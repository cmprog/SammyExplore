// The correction "rewrite": a storybook page drops over the world, a quill scribbles it out
// row by row, then a pink eraser rubs the scribbles away again.
// state: { phase: 'in'|'hold'|'out', progress 0..1, seed } from CorrectionSequence.visualState().
import { mainCanvasSize, smoothStep, clamp, RandomGenerator } from 'littlejs';
import { drawScreenCanvas } from './screenCanvas.js';

const ROWS = 7;
const STAGGER = .07;             // each row starts this much (of the phase) after the previous
const STROKE_WIDTH = [36, 54];  // per row, so it looks hand-drawn
const ZIG_STEP = [45, 135];      // horizontal distance between zigzag points
const ZIG_HEIGHT = [40, 125];    // how far each point swings above/below the row
const ZIG_BACKTRACK = .25;       // chance a point doubles back a little, like a real scribble
const PAGE_IN_PORTION = .4;      // the page has fully dropped after this much of the scribble-in...
const PAGE_OUT_START = .3;       // ...and starts lifting once the eraser is this far along
const EDGE_WAVE = 16;            // height of the page edge's wobble, in pixels
const OVERHANG = 90;             // strokes start and end off-screen

const COLORS = {
    page: 'rgb(244, 228, 186)',
    vignette: 'rgba(150, 100, 40, .35)',
    pageEdge: '#a07a48',
    ink: 'rgba(43, 35, 64, .9)',
    quillFeather: '#fffaf0',
    quillShade: '#e6d9c3',
    quillShaft: '#9b7b55',
    nib: '#3a3040',
    outline: '#3a2a20',
    eraser: '#f4a3b5',
    eraserShade: '#de7f97',
    eraserBand: '#6c8fd6',
    shine: 'rgba(255, 255, 255, .6)',
};

let cachedSeed = null, cachedRows = null;

export function drawPageScribble({ phase, progress, seed }, time)
{
    const size = mainCanvasSize;
    const rows = rowsFor(seed, size);

    drawScreenCanvas(ctx =>
    {
        const band = pageBand(phase, progress);
        if (band[1] - band[0] <= 0)
            return;
        drawPage(ctx, size, band);
        // Ink only lands on the page, so lifting the page also lifts its scribbles.
        ctx.save();
        pagePath(ctx, size, band);
        ctx.clip();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = COLORS.ink;
        let tool = null;
        rows.forEach((row, index) =>
        {
            const [from, to] = visibleSpan(phase, progress, index);
            if (to - from <= 0)
                return;
            ctx.lineWidth = row.width;
            strokeSpan(ctx, row, from, to);
            if (phase === 'in' && to < 1)
                tool = { pos: pointAt(row, to), draw: drawQuill };
            if (phase === 'out' && from > 0)
                tool = { pos: pointAt(row, from), draw: drawEraser };
        });
        ctx.restore();
        tool?.draw(ctx, tool.pos, time);
    });
}

// The page slides down over the world like a blind, then is lifted away top to bottom
// behind the eraser. No alpha fade: a half-transparent page over the night sky looks muddy.
// Returns the covered band [top, bottom] as fractions of the screen height.
function pageBand(phase, progress)
{
    if (phase === 'in')
        return [0, smoothStep(clamp(progress / PAGE_IN_PORTION))];
    if (phase === 'hold')
        return [0, 1];
    return [smoothStep(clamp((progress - PAGE_OUT_START) / (1 - PAGE_OUT_START))), 1];
}

function pagePath(ctx, size, [top, bottom])
{
    const edgeTop = top > 0 ? top * (size.y + EDGE_WAVE * 2) - EDGE_WAVE : -EDGE_WAVE * 2;
    const edgeBottom = bottom < 1 ? bottom * (size.y + EDGE_WAVE * 2) - EDGE_WAVE : size.y + EDGE_WAVE * 2;
    ctx.beginPath();
    wavyEdge(ctx, size.x, edgeTop, false);
    wavyEdge(ctx, size.x, edgeBottom, true);
    ctx.closePath();
}

function drawPage(ctx, size, band)
{
    pagePath(ctx, size, band);
    ctx.fillStyle = COLORS.page;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const vignette = ctx.createRadialGradient(size.x / 2, size.y / 2, size.y * .35, size.x / 2, size.y / 2, size.x * .65);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, COLORS.vignette);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size.x, size.y);
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.pageEdge;
    ctx.stroke();
}

// Deckled paper edge across the screen at height y (left to right, or right to left when reversed).
function wavyEdge(ctx, width, y, reversed)
{
    const steps = 24;
    for (let i = 0; i <= steps; i++)
    {
        const x = (reversed ? steps - i : i) / steps * width;
        ctx.lineTo(x, y + Math.sin(x * .013) * EDGE_WAVE * .6 + Math.sin(x * .041) * EDGE_WAVE * .4);
    }
}

// Fraction [from, to] of a row's stroke that is inked right now.
function visibleSpan(phase, progress, index)
{
    if (phase === 'hold')
        return [0, 1];
    const fraction = clamp((progress - index * STAGGER) / (1 - (ROWS - 1) * STAGGER));
    return phase === 'in' ? [0, fraction] : [fraction, 1];
}

/** Zigzag rows, alternating direction like a real scribble. Cached per correction. */
function rowsFor(seed, size)
{
    if (seed === cachedSeed)
        return cachedRows;
    const random = new RandomGenerator(seed * 7919 + 13);
    cachedRows = [];
    for (let i = 0; i < ROWS; i++)
    {
        const y = size.y * (i + .5) / ROWS;
        const points = [];
        for (let x = -OVERHANG, up = true; x < size.x + OVERHANG; up = !up)
        {
            points.push({ x, y: y + (up ? -1 : 1) * random.float(...ZIG_HEIGHT) });
            x += random.float() < ZIG_BACKTRACK ? -random.float(...ZIG_STEP) * .4 : random.float(...ZIG_STEP);
        }
        if (i % 2)
            points.reverse();
        cachedRows.push({ ...withLengths(points), width: random.float(...STROKE_WIDTH) });
    }
    cachedSeed = seed;
    return cachedRows;
}

function withLengths(points)
{
    let total = 0;
    const lengths = [0];
    for (let i = 1; i < points.length; i++)
        lengths.push(total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return { points, lengths, total };
}

function pointAt({ points, lengths, total }, fraction)
{
    const distance = fraction * total;
    let i = 1;
    while (i < points.length - 1 && lengths[i] < distance)
        i++;
    const a = points[i - 1], b = points[i];
    const t = clamp((distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1));
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function strokeSpan(ctx, row, from, to)
{
    const start = pointAt(row, from), end = pointAt(row, to);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    row.points.forEach((point, i) =>
    {
        const at = row.lengths[i] / row.total;
        if (at > from && at < to)
            ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

// A cream feather quill with its nib on the scribble head, wiggling as it writes.
function drawQuill(ctx, pos, time)
{
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(-.75 + Math.sin(time * 40) * .06);
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.outline;
    // nib
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-9, -34);
    ctx.lineTo(9, -34);
    ctx.closePath();
    ctx.fillStyle = COLORS.nib;
    ctx.fill();
    ctx.stroke();
    // feather vane
    ctx.beginPath();
    ctx.ellipse(0, -120, 34, 92, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.quillFeather;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-12, -120, 14, 78, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.quillShade;
    ctx.fill();
    // shaft
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, -205);
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.quillShaft;
    ctx.stroke();
    ctx.restore();
}

// A chunky pink eraser that scrubs back and forth over the tail of the scribble.
function drawEraser(ctx, pos, time)
{
    ctx.save();
    ctx.translate(pos.x + Math.sin(time * 30) * 10, pos.y);
    ctx.rotate(-.35);
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.outline;
    ctx.beginPath();
    ctx.roundRect(-55, -100, 110, 130, 22);
    ctx.fillStyle = COLORS.eraser;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-55, -10, 110, 40, [0, 0, 22, 22]);
    ctx.fillStyle = COLORS.eraserShade;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.eraserBand;
    ctx.fillRect(-53, -66, 106, 22);
    ctx.fillStyle = COLORS.shine;
    ctx.beginPath();
    ctx.ellipse(-30, -82, 10, 6, -.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
