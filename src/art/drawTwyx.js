// Twyx the tuxedo cat, drawn from layered primitives in the same round style as Sammy.
// A pure function of (pos, pose, time): the remembered animation (facing turn, sit and lick
// blends, blink, tail swish, pet reaction, squash spring, and since T-015 the trot cycle, leaps,
// head turns and the waiting look) arrives in `pose`, worked out by TwyxAnimator. Missing fields
// fall back to a calm standing cat, so drawTwyx(pos, {}, t) works.
//
// Art units: 1 = one tile. Origin between the feet, y up, drawn facing right and mirrored for
// facing left. Body shapes are data (data/twyxPoses.js), colors are TWYX_PALETTE.
// Black fur on a night sky: the fur is a soft charcoal with a moonlit rim along the top edge and
// a darker outline all round, so the silhouette reads against the darkest part of the sky.
import { lerp } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { TWYX_PALETTE as P } from '../data/palettes.js';
import { TWYX_SHAPES, TWYX_GAIT as GAIT, TWYX_FACE_TURN as TURN } from '../data/twyxPoses.js';
import { TWYX, TWYX_MOTION } from '../data/tuning.js';

const OUTLINE = .04;
const HEAD = { w: .66, h: .56 };
const LEG_W = .15;
const PAW = { w: .19, h: .11 };
const TAIL = { segments: 18, length: .78, width: .13, tipWidth: .1, maxBend: .3 };
const RIM_LIFT = .022;        // how far the moonlit rim peeks out above each fur shape

/**
 * @param {Vector2} pos - world position between Twyx's feet (bottom center)
 * @param {object} pose - see TwyxAnimator.pose(); every field optional
 * @param {number} time - seconds, for breathing and the tail wave
 * @param {{scale?:number}} [opts]
 */
export function drawTwyx(pos, pose, time, { scale = 1 } = {})
{
    const look = lookFor(pose, time);
    const shape = shapeFor(look);
    const root = ArtFrame.root(pos, {
        scale,
        mirror: look.mirror,
        stretchX: look.turnSqueeze * (1 - look.squash * .5),
        stretchY: 1 + look.squash,
        // In the air she noses up on the way up and down on the way down.
        tilt: look.airLean * .2 * look.air * look.mirror,
        pivotY: .4,
    });

    drawShadow(ArtFrame.root(pos, { scale }), look, shape);
    drawTail(root, look, shape.tail, time);
    drawLegs(root, shape, look, true);
    drawBodyOutline(root, shape, look);
    drawLegs(root, shape, look, false);
    drawBodyFill(root, shape);
    drawBib(root, shape.bib);
    const head = headFrame(root, shape, look);
    drawEars(head, look);
    drawHead(head);
    drawFace(head, look);
    if (look.lick > .01)
        drawLickPaw(root, shape, look, head);
}

// --- pose -> look -----------------------------------------------------------------------------

function lookFor(pose, time)
{
    const turn = pose.turn ?? pose.facing ?? 1;
    const breath = Math.sin(time * TWYX.BREATHE_SPEED);
    return {
        mirror: turn < 0 ? -1 : 1,
        // Turning around is a quick squeeze through the middle, like a paper cutout flipping.
        turnSqueeze: .3 + .7 * Math.min(1, Math.abs(turn)),
        squash: (pose.squash ?? 0) + breath * .018,
        sit: pose.sit ?? 0,
        lick: pose.lick ?? 0,
        lickTime: pose.lickTime ?? time,
        perk: pose.perk ?? 0,
        happy: pose.happy ?? 0,
        blink: pose.blink ?? 0,
        swish: pose.swish ?? 0,
        walk: pose.walk ?? 0,
        gait: pose.gait ?? 0,
        air: pose.air ?? 0,
        airLean: pose.airLean ?? 0,
        headTurn: pose.headTurn ?? 1,
        lookUp: pose.lookUp ?? 0,
        curious: pose.curious ?? 0,
        mrrp: pose.mrrp ?? 0,
        shake: pose.shake ?? 0,
    };
}

/** The body shape for the look: stand/sit by `sit`, then toward trot by `walk` and leap by
 *  `air`. Standing or sitting still is the data object itself (no blending, no allocation). */
function shapeFor(look)
{
    const ease = t => t * t * (3 - 2 * t);
    const { sit, walk, air } = look;
    let shape = sit <= 0 ? TWYX_SHAPES.stand
        : sit >= 1 ? TWYX_SHAPES.sit
        : blendShape(TWYX_SHAPES.stand, TWYX_SHAPES.sit, ease(sit));
    if (walk > 0)
        shape = trotBob(blendShape(shape, TWYX_SHAPES.trot, ease(walk)), look);
    if (air > 0)
        shape = blendShape(shape, TWYX_SHAPES.leap, ease(air));
    return shape;
}

/** The body rides up twice per trot cycle (once per footfall), the head nods a little behind
 *  it, and the raised tail bounces. Mutates a freshly blended shape. */
function trotBob(shape, { gait, walk })
{
    const bob = Math.abs(Math.sin(gait)) * GAIT.bob * walk;
    for (const part of [shape.body, shape.haunch, shape.bib, shape.tail])
        part.y += bob;
    shape.head.y += bob + Math.sin(gait * 2 - .6) * GAIT.headBob * walk;
    shape.frontLeg.hip += bob;
    shape.backLeg.hip += bob;
    shape.tail.angle += Math.sin(gait * 2 - 1.2) * GAIT.tailBounce * walk;
    return shape;
}

function blendShape(a, b, t)
{
    const out = {};
    for (const key of Object.keys(a))
    {
        out[key] = {};
        for (const field of Object.keys(a[key]))
            out[key][field] = lerp(a[key][field], b[key][field], t);
    }
    return out;
}

// --- parts, back to front ---------------------------------------------------------------------

function drawShadow(ground, look, shape)
{
    if (look.air >= 1)
        return;   // up in the air: her shadow is on the ground somewhere below, not at her feet
    const w = (.62 + .3 * (1 - look.sit)) * (1 - look.squash * .4);
    ground.ellipse(shape.body.x * look.mirror, .005, w, .12, P.shadow.scale(1, 1 - look.air));
}

/** One smooth band along a curved centerline, with round ends, so the tail tapers to a soft
 *  tip. Three passes (outline, moonlit rim, fur) of one polygon each keep it cheap to draw.
 *  A gentle wave runs along it all the time; a swish is a bigger, faster wave. */
function drawTail(root, look, tail, time)
{
    const n = TAIL.segments, step = TAIL.length / n;
    const spine = [];
    let x = tail.x, y = tail.y, angle = tail.angle;
    const amount = TWYX.TAIL_SWAY * (1 - look.swish) + TWYX.SWISH_SWAY * look.swish;
    const speed = lerp(TWYX.TAIL_SPEED, TWYX.SWISH_SPEED, look.swish);
    for (let i = 0; i <= n; i++)
    {
        spine.push({ x, y, angle });
        // The wave travels from base to tip and grows toward the tip, like a real tail flick.
        const wave = Math.sin(time * speed - i / n * 5) * amount * (.3 + i / n) * 4.5;
        // Bend grows toward the tip (2i/n averages to 1), so the tail hooks like a question mark.
        // Capped per segment so the inside of a tight curl never folds over itself.
        angle += Math.max(-TAIL.maxBend, Math.min(TAIL.maxBend, (tail.curl * 2 * i / n + wave) / n));
        x += Math.cos(angle) * step;
        y += Math.sin(angle) * step;
    }
    const half = i => lerp(TAIL.width, TAIL.tipWidth, i / n) / 2;
    root.poly(tailBand(spine, half, OUTLINE, 0), P.outline);
    root.poly(tailBand(spine, half, 0, RIM_LIFT * .45), P.rim);
    root.poly(tailBand(spine, half, -.006, -.006), P.fur);
}

/** Outline of the band: down one side, round tip cap, back up the other side, round base cap. */
function tailBand(spine, half, grow, lift)
{
    const n = spine.length - 1;
    const side = sign => spine.map(({ x, y, angle }, i) =>
    {
        const r = half(i) + grow;
        return [x - Math.sin(angle) * r * sign, y + lift + Math.cos(angle) * r * sign];
    });
    const cap = (i, from) =>
    {
        const { x, y, angle } = spine[i], r = half(i) + grow, points = [];
        for (let k = 1; k < 6; k++)
        {
            const a = angle + from - k / 6 * Math.PI;
            points.push([x + Math.cos(a) * r, y + lift + Math.sin(a) * r]);
        }
        return points;
    };
    return [...side(1), ...cap(n, Math.PI / 2), ...side(-1).reverse(), ...cap(0, -Math.PI / 2)];
}

/** Far legs (behind the body, shaded) or near legs: stubby, each ending in a white paw. Each
 *  leg runs from its hip down to its paw, so a swinging or reaching paw tilts the leg with it. */
function drawLegs(root, shape, look, far)
{
    const raised = look.lick;
    for (const leg of [shape.backLeg, shape.frontLeg])
    {
        const front = leg === shape.frontLeg;
        // Far legs sit a little behind and toward the back, as seen from the 3/4 angle.
        const x = leg.x + (far ? -.07 : 0);
        if (front && !far && raised > .5)
            continue;   // that paw is up at the mouth (drawLickPaw)
        const fur = far ? P.furShade : P.fur;
        const paw = far ? P.whiteShade : P.white;
        const { dx, lift } = legSwing(look, front, far);
        const top = leg.hip + .02, bottom = lift - .02;
        const px = x + dx, drop = top - bottom;
        const h = Math.hypot(dx, drop), angle = Math.atan2(dx, drop);
        const cx = (x + px) / 2, cy = (top + bottom) / 2;
        const pawY = PAW.h / 2 + lift;
        root.ellipse(cx, cy, LEG_W + OUTLINE * 2, h + OUTLINE * 2, P.outline, angle);
        root.ellipse(px + .04, pawY, PAW.w + OUTLINE * 2, PAW.h + OUTLINE * 2, P.outline);
        root.ellipse(cx, cy, LEG_W, h, fur, angle);
        root.ellipse(px + .04, pawY, PAW.w, PAW.h, paw);
        if (!far)
            for (const toe of [-.035, .035])
                root.line([[px + .04 + toe, pawY - .04], [px + .04 + toe, pawY - .005]], .014, P.whiteShade);
    }
}

/** Where a paw is in the trot cycle (diagonal pairs: near front with far back) and in a leap. */
function legSwing(look, front, far)
{
    if (look.walk <= 0 && look.air <= 0)
        return { dx: 0, lift: 0 };
    const phase = look.gait + (front !== far ? 0 : Math.PI);
    const reach = front ? GAIT.reach.front : GAIT.reach.back;
    return {
        dx: Math.sin(phase) * GAIT.stride * look.walk + reach.dx * look.air,
        // Lifted while swinging forward (cos > 0), planted while pushing back.
        lift: Math.max(0, Math.cos(phase)) * GAIT.lift * look.walk + reach.lift * look.air,
    };
}

function drawBodyOutline(root, { body, haunch })
{
    root.ellipse(body.x, body.y, body.w + OUTLINE * 2, body.h + OUTLINE * 2, P.outline, body.tilt);
    root.ellipse(haunch.x, haunch.y, haunch.w + OUTLINE * 2, haunch.h + OUTLINE * 2, P.outline, haunch.tilt);
}

/** Rim (moonlight on the top edge), shade underneath, fur on top, then a soft sheen. */
function drawBodyFill(root, { body, haunch })
{
    for (const part of [body, haunch])
        root.ellipse(part.x, part.y, part.w, part.h, P.rim, part.tilt);
    for (const part of [body, haunch])
        root.ellipse(part.x, part.y - .01, part.w - .006, part.h - .02, P.furShade, part.tilt);
    for (const part of [body, haunch])
        root.ellipse(part.x + .005, part.y - .006 - RIM_LIFT * .3, part.w - .04, part.h - RIM_LIFT * 2.4, P.fur, part.tilt);
    // The thigh: a darker crescent along the front of the haunch.
    root.arc(haunch.x, haunch.y, haunch.w * .92, haunch.h * .92, -1.1, .9, .028, P.furShade, 8);
    root.ellipse(body.x - body.w * .18, body.y + body.h * .22, body.w * .3, body.h * .18, P.furLight.withAlpha(.6), body.tilt + .2);
}

/** The white tuxedo shirt front, with a little shading at its bottom edge. */
function drawBib(root, bib)
{
    root.ellipse(bib.x, bib.y, bib.w, bib.h, P.whiteShade, bib.tilt);
    root.ellipse(bib.x + .01, bib.y + .02, bib.w - .03, bib.h - .05, P.white, bib.tilt);
    // Fluffy chest tuft: two little scallops at the bottom of the bib.
    for (const dx of [-.05, .05])
        root.circle(bib.x + dx + .01, bib.y - bib.h * .38, .09, P.white);
}

function headFrame(root, shape, look)
{
    // Licking: the head dips forward to meet the paw. Petted: a happy little upward tilt.
    // lookUp tilts her face toward Sammy; waiting, she cocks her head a little (curious).
    // headTurn below 0: she's looking back over her shoulder (the head flips, squeezing through
    // the middle like the body does when she turns round).
    const dip = look.lick * (1 - look.happy);
    const x = shape.head.x + dip * .05, y = shape.head.y - dip * .08;
    const back = look.headTurn < 0 ? -1 : 1;
    const squeeze = back * (.35 + .65 * Math.min(1, Math.abs(look.headTurn)));
    // Looking back, the head swings round over her shoulder: drawn back over the body and lifted.
    const over = Math.max(0, -look.headTurn);
    const tilt = (look.lookUp + look.curious * .13 + over * .12) * back + look.shake * TWYX_MOTION.SHAKE_ANGLE;
    return root.child(x - over * .12, y + over * .04, -dip * .28 + look.happy * .08 + tilt, squeeze, 1);
}

function drawEars(head, look)
{
    for (const side of [-1, 1])
    {
        // Near ear (+1) a touch bigger: the face is turned toward the facing side.
        const size = (side > 0 ? 1 : .9) * (1 + look.perk * .12);
        // Curious (waiting): the far ear tips out a little, the classic "hm?" ear.
        const lean = side * (.32 - look.perk * .22) + (side < 0 ? -look.curious * .2 : 0);
        const ear = head.child(side * .17 + TURN * .5, .17 + look.perk * .025, -lean, size);
        const outer = [[-.12, -.02], [.11, -.02], [.035, .2], [.0, .215], [-.03, .2]];
        ear.poly(outer, P.fur, OUTLINE * .95, P.outline);
        ear.poly([[-.12, .01], [.11, .01], [.035, .2], [.0, .215], [-.03, .2]].map(([x, y]) => [x, y + RIM_LIFT * .5]), P.rim);
        ear.poly(outer.map(([x, y]) => [x * .96, y - .008]), P.fur);
        ear.poly([[-.06, .01], [.06, .01], [.02, .15], [-.01, .15]], P.earInner);
    }
}

function drawHead(head)
{
    const { w, h } = HEAD;
    head.ellipse(0, 0, w + OUTLINE * 2, h + OUTLINE * 2, P.outline);
    head.ellipse(0, 0, w, h, P.rim);
    head.ellipse(0, -.01, w - .006, h - .02, P.furShade);
    head.ellipse(.005, -.006 - RIM_LIFT * .3, w - .04, h - RIM_LIFT * 2.4, P.fur);
    head.ellipse(-.14, .14, .2, .1, P.furLight.withAlpha(.55), .35);
}

function drawFace(head, look)
{
    const x = TURN;
    // Tuxedo blaze: a narrow white stripe running up the nose from the muzzle.
    head.poly([[x - .055, -.07], [x + .055, -.07], [x + .018, .08], [x - .018, .08]], P.white);
    // Muzzle: two puffy cheeks and a little chin, all white.
    head.ellipse(x, -.165, .11, .07, P.white);
    for (const side of [-1, 1])
        head.ellipse(x + side * .062, -.105, .15, .12, P.white);
    for (const side of [-1, 1])
        head.ellipse(x + side * .2 + TURN * .3, -.06, .09, .05, P.cheek);
    for (const side of [-1, 1])
    {
        const far = side < 0 ? 1 - TURN * 2.2 : 1;
        drawEye(head.child(x + side * .135, .035, 0, far, 1), look);
    }
    drawNoseAndMouth(head, x, look.mrrp);
    drawWhiskers(head, x);
}

function drawEye(eye, look)
{
    const w = .15, h = .17;
    if (look.happy > .5)
    {
        // Content "^": the classic happy cat squint.
        eye.arc(0, -.04, w * .9, h * .8, Math.PI * .12, Math.PI * .88, .034, P.outline, 8);
        return;
    }
    // Eyes shut for a blink, and while busy licking a paw (cats concentrate on that).
    if (look.blink > .5 || look.lick > .6)
    {
        eye.arc(0, .01, w * .85, h * .45, Math.PI * 1.1, Math.PI * 1.9, .03, P.outline, 8);
        return;
    }
    eye.ellipse(0, 0, w + OUTLINE * 1.2, h + OUTLINE * 1.2, P.outline);
    eye.ellipse(0, 0, w, h, P.iris);
    eye.ellipse(0, -.03, w * .8, h * .45, P.irisDark.withAlpha(.5));
    // Big round pupils (wide at night, and cuter than slits), glancing the way Twyx faces.
    eye.ellipse(.012, -.004, w * .5, h * .74, P.pupil);
    eye.circle(-.018, .035, .055, P.shine);
    eye.circle(.03, -.035, .025, P.shine.withAlpha(.85));
}

function drawNoseAndMouth(head, x, mrrp)
{
    if (mrrp > .15)
    {
        // "Mrrp?": a little round open mouth with a peek of tongue, under the nose.
        head.ellipse(x, -.14, .075 * mrrp + .02, .07 * mrrp + .015, P.mouth);
        head.ellipse(x, -.155, .05 * mrrp, .03 * mrrp, P.tongue);
    }
    head.poly([[x - .04, -.052], [x + .04, -.052], [x + .012, -.088], [x - .012, -.088]], P.nose, OUTLINE * .55, P.outline);
    head.ellipse(x - .012, -.06, .022, .012, P.shine.withAlpha(.7));
    head.line([[x, -.088], [x, -.112]], .014, P.mouth);
    for (const side of [-1, 1])
        head.arc(x + side * .025, -.108, .05, .045, Math.PI * 1.05, Math.PI * 1.95, .014, P.mouth, 6);
}

function drawWhiskers(head, x)
{
    for (const side of [-1, 1])
    {
        const reach = side > 0 ? .2 : .15;   // far side whiskers foreshortened
        for (const [dy, droop] of [[-.09, .02], [-.12, -.03]])
        {
            const sx = x + side * .1;
            head.line([[sx, dy], [sx + side * reach * .55, dy + droop * .4 + .006], [sx + side * reach, dy + droop]], .011, P.whisker);
        }
    }
}

/** Licking: the near front paw is raised up to the mouth, white mitt toward the face. */
function drawLickPaw(root, shape, look, head)
{
    const leg = shape.frontLeg;
    const mouth = { x: shape.head.x + TURN + .1, y: shape.head.y - .2 };
    const shoulder = { x: leg.x, y: leg.hip + .05 };
    // Bob the paw a little in time with the licks.
    const bob = Math.sin(look.lickTime * 9) * .015 * look.lick;
    const tx = lerp(leg.x + .04, mouth.x, look.lick), ty = lerp(PAW.h / 2, mouth.y + bob, look.lick);
    const angle = Math.atan2(ty - shoulder.y, tx - shoulder.x);
    const length = Math.hypot(tx - shoulder.x, ty - shoulder.y);
    const arm = root.child(shoulder.x, shoulder.y, angle);
    arm.ellipse(length / 2, 0, length + LEG_W + OUTLINE * 2, LEG_W + OUTLINE * 2, P.outline);
    arm.ellipse(length / 2, 0, length + LEG_W, LEG_W, P.fur);
    arm.ellipse(length, 0, PAW.h + .02 + OUTLINE * 2, PAW.w + OUTLINE * 2, P.outline);
    arm.ellipse(length, 0, PAW.h + .02, PAW.w, P.white);
    arm.circle(length + .02, .03, .04, P.earInner.withAlpha(.8));   // a peek of toe beans
    // A little pink tongue flicks out against the paw.
    if (look.lick > .5 && Math.sin(look.lickTime * 9) > -.2)
        head.ellipse(TURN + .03, -.15, .05, .065, P.tongue);
}
