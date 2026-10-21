// The swirl that carries Sammy between the bedroom and a chapter (T-017): the portal's swirl
// spreads out over the whole view, closing in on a point (the portal) until the screen is all
// spinning color, then unwinds outward from the middle on the new place.
// Screen space (Canvas2D, y down): drawSwirlTransition(ctx, state, time).
//   state: { cover 0..1 (0 nothing, 1 the view fully covered), center {x, y} screen pixels,
//            color: Color (the chapter's), spin: radians }
import { mainCanvasSize, WHITE, rgb } from 'littlejs';

const DEEP = rgb(.07, .05, .18);
const ARMS = 5;
const EDGE_WAVES = 7;
const EDGE_WOBBLE = .09;
const EDGE_POINTS = 160;     // vertices around the wavy edge (smooth even when it spans the screen)
const ARM_STEPS = 120;

/** @param {CanvasRenderingContext2D} ctx */
export function drawSwirlTransition(ctx, { cover, center, color, spin }, time)
{
    if (cover <= 0)
        return;
    const size = mainCanvasSize;
    const far = Math.max(...[[0, 0], [size.x, 0], [0, size.y], [size.x, size.y]]
        .map(([x, y]) => Math.hypot(x - center.x, y - center.y))) * (1 + EDGE_WOBBLE) + 40;
    const hole = (1 - cover) * far;
    const css = c => c.toString(false);
    const dark = color.lerp(DEEP, .38), light = color.lerp(WHITE, .5);

    ctx.save();
    // Everything outside the (wavy, turning) hole.
    ctx.beginPath();
    ctx.rect(0, 0, size.x, size.y);
    if (hole > 1)
        traceEdge(ctx, center, hole, spin);
    ctx.clip('evenodd');
    // Deep at the edges, glowing toward the middle the swirl turns around.
    const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, far);
    glow.addColorStop(0, css(light));
    glow.addColorStop(.35, css(color.lerp(dark, .5)));
    glow.addColorStop(1, css(dark));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size.x, size.y);
    for (let k = 0; k < ARMS; k++)
        drawArm(ctx, center, far, spin + k * Math.PI * 2 / ARMS, k % 2 ? css(color) : css(color.lerp(light, .4)));
    drawSparkles(ctx, center, far, hole, spin, time);
    ctx.restore();

    if (hole > 1)
    {
        // A bright rim where the swirl meets the world.
        ctx.save();
        ctx.beginPath();
        traceEdge(ctx, center, hole, spin);
        ctx.lineWidth = 14;
        ctx.strokeStyle = css(light);
        ctx.shadowColor = css(light);
        ctx.shadowBlur = 30;
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();
    }
}

function traceEdge(ctx, center, radius, spin)
{
    for (let i = 0; i < EDGE_POINTS; i++)
    {
        const a = i / EDGE_POINTS * Math.PI * 2;
        const r = radius * (1 + EDGE_WOBBLE * Math.sin(a * EDGE_WAVES + spin * 2));
        const x = center.x + Math.cos(a) * r, y = center.y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
}

/** One spiral arm: a band that winds outward from the middle, widening as it goes. */
function drawArm(ctx, center, far, start, fill)
{
    const turns = 1.6, steps = ARM_STEPS;
    const at = (t, offset) =>
    {
        const r = 10 + far * 1.15 * t;
        const a = start + offset * (.25 + t * .9) - t * turns * Math.PI * 2;
        return [center.x + Math.cos(a) * r, center.y + Math.sin(a) * r];
    };
    ctx.beginPath();
    for (let i = 0; i <= steps; i++)
        ctx.lineTo(...at(i / steps, 0));
    for (let i = steps; i >= 0; i--)
        ctx.lineTo(...at(i / steps, .55));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

/** Twinkles drifting in toward the middle, only over the covered part. */
function drawSparkles(ctx, center, far, hole, spin, time)
{
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++)
    {
        const t = (time * .25 + i * .618) % 1;
        const r = hole + (far - hole) * (1 - t);
        const a = i * 2.39996 + spin * .6 + t * 2;
        const s = 5 + (i % 4) * 3;
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI) * .9;
        ctx.translate(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r);
        ctx.rotate(a);
        ctx.beginPath();
        for (let p = 0; p < 8; p++)
        {
            const q = p * Math.PI / 4, len = p % 2 ? s * .3 : s;
            ctx.lineTo(Math.cos(q) * len, Math.sin(q) * len);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
