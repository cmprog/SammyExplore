// Baked wall decor: pixel-art posters taped up, a bunting garland, and a string of fairy lights
// (the bulbs glow at night: systems/RoomLighting.js lights them from fairyBulbs()).
// Decor items arrive as {x, w, h, top, base, ...props} in world units (see systems/roomLayout.js).
import { vec2 } from 'littlejs';
import { POSTERS } from '../../data/roomPixelArt.js';
import { rect, outlinedBox, outlinedPoly, ellipse, poly, line, pixelArt, pixelSize, hash, OUTLINE } from './roomShapes.js';

// --- posters -------------------------------------------------------------------------------------

export function drawPoster(ctx, { x, w, h, top, art }, p)
{
    const poster = POSTERS[art];
    const x0 = x, x1 = x + w, y1 = top, y0 = top - h;
    rect(ctx, x0 + .1, y0 - .12, x1 + .1, y1 - .12, p.shadow);   // it sits off the wall a hair
    outlinedBox(ctx, x0, y0, x1, y1, .04, poster.paper, p.outline);
    const size = pixelSize(poster.rows);
    const px = Math.min((w - .5) / size.w, (h - .5) / size.h);
    pixelArt(ctx, poster.rows, poster.colors, (x0 + x1) / 2 - size.w * px / 2, (y0 + y1) / 2 + size.h * px / 2, px);
    // Washi tape on the top corners.
    for (const [cx, angle, salt] of [[x0 + .1, -.6, 1], [x1 - .1, .6, 2]])
    {
        const color = p.tape[Math.floor(hash(x, cx, salt) * p.tape.length)];
        poly(ctx, [vec2(-.32, -.11), vec2(.32, -.11), vec2(.32, .11), vec2(-.32, .11)], color, cx, y1 - .06, angle);
    }
}

// --- bunting: triangle flags on a sagging string ------------------------------------------------

export function drawBunting(ctx, { x, w, top, sag = .8 }, p)
{
    const y = t => top - sag * 4 * t * (1 - t);
    const points = [];
    for (let i = 0; i <= 24; i++)
        points.push(vec2(x + w * i / 24, y(i / 24)));
    for (let i = 0; i < points.length - 1; i++)
        line(ctx, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, .05, p.string);
    const count = Math.floor(w / .95);
    for (let i = 0; i < count; i++)
    {
        const t = (i + .5) / count, fx = x + w * t, fy = y(t);
        const flag = [vec2(-.32, 0), vec2(.32, 0), vec2(0, -.62)];
        outlinedPoly(ctx, flag, p.flags[i % p.flags.length], p.outline, fx, fy + .02);
        poly(ctx, [vec2(-.32, 0), vec2(-.05, 0), vec2(-.18, -.3)], p.paintLight.withAlpha(.35), fx, fy + .02);
    }
}

// --- fairy lights: scalloped wire with little bulbs -----------------------------------------------

/** Where each bulb hangs, with its color index: shared by the bake and the lighting. */
export function fairyBulbs({ x, w, top, span = 5, sag = .5, every = 1 })
{
    const bulbs = [];
    for (let bx = x + every / 2, i = 0; bx < x + w; bx += every, i++)
    {
        const t = ((bx - x) % span) / span;
        bulbs.push({ x: bx, y: top - sag * 4 * t * (1 - t) - .2, color: i % 4, phase: hash(bx, top, 7) * 6.28 });
    }
    return bulbs;
}

export function drawFairyLights(ctx, decor, p)
{
    const { x, w, top, span = 5, sag = .5 } = decor;
    const y = wx => { const t = ((wx - x) % span) / span; return top - sag * 4 * t * (1 - t); };
    for (let wx = x; wx < x + w; wx += .2)
        line(ctx, wx, y(wx), Math.min(wx + .2, x + w), y(Math.min(wx + .2, x + w - .001)), .045, p.string);
    for (const bulb of fairyBulbs(decor))
    {
        rect(ctx, bulb.x - .06, bulb.y + .08, bulb.x + .06, bulb.y + .2, p.string);
        ellipse(ctx, bulb.x, bulb.y - .04, .2 + OUTLINE * 2, .26 + OUTLINE * 2, p.outline);
        ellipse(ctx, bulb.x, bulb.y - .04, .2, .26, p.bulbs[bulb.color]);
        ellipse(ctx, bulb.x - .03, bulb.y, .06, .09, p.paintLight);
    }
}
