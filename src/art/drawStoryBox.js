// The narrator's text box: a parchment storybook panel at the bottom of the screen with an
// inked frame, corner flourishes, a ribbon name tag, and typewriter text.
// Pure drawing: everything comes from the arguments.
import { drawTextScreen, mainContext, mainCanvasSize, vec2, rgb, smoothStep } from '../../lib/littlejs/littlejs.esm.js';
import { drawScreenCanvas } from './screenCanvas.js';

const FONT = 'Georgia, "Palatino Linotype", "Book Antiqua", serif';
const TEXT_SIZE = 46;
const LINE_HEIGHT = 60;
const BOX_WIDTH = 1480;
const PAD_X = 76;
const PAD_TOP = 60;       // room for the ribbon
const PAD_BOTTOM = 44;
const BOTTOM_MARGIN = 40;
const CORNER_RADIUS = 34;
const MAX_TEXT_WIDTH = BOX_WIDTH - PAD_X * 2;
const SLIDE_DISTANCE = 60;

const INK = rgb(.23, .14, .08);
const LABEL_TEXT = rgb(1, .95, .8);
const COLORS = {
    paperTop: '#fdf4dc',
    paperBottom: '#f0dba8',
    burn: 'rgba(160, 110, 50, .28)',
    outline: '#5b3a22',
    innerLine: 'rgba(120, 80, 40, .55)',
    flourish: '#8a5a32',
    shadow: 'rgba(8, 4, 24, .55)',
    ribbon: '#8c2f39',
    ribbonDark: '#5a1a22',
    ribbonShine: 'rgba(255, 210, 200, .35)',
    nextArrow: '#8c2f39',
};
const LABEL = 'The Narrator';

/** Split text into rows that fit the box. Rows keep their start index into the text,
 *  so a typewriter reveal can be applied without words hopping between lines. */
export function layoutStoryText(text)
{
    mainContext.save();
    mainContext.font = `${TEXT_SIZE}px ${FONT}`;
    const rows = [];
    let rowStart = -1, rowEnd = -1;
    for (const match of text.matchAll(/\S+/g))
    {
        const start = match.index, end = start + match[0].length;
        if (rowStart < 0)
            rowStart = start;
        else if (mainContext.measureText(text.slice(rowStart, end)).width > MAX_TEXT_WIDTH)
        {
            rows.push({ start: rowStart, text: text.slice(rowStart, rowEnd) });
            rowStart = start;
        }
        rowEnd = end;
    }
    if (rowStart >= 0)
        rows.push({ start: rowStart, text: text.slice(rowStart, rowEnd) });
    mainContext.restore();
    return rows;
}

/** rows: from layoutStoryText. appear: 0..1. revealed: show the "next" arrow. */
export function drawStoryBox({ rows, visibleChars, appear, revealed, time })
{
    if (appear <= 0)
        return;
    const ease = smoothStep(appear);
    const height = PAD_TOP + rows.length * LINE_HEIGHT + PAD_BOTTOM;
    const center = vec2(mainCanvasSize.x / 2, mainCanvasSize.y - BOTTOM_MARGIN - height / 2 + (1 - ease) * SLIDE_DISTANCE);
    const box = { w: BOX_WIDTH, h: height };

    drawScreenCanvas(ctx =>
    {
        ctx.globalAlpha = ease;
        ctx.translate(center.x, center.y);
        const pop = .94 + .06 * ease;
        ctx.scale(pop, pop);
        drawPaper(ctx, box);
        drawFlourishes(ctx, box);
        drawRibbon(ctx, box, time);
        drawRows(ctx, box, rows, visibleChars);
        if (revealed)
            drawNextArrow(ctx, box, time);
    });
}

function roundRectPath(ctx, w, h, radius)
{
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, radius);
}

function drawPaper(ctx, { w, h })
{
    // Soft drop shadow so the page lifts off the night scene.
    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    const paper = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    paper.addColorStop(0, COLORS.paperTop);
    paper.addColorStop(1, COLORS.paperBottom);
    ctx.fillStyle = paper;
    roundRectPath(ctx, w, h, CORNER_RADIUS);
    ctx.fill();
    ctx.restore();

    // Toasted edges, like an old storybook page.
    ctx.save();
    roundRectPath(ctx, w, h, CORNER_RADIUS);
    ctx.clip();
    ctx.strokeStyle = COLORS.burn;
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 5;
    roundRectPath(ctx, w, h, CORNER_RADIUS);
    ctx.stroke();

    ctx.strokeStyle = COLORS.innerLine;
    ctx.lineWidth = 2;
    roundRectPath(ctx, w - 30, h - 30, CORNER_RADIUS - 12);
    ctx.stroke();
}

// Little curled corners inside the inner frame.
function drawFlourishes(ctx, { w, h })
{
    ctx.strokeStyle = COLORS.flourish;
    ctx.fillStyle = COLORS.flourish;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const inset = 30, reach = 34;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    {
        const cx = sx * (w / 2 - inset), cy = sy * (h / 2 - inset);
        ctx.beginPath();
        ctx.moveTo(cx, cy - sy * reach);
        ctx.quadraticCurveTo(cx, cy, cx - sx * reach, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - sx * 9, cy - sy * 9, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Swallowtail ribbon straddling the top edge, carrying the speaker's name.
function drawRibbon(ctx, { w, h }, time)
{
    const rw = 300, rh = 50, notch = 20;
    const x = -w / 2 + 70 + rw / 2, y = -h / 2 + 2 + Math.sin(time * 2) * 1.5;
    const points = [
        [-rw / 2 - notch, -rh / 2], [rw / 2 + notch, -rh / 2], [rw / 2 + 4, 0],
        [rw / 2 + notch, rh / 2], [-rw / 2 - notch, rh / 2], [-rw / 2 - 4, 0],
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (const [px, py] of points)
        ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fillStyle = COLORS.ribbon;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ribbonDark;
    ctx.stroke();
    // A highlight stripe so it reads as satin, not a flat sticker.
    ctx.fillStyle = COLORS.ribbonShine;
    ctx.fillRect(-rw / 2 + 6, -rh / 2 + 6, rw - 12, 6);
    drawTextScreen(LABEL, vec2(0, 2), 30, LABEL_TEXT, 0, INK, 'center', FONT, 'italic bold', undefined, 0, ctx);
    ctx.restore();
}

function drawRows(ctx, { w, h }, rows, visibleChars)
{
    const left = -w / 2 + PAD_X;
    const top = -h / 2 + PAD_TOP + LINE_HEIGHT / 2;
    rows.forEach((row, index) =>
    {
        const shown = Math.max(0, Math.min(row.text.length, visibleChars - row.start));
        if (shown)
            drawTextScreen(row.text.slice(0, shown), vec2(left, top + index * LINE_HEIGHT),
                TEXT_SIZE, INK, 0, INK, 'left', FONT, '', undefined, 0, ctx);
    });
}

// Bobbing triangle: "there's more / you can move on".
function drawNextArrow(ctx, { w, h }, time)
{
    const x = w / 2 - 58, y = h / 2 - 34 + Math.sin(time * 6) * 4;
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 8);
    ctx.lineTo(x + 13, y - 8);
    ctx.lineTo(x, y + 9);
    ctx.closePath();
    ctx.fillStyle = COLORS.nextArrow;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ribbonDark;
    ctx.stroke();
}
