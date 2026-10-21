// The wind-up toy mouse (T-016): a round grey felt mouse on two little wheels, with big pink
// ears, a bead eye, a pink nose, a string tail and a brass wind-up key in its back.
// Frazzled it trembles, its key whirrs round, its eye goes wide with a worried brow and a wobbly
// mouth, and jitter marks flick by its head (the sweat drops are particles). Calm, its eye
// closes in a happy curve, it blushes, smiles, and its key turns lazily.
// Pure drawing: drawWindupMouse(feet, look, time), plus its particles drawSweatDrop and drawSighPuff.
//
// Art units: 1 = one tile, origin between the wheels, y up, drawn facing right (mirrored for left).
import { vec2, drawEllipse, lerp } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { TOY_LINE } from './toyParts.js';

const OUT = TOY_LINE;

/**
 * @param {Vector2} feet - bottom center (where the wheels touch the ground)
 * @param {{facing:number, upset:number, calm:number, keyAngle:number, wheel:number, hop:number,
 *          blink:number, squash:number, palette:object}} m
 *   upset: 1 frazzled .. 0 not; calm: 0 .. 1 content (happy eye, blush); keyAngle/wheel: radians
 */
export function drawWindupMouse(feet, m, time)
{
    const P = m.palette;
    const upset = m.upset;
    // Trembling: a fast sideways jitter and wobble, scaled by how frazzled it is.
    const shake = Math.sin(time * 47) * .045 * upset + Math.sin(time * 31 + 1) * .02 * upset;
    const tilt = Math.sin(time * 39) * .07 * upset;
    drawEllipse(feet.add(vec2(0, .02)), vec2(.82 - m.hop * .6, .12), P.shadow);
    const root = ArtFrame.root(feet.add(vec2(shake, m.hop)), {
        mirror: m.facing < 0 ? -1 : 1, stretchX: 1 - m.squash * .5, stretchY: 1 + m.squash, tilt, pivotY: .1,
    });
    drawTail(root, P, upset, time);
    drawWheels(root, P, m.wheel);
    drawEar(root, P, .1, .5, .9, upset, time, true);
    drawBody(root, P);
    drawKey(root, P, m.keyAngle);
    drawEar(root, P, .23, .49, 1, upset, time, false);
    drawFace(root, P, m, time);
    if (upset > .3)
        drawJitterMarks(root, P, upset, time);
}

function drawTail(root, P, upset, time)
{
    // A string tail that loops up behind; frazzled, it wiggles fast.
    const points = [];
    for (let i = 0; i <= 12; i++)
    {
        const t = i / 12;
        const wiggle = Math.sin(time * (4 + upset * 18) - t * 5) * (.02 + upset * .05) * t;
        const a = Math.PI * (1 - t * 1.25);
        points.push([-.38 - t * .22 + Math.cos(a) * .1 * t, .2 + Math.sin(a) * .2 * t + t * .1 + wiggle]);
    }
    root.line(points, .06, P.outline);
    root.line(points, .03, P.mouseEar);
}

function drawWheels(root, P, angle)
{
    for (const x of [-.18, .17])
    {
        root.outlinedEllipse(x, .07, .14, .14, P.wheel, P.outline, OUT * .8);
        for (const k of [0, Math.PI / 2])
        {
            const a = angle + k, c = Math.cos(a) * .045, s = Math.sin(a) * .045;
            root.line([[x - c, .07 - s], [x + c, .07 + s]], .018, P.plateLight);
        }
        root.circle(x, .07, .04, P.plate);
    }
}

function drawEar(root, P, x, y, size, upset, time, far)
{
    // Frazzled ears twitch now and then; calm ones relax back a little.
    const twitch = Math.max(0, Math.sin(time * 9 + (far ? 1.7 : 0))) ** 6 * .25 * upset;
    const ear = root.child(x, y, .25 - twitch + (1 - upset) * .12, size);
    ear.outlinedEllipse(0, .08, .26, .27, far ? P.mouseFurDark : P.mouseFur, P.outline, OUT);
    ear.ellipse(.01, .085, .16, .17, P.mouseEar);
    if (!far)
        ear.ellipse(-.04, .13, .05, .04, P.shine);
}

function drawBody(root, P)
{
    // An egg of felt tapering to the nose: a round back and a smaller front, outlined together.
    root.ellipse(-.04, .3, .72 + OUT * 2, .5 + OUT * 2, P.outline);
    root.ellipse(.22, .24, .46 + OUT * 2, .32 + OUT * 2, P.outline, -.15);
    root.ellipse(-.04, .3, .72, .5, P.mouseFurDark);
    root.ellipse(.22, .24, .46, .32, P.mouseFurDark, -.15);
    root.ellipse(-.03, .32, .68, .44, P.mouseFur);
    root.ellipse(.22, .26, .42, .27, P.mouseFur, -.15);
    root.ellipse(.0, .14, .58, .14, P.mouseBelly);
    root.ellipse(-.12, .44, .34, .1, P.mouseFurLight, .2);
    // A felt seam stitched along its back.
    for (let i = 0; i < 6; i++)
    {
        const a = Math.PI * (.85 - i * .1);
        const x0 = -.04 + Math.cos(a) * .3, y0 = .3 + Math.sin(a) * .2;
        const x1 = -.04 + Math.cos(a - .05) * .3, y1 = .3 + Math.sin(a - .05) * .2;
        root.line([[x0, y0], [x1, y1]], .014, P.mouseFurDark);
    }
}

/** The brass key, spinning round its upright stem (its bow is seen from the side, so it narrows). */
function drawKey(root, P, angle)
{
    const x = -.16, base = .52;
    root.line([[x, base - .04], [x, base + .14]], .06 + OUT * 2, P.outline);
    root.line([[x, base - .04], [x, base + .14]], .06, P.key);
    const c = Math.cos(angle), w = Math.abs(c);
    for (const side of [-1, 1])
    {
        const lx = x + side * .1 * c;
        root.outlinedEllipse(lx, base + .2, .05 + .13 * w, .13, P.key, P.outline, OUT * .8);
        if (w > .3)
            root.ellipse(lx, base + .2, .05 * w, .05, P.outline);
    }
    root.outlinedEllipse(x, base + .2, .07, .07, P.key, P.outline, OUT * .6);
    root.ellipse(x - .02, base + .07, .02, .06, P.shine);
}

function drawFace(root, P, m, time)
{
    const ex = .31, ey = .34;
    const upset = m.upset, calm = m.calm;
    if (calm > .5)
    {
        // Content: a happy closed eye and a rosy cheek.
        root.arc(ex, ey - .03, .12, .1, Math.PI * .15, Math.PI * .85, .028, P.bead, 8);
        root.ellipse(ex + .02, ey - .1, .1, .05, P.blush);
    }
    else if (m.blink > .5)
        root.arc(ex, ey + .01, .1, .05, Math.PI * 1.1, Math.PI * 1.9, .026, P.bead, 6);
    else
    {
        // Wide-eyed when frazzled (a white eye with a small darting bead), a bead eye otherwise.
        const white = lerp(.07, .17, upset);
        root.outlinedEllipse(ex, ey, white, white * 1.1, P.mouseBelly, P.outline, OUT * .6 * upset);
        const dart = Math.sin(time * 13) * .02 * upset;
        const bead = lerp(.1, .065, upset);
        root.ellipse(ex + .015 + dart, ey - .005, bead, bead * 1.15, P.bead);
        root.circle(ex - .005 + dart, ey + .02, .03, P.shine);
    }
    if (upset > .3)   // a worried brow, its inner end up
        root.line([[ex - .07, ey + .1], [ex + .06, ey + .14 - .03 * Math.sin(time * 9)]], .025, P.outline);
    // The nose, whiskers and mouth.
    root.outlinedEllipse(.47, .22, .1, .085, P.mouseNose, P.outline, OUT * .7);
    root.circle(.455, .235, .03, P.shine);
    for (const [dy, droop] of [[.02, .03], [-.01, -.01], [-.04, -.05]])
        root.line([[.42, .2 + dy], [.56, .2 + dy + droop]], .01, P.outline.withAlpha(.6));
    if (upset > .3)
    {
        const wob = [];
        for (let i = 0; i <= 6; i++)
            wob.push([.33 + i * .016, .15 + Math.sin(i * 2.2 + time * 20) * .012]);
        root.line(wob, .018, P.outline);
    }
    else
        root.arc(.38, .17, .1, .06, Math.PI * 1.15, Math.PI * 1.85, .02, P.outline, 6);
}

/** Little flicking tick marks round its head: the cartoon sign for "all a-tremble". */
function drawJitterMarks(root, P, upset, time)
{
    const flick = Math.floor(time * 8) % 2;
    const marks = flick ? [[.5, .55, .5], [.62, .42, .1]] : [[.56, .6, .7], [.66, .36, -.1]];
    for (const [x, y, a] of marks)
    {
        const dx = Math.cos(a) * .07, dy = Math.sin(a) * .07;
        root.line([[x, y], [x + dx, y + dy]], .03, P.outline.withAlpha(.8 * upset));
    }
    root.line([[-.5, .48], [-.56, .55]], .03, P.outline.withAlpha(.8 * upset * flick));
}

/** A sweat drop flying off its head. @param {{size:number, alpha:number, angle:number}} p */
export function drawSweatDrop(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size }).child(0, 0, p.angle);
    const c = p.color, o = p.outline;
    frame.poly([[-.36, .05], [0, .9], [.36, .05]], o.withAlpha(p.alpha));
    frame.circle(0, -.1, .86, o.withAlpha(p.alpha));
    frame.poly([[-.26, .05], [0, .72], [.26, .05]], c.withAlpha(p.alpha));
    frame.circle(0, -.1, .66, c.withAlpha(p.alpha));
    frame.ellipse(-.12, 0, .16, .26, p.shine.withAlpha(p.alpha * .9), .3);
}

/** A soft little cloud of a relieved sigh. @param {{size:number, alpha:number, progress:number}} p */
export function drawSighPuff(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size * (.7 + p.progress * .6) });
    const color = p.color.withAlpha(p.alpha * .85);
    for (const [x, y, d] of [[-.3, 0, .55], [0, .12, .7], [.32, 0, .55], [0, -.1, .5]])
        frame.circle(x, y, d, color);
}
