// Title screen art, isolated so it can be swapped out later:
//   drawTitleBackdrop -> replace with drawBackdrop (T-010) when it lands
//   drawTitleSammy    -> replace with drawSammy (T-005) when it lands
// Canvas2D in screen pixels (call inside drawScreenCanvas). Pure functions of (pos, state, time).

const SKY = ['#0a0b2b', '#1b1a4d', '#3a2d68', '#5b3f74'];
const STAR_COUNT = 90;

// Fixed star field: a tiny deterministic hash, so the sky doesn't reshuffle every frame.
const STARS = Array.from({ length: STAR_COUNT }, (_, i) =>
{
    const r = n => fract(Math.sin(i * 127.1 + n * 311.7) * 43758.5453);
    return { x: r(1), y: r(2) * .62, size: 1.5 + r(3) * 3.5, phase: r(4) * 6.28, speed: .8 + r(5) * 1.8 };
});

/** Night sky: gradient, twinkling stars, a glowing moon, and rolling hill silhouettes. */
export function drawTitleBackdrop(ctx, size, time)
{
    const sky = ctx.createLinearGradient(0, 0, 0, size.y);
    SKY.forEach((color, i) => sky.addColorStop(i / (SKY.length - 1), color));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size.x, size.y);

    for (const star of STARS)
    {
        const twinkle = .55 + .45 * Math.sin(time * star.speed + star.phase);
        drawStar(ctx, star.x * size.x, star.y * size.y, star.size * (.7 + .3 * twinkle), twinkle);
    }

    drawMoon(ctx, { x: size.x * .915, y: size.y * .15 }, time);
    drawHill(ctx, size, size.y * .80, 260, .0016, 0, '#2a2152');
    drawHill(ctx, size, size.y * .88, 120, .0026, 1.7, '#1b1538');
}

function drawStar(ctx, x, y, r, brightness)
{
    ctx.fillStyle = `rgba(255, 246, 210, ${.35 + .65 * brightness})`;
    ctx.beginPath();
    // Four-point twinkle for the bigger stars, dots for the rest.
    if (r > 3.6)
    {
        ctx.moveTo(x, y - r * 2.2);
        ctx.quadraticCurveTo(x, y, x + r * 2.2, y);
        ctx.quadraticCurveTo(x, y, x, y + r * 2.2);
        ctx.quadraticCurveTo(x, y, x - r * 2.2, y);
        ctx.quadraticCurveTo(x, y, x, y - r * 2.2);
    }
    else
        ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawMoon(ctx, pos, time)
{
    const r = 95;
    const glow = ctx.createRadialGradient(pos.x, pos.y, r * .6, pos.x, pos.y, r * 3);
    glow.addColorStop(0, `rgba(255, 240, 190, ${.32 + .04 * Math.sin(time)})`);
    glow.addColorStop(1, 'rgba(255, 240, 190, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(pos.x - r * 3, pos.y - r * 3, r * 6, r * 6);

    const body = ctx.createRadialGradient(pos.x - r * .3, pos.y - r * .35, r * .2, pos.x, pos.y, r);
    body.addColorStop(0, '#fffbe6');
    body.addColorStop(1, '#f3dc9c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Soft craters
    ctx.fillStyle = 'rgba(214, 180, 110, .35)';
    for (const [dx, dy, cr] of [[.3, .2, .18], [-.25, .35, .12], [.05, -.35, .1]])
    {
        ctx.beginPath();
        ctx.arc(pos.x + dx * r, pos.y + dy * r, cr * r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawHill(ctx, size, baseY, amplitude, frequency, phase, color)
{
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size.y);
    for (let x = 0; x <= size.x; x += 40)
        ctx.lineTo(x, baseY - Math.sin(x * frequency + phase) * amplitude * .5 - amplitude * .3);
    ctx.lineTo(size.x, size.y);
    ctx.closePath();
    ctx.fill();
}

/**
 * Placeholder Sammy until drawSammy (T-005) exists: a round cartoon owl perched on a branch,
 * with an idle bob, breathing squash, and blinks.
 * @param {{x:number, y:number}} pos - where the feet grip the branch
 * @param {{scale?:number}} state
 */
export function drawTitleSammy(ctx, pos, { scale = 1 } = {}, time = 0)
{
    drawBranch(ctx, pos, scale);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(scale, scale);
    ctx.lineJoin = ctx.lineCap = 'round';

    const breathe = Math.sin(time * 2.4);
    const bob = breathe * 5;
    // Squash and stretch with the breath: wider when low, taller when high.
    ctx.translate(0, bob);
    ctx.scale(1 + breathe * .02, 1 - breathe * .02);

    const outline = '#2a1a33';
    // Body
    ellipse(ctx, 0, -120, 105, 125, '#8a5a3c', outline, 7);
    ellipse(ctx, 0, -95, 70, 88, '#e9cfa6', null);           // belly
    for (let i = 0; i < 3; i++)                               // belly feather marks
        for (let j = -1; j <= 1; j++)
        {
            ctx.beginPath();
            ctx.arc(j * 26 + (i % 2) * 13 - 6, -120 + i * 30, 9, .2, Math.PI - .2);
            ctx.strokeStyle = 'rgba(140, 95, 60, .55)';
            ctx.lineWidth = 3.5;
            ctx.stroke();
        }
    // Wings, with a little flutter now and then
    const flutter = Math.max(0, Math.sin(time * 1.3) ** 30) * .25;
    for (const side of [-1, 1])
    {
        ctx.save();
        ctx.translate(side * 88, -140);
        ctx.rotate(side * (.18 + flutter));
        ellipse(ctx, 0, 40, 34, 78, '#734630', outline, 6);
        ctx.restore();
    }
    // Ear tufts
    for (const side of [-1, 1])
    {
        ctx.beginPath();
        ctx.moveTo(side * 40, -225);
        ctx.quadraticCurveTo(side * 70, -270, side * 92, -282);
        ctx.quadraticCurveTo(side * 90, -240, side * 78, -208);
        ctx.closePath();
        ctx.fillStyle = '#734630';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = outline;
        ctx.stroke();
    }
    // Face disc
    ellipse(ctx, 0, -178, 92, 64, '#f4e2c2', outline, 5);
    // Eyes: blink every few seconds, quick double-blink sometimes.
    const cycle = time % 4.2;
    const blink = cycle < .14 || (cycle > .3 && cycle < .4 && Math.floor(time / 4.2) % 3 === 0);
    const look = Math.sin(time * .7) * 5;
    for (const side of [-1, 1])
        drawEye(ctx, side * 42, -180, blink, look, outline);
    // Beak
    ctx.beginPath();
    ctx.moveTo(-13, -160);
    ctx.quadraticCurveTo(0, -152, 13, -160);
    ctx.quadraticCurveTo(4, -132, 0, -128);
    ctx.quadraticCurveTo(-4, -132, -13, -160);
    ctx.fillStyle = '#f6a93b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = outline;
    ctx.stroke();
    // Rosy cheeks
    for (const side of [-1, 1])
        ellipse(ctx, side * 70, -150, 14, 8, 'rgba(255, 130, 150, .45)', null);
    // Feet
    for (const side of [-1, 1])
        for (let t = -1; t <= 1; t++)
            ellipse(ctx, side * 30 + t * 11, -bob - 2, 8, 12, '#f6a93b', outline, 3.5);
    ctx.restore();
}

function drawEye(ctx, x, y, blink, look, outline)
{
    if (blink)
    {
        ctx.beginPath();
        ctx.arc(x, y - 4, 24, .25, Math.PI - .25);
        ctx.lineWidth = 6;
        ctx.strokeStyle = outline;
        ctx.stroke();
        return;
    }
    ellipse(ctx, x, y, 32, 34, '#fffdf5', outline, 5);
    ellipse(ctx, x + look, y + 3, 19, 21, '#2a1a33', null);
    ellipse(ctx, x + look - 7, y - 6, 7, 7, '#ffffff', null);
    ellipse(ctx, x + look + 6, y + 9, 3.5, 3.5, 'rgba(255, 255, 255, .8)', null);
}

function drawBranch(ctx, pos, scale)
{
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e1430';
    ctx.lineWidth = 46 * scale;
    ctx.beginPath();
    ctx.moveTo(pos.x - 520 * scale, pos.y + 40 * scale);
    ctx.quadraticCurveTo(pos.x, pos.y - 6 * scale, pos.x + 300 * scale, pos.y + 24 * scale);
    ctx.stroke();
    ctx.strokeStyle = '#4a3326';
    ctx.lineWidth = 34 * scale;
    ctx.stroke();
    // A couple of leaves for cuteness
    for (const [dx, dy, a] of [[-330, 20, -.6], [200, 6, .5]])
    {
        ctx.save();
        ctx.translate(pos.x + dx * scale, pos.y + dy * scale);
        ctx.rotate(a);
        ellipse(ctx, 0, -28 * scale, 14 * scale, 30 * scale, '#3f7a4a', '#1e1430', 4);
        ctx.restore();
    }
    ctx.restore();
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 4)
{
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill)
    {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke)
    {
        ctx.lineWidth = width;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}

function fract(x)
{
    return x - Math.floor(x);
}
