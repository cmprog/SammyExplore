// What you see out of the window, baked: the sun sprite, a field of stars, and the scenery (a
// far ridge, rolling hills, the neighbor's little house, trees, and the garden fence), once in
// night colors and once in day colors so the view can cross-fade as the day turns.
// The sky gradient, moon, twinkles, sun rays, and clouds are drawn live by systems/WindowView.js
// with the outdoor backdrop's own drawing (art/backdropSky.js, art/drawBackdrop.js).
// World units, y up; `rect` is the area to cover {x0, y0, x1, y1} (the glass plus a margin).
import { vec2, drawCircleGradient } from 'littlejs';
import { createStrip, stripCircle, stripGlow } from '../backdropStrip.js';
import { rect as box, roundRect, circle, ellipse, poly, hash } from './roomShapes.js';

/** A sun sprite (pixels): halo, rim, body, and a bright core, as the outdoor sky bakes it. */
export function bakeSunSprite(size, palette)
{
    const canvasSize = Math.ceil(size * 2.2);
    const strip = createStrip(canvasSize, 0, canvasSize);
    if (!strip)
        return null;
    // Strip coordinates run up from the bottom of the screen (backdropStrip.js); find the
    // canvas center in them.
    const c = canvasSize / 2, cy = strip.yShift + strip.height - c;
    stripGlow(strip, c, cy, size * 2.1, palette.sunHalo.withAlpha(.35));
    stripCircle(strip, c, cy, size, palette.sunRim);
    stripCircle(strip, c, cy, size * .9, palette.sun);
    stripGlow(strip, c - size * .08, cy + size * .08, size * .7, palette.sunCore);
    return strip;
}

/** Steady little stars, denser and brighter toward the top. */
export function drawWindowStars(ctx, rect, palette)
{
    const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
    for (let i = 0; i < 70; i++)
    {
        const depth = hash(i, 1, 31) ** 1.4;             // 0 = top, 1 = the horizon
        const x = rect.x0 + hash(i, 2, 31) * w, y = rect.y1 - depth * h;
        const fade = 1 - depth * .75;
        const color = (hash(i, 3, 31) < .3 ? palette.starCool : palette.star).withAlpha((.45 + hash(i, 4, 31) * .5) * fade);
        const size = .03 + hash(i, 5, 31) * .035;
        circle(ctx, x, y, size, color);
        if (size > .055)
            drawCircleGradient(vec2(x, y), size * 5, color.withAlpha(.2 * fade), color.withAlpha(0), false, false, ctx);
    }
}

/**
 * The scenery outside. `horizon` is where the hills meet the sky; `sky` and `view` are the
 * outdoor backdrop palette and the room palette's view colors for this time (night or day).
 */
export function drawWindowScenery(ctx, rect, horizon, sky, view, night)
{
    const { x0, x1, y0 } = rect, w = x1 - x0;
    // A far ridge, faded toward the sky, with mist at its feet.
    const ridge = [vec2(x0, y0)];
    for (let i = 0; i <= 20; i++)
    {
        const t = i / 20;
        ridge.push(vec2(x0 + t * w, horizon + 1.2 + Math.sin(t * 7.3 + 1) * .35 + Math.sin(t * 17) * .12));
    }
    ridge.push(vec2(x1, y0));
    poly(ctx, ridge.map(v => vec2(v.x, v.y + .07)), sky.ridgeFarRim);
    poly(ctx, ridge, sky.ridgeFar);
    // Rolling hills: overlapping domes, lit along their tops.
    const domes = [[.1, 1.5, 4.8], [.42, 1.1, 5.4], [.78, 1.35, 4.6], [1.05, .9, 4]];
    for (const [t, crest, width] of domes)
        ellipse(ctx, x0 + t * w - .05, horizon + crest - width * .3 + .08, width, width * .6, sky.hillsRim);
    for (const [t, crest, width] of domes)
        ellipse(ctx, x0 + t * w, horizon + crest - width * .3, width, width * .6, sky.hills);
    box(ctx, x0, y0, x1, horizon + .2, sky.hills);
    drawHouse(ctx, x0 + w * .38, horizon + 1.05, view, night);
    // Trees: round ones and a pine, standing on the hills. Open sky stays on the left and right
    // (WindowView.BODY_INSET), where the sun and moon rise and set.
    for (const [t, base, size] of [[.05, .9, 1.4], [.61, .55, 1.5], [.98, .7, 1.2]])
        roundTree(ctx, x0 + t * w, horizon + base, size, sky);
    pineTree(ctx, x0 + w * .51, horizon + .45, 1.4, sky);
    // The garden: a soft hedge line and a picket fence along the bottom.
    for (let x = x0, i = 0; x < x1 + .5; x += .7, i++)
    {
        circle(ctx, x, horizon - .15 + hash(i, 1, 41) * .15, 1 + hash(i, 2, 41) * .3, sky.bushesRim);
        circle(ctx, x + .03, horizon - .2 + hash(i, 1, 41) * .15, .95 + hash(i, 2, 41) * .3, sky.bushes);
    }
    box(ctx, x0, y0, x1, horizon - .3, sky.bushes);
    drawFence(ctx, x0, x1, horizon - .35, view);
}

function drawHouse(ctx, x, base, view, night)
{
    box(ctx, x - .7, base, x + .7, base + 1, view.houseShade);
    box(ctx, x - .7, base, x + .62, base + 1, view.houseWall);
    poly(ctx, [vec2(-.95, 0), vec2(.95, 0), vec2(0, .8)], view.roof, x, base + .95);
    box(ctx, x + .35, base + 1.2, x + .55, base + 1.75, view.roof);
    box(ctx, x - .5, base, x - .15, base + .6, view.door);
    if (night)
        drawCircleGradient(vec2(x + .32, base + .55), 1.6, view.windowGlow, view.windowGlow.withAlpha(0), false, false, ctx);
    box(ctx, x + .1, base + .35, x + .55, base + .75, view.houseWindow);
    box(ctx, x + .31, base + .35, x + .34, base + .75, view.houseShade);
}

function roundTree(ctx, x, base, size, sky)
{
    box(ctx, x - size * .07, base - .3, x + size * .07, base + size * .5, sky.trunk);
    const lobes = [[0, .75, 1], [-.3, .55, .7], [.32, .5, .66]];
    for (const [dx, dy, d] of lobes)
        circle(ctx, x + dx * size - .05, base + dy * size + .06, d * size, sky.treesRim);
    for (const [dx, dy, d] of lobes)
        circle(ctx, x + dx * size, base + dy * size, d * size, sky.trees);
    circle(ctx, x - size * .15, base + size * .9, size * .4, sky.treesDetail);
}

function pineTree(ctx, x, base, size, sky)
{
    box(ctx, x - .06, base - .2, x + .06, base + .3, sky.trunk);
    for (let i = 0; i < 3; i++)
    {
        const w = size * (1 - i * .25), y = base + .2 + i * size * .32;
        poly(ctx, [vec2(-w / 2 - .04, -.02), vec2(w / 2 + .04, -.02), vec2(0, size * .55 + .06)], sky.treesRim, x - .04, y);
        poly(ctx, [vec2(-w / 2, 0), vec2(w / 2, 0), vec2(0, size * .55)], sky.trees, x, y);
    }
}

function drawFence(ctx, x0, x1, top, view)
{
    box(ctx, x0, top - .55, x1, top - .42, view.fenceShade);
    box(ctx, x0, top - .25, x1, top - .12, view.fenceShade);
    for (let x = x0 + .1; x < x1; x += .42)
    {
        roundRect(ctx, x, top - 1.4, x + .26, top, .02, view.fenceShade);
        poly(ctx, [vec2(0, 0), vec2(.26, 0), vec2(.13, .16)], view.fence, x, top - .02);
        box(ctx, x, top - 1.4, x + .2, top, view.fence);
    }
}
