// A canvas to bake one backdrop layer into, plus shape helpers that draw into it with the
// engine's primitives (Canvas2D path, screen space, into the strip's own context).
//
// Bake coordinates: pixels, x right, y UP measured from the bottom of the 1080 px screen (with
// the camera at the level's bottom-left). So y = 1080 - screenY no matter where the strip is cut;
// art code can place a ridge "at screen y 600" without caring about the strip's own bounds.
// Strips repeat horizontally; shapes near either end are also drawn shifted by one strip width.
import { vec2, drawCircle, drawCircleGradient, drawEllipse, drawPoly, BLACK } from '../../lib/littlejs/littlejs.esm.js';

const SCREEN_HEIGHT = 1080;
const FAR_BELOW = -1e4;
/** Strips are drawn in columns this wide, each cut to its own content (see trimStrip). */
export const STRIP_COLUMN = 128;

/**
 * @param {number} width
 * @param {number} top - screen y of the strip's top edge
 * @param {number} bottom - screen y of the strip's bottom edge
 * @returns {{canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D, width: number, height: number,
 *            top: number, yShift: number, columnMaxY: number[]} | null}
 *          null when there is no canvas support (engine headless mode).
 */
export function createStrip(width, top, bottom)
{
    if (typeof OffscreenCanvas === 'undefined')
        return null;
    const height = Math.round(bottom - top);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    // The highest thing drawn in each column, so the strip can be trimmed to its content afterwards.
    const columnMaxY = new Array(Math.ceil(width / STRIP_COLUMN)).fill(-Infinity);
    return ctx ? { canvas, ctx, width, height, top, yShift: SCREEN_HEIGHT - bottom, columnMaxY } : null;
}

/**
 * Cut the strip down to its content. Every transparent pixel still costs fill rate each frame,
 * which is what limits slow and software-rendered GPUs, so:
 * - empty rows above the tallest content are dropped (a GPU-side copy, no readback), and
 * - `columns` lists, per STRIP_COLUMN-wide column, the first row with anything in it, so the
 *   renderer can draw each column as its own quad starting there.
 */
export function trimStrip(strip)
{
    const firstRow = y => Math.max(0, Math.floor(canvasY(strip, y)) - 2);
    const skip = Math.min(...strip.columnMaxY.map(firstRow), strip.height);
    let trimmed = strip;
    if (skip > 0)
    {
        trimmed = createStrip(strip.width, strip.top + skip, SCREEN_HEIGHT - strip.yShift);
        trimmed.ctx.drawImage(strip.canvas, 0, skip, strip.width, trimmed.height, 0, 0, strip.width, trimmed.height);
    }
    trimmed.columns = strip.columnMaxY.map((maxY, i) => ({
        x: i * STRIP_COLUMN,
        width: Math.min(STRIP_COLUMN, strip.width - i * STRIP_COLUMN),
        top: Math.min(firstRow(maxY) - skip, trimmed.height),
    }));
    return trimmed;
}

/** Record that something reaches up to height y between x0 and x1 (canvas x, may be off the ends). */
function reach(strip, x0, x1, y)
{
    const last = strip.columnMaxY.length - 1;
    const c0 = Math.max(0, Math.floor(x0 / STRIP_COLUMN)), c1 = Math.min(last, Math.floor(x1 / STRIP_COLUMN));
    for (let c = c0; c <= c1; c++)
        strip.columnMaxY[c] = Math.max(strip.columnMaxY[c], y);
}

/** Bake y (up from the screen bottom) to this canvas's pixel y (down from its top). */
export function canvasY(strip, y)
{
    return strip.height - (y - strip.yShift);
}

/** Record how high an ellipse reaches in each column it touches (its outline, not its box). */
function reachEllipse(strip, cx, cy, rx, ry)
{
    const last = strip.columnMaxY.length - 1;
    const c0 = Math.max(0, Math.floor((cx - rx) / STRIP_COLUMN)), c1 = Math.min(last, Math.floor((cx + rx) / STRIP_COLUMN));
    for (let c = c0; c <= c1; c++)
    {
        // Highest point inside this column: the column x nearest the center.
        const nearest = Math.min(Math.max(cx, c * STRIP_COLUMN), (c + 1) * STRIP_COLUMN);
        const t = (nearest - cx) / rx;
        strip.columnMaxY[c] = Math.max(strip.columnMaxY[c], cy + ry * Math.sqrt(Math.max(0, 1 - t * t)) + 1);
    }
}

/**
 * Draw a shape and its wrapped copies near the strip ends.
 * `top` is how high the shape reaches, or a function (wx) => void that records it per column.
 */
function wrapped(strip, x, radius, top, draw)
{
    const at = wx =>
    {
        typeof top === 'function' ? top(wx) : reach(strip, wx - radius, wx + radius, top);
        draw(wx);
    };
    at(x);
    if (x - radius < 0) at(x + strip.width);
    if (x + radius > strip.width) at(x - strip.width);
}

export function stripCircle(strip, x, y, diameter, color)
{
    wrapped(strip, x, diameter / 2, wx => reachEllipse(strip, wx, y, diameter / 2, diameter / 2), wx =>
        drawCircle(vec2(wx, canvasY(strip, y)), diameter, color, 0, BLACK, false, true, strip.ctx));
}

export function stripGlow(strip, x, y, diameter, color, outerColor = color.withAlpha(0))
{
    wrapped(strip, x, diameter / 2, y + diameter / 2, wx =>
        drawCircleGradient(vec2(wx, canvasY(strip, y)), diameter, color, outerColor, false, true, strip.ctx));
}

export function stripEllipse(strip, x, y, width, height, color)
{
    wrapped(strip, x, width / 2, wx => reachEllipse(strip, wx, y, width / 2, height / 2), wx =>
        drawEllipse(vec2(wx, canvasY(strip, y)), vec2(width, height), color, 0, 0, BLACK, false, true, strip.ctx));
}

/** Points are bake coordinates relative to x (y absolute); `radius` is the shape's half width. */
export function stripPoly(strip, points, color, x = 0, radius = strip.width)
{
    wrapped(strip, x, radius, Math.max(...points.map(p => p.y)), wx =>
        drawPoly(points, color, 0, BLACK, vec2(wx, canvasY(strip, 0)), 0, false, true, strip.ctx));
}

// Full-width bands use exact fillRect: the engine's Canvas2D path offsets shapes by half a pixel,
// which would leave a faint half-covered column at x = 0 (a visible seam once strips repeat).

/** Solid band across the whole strip between two heights. */
export function stripRect(strip, yBottom, yTop, color)
{
    stripGradient(strip, yBottom, yTop, [color, color]);
}

/**
 * Vertical gradient across the full strip width between two heights.
 * @param {Color[]} colors - from the bottom up, spread evenly unless `stops` (0 = bottom, 1 = top) is given
 * @param {boolean} [onlyOverPaint] - tint just what is already drawn (fog settling on hills, not on empty sky)
 */
export function stripGradient(strip, yBottom, yTop, colors, stops, onlyOverPaint = false)
{
    const ctx = strip.ctx;
    const top = canvasY(strip, yTop), bottom = canvasY(strip, yBottom);
    onlyOverPaint || reach(strip, 0, strip.width, yTop);
    const gradient = ctx.createLinearGradient(0, bottom, 0, top);
    colors.forEach((color, i) => gradient.addColorStop(stops ? stops[i] : i / (colors.length - 1), color.toString()));
    ctx.save();
    if (onlyOverPaint)
        ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, strip.width, bottom - top);
    ctx.restore();
}

/** A seamless rolling line: a sum of sine waves whose periods divide the strip width. */
export function periodicRidge(rng, width, baseY, waves)
{
    const terms = waves.map(([cycles, amplitude]) => ({ cycles, amplitude, phase: rng.float(0, Math.PI * 2) }));
    return x => baseY + terms.reduce((sum, t) =>
        sum + t.amplitude * Math.sin(x / width * Math.PI * 2 * t.cycles + t.phase), 0);
}

/** Fill everything under a ridge function (see periodicRidge), `lift` pixels higher. */
export function stripRidge(strip, ridge, color, lift = 0, step = 16)
{
    const points = [vec2(0, FAR_BELOW)];
    for (let x = 0; x <= strip.width; x += step)
    {
        points.push(vec2(x, ridge(x) + lift));
        reach(strip, x - step, x + step, ridge(x) + lift);
    }
    points.push(vec2(strip.width, ridge(strip.width) + lift), vec2(strip.width, FAR_BELOW));
    drawPoly(points, color, 0, BLACK, vec2(0, canvasY(strip, 0)), 0, false, true, strip.ctx);
}

/** Lowest point of a ridge, in bake coordinates: everything below it is solid. */
export function ridgeLow(ridge, width, step = 4)
{
    let low = Infinity;
    for (let x = 0; x <= width; x += step)
        low = Math.min(low, ridge(x));
    return low;
}

/** Where a baked strip becomes solid, in pixels from its top edge (see Backdrop gap bands). */
export function opaqueFrom(strip, solidBelowY)
{
    return Math.max(0, canvasY(strip, solidBelowY));
}
