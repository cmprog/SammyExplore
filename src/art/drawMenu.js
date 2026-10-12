// Menu UI art shared by the title, pause, and level complete screens: the big bouncy title text,
// pill buttons with a glowing highlight, panels, the screen dim, and the feather cursor.
// All Canvas2D in screen pixels (call inside drawScreenCanvas). Pure functions of their arguments.
import { drawFeather } from './drawFeather.js';

/** Round, friendly lettering. Falls back gracefully on machines without Comic Sans. */
export const UI_FONT = '"Comic Sans MS", "Chalkboard SE", "Trebuchet MS", sans-serif';

const COLORS = {
    outline: '#140e30',
    buttonTop: '#3a3180',
    buttonBottom: '#262058',
    buttonText: '#efeaff',
    hotTop: '#ffe596',
    hotBottom: '#f5a845',
    hotText: '#3b2110',
    glow: 'rgba(255, 210, 110, .75)',
    disabledTop: '#3b3a52',
    disabledBottom: '#2c2b40',
    disabledText: '#8a87a6',
    sliderTrack: 'rgba(20, 14, 48, .55)',
    sliderFill: '#ffd36e',
};

/**
 * Big wavy title: each letter bobs on its own beat, with a thick ink outline and a drop shadow.
 * @param {{x:number, y:number}} pos - center of the text
 */
export function drawTitleText(ctx, text, pos, { size = 170, appear = 1 } = {}, time = 0)
{
    ctx.save();
    ctx.font = `bold ${size}px ${UI_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const widths = [...text].map(char => ctx.measureText(char).width);
    const total = widths.reduce((sum, w) => sum + w, 0);
    let x = pos.x - total / 2;
    [...text].forEach((char, i) =>
    {
        const w = widths[i];
        // Letters drop in one after another, then keep bobbing gently.
        const drop = Math.max(0, Math.min(1, appear * 1.6 - i * .045));
        const bob = Math.sin(time * 2.2 - i * .55) * size * .045;
        const y = pos.y + bob - (1 - easeOutBack(drop)) * size * .8;
        const tilt = Math.sin(time * 1.7 - i * .8) * .04;
        ctx.save();
        ctx.globalAlpha = drop;
        ctx.translate(x + w / 2, y);
        ctx.rotate(tilt);
        drawLetter(ctx, char, -w / 2, size);
        ctx.restore();
        x += w;
    });
    ctx.restore();
}

function drawLetter(ctx, char, x, size)
{
    ctx.fillStyle = 'rgba(8, 4, 26, .55)';
    ctx.fillText(char, x + size * .05, size * .07);
    ctx.lineWidth = size * .14;
    ctx.strokeStyle = COLORS.outline;
    ctx.strokeText(char, x, 0);
    const fill = ctx.createLinearGradient(0, -size * .4, 0, size * .4);
    fill.addColorStop(0, '#fff8d2');
    fill.addColorStop(.45, '#ffd36e');
    fill.addColorStop(1, '#f39a3b');
    ctx.fillStyle = fill;
    ctx.fillText(char, x, 0);
    // A thin warm rim inside the outline makes the letters look puffy.
    ctx.lineWidth = size * .025;
    ctx.strokeStyle = 'rgba(255, 255, 240, .55)';
    ctx.strokeText(char, x, -size * .02);
}

/**
 * Pill button. highlight 0..1 eases the hot colors, glow, and size in.
 * slider: optional { value 0..1 } to draw a volume bar with - and + ends.
 */
export function drawMenuButton(ctx, { x, y, w, h, label, highlight = 0, enabled = true, slider = null }, time = 0)
{
    ctx.save();
    ctx.translate(x, y);
    const grow = 1 + .06 * highlight + Math.sin(time * 4) * .008 * highlight;
    ctx.scale(grow, grow);
    ctx.lineJoin = 'round';

    // Drop shadow, then body.
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 6, -h / 2 + 8, w, h, h / 2);
    ctx.fillStyle = 'rgba(6, 3, 20, .45)';
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    if (highlight > .01)
    {
        ctx.shadowColor = COLORS.glow;
        ctx.shadowBlur = 36 * highlight;
    }
    ctx.fillStyle = buttonFill(ctx, h, enabled, highlight);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLORS.outline;
    ctx.stroke();

    // Glossy top shine.
    ctx.beginPath();
    ctx.roundRect(-w / 2 + h * .3, -h / 2 + 7, w - h * .6, h * .3, h * .15);
    ctx.fillStyle = `rgba(255, 255, 255, ${enabled ? .16 + .2 * highlight : .06})`;
    ctx.fill();

    ctx.font = `bold ${Math.round(h * .5)}px ${UI_FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = !enabled ? COLORS.disabledText : highlight > .5 ? COLORS.hotText : COLORS.buttonText;
    if (slider)
        drawSliderContent(ctx, label, slider.value, w, h);
    else
    {
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, 3);
    }
    ctx.restore();
}

function buttonFill(ctx, h, enabled, highlight)
{
    const fill = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    if (!enabled)
    {
        fill.addColorStop(0, COLORS.disabledTop);
        fill.addColorStop(1, COLORS.disabledBottom);
    }
    else
    {
        fill.addColorStop(0, mix(COLORS.buttonTop, COLORS.hotTop, highlight));
        fill.addColorStop(1, mix(COLORS.buttonBottom, COLORS.hotBottom, highlight));
    }
    return fill;
}

function drawSliderContent(ctx, label, value, w, h)
{
    ctx.textAlign = 'left';
    ctx.fillText(label, -w / 2 + h * .55, 3);
    const trackLeft = 0, trackRight = w / 2 - h * .9, trackH = h * .26;
    ctx.textAlign = 'center';
    ctx.fillText('-', trackLeft - h * .32, 1);
    ctx.fillText('+', trackRight + h * .36, 3);
    ctx.beginPath();
    ctx.roundRect(trackLeft, -trackH / 2, trackRight - trackLeft, trackH, trackH / 2);
    ctx.fillStyle = COLORS.sliderTrack;
    ctx.fill();
    if (value > 0)
    {
        ctx.beginPath();
        ctx.roundRect(trackLeft, -trackH / 2, Math.max(trackH, (trackRight - trackLeft) * value), trackH, trackH / 2);
        ctx.fillStyle = COLORS.sliderFill;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = COLORS.outline;
        ctx.stroke();
    }
}

/** Night-blue storybook panel with a soft gold border, centered on pos. */
export function drawPanel(ctx, { x, y, w, h })
{
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 10, y - h / 2 + 14, w, h, 46);
    ctx.fillStyle = 'rgba(4, 2, 16, .5)';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 46);
    const fill = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    fill.addColorStop(0, '#2a2466');
    fill.addColorStop(1, '#17133f');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = COLORS.outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 14, y - h / 2 + 14, w - 28, h - 28, 34);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 214, 130, .55)';
    ctx.setLineDash([2, 14]);
    ctx.stroke();
    ctx.restore();
}

/** Plain heading or body text with an outline, centered. Wraps at maxWidth. */
export function drawLabel(ctx, text, pos, { size = 56, color = '#fff2cc', maxWidth = Infinity, lineHeight = 1.25 } = {})
{
    ctx.save();
    ctx.font = `bold ${size}px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const lines = wrap(ctx, text, maxWidth);
    lines.forEach((line, i) =>
    {
        const y = pos.y + (i - (lines.length - 1) / 2) * size * lineHeight;
        ctx.lineWidth = size * .16;
        ctx.strokeStyle = COLORS.outline;
        ctx.strokeText(line, pos.x, y);
        ctx.fillStyle = color;
        ctx.fillText(line, pos.x, y);
    });
    ctx.restore();
}

function wrap(ctx, text, maxWidth)
{
    const lines = [];
    let line = '';
    for (const word of text.split(' '))
    {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth)
        {
            lines.push(line);
            line = word;
        }
        else
            line = next;
    }
    lines.push(line);
    return lines;
}

/** Darken everything drawn so far. */
export function drawDim(ctx, size, alpha)
{
    ctx.fillStyle = `rgba(8, 6, 28, ${alpha})`;
    ctx.fillRect(0, 0, size.x, size.y);
}

/** The mouse cursor on menu screens: a feather with its quill tip at the pointer. */
export function drawCursorFeather(ctx, pos, time)
{
    const angle = -.65 + Math.sin(time * 3) * .05;
    // The quill tip sits ~56px below the feather center (at length 100); rotate that offset.
    const length = 70, tip = 56 * length / 100;
    const center = { x: pos.x + Math.sin(angle) * tip, y: pos.y - Math.cos(angle) * tip };
    drawFeather(ctx, center, { angle, length });
}

/** The selection marker beside the highlighted menu item. */
export function drawMarkerFeather(ctx, pos, time)
{
    drawFeather(ctx, { x: pos.x + Math.sin(time * 5) * 6, y: pos.y }, { angle: 1.25 + Math.sin(time * 5) * .08, length: 78 });
}

function easeOutBack(t)
{
    const c = 1.7;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function mix(a, b, t)
{
    const pa = parseHex(a), pb = parseHex(b);
    const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function parseHex(hex)
{
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
