// The "press E" bubble that floats over the nearest interactable: a round cream speech bubble
// with a little tail and a bold E. Canvas2D in screen pixels (call inside drawScreenCanvas).
// Pure: drawInteractPrompt(ctx, pos, appear, time).
import { UI_FONT } from './drawMenu.js';

const SIZE = 74;          // bubble width and height, px
const RADIUS = 24;
const TAIL = 14;
const COLORS = {
    shadow: 'rgba(6, 3, 20, .35)',
    top: '#fffaf0',
    bottom: '#ffe0a0',
    outline: '#3b2110',
    letter: '#5b3a22',
    shine: 'rgba(255, 255, 255, .7)',
};

/**
 * @param {{x:number, y:number}} pos - screen position of the tail's tip (the bubble sits above it)
 * @param {number} appear - 0 hidden .. 1 fully shown (fade and pop)
 */
export function drawInteractPrompt(ctx, pos, appear, time)
{
    if (appear <= 0)
        return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, appear * 1.4);
    ctx.translate(pos.x, pos.y);
    const pop = .6 + .4 * easeOutBack(appear) + Math.sin(time * 5) * .015;
    ctx.scale(pop, pop);
    ctx.lineJoin = 'round';

    const top = -TAIL - SIZE;
    bubblePath(ctx, 4, top + 6);
    ctx.fillStyle = COLORS.shadow;
    ctx.fill();

    bubblePath(ctx, 0, top);
    const fill = ctx.createLinearGradient(0, top, 0, -TAIL);
    fill.addColorStop(0, COLORS.top);
    fill.addColorStop(1, COLORS.bottom);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = COLORS.outline;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-SIZE * .2, top + SIZE * .2, SIZE * .16, SIZE * .07, -.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.shine;
    ctx.fill();

    ctx.font = `bold ${Math.round(SIZE * .62)}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.letter;
    ctx.fillText('E', 0, top + SIZE / 2 + 3);
    ctx.restore();
}

/** Rounded square with a small tail at the bottom center; the tail tip is at (dx, top + SIZE + TAIL). */
function bubblePath(ctx, dx, top)
{
    const left = dx - SIZE / 2, bottom = top + SIZE;
    ctx.beginPath();
    ctx.moveTo(left + RADIUS, top);
    ctx.arcTo(left + SIZE, top, left + SIZE, bottom, RADIUS);
    ctx.arcTo(left + SIZE, bottom, left, bottom, RADIUS);
    ctx.lineTo(dx + TAIL * .8, bottom);
    ctx.lineTo(dx, bottom + TAIL);
    ctx.lineTo(dx - TAIL * .8, bottom);
    ctx.arcTo(left, bottom, left, top, RADIUS);
    ctx.arcTo(left, top, left + SIZE, top, RADIUS);
    ctx.closePath();
}

function easeOutBack(t)
{
    const c = 1.7;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
