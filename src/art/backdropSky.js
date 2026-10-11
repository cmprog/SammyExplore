// Sky art, baked once per level load: the sky texture (gradient, stars, and the moon's or sun's
// halo), the moon itself, and one small sprite per cloud. Also the little descriptors for what is
// animated live (twinkling stars, fireflies). Pure functions of (layout, palette, rng).
// Heights are bake coordinates: y up from the screen bottom (see backdropStrip.js).
import { vec2, rgb, drawCircle, drawCircleGradient, drawPoly, BLACK } from '../../lib/littlejs/littlejs.esm.js';
import { createStrip, stripCircle, stripEllipse, stripGlow, stripGradient } from './backdropStrip.js';

const SCREEN_HEIGHT = 1080;

// --- the sky texture ---------------------------------------------------------------------------

/** Gradient sky plus everything in it that never moves: stars and the moon's or sun's halo. */
export function bakeSky(width, layout, palette, rng, night)
{
    const { midY, horizonY } = layout.sky;
    const strip = createStrip(width, 0, horizonY);
    if (!strip)
        return null;
    const y = screenY => SCREEN_HEIGHT - screenY;
    stripGradient(strip, y(horizonY), y(0), [palette.skyHorizon, palette.skyMid, palette.skyTop], [0, 1 - midY / horizonY, 1]);
    if (night)
    {
        bakeStars(strip, layout.stars, palette, rng);
        bakeHalo(strip, layout.moon, palette.moonHalo, [[4.6, .10], [2.6, .16], [1.6, .22]]);
    }
    else
        bakeSunInSky(strip, layout.sun, palette);
    return strip;
}

/** Soft glow rings around a sky body; [diameter in body sizes, alpha] from the outside in. */
function bakeHalo(strip, body, color, rings)
{
    for (const [scale, alpha] of rings)
        stripGlow(strip, body.x, SCREEN_HEIGHT - body.y, body.size * scale, color.withAlpha(alpha));
}

/** Lots of tiny steady stars, denser and brighter high up, fading out toward the horizon. */
function bakeStars(strip, layout, palette, rng)
{
    for (let i = 0; i < layout.count; i++)
    {
        const depth = rng.float() ** 1.5;             // 0 = top of the sky, 1 = the horizon
        const y = SCREEN_HEIGHT - layout.height * depth;
        const fade = 1 - depth * .8;
        const color = (rng.bool(.3) ? palette.starCool : palette.star).withAlpha(rng.float(.35, .9) * fade);
        const size = rng.float(1.6, 3.6);
        const x = rng.float(0, strip.width);
        stripCircle(strip, x, y, size, color);
        if (size > 3.1)   // a few get a faint glow
            stripGlow(strip, x, y, size * 5, color.withAlpha(.18 * fade));
    }
}

function bakeSunInSky(strip, sun, palette)
{
    bakeHalo(strip, sun, palette.sunHalo, [[5.5, .35], [2.6, .45]]);
    const y = SCREEN_HEIGHT - sun.y;
    stripCircle(strip, sun.x, y, sun.size, palette.sunRim);
    stripCircle(strip, sun.x, y, sun.size * .9, palette.sun);
    stripGlow(strip, sun.x - sun.size * .08, y + sun.size * .08, sun.size * .7, palette.sunCore);
}

/** The bigger stars that twinkle live, in screen pixels. */
export function makeTwinkles(layout, rng, width)
{
    const twinkles = [];
    for (let i = 0; i < layout.twinkleCount; i++)
        twinkles.push({
            x: rng.float(0, width),
            y: layout.height * rng.float() ** 1.4 * .85,
            size: rng.float(3, 6.5),
            speed: rng.float(1.2, 3),
            phase: rng.float(0, Math.PI * 2),
            sparkle: rng.bool(.35),
            cool: rng.bool(.3),
        });
    return twinkles;
}

// --- the moon ------------------------------------------------------------------------------------

/** A soft, round full moon with gentle craters and a pearly highlight. */
export function bakeMoon(size, palette)
{
    const canvasSize = Math.ceil(size * 1.1);
    const strip = createStrip(canvasSize, 0, canvasSize);
    if (!strip)
        return null;
    const c = canvasSize / 2;
    const circle = (x, y, d, color) => drawCircle(vec2(c + x, c + y), d, color, 0, BLACK, false, true, strip.ctx);
    circle(0, 0, size, palette.moonShade);
    // Lit body nudged up-left so the shade shows as a soft crescent on the lower right.
    circle(-size * .03, -size * .03, size * .94, palette.moon);
    const craters = [[.2, -.1, .17], [-.17, .2, .13], [.08, .3, .08], [-.25, -.16, .08], [.28, .19, .06]];
    for (const [x, y, d] of craters)
    {
        circle(x * size + 1.5, y * size + 1.5, d * size, palette.moonCraterRim);
        circle(x * size, y * size, d * size * .96, palette.moonCrater);
    }
    drawCircleGradient(vec2(c - size * .18, c - size * .2), size * .5,
        palette.moonCraterRim.withAlpha(.65), palette.moonCraterRim.withAlpha(0), false, true, strip.ctx);
    return strip;
}

// --- clouds ------------------------------------------------------------------------------------

/**
 * Fluffy cartoon clouds: puffs on a flat-ish bottom, a soft outline and a shaded underside.
 * Each cloud is its own small sprite, so the empty sky between clouds costs nothing to draw.
 * @returns {{strip, x: number, y: number}[]} x along the repeating cloud band, y = screen center
 */
export function bakeClouds(bandWidth, layout, palette, rng)
{
    const spacing = bandWidth / layout.count;
    const sprites = [];
    for (let i = 0; i < layout.count; i++)
    {
        const cloud = makeCloud(rng, layout.scale);
        const screenY = layout.top + rng.float(.15, .85) * layout.height;
        const strip = createStrip(Math.ceil(cloud.width), screenY - cloud.height / 2, screenY + cloud.height / 2);
        if (!strip)
            return [];
        bakeCloud(strip, cloud, SCREEN_HEIGHT - screenY, palette);
        sprites.push({ strip, x: (i + rng.float(.1, .7)) * spacing, y: screenY });
    }
    return sprites;
}

function makeCloud(rng, scale)
{
    const width = rng.float(240, 400) * scale;
    const puffs = [{ x: 0, y: width * .1, d: width * .48 }];
    const count = rng.int(4, 7);
    for (let i = 0; i < count; i++)
    {
        const t = (i / (count - 1)) * 2 - 1;     // -1 .. 1 across the cloud
        puffs.push({ x: t * width * .36, y: (1 - Math.abs(t)) * width * .07 - width * .03, d: width * rng.float(.24, .34) * (1.15 - Math.abs(t) * .4) });
    }
    // Sprite bounds: puffs plus outline, with a little air.
    const left = Math.min(...puffs.map(p => p.x - p.d / 2)), right = Math.max(...puffs.map(p => p.x + p.d / 2));
    const top = Math.max(...puffs.map(p => p.y + p.d / 2)), bottom = Math.min(...puffs.map(p => p.y - p.d / 2));
    const pad = 12;
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2;
    puffs.forEach(p => { p.x -= centerX; p.y -= centerY; });
    return { puffs, width: right - left + pad * 2, height: top - bottom + pad * 2 };
}

function bakeCloud(strip, cloud, centerY, palette)
{
    const cx = strip.width / 2;
    const pass = (grow, dy, scale, color) => cloud.puffs.forEach(p =>
        stripCircle(strip, cx + p.x, centerY + p.y + dy, p.d * scale + grow, color));
    pass(8, 0, 1, palette.cloudOutline);
    pass(0, 0, 1, palette.cloudShade);
    // Main puffs nudged up and in, so the shade peeks out along the bottom like a soft shadow.
    pass(0, 5, .92, palette.cloud);
    // Little glossy highlights on the top puffs.
    cloud.puffs.slice(0, 3).forEach(p =>
        stripEllipse(strip, cx + p.x - p.d * .14, centerY + p.y + p.d * .2, p.d * .3, p.d * .16, palette.cloud));
}

// --- glints ------------------------------------------------------------------------------------

/** Cell size of the glint atlas: a soft glow, a round dot, and a four-pointed sparkle, in white. */
export const GLINT_CELL = 64;
export const GLINT_KINDS = ['glow', 'dot', 'sparkle'];

/**
 * Small white sprites that every twinkle and firefly is drawn from, tinted per draw. Drawing
 * them as textured quads from one texture keeps all of them in a single GPU batch.
 */
export function bakeGlints()
{
    const strip = createStrip(GLINT_CELL * GLINT_KINDS.length, 0, GLINT_CELL);
    if (!strip)
        return null;
    const ctx = strip.ctx, c = GLINT_CELL / 2, white = rgb(1, 1, 1);
    // Glow: a soft core inside a wide falloff.
    drawCircleGradient(vec2(c), GLINT_CELL - 4, white.withAlpha(.6), white.withAlpha(0), false, true, ctx);
    drawCircleGradient(vec2(c), GLINT_CELL * .45, white.withAlpha(.6), white.withAlpha(0), false, true, ctx);
    drawCircle(vec2(GLINT_CELL + c, c), GLINT_CELL - 8, white, 0, BLACK, false, true, ctx);
    const sparkle = vec2(GLINT_CELL * 2 + c, c), long = c - 3, thin = long * .16;
    drawPoly([vec2(0, long), vec2(thin, 0), vec2(0, -long), vec2(-thin, 0)], white, 0, BLACK, sparkle, 0, false, true, ctx);
    drawPoly([vec2(long, 0), vec2(0, thin), vec2(-long, 0), vec2(0, -thin)], white, 0, BLACK, sparkle, 0, false, true, ctx);
    return strip;
}

// --- fireflies ---------------------------------------------------------------------------------

/** Fireflies wander on slow loops and blink on and off. x is along a repeating band, y in screen pixels. */
export function makeFireflies(layout, rng, width)
{
    const flies = [];
    for (let i = 0; i < layout.count; i++)
        flies.push({
            x: rng.float(0, width),
            y: rng.float(layout.top, layout.bottom),
            rangeX: rng.float(30, 90),
            rangeY: rng.float(15, 45),
            speed: rng.float(.15, .35),
            phase: rng.float(0, Math.PI * 2),
            blinkSpeed: rng.float(.6, 1.3),
            blinkPhase: rng.float(0, Math.PI * 2),
            size: rng.float(6, 9),
        });
    return flies;
}

