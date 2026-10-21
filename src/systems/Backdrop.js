// The scenery behind a level: sky, moon or sun, stars or clouds, and parallax hills, trees and
// bushes. Drawn in screen space behind the terrain.
//
// Performance: everything static is baked once into textures (drawing it live would be hundreds
// of shapes a frame), and the textures are cut to the band each layer actually shows, because
// fill rate is what costs on slow or software-rendered GPUs. Each frame blits the textures at
// their parallax offsets and draws only the cheap animated bits (twinkles, moon glow, sun rays,
// fireflies). If vertical parallax pulls two layers apart, a plain band in the farther layer's
// bottom color fills the gap.
import {
    EngineObject, TextureInfo, TileInfo, RandomGenerator, vec2, time,
    cameraPos, cameraScale, getCameraSize, mainCanvasSize,
} from 'littlejs';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { BACKDROP_PALETTES } from '../data/palettes.js';
import { BACKDROP_LAYOUT, BACKDROP_STRIP_WIDTH, BACKDROP_SEED } from '../data/backdrop.js';
import { createStrip, trimStrip, opaqueFrom } from '../art/backdropStrip.js';
import { bakeHills, bakeTrees, bakeBushes } from '../art/backdropScenery.js';
import {
    bakeSky, bakeMoon, bakeClouds, bakeGlints, makeTwinkles, makeFireflies, GLINT_CELL, GLINT_KINDS,
} from '../art/backdropSky.js';
import {
    drawSprite, drawStrip, drawBand, drawClouds, drawTwinkles, drawMoon, drawSunRays, drawFireflies,
} from '../art/drawBackdrop.js';
import { SmoothTexture } from './worldBake.js';

const DEFAULT_TIME_OF_DAY = 'night';
const SCENERY = [
    { name: 'hills', bake: bakeHills, seed: 20 },
    { name: 'trees', bake: bakeTrees, seed: 21 },
    { name: 'bushes', bake: bakeBushes, seed: 22 },
];

export class Backdrop extends EngineObject
{
    /**
     * @param {string} timeOfDay - a key of BACKDROP_PALETTES (data/palettes.js)
     * @param {{layout?: object}} [options] - layout: per-key overrides merged into BACKDROP_LAYOUT
     *   (e.g. the title screen's moon position, TITLE_BACKDROP_LAYOUT)
     */
    constructor(timeOfDay, { layout = {} } = {})
    {
        super(vec2(), vec2(), undefined, 0, undefined, RENDER_ORDER.backdrop);
        this.mass = 0;            // scenery, not a physics object
        this.gravityScale = 0;
        if (!BACKDROP_PALETTES[timeOfDay])
            console.warn(`backdrop: no palette for timeOfDay "${timeOfDay}", using ${DEFAULT_TIME_OF_DAY}`);
        this.timeOfDay = BACKDROP_PALETTES[timeOfDay] ? timeOfDay : DEFAULT_TIME_OF_DAY;
        this.palette = BACKDROP_PALETTES[this.timeOfDay];
        this.layout = mergeLayout(BACKDROP_LAYOUT, layout);
        this.textures = [];       // every TextureInfo we made, freed in destroy()
        this.scenery = [];        // { layer, layout } far to near
        this.clouds = [];         // { layout, sprites } per cloud band
        this.twinkles = [];
        this.fireflies = [];
        const start = performance.now();
        try { this.bake(); }
        catch (error)
        {
            this.destroy();       // free the textures baked so far
            throw error;
        }
        this.bakeMs = Math.round(performance.now() - start);
    }

    get night() { return this.timeOfDay === 'night'; }

    destroy()
    {
        if (this.destroyed)
            return;
        this.textures.forEach(texture => texture.destroyWebGLTexture());
        this.textures = [];
        super.destroy();
    }

    // --- baking -----------------------------------------------------------------------------------

    bake()
    {
        const seeded = offset => new RandomGenerator(BACKDROP_SEED + offset);
        const layout = this.layout;
        this.sky = this.toLayer(bakeSky(mainCanvasSize.x, layout, this.palette, seeded(1), this.night));
        if (this.night)
        {
            this.moon = this.toLayer(bakeMoon(layout.moon.size, this.palette));
            this.glints = this.toGlints(bakeGlints());
            this.twinkles = makeTwinkles(layout.stars, seeded(2), mainCanvasSize.x);
            this.fireflies = makeFireflies(layout.fireflies, seeded(3), BACKDROP_STRIP_WIDTH);
        }
        else
            this.clouds = layout.clouds.map((band, i) => ({
                layout: band,
                sprites: bakeClouds(BACKDROP_STRIP_WIDTH, band, this.palette, seeded(10 + i))
                    .map(({ strip, x, y }) => ({ layer: this.toLayer(strip), x, y })),
            }));
        for (const { name, bake, seed } of SCENERY)
        {
            const bandLayout = layout[name];
            const strip = createStrip(BACKDROP_STRIP_WIDTH, bandLayout.top, bandLayout.bottom);
            if (!strip)
                continue;    // no canvas support (headless): nothing to show
            const { solidBelowY, bottomColor } = bake(strip, bandLayout, this.palette, seeded(seed));
            const trimmed = trimStrip(strip);
            const layer = { ...this.toLayer(trimmed), opaqueFrom: opaqueFrom(trimmed, solidBelowY), bottomColor };
            layer.columns = trimmed.columns.map(column => ({ ...column,
                tile: new TileInfo(vec2(column.x, column.top), vec2(column.width, trimmed.height - column.top), layer.tile.textureInfo, 0, 0) }));
            // The strip's top moved down by the trim; keep its parallax anchored to the layout.
            this.scenery.push({ name, layout: bandLayout, trim: trimmed.top - bandLayout.top, layer });
        }
    }

    toLayer(strip)
    {
        if (!strip)
            return null;
        const textureInfo = new TextureInfo(strip.canvas);
        this.textures.push(textureInfo);
        return { tile: new TileInfo().setFullImage(textureInfo), width: strip.width, height: strip.height };
    }

    /** Tile per glint kind. Linear filtering, since glints are drawn at many sizes and the
     *  engine's pixel-art (nearest) filtering would make them blocky. */
    toGlints(strip)
    {
        const layer = this.toLayer(strip);
        if (!layer)
            return null;
        this.glintSmoother = new SmoothTexture(layer.tile.textureInfo);
        this.glintSmoother.apply();
        const glints = {};
        GLINT_KINDS.forEach((kind, i) =>
            glints[kind] = new TileInfo(vec2(i * GLINT_CELL, 0), vec2(GLINT_CELL), layer.tile.textureInfo, 0, 0));
        return glints;
    }

    // --- drawing --------------------------------------------------------------------------------

    render()
    {
        if (!this.sky)
            return;
        // Every frame: the engine resets texture filtering after a WebGL context restore.
        this.glintSmoother?.apply();
        // Camera offset from the level's bottom-left view, in screen pixels. Layers only ever move
        // down (camera going up), so their baked bottoms are only exposed if parallax opens a gap.
        const half = getCameraSize().scale(.5);
        const camera = vec2((cameraPos.x - half.x) * cameraScale, Math.max(0, cameraPos.y - half.y) * cameraScale);
        drawSprite(this.sky, this.sky.width / 2, this.sky.height / 2);
        this.night ? this.renderNightSky() : this.renderDaySky(camera);
        this.renderScenery(camera);
        if (this.night)
        {
            const { parallax } = this.layout.fireflies;
            drawFireflies(this.fireflies, this.glints, this.palette, camera.x * parallax, BACKDROP_STRIP_WIDTH, camera.y * parallax, time);
        }
    }

    renderNightSky()
    {
        const { moon } = this.layout;
        drawTwinkles(this.twinkles, this.glints, this.palette, time);
        drawMoon(this.moon, this.glints, vec2(moon.x, moon.y), moon.size, this.palette, moon.pulseSeconds, time);
    }

    renderDaySky(camera)
    {
        const { sun } = this.layout;
        drawSunRays(vec2(sun.x, sun.y), sun.size, this.palette, sun, time);
        for (const { layout, sprites } of this.clouds)
            drawClouds(sprites, camera.x * layout.parallax + time * layout.drift, BACKDROP_STRIP_WIDTH);
    }

    renderScenery(camera)
    {
        let gapTop = this.sky.height, gapColor = this.palette.skyHorizon;
        for (const { layout, layer, trim } of this.scenery)
        {
            const top = layout.top + trim + camera.y * layout.parallax;
            drawBand(gapTop, top + layer.opaqueFrom, gapColor);
            drawStrip(layer, camera.x * layout.parallax, top);
            gapTop = top + layer.height;
            gapColor = layer.bottomColor;
        }
        drawBand(gapTop, mainCanvasSize.y, gapColor);
    }

    /** Plain-data view for window.__sammy.backdrop. */
    debugState()
    {
        return {
            timeOfDay: this.timeOfDay,
            layers: [this.sky && 'sky', this.moon && 'moon', ...this.clouds.map((_, i) => `clouds${i}`),
                ...this.scenery.map(s => s.name)].filter(Boolean),
            textures: this.textures.length,
            bakeMs: this.bakeMs,
        };
    }
}

/** Shallow per-key merge: { moon: { x } } replaces only the moon's x. */
function mergeLayout(base, overrides)
{
    const merged = { ...base };
    for (const [key, value] of Object.entries(overrides))
        merged[key] = Array.isArray(value) || typeof value !== 'object' ? value : { ...base[key], ...value };
    return merged;
}
