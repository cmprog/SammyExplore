// Level complete art: confetti (stars, feathers, dots), a bouncy banner, and the continue prompt.
// Canvas2D in screen pixels; pure functions of their arguments.
import { drawFeather } from './drawFeather.js';
import { drawTitleText, drawLabel } from './drawMenu.js';

export const CONFETTI_COLORS = ['#ffd36e', '#ff8fab', '#8fd3ff', '#b8f28c', '#fff6df', '#c9a0ff'];

/** pieces: [{x, y, angle, size, color, shape: 'star'|'feather'|'dot'}] */
export function drawConfetti(ctx, pieces)
{
    for (const p of pieces)
    {
        if (p.shape === 'feather')
        {
            drawFeather(ctx, p, { angle: p.angle, length: p.size * 3, shadow: false });
            continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#140e30';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (p.shape === 'star')
            traceStar(ctx, p.size, p.size * .45);
        else
            ctx.ellipse(0, 0, p.size * .6, p.size * .4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

function traceStar(ctx, outer, inner)
{
    for (let i = 0; i < 10; i++)
    {
        const r = i % 2 ? inner : outer;
        const a = i * Math.PI / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
}

/** The "Level Complete!" banner: wavy title lettering on a ribbon that swings in. */
export function drawBanner(ctx, text, pos, appear, time)
{
    const w = 1080, h = 190;
    ctx.save();
    ctx.globalAlpha = Math.min(1, appear * 2);
    ctx.translate(pos.x, pos.y - (1 - appear) * 160);
    ctx.rotate(Math.sin(time * 1.6) * .015);
    // Ribbon tails
    ctx.fillStyle = '#7a2433';
    for (const side of [-1, 1])
    {
        ctx.beginPath();
        ctx.moveTo(side * (w / 2 - 40), -h * .2);
        ctx.lineTo(side * (w / 2 + 110), -h * .1);
        ctx.lineTo(side * (w / 2 + 70), h * .2);
        ctx.lineTo(side * (w / 2 + 110), h * .5);
        ctx.lineTo(side * (w / 2 - 40), h * .4);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#140e30';
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 40);
    const fill = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    fill.addColorStop(0, '#c4405a');
    fill.addColorStop(1, '#8c2f39');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#140e30';
    ctx.stroke();
    ctx.restore();
    drawTitleText(ctx, text, { x: pos.x, y: pos.y - (1 - appear) * 160 + 4 }, { size: 120, appear }, time);
}

export function drawPrompt(ctx, text, pos, time)
{
    ctx.save();
    ctx.globalAlpha = .75 + .25 * Math.sin(time * 4);
    drawLabel(ctx, text, pos, { size: 44, color: '#fff2cc' });
    ctx.restore();
}
