// Sammy the owl, drawn from layered primitives. A pure function of (pos, pose, time): all the
// remembered animation (squash spring, eased wings, flap stroke, run phase) arrives in `pose`,
// worked out by SammyAnimator. Anything missing from the pose falls back to the state's resting
// look (data/sammyPoses.js), so a bare { state: 'idle' } draws a happy idle owl too.
//
// Art units: 1 = one world tile at scale 1. Origin between the feet, y up, drawn facing right
// and mirrored for facing left. The face is turned a little toward the facing side (3/4 view)
// so the direction Sammy is heading always reads, even when the wings are spread symmetric.
import { ArtFrame } from './ArtFrame.js';
import { SAMMY_PALETTE as P } from '../data/palettes.js';
import { SAMMY_POSES, FRONT_WING_MAX_ROT } from '../data/sammyPoses.js';
import { SAMMY_ANIM as A } from '../data/tuning.js';

const OUTLINE = .042;           // soft dark outline around every part, art units
const BODY = { y: .47, w: .86, h: .9 };
const PIVOT_Y = BODY.y;          // body lean turns around the middle of the body
const SHOULDER = { x: .34, y: .5 };
const WING = { w: .25, l: .42 };
const HEAD_PIVOT_Y = .55;
const EYE = { x: .16, y: .63, w: .27, h: .29 };
const FACE_TURN = .055;          // how far the face slides toward the facing side

/**
 * @param {Vector2} pos - world position between Sammy's feet (bottom center)
 * @param {object} pose - see SammyAnimator.pose(); every field optional except `state`
 * @param {number} time - seconds, for breathing and blinks
 * @param {{scale?:number}} [opts] - scale: world units per art unit (the title draws a big Sammy)
 */
export function drawSammy(pos, pose, time, { scale = 1 } = {})
{
    const look = lookFor(pose, time);
    const root = ArtFrame.root(pos, {
        scale,
        mirror: look.facing,
        stretchX: 1 - look.squash * .5,
        stretchY: 1 + look.squash,
        tilt: look.tilt,
        pivotY: PIVOT_Y,
    });
    const body = root.child(0, look.bob);

    if (look.shadow)
        drawShadow(ArtFrame.root(pos, { scale }), look);
    if (!look.wingsFront)
        drawWings(body, look);
    drawTufts(body.child(0, HEAD_PIVOT_Y, look.headTilt), look);
    drawFeet(root, look);
    drawBody(body, look);
    drawFace(body.child(0, HEAD_PIVOT_Y, look.headTilt), look);
    if (look.wingsFront)
        drawWings(body, look);
}

// --- pose -> look -----------------------------------------------------------------------------

/** Everything the drawing needs, with per-state fallbacks and the time-based touches folded in. */
function lookFor(pose, time)
{
    const state = SAMMY_POSES[pose.state] ? pose.state : 'idle';
    const rest = SAMMY_POSES[state];
    const wing = pose.wing ?? rest.wing;
    const eyes = pose.eyes ?? rest.eyes;
    const stateTime = pose.stateTime ?? time;
    const stroking = (pose.flapAge ?? Infinity) < A.FLAP_STROKE_TIME;
    const grounded = pose.grounded ?? (state === 'idle' || state === 'run' || state === 'land');
    const look = {
        state,
        facing: pose.facing ?? 1,
        squash: pose.squash ?? 0,
        tilt: pose.tilt ?? 0,
        tuft: pose.tuft ?? 0,
        wing,
        wingsFront: wing.rot < FRONT_WING_MAX_ROT && !stroking,
        flutter: 0,
        eyeOpen: eyes.open,
        pupil: eyes.pupil,
        blink: blinkAmount(time),
        headTilt: 0,
        lookFront: 0,
        bob: 0,
        runPhase: pose.runPhase ?? 0,
        running: state === 'run',
        airborne: !grounded,
        shadow: pose.shadow ?? grounded,
    };
    if (state === 'idle')
        addIdlePersonality(look, stateTime, time);
    else if (state === 'run')
        addWaddle(look);
    else if (state === 'fall' && !stroking)
        look.flutter = Math.sin(time * 26) * .12;    // little panicky flutter on the way down
    return look;
}

function addIdlePersonality(look, idleTime, time)
{
    const breath = Math.sin(time * A.BREATHE_SPEED);
    look.squash += breath * .022;
    look.bob = breath * .008;
    const t = idleTime % A.IDLE_CYCLE;
    look.headTilt = A.IDLE_TILT * bump(t, A.IDLE_TILT_AT, A.IDLE_TILT_TIME);
    look.lookFront = bump(t, A.IDLE_LOOK_AT, A.IDLE_LOOK_TIME);
    look.pupil *= 1 + .15 * look.lookFront;          // big round eyes straight at you
}

function addWaddle(look)
{
    const step = Math.sin(look.runPhase);
    look.bob = Math.abs(step) * A.RUN_BOUNCE;
    look.tilt += step * A.RUN_SWAY;
    look.headTilt = -step * A.RUN_SWAY * .5;         // the head steadies against the waddle
}

/** 0 open .. 1 closed. A quick blink every few seconds, a double blink every third time. */
function blinkAmount(time)
{
    const cycle = Math.floor(time / A.BLINK_EVERY);
    const t = time - cycle * A.BLINK_EVERY;
    const one = s => Math.max(0, 1 - Math.abs((t - s) / (A.BLINK_TIME / 2)));
    return Math.min(1, one(A.BLINK_TIME / 2) + (cycle % 3 === 2 ? one(A.BLINK_TIME * 2.2) : 0)) ** .6;
}

/** Smooth 0 -> 1 -> 0 over [start, start + length]. */
function bump(t, start, length)
{
    const x = (t - start) / length;
    if (x <= 0 || x >= 1)
        return 0;
    const ease = v => v * v * (3 - 2 * v);
    return ease(Math.min(x / .25, 1)) * ease(Math.min((1 - x) / .25, 1));
}

// --- parts, back to front ---------------------------------------------------------------------

function drawShadow(ground, look)
{
    const w = .72 * (1 - look.squash * .4) * (1 - look.bob * 3);
    ground.ellipse(0, .005, w, .13, P.shadow);
}

function drawWings(body, look)
{
    for (const side of [-1, 1])
    {
        // Flapping wings stroke a hair out of sync, which reads as effort rather than machinery.
        const rot = look.wing.rot + look.flutter * side + wingSwing(look, side);
        const shoulder = body.child(side * SHOULDER.x, SHOULDER.y, side * rot);
        drawWing(shoulder, side, look.wing.spread, look.wing.length);
    }
}

/** Running: the folded wings swing a little with each step, like arms. */
function wingSwing(look, side)
{
    return look.running ? Math.max(0, Math.sin(look.runPhase) * side) * .35 : 0;
}

/** One wing in its own frame: it hangs along -y from the shoulder at the origin. Round at the
 *  shoulder, tapering to a tip, with three flight feathers fanning out past it. */
function drawWing(frame, side, spread, length)
{
    const l = WING.l * length, w = WING.w;
    // Even folded, the flight feathers fan a little so their tips scallop the end of the wing.
    const fanned = .2 + spread * .8;
    const fan = [-1, 0, 1].map(i => frame.child(i * w * .14, -l * .3, -side * i * fanned * .3));
    const feather = l * (.6 + .1 * spread), fw = w * .42;
    // Outline pass for every piece first, so the whole wing has one clean silhouette.
    // Rounded feather tips, so the wing edge is a soft scallop rather than claws.
    for (const f of fan)
        f.ellipse(0, -feather / 2, fw + OUTLINE * 2, feather + OUTLINE * 2, P.outline);
    frame.poly(teardrop(w + OUTLINE * 2, w * .2 + OUTLINE, -l * .86 - OUTLINE), P.outline);
    for (const f of fan)
        f.ellipse(0, -feather / 2, fw, feather, P.wingTip);
    frame.poly(teardrop(w, w * .2, -l * .86), P.wing);
    // Covert feathers: a lighter cap at the shoulder with a scalloped lower edge.
    frame.ellipse(0, -l * .2, w * .78, l * .34, P.wingLight);
    for (const i of [-1, 0, 1])
        frame.circle(i * w * .24, -l * (.36 - Math.abs(i) * .03), w * .3, P.wingLight);
    for (const i of [-1, 1])
        frame.line([[i * w * .12, -l * .5], [i * w * .1, -l * .74]], .018, P.wingTip);
}

/** An egg pointing down -y: a round cap whose top is at `top`, tapering to a soft tip at `bottom`. */
function teardrop(w, top, bottom)
{
    const r = w / 2, cy = top - r * .9;
    const points = [];
    for (let i = 0; i <= 10; i++)
    {
        const a = i / 10 * Math.PI;
        points.push([Math.cos(a) * r, cy + Math.sin(a) * r * .9]);
    }
    // Down the left side to the tip and back up the right, bulging out a little on the way.
    const side = (sign, t) => [sign * r * (1 - t ** 2.2) ** .6 * (1 + .1 * Math.sin(t * Math.PI)), cy - t * (cy - bottom)];
    for (let i = 1; i < 8; i++)
        points.push(side(-1, i / 8));
    points.push([0, bottom]);
    for (let i = 7; i >= 1; i--)
        points.push(side(1, i / 8));
    return points;
}

function drawTufts(head, look)
{
    const turn = FACE_TURN * (1 - look.lookFront);
    for (const side of [-1, 1])
    {
        // The tuft pivots at its base, drooping outward on the way up and flicking up on the way down.
        const base = head.child(side * .21 + turn * .6, .22, -side * look.tuft);
        const points = [[-side * .12, -.05], [side * .1, -.03], [side * .2, .27], [side * .12, .23]];
        base.poly(points, P.body, OUTLINE, P.outline);
        base.poly([[-side * .02, 0], [side * .08, .0], [side * .16, .19], [side * .1, .16]], P.bodyLight);
    }
}

function drawFeet(root, look)
{
    for (const side of [-1, 1])
    {
        let lift = 0, forward = 0, droop = 0;
        if (look.running)
        {
            const step = Math.sin(look.runPhase) * side;
            lift = Math.max(0, step) * .1;
            forward = Math.cos(look.runPhase) * side * .05;
        }
        else if (look.airborne)
        {
            lift = look.state === 'glide' ? .12 : .02;   // tucked up while gliding
            droop = .5;                                   // toes point down, dangling
        }
        const foot = root.child(side * .13 + forward, .035 + lift, 0);
        for (const t of [-1, 0, 1])
            foot.ellipse(t * .045, -.005, .07 + OUTLINE * 2, .085 + OUTLINE * 2, P.outline, t * droop * .4);
        for (const t of [-1, 0, 1])
            foot.ellipse(t * .045, -.005, .07, .085, P.feet, t * droop * .4);
    }
}

function drawBody(body, look)
{
    const { y, w, h } = BODY;
    body.ellipse(0, y, w + OUTLINE * 2, h + OUTLINE * 2, P.outline);
    body.ellipse(0, y, w, h, P.rim);
    body.ellipse(0, y - .012, w - .01, h - .026, P.bodyShade);
    body.ellipse(-.01, y + .02, w - .07, h - .1, P.body);
    body.ellipse(-.13, y + .2, .22, .15, P.bodyLight.withAlpha(.55), .5);
    drawBelly(body, look);
}

function drawBelly(body, look)
{
    const x = FACE_TURN * .5 * (1 - look.lookFront);
    body.ellipse(x, .31, .54, .5, P.belly);
    // Rows of little U-shaped feather marks, fewer toward the bottom.
    const rows = [[.42, [-.13, 0, .13]], [.31, [-.07, .07]], [.2, [0]]];
    for (const [y, xs] of rows)
        for (const mx of xs)
            body.arc(x + mx, y + .02, .085, .06, Math.PI * 1.08, Math.PI * 1.92, .024, P.bellyMark.withAlpha(.75), 6);
}

function drawFace(head, look)
{
    const turn = FACE_TURN * (1 - look.lookFront);
    const y = EYE.y - HEAD_PIVOT_Y;
    // Heart-shaped face: two overlapping discs, with a dip of body color between them at the top.
    for (const side of [-1, 1])
    {
        const far = side < 0 ? 1 - turn * 1.6 : 1;
        head.ellipse(side * EYE.x + turn, y - .01, .4 * far, .4, P.face);
    }
    head.poly([[turn - .08, y + .23], [turn + .08, y + .23], [turn, y + .1]], P.brow);
    for (const side of [-1, 1])
        head.ellipse(side * .25 + turn * 1.2, y - .1, .1, .055, P.cheek);
    for (const side of [-1, 1])
    {
        // The far eye is a touch narrower: the face is turned toward the facing side.
        const far = side < 0 ? 1 - turn * 1.6 : 1;
        drawEye(head.child(side * EYE.x + turn, y, 0, far, 1), look, side);
    }
    drawBeak(head, turn, y);
}

function drawEye(eye, look, side)
{
    const wide = Math.max(look.eyeOpen, 1);
    const w = EYE.w * wide, h = EYE.h * wide;
    // Blinks are all-or-nothing: they last a few frames, and a half-shut lid reads as grumpy.
    if (look.blink > .5)
    {
        // Closed: a soft smile-shaped lid line.
        eye.arc(0, -.01, w * .8, h * .5, Math.PI * 1.1, Math.PI * 1.9, .04, P.outline, 8);
        return;
    }
    eye.ellipse(0, 0, w + OUTLINE * 1.1, h + OUTLINE * 1.1, P.outline);
    eye.ellipse(0, 0, w, h, P.eyeWhite);
    // Pupils look the way Sammy faces, or straight out of the screen.
    const gaze = .028 * (1 - look.lookFront);
    const iris = .2 * look.pupil, pupil = .135 * look.pupil;
    eye.ellipse(gaze, -.005, iris, iris * 1.05, P.iris);
    eye.ellipse(gaze * 1.3, -.005, pupil, pupil * 1.08, P.pupil);
    eye.circle(gaze - .035, .045, .07, P.shine);
    eye.circle(gaze + .035, -.045, .032, P.shine.withAlpha(.85));
    if (look.eyeOpen < .98)
        drawSmileLid(eye, w, h, 1 - look.eyeOpen);
}

/** Happy squint: the cheek pushes up from below with an arched edge, so the eye reads as a smile.
 *  The lid is clipped to the eye, so it never spills over the rest of the face. */
function drawSmileLid(eye, w, h, amount)
{
    const rw = w / 2 + OUTLINE * .55, rh = h / 2 + OUTLINE * .55;
    const top = -rh + amount * h * .95;              // arch height in the middle of the eye
    const sag = h * .32 * Math.min(1, amount * 2);   // how much lower it meets the eye's sides
    const steps = 14, lower = [], upper = [];
    for (let i = 0; i <= steps; i++)
    {
        const x = rw * (i / steps * 2 - 1) * .995;
        const edge = rh * Math.sqrt(1 - (x / rw) ** 2);
        const arch = top - sag * (x / rw) ** 2;
        lower.push([x, -edge * 1.03]);
        upper.push([x, Math.min(edge, Math.max(-edge * 1.03 + .002, arch))]);
    }
    eye.poly([...lower, ...upper.reverse()], P.face);
    const lash = upper.filter(([, y], i) => i > 0 && i < steps && y > -rh * .9);
    if (lash.length > 1)
        eye.line(lash.reverse(), .035, P.outline);
}

function drawBeak(head, turn, y)
{
    const x = turn * 1.35;
    const points = [[x - .07, y - .05], [x + .07, y - .05], [x + .05, y - .11], [x + .01, y - .18], [x - .04, y - .11]];
    head.poly(points, P.beak, OUTLINE * .9, P.outline);
    head.poly([[x + .07, y - .05], [x + .05, y - .11], [x + .01, y - .18], [x + .01, y - .1]], P.beakShade);
    head.ellipse(x - .025, y - .07, .04, .025, P.shine.withAlpha(.6));
}
