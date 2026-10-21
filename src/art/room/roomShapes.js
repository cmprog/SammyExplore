// Shape helpers for baked room art, in world units (tiles, y up), drawing with the engine's
// primitives into a 2D context (see systems/worldBake.js). Rects are given by their edges.
import { vec2, drawRect, drawPoly, drawCircle, drawEllipse, drawEllipseGradient, drawRectGradient, drawLine } from 'littlejs';
import { roundedRectPoints } from '../shapes.js';

/** The soft plum outline every piece of room art carries, in tiles. */
export const OUTLINE = .055;
/** A hair of overlap so neighboring pixel-art squares never show a seam between them. */
const SEAM = .012;

export function rect(ctx, x0, y0, x1, y1, color)
{
    drawRect(vec2((x0 + x1) / 2, (y0 + y1) / 2), vec2(x1 - x0, y1 - y0), color, 0, false, false, ctx);
}

export function roundRect(ctx, x0, y0, x1, y1, r, color)
{
    if (r <= 0)
        return rect(ctx, x0, y0, x1, y1, color);
    drawPoly(roundedRectPoints(x1 - x0, y1 - y0, r, 5), color, 0, undefined,
        vec2((x0 + x1) / 2, (y0 + y1) / 2), 0, false, false, ctx);
}

/** A rounded box with the room's soft outline around it: the basic furniture shape. */
export function outlinedBox(ctx, x0, y0, x1, y1, r, fill, outline)
{
    roundRect(ctx, x0 - OUTLINE, y0 - OUTLINE, x1 + OUTLINE, y1 + OUTLINE, r + OUTLINE, outline);
    roundRect(ctx, x0, y0, x1, y1, r, fill);
}

/**
 * A painted panel: outline, fill, a lit strip along the top and a shaded strip along the bottom
 * (light comes from above, a little from the left).
 */
export function panel(ctx, x0, y0, x1, y1, { r = .1, fill, light, shade, outline, lightSize = .08, shadeSize = .12 })
{
    outlinedBox(ctx, x0, y0, x1, y1, r, shade, outline);
    roundRect(ctx, x0, y0 + shadeSize, x1, y1, r, fill);
    if (light)
        roundRect(ctx, x0 + r * .6, y1 - lightSize - .03, x1 - r * .6, y1 - .03, lightSize / 2, light);
}

export function circle(ctx, x, y, diameter, color)
{
    drawCircle(vec2(x, y), diameter, color, 0, undefined, false, false, ctx);
}

export function ellipse(ctx, x, y, w, h, color, angle = 0)
{
    drawEllipse(vec2(x, y), vec2(w, h), color, angle, 0, undefined, false, false, ctx);
}

/** Points are relative to (x, y). */
export function poly(ctx, points, color, x = 0, y = 0, angle = 0)
{
    drawPoly(points, color, 0, undefined, vec2(x, y), angle, false, false, ctx);
}

/** A polygon with the soft outline around it (the shape stamped a hair out in each direction). */
export function outlinedPoly(ctx, points, fill, outline, x = 0, y = 0)
{
    for (const [dx, dy] of [[-OUTLINE, 0], [OUTLINE, 0], [0, -OUTLINE], [0, OUTLINE]])
        poly(ctx, points, outline, x + dx, y + dy);
    poly(ctx, points, fill, x, y);
}

export function line(ctx, ax, ay, bx, by, width, color)
{
    drawLine(vec2(ax, ay), vec2(bx, by), width, color, undefined, 0, false, false, ctx);
}

/** Vertical gradient; colors may be transparent (soft shadows). */
export function gradient(ctx, x0, y0, x1, y1, top, bottom)
{
    drawRectGradient(vec2((x0 + x1) / 2, (y0 + y1) / 2), vec2(x1 - x0, y1 - y0), top, bottom, 0, false, false, ctx);
}

/** A soft oval shadow on the wall, centered on (x, y) and fading out toward its edges. */
export function softShadow(ctx, x, y, w, h, color)
{
    drawEllipseGradient(vec2(x, y), vec2(w, h), color, color.withAlpha(0), 0, false, false, ctx);
}

/** Horizontal gradient, left color to right color. */
export function gradientX(ctx, x0, y0, x1, y1, left, right)
{
    // A vertical gradient turned a quarter turn: its top ends up on the left.
    drawRectGradient(vec2((x0 + x1) / 2, (y0 + y1) / 2), vec2(y1 - y0, x1 - x0), left, right, -Math.PI / 2, false, false, ctx);
}

/**
 * Pixel art from rows of characters (data/roomPixelArt.js): top-left at (x0, yTop), each
 * pixel `px` tiles square. '.' is empty; other characters name colors in `colors`.
 */
export function pixelArt(ctx, rows, colors, x0, yTop, px)
{
    rows.forEach((row, r) =>
    {
        const y1 = yTop - r * px;
        // Runs of one color are one rect, so a picture is a handful of draws, not hundreds.
        for (let c = 0; c < row.length;)
        {
            const char = row[c];
            let end = c + 1;
            while (end < row.length && row[end] === char)
                end++;
            if (char !== '.')
                rect(ctx, x0 + c * px - SEAM, y1 - px - SEAM, x0 + end * px + SEAM, y1 + SEAM, colors[char] ?? colors.X);
            c = end;
        }
    });
}

/** Size of a pixel-art picture in pixels: {w, h}. */
export function pixelSize(rows)
{
    return { w: Math.max(...rows.map(row => row.length)), h: rows.length };
}

/** Deterministic 0..1 noise, so baked art is the same on every visit. */
export function hash(x, y, salt = 0)
{
    let h = Math.imul(Math.round(x * 97) | 0, 374761393) ^ Math.imul(Math.round(y * 89) | 0, 668265263) ^ Math.imul(salt + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
