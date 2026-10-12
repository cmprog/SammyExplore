// The "saved" notice: a little feather that flutters in the top-right corner with a label.
// Pure drawing of (state, time); screen space.
import { mainCanvasSize, smoothStep, clamp } from 'littlejs';
import { drawScreenCanvas } from './screenCanvas.js';
import { drawFeather } from './drawFeather.js';
import { UI_FONT } from './drawMenu.js';

const MARGIN = 40;
const PILL = { w: 210, h: 76 };
const FADE_IN = .25;
const FADE_OUT = .5;

/** state: { age, duration, label } in seconds. */
export function drawSaveIcon({ age, duration, label }, time)
{
    const appear = smoothStep(clamp(age / FADE_IN, 0, 1)) * smoothStep(clamp((duration - age) / FADE_OUT, 0, 1));
    if (appear <= 0)
        return;
    const x = mainCanvasSize.x - MARGIN - PILL.w / 2;
    const y = MARGIN + PILL.h / 2 - (1 - appear) * 20;

    drawScreenCanvas(ctx =>
    {
        ctx.globalAlpha = appear;
        ctx.beginPath();
        ctx.roundRect(x - PILL.w / 2, y - PILL.h / 2, PILL.w, PILL.h, PILL.h / 2);
        ctx.fillStyle = 'rgba(18, 13, 43, .78)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 224, 150, .8)';
        ctx.stroke();

        // A quick pop when it arrives, then a gentle sway.
        const pop = 1 + .25 * Math.max(0, 1 - age / .3);
        drawFeather(ctx, { x: x - 58, y }, { angle: .5 + Math.sin(time * 5) * .18, length: 64 * pop });

        ctx.font = `bold 38px ${UI_FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe9b0';
        ctx.fillText(label, x - 18, y + 2);
    });
}
