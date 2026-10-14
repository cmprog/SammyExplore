// The sky and garden seen through the room's window, for the current time of day. Drawn in the
// room backdrop's pass, before the wall: the wall is opaque except for the glass, so only the
// part behind the glass ever shows.
//
// Reuses the outdoor sky's art: the moon, glints (twinkles, moon glow), clouds, and sun rays
// come from art/backdropSky.js and art/drawBackdrop.js; the scenery uses the outdoor palettes.
// Baked once: stars, scenery (night and day colors), moon, sun, clouds. Live each frame: the
// sky gradient, the sun and moon moving across the sky, twinkles, drifting clouds, and
// cross-fades between night and day. Far things shift a little with the camera, for depth.
import {
    vec2, rgb, TextureInfo, TileInfo, RandomGenerator, drawTile, drawRectGradient, worldToScreen,
    cameraPos, cameraScale, clamp, time, WHITE,
} from 'littlejs';
import { BACKDROP_PALETTES } from '../data/palettes.js';
import { ROOM_WINDOW } from '../data/tuning.js';
import { bakeMoon, bakeClouds, bakeGlints, makeTwinkles, GLINT_CELL, GLINT_KINDS } from '../art/backdropSky.js';
import { drawTwinkles, drawMoon, drawSunRays } from '../art/drawBackdrop.js';
import { bakeSunSprite, drawWindowStars, drawWindowScenery } from '../art/room/windowSky.js';
import { bakeWorldRect, destroySprites, SmoothTexture } from './worldBake.js';

const { night: NIGHT, day: DAY } = BACKDROP_PALETTES;
const SEED = 4242;
const HORIZON = 2.0;          // tiles above the bottom of the glass where the hills meet the sky
const SCENERY_TOP = 5.2;      // the tallest tree, above the bottom of the glass
const BODY_INSET = .12;       // fraction of the glass the sun and moon stay clear of (the curtains hang there)
const SUN_RAYS = { rays: 10, raySpinSeconds: 90 };
const MOON_PULSE = 7;
const CLOUDS = { count: 4, scale: .38 };

export class WindowView
{
    /** @param {{glass: {x0, y0, x1, y1}}} geometry  @param {object} viewPalette - roomPalette.view */
    constructor(geometry, viewPalette)
    {
        this.glass = geometry.glass;
        const g = this.glass, margin = ROOM_WINDOW.PARALLAX_MAX + .2;
        this.center = vec2((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2);
        this.horizon = g.y0 + HORIZON;
        this.textures = [];
        const area = { x0: g.x0 - margin, y0: g.y0 - margin, x1: g.x1 + margin, y1: g.y1 + margin };
        this.stars = bakeWorldRect(area.x0, area.y0, area.x1, area.y1, ctx => drawWindowStars(ctx, area, NIGHT));
        const sceneryArea = { ...area, y1: g.y0 + SCENERY_TOP };
        this.night = bakeWorldRect(sceneryArea.x0, sceneryArea.y0, sceneryArea.x1, sceneryArea.y1,
            ctx => drawWindowScenery(ctx, sceneryArea, this.horizon, NIGHT, viewPalette.night, true));
        this.day = bakeWorldRect(sceneryArea.x0, sceneryArea.y0, sceneryArea.x1, sceneryArea.y1,
            ctx => drawWindowScenery(ctx, sceneryArea, this.horizon, DAY, viewPalette.day, false));
        const bodyPixels = ROOM_WINDOW.BODY_SIZE * cameraScale;
        this.moon = this.toLayer(bakeMoon(bodyPixels, NIGHT));
        this.sun = this.toLayer(bakeSunSprite(bodyPixels, DAY));
        this.bakeGlints();
        const rng = new RandomGenerator(SEED);
        const width = (g.x1 - g.x0) * cameraScale;
        this.twinkles = makeTwinkles({ twinkleCount: 7, height: (g.y1 - g.y0 - HORIZON) * cameraScale }, rng, width);
        this.cloudBand = g.x1 - g.x0 + 4;
        this.clouds = bakeClouds(this.cloudBand * cameraScale, { ...CLOUDS, top: 0, height: 1 }, DAY, rng)
            .map(({ strip, x }, i) => ({ layer: this.toLayer(strip), x: x / cameraScale, y: g.y1 - 1 - (i % 2) * 1.6 - rng.float(0, .8) }));
    }

    toLayer(strip)
    {
        if (!strip)
            return null;
        const textureInfo = new TextureInfo(strip.canvas);
        this.textures.push(textureInfo);
        return { tile: new TileInfo().setFullImage(textureInfo), width: strip.width, height: strip.height };
    }

    bakeGlints()
    {
        const layer = this.toLayer(bakeGlints());
        if (!layer)
            return;
        this.glintSmoother = new SmoothTexture(layer.tile.textureInfo);
        this.glints = {};
        GLINT_KINDS.forEach((kind, i) =>
            this.glints[kind] = new TileInfo(vec2(i * GLINT_CELL, 0), vec2(GLINT_CELL), layer.tile.textureInfo, 0, 0));
    }

    destroy()
    {
        this.textures.forEach(texture => texture.destroyWebGLTexture());
        this.textures = [];
        [this.stars, this.night, this.day].forEach(destroySprites);
    }

    /** Where a sky body is, in world space: rising behind the hills at the left, over the top,
     *  and setting at the right. It climbs quickly, so a low sun still peeks over the hills. */
    bodyPos({ u, up }, parallax)
    {
        const g = this.glass;
        const inset = (g.x1 - g.x0) * BODY_INSET;
        return vec2(g.x0 + inset + u * (g.x1 - g.x0 - inset * 2), this.horizon - .6 + up ** .55 * (g.y1 - this.horizon - .2)).add(parallax);
    }

    /** @param {object} look - DayCycle look  @param {{sun, moon}} bodies - DayCycle.body() results */
    render(look, bodies)
    {
        if (!this.glints)
            return;
        this.glintSmoother.apply();
        const g = this.glass, offset = cameraPos.subtract(this.center);
        const shift = k => vec2(clamp(offset.x * k, -ROOM_WINDOW.PARALLAX_MAX, ROOM_WINDOW.PARALLAX_MAX),
            clamp(offset.y * k, -ROOM_WINDOW.PARALLAX_MAX, ROOM_WINDOW.PARALLAX_MAX));
        const sky = shift(ROOM_WINDOW.SKY_PARALLAX), view = shift(ROOM_WINDOW.VIEW_PARALLAX);
        this.renderSky(look, g);
        if (look.stars > .01)
        {
            this.stars.forEach(s => drawTile(s.pos.add(sky), s.size, s.tile, WHITE.withAlpha(look.stars)));
            const corner = worldToScreen(vec2(g.x0, g.y1).add(sky));
            drawTwinkles(this.twinkles, this.glints, NIGHT, time, corner, look.stars);
        }
        if (bodies.moon && this.moon)
        {
            const pos = worldToScreen(this.bodyPos(bodies.moon, sky));
            drawMoon(this.moon, this.glints, pos, ROOM_WINDOW.BODY_SIZE * cameraScale, NIGHT, MOON_PULSE, time);
        }
        if (bodies.sun && this.sun)
            this.renderSun(bodies.sun, sky);
        this.renderClouds(look, sky);
        // Night scenery underneath, day scenery fading in over it.
        this.night.forEach(s => drawTile(s.pos.add(view), s.size, s.tile, look.viewTint));
        if (look.dayView > .01)
            this.day.forEach(s => drawTile(s.pos.add(view), s.size, s.tile, look.viewTint.withAlpha(look.dayView)));
    }

    renderSky(look, g)
    {
        // Two gradients, top to middle and middle to horizon, a little bigger than the glass.
        const mid = this.horizon + (g.y1 - this.horizon) * .45;
        const x = (g.x0 + g.x1) / 2, w = g.x1 - g.x0 + 1;
        drawRectGradient(vec2(x, (mid + g.y1 + .5) / 2), vec2(w, g.y1 + .5 - mid), look.skyTop, look.skyMid);
        drawRectGradient(vec2(x, (g.y0 - .5 + mid) / 2), vec2(w, mid - g.y0 + .5), look.skyMid, look.skyHorizon);
    }

    renderSun(body, sky)
    {
        const size = ROOM_WINDOW.BODY_SIZE * cameraScale;
        const pos = this.bodyPos(body, sky);
        // Low in the sky the sun turns warm orange.
        const low = 1 - body.up;
        const tint = rgb(1, 1 - low * .3, 1 - low * .55);
        drawSunRays(worldToScreen(pos), size, DAY, SUN_RAYS, time);
        drawTile(pos, vec2(this.sun.width, this.sun.height).scale(1 / cameraScale), this.sun.tile, tint);
    }

    renderClouds(look, sky)
    {
        if (look.clouds < .01)
            return;
        const g = this.glass, color = look.viewTint.withAlpha(look.clouds);
        for (const cloud of this.clouds)
        {
            if (!cloud.layer)
                continue;
            const x = g.x0 - 2 + wrap(cloud.x + time * ROOM_WINDOW.CLOUD_DRIFT, this.cloudBand);
            const size = vec2(cloud.layer.width, cloud.layer.height).scale(1 / cameraScale);
            drawTile(vec2(x, cloud.y).add(sky), size, cloud.layer.tile, color);
        }
    }

    debugState()
    {
        return { glass: { ...this.glass }, textures: this.textures.length + this.stars.length + this.night.length + this.day.length };
    }
}

function wrap(value, period)
{
    return ((value % period) + period) % period;
}
