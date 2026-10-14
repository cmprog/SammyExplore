// Room lighting, using the engine's LightSystem plugin: the scene is drawn at full brightness
// and then multiplied by a light map. The map starts at the time of day's `ambient` color
// (dayCycle.js) and every light here adds onto it:
//   - the window glass at full light (the sky keeps its own colors), with a soft spill around it
//   - a shaft of sun or moon light slanting in through the window
//   - the nightlight's warm pool when it's on (it clicks on in the evening, off in the morning)
//   - the fairy lights' little glows at night
// Measured cheap: the map is a quarter-size texture (ROOM_LIGHT.LIGHTMAP_SCALE), so it costs one
// small clear, a few dozen soft sprites, and one full-screen multiply per frame.
//
// It also draws, in the normal pass under the characters: the nightlight lamp itself, the halos
// of the lit fairy bulbs, and dust motes drifting in a sunbeam.
// The plugin is global: it is created the first time a room needs it and switched off whenever
// no room is showing (title screen, outdoor levels).
import {
    EngineObject, LightSystemPlugin, lightSystem, vec2, rgb, drawTile, drawRect, isOnScreen,
    mainCanvasSize, clamp, time, TileInfo, TextureInfo, WHITE,
} from 'littlejs';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { ROOM_LIGHT } from '../data/tuning.js';
import { bakeGlints, GLINT_CELL, GLINT_KINDS } from '../art/backdropSky.js';
import { drawNightlight, nightlightGlowPos } from '../art/room/drawNightlight.js';
import { fairyBulbs } from '../art/room/decorWall.js';
import { SmoothTexture } from './worldBake.js';

// The light shaft's layers: [center along the shaft, width, length (fractions), share of strength].
const BEAM_LAYERS = [[.45, 1.5, 1.15, .6], [.3, .9, .7, .5]];

export class RoomLighting extends EngineObject
{
    /** @param {object} layout - systems/roomLayout.js  @param {object} palette  @param {DayCycle} cycle */
    constructor(layout, palette, cycle)
    {
        super(vec2(), vec2(), undefined, 0, undefined, RENDER_ORDER.roomLights);
        this.mass = 0;
        this.gravityScale = 0;
        this.layout = layout;
        this.palette = palette;
        this.cycle = cycle;
        this.bulbs = layout.decor.filter(item => item.kind === 'fairyLights').flatMap(fairyBulbs)
            .map(bulb => ({ ...bulb, pos: vec2(bulb.x, bulb.y), tint: palette.bulbs[bulb.color].copy() }));
        this.bulbHalo = vec2(.75);
        this.bulbLight = vec2(ROOM_LIGHT.FAIRY_RADIUS * 2);
        this.nightlight = cycle.nightlightOn ? 1 : 0;   // a visit at night starts with it already on
        this.popAge = Infinity;
        this.beam = null;
        this.motes = Array.from({ length: ROOM_LIGHT.MOTES }, (_, i) => ({ t: (i * .618) % 1, s: ((i * .37) % 1) - .5, speed: .02 + (i % 5) * .006, phase: i * 1.3 }));
        this.bakeGlow();
        enableLighting(cycle.look.ambient);
    }

    bakeGlow()
    {
        const strip = bakeGlints();
        if (!strip)
            return;
        this.glowTexture = new TextureInfo(strip.canvas);
        this.smoother = new SmoothTexture(this.glowTexture);
        const index = GLINT_KINDS.indexOf('glow'), dot = GLINT_KINDS.indexOf('dot');
        this.glow = new TileInfo(vec2(index * GLINT_CELL, 0), vec2(GLINT_CELL), this.glowTexture, 0, 0);
        this.dot = new TileInfo(vec2(dot * GLINT_CELL, 0), vec2(GLINT_CELL), this.glowTexture, 0, 0);
    }

    destroy()
    {
        if (this.destroyed)
            return;
        this.glowTexture?.destroyWebGLTexture();
        disableLighting();
        super.destroy();
    }

    /** Once per update step (the host's tick), after the day cycle has moved. */
    tick(dt)
    {
        const target = this.cycle.nightlightOn ? 1 : 0;
        if (target && this.nightlight === 0)
            this.popAge = 0;
        this.nightlight = clamp(this.nightlight + Math.sign(target - this.nightlight) * dt / ROOM_LIGHT.NIGHTLIGHT_FADE, 0, 1);
        this.popAge += dt;
        this.beam = this.beamGeometry();
    }

    /** The light shaft through the window: from the sun if it's up, else the moon. */
    beamGeometry()
    {
        const glass = this.layout.window?.glass;
        const body = this.cycle.body('sun') ?? this.cycle.body('moon');
        const look = this.cycle.look;
        if (!glass || !body || look.beam.a <= 0)
            return null;
        // Light travels away from the body: a morning sun on the left shines down to the right.
        const slant = clamp(Math.PI / 2 - Math.PI * body.u, -ROOM_LIGHT.BEAM_MAX_SLANT, ROOM_LIGHT.BEAM_MAX_SLANT);
        const dir = vec2(Math.sin(slant), -Math.cos(slant));
        const start = vec2((glass.x0 + glass.x1) / 2, (glass.y0 + glass.y1) / 2);
        return {
            start, dir, slant,
            width: (glass.x1 - glass.x0) * .8,
            strength: look.beam.a * Math.sqrt(body.up),
            sun: !!this.cycle.body('sun'),
        };
    }

    // --- normal pass: the lamp, bulb halos, dust motes ------------------------------------------

    render()
    {
        if (lightSystem)
            lightSystem.ambientColor.setFrom(this.cycle.look.ambient);   // the map clears to this
        this.smoother?.apply();
        const look = this.cycle.look;
        if (this.layout.nightlight)
        {
            const { x, base } = this.layout.nightlight;
            const pop = clamp(1 - this.popAge / ROOM_LIGHT.NIGHTLIGHT_POP, 0, 1);
            drawNightlight(vec2(x, base), { on: this.nightlight, pop, glow: this.glow }, time, this.palette.nightlight, this.palette.outline);
        }
        if (this.glow && look.fairy > .02)
            this.renderBulbs(this.bulbHalo, .6 * look.fairy);
        if (this.glow && this.beam?.sun && this.beam.strength > .05)
            this.renderMotes(this.beam);
    }

    /** The fairy bulbs that are on screen, each a soft glow of its own color, gently twinkling. */
    renderBulbs(size, strength)
    {
        for (const bulb of this.bulbs)
        {
            if (!isOnScreen(bulb.pos, size))
                continue;
            bulb.tint.a = strength * (1 - ROOM_LIGHT.FAIRY_TWINKLE * (.5 + .5 * Math.sin(time * 1.3 + bulb.phase)));
            drawTile(bulb.pos, size, this.glow, bulb.tint);
        }
    }

    /** Dust specks floating slowly down the sunbeam, fading in and out along it. */
    renderMotes(beam)
    {
        const across = vec2(-beam.dir.y, beam.dir.x);
        for (const mote of this.motes)
        {
            const t = (mote.t + time * mote.speed) % 1;
            const s = mote.s + Math.sin(time * .7 + mote.phase) * .08;
            const pos = beam.start.add(beam.dir.scale(1.5 + t * (ROOM_LIGHT.BEAM_LENGTH - 4))).add(across.scale(s * beam.width * .7));
            const fade = Math.sin(t * Math.PI) * beam.strength * 2.2;
            drawTile(pos, vec2(.09), this.dot, rgb(1, .97, .85, clamp(fade, 0, .8)));
        }
    }

    // --- the light map (called by the LightSystem plugin, additive) -----------------------------

    renderLight()
    {
        if (!this.glow)
            return;
        const look = this.cycle.look;
        const glass = this.layout.window?.glass;
        if (glass)
        {
            const center = vec2((glass.x0 + glass.x1) / 2, (glass.y0 + glass.y1) / 2);
            drawRect(center, vec2(glass.x1 - glass.x0, glass.y1 - glass.y0), WHITE);
            drawTile(center, vec2(ROOM_LIGHT.WINDOW_GLOW * 2), this.glow, look.spill);
        }
        if (this.beam)
            this.renderBeam(this.beam, look.beam);
        if (this.layout.nightlight && this.nightlight > 0)
        {
            const { x, base } = this.layout.nightlight, glowColor = this.palette.nightlight.glow;
            const pos = nightlightGlowPos(vec2(x, base));
            const breathe = 1 + Math.sin(time * 1.7) * ROOM_LIGHT.NIGHTLIGHT_FLICKER;
            drawTile(pos, vec2(ROOM_LIGHT.NIGHTLIGHT_RADIUS * 2 * breathe), this.glow, glowColor.withAlpha(ROOM_LIGHT.NIGHTLIGHT_STRENGTH * this.nightlight));
            drawTile(pos, vec2(ROOM_LIGHT.NIGHTLIGHT_CORE * 2), this.glow, WHITE.withAlpha(this.nightlight));
        }
        if (look.fairy > .02)
            this.renderBulbs(this.bulbLight, ROOM_LIGHT.FAIRY_STRENGTH * look.fairy);
    }

    /** Soft glows stretched along the shaft: brightest near the window, fading toward the floor. */
    renderBeam(beam, color)
    {
        const length = ROOM_LIGHT.BEAM_LENGTH;
        for (const [along, width, stretch, share] of BEAM_LAYERS)
        {
            const center = beam.start.add(beam.dir.scale(length * along));
            drawTile(center, vec2(beam.width * width, length * stretch), this.glow, color.withAlpha(beam.strength * share), -beam.slant);
        }
    }

    debugState()
    {
        return {
            lighting: !!lightSystem?.enabled,
            ambient: colorData(this.cycle.look.ambient),
            nightlight: Math.round(this.nightlight * 100) / 100,
            beam: this.beam ? { from: this.beam.sun ? 'sun' : 'moon', strength: Math.round(this.beam.strength * 100) / 100 } : null,
            fairy: Math.round(this.cycle.look.fairy * 100) / 100,
            bulbs: this.bulbs.length,
        };
    }
}

function colorData(c)
{
    return { r: Math.round(c.r * 100) / 100, g: Math.round(c.g * 100) / 100, b: Math.round(c.b * 100) / 100 };
}

/** Turn the global light system on (creating it the first time a room needs it). */
function enableLighting(ambient)
{
    if (!lightSystem)
        new LightSystemPlugin(mainCanvasSize.scale(ROOM_LIGHT.LIGHTMAP_SCALE).floor(), ambient);
    lightSystem.enabled = true;
    lightSystem.ambientColor.setFrom(ambient);
}

function disableLighting()
{
    if (lightSystem)
        lightSystem.enabled = false;
}
