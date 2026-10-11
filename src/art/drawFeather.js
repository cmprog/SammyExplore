// A soft cartoon feather (menu marker, mouse cursor, "saved" icon). Canvas2D, screen pixels.
// Pure drawing: pos is the feather's center, it points up when angle = 0.

const DEFAULT_STYLE = {
    light: '#fff6df',
    dark: '#e9c98f',
    outline: '#3a2448',
    quill: '#9a6a3c',
    barb: 'rgba(160, 112, 60, .55)',
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number, y:number}} pos - center in canvas pixels
 * @param {{angle?:number, length?:number, style?:object, shadow?:boolean}} state
 */
export function drawFeather(ctx, pos, { angle = 0, length = 100, style = DEFAULT_STYLE, shadow = true } = {})
{
    const s = length / 100;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.scale(s, s);
    ctx.lineJoin = ctx.lineCap = 'round';

    if (shadow)
    {
        ctx.save();
        ctx.translate(5, 6);
        traceVane(ctx);
        ctx.fillStyle = 'rgba(10, 6, 30, .35)';
        ctx.fill();
        ctx.restore();
    }

    traceVane(ctx);
    const fill = ctx.createLinearGradient(-18, 0, 20, 0);
    fill.addColorStop(0, style.light);
    fill.addColorStop(.55, style.light);
    fill.addColorStop(1, style.dark);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = style.outline;
    ctx.stroke();

    // Barbs: a few soft strokes fanning out from the quill so it reads as a feather, not a leaf.
    ctx.strokeStyle = style.barb;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++)
    {
        const y = -30 + i * 13;
        ctx.beginPath();
        ctx.moveTo(1, y + 6);
        ctx.quadraticCurveTo(8, y, 14 - i, y - 6);
        ctx.moveTo(-1, y + 8);
        ctx.quadraticCurveTo(-7, y + 3, -12 + i, y - 2);
        ctx.stroke();
    }

    // Quill
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.quadraticCurveTo(2, 10, -3, 56);
    ctx.lineWidth = 4;
    ctx.strokeStyle = style.quill;
    ctx.stroke();

    // Shine along the light side
    ctx.beginPath();
    ctx.moveTo(-6, -30);
    ctx.quadraticCurveTo(-12, -8, -8, 14);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, .7)';
    ctx.stroke();
    ctx.restore();
}

function traceVane(ctx)
{
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.bezierCurveTo(22, -42, 24, 6, 4, 40);
    ctx.lineTo(-2, 42);
    ctx.bezierCurveTo(-20, 12, -18, -38, 0, -54);
    ctx.closePath();
}
