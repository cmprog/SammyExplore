// A freestanding storybook door: a little arched wooden frame with a keystone, a rounded plank
// door with iron hinges and a brass knob, and a padlock when it is locked. Opening swings the
// door toward its hinge side; an exit door glows warmly inside.
// Pure drawing: drawDoor(feetPos, state, time).
import {
    vec2, rgb, drawPoly, drawLineList, drawLine, drawCircle, drawEllipse, drawCircleGradient,
} from 'littlejs';
import { archPoints, roundedRectPoints } from './shapes.js';

const OUTLINE = rgb(.16, .09, .07);
const SHADOW = rgb(.03, .02, .08, .35);
const FRAME = rgb(.52, .36, .26);
const FRAME_LIGHT = rgb(.68, .5, .36);
const WOOD = rgb(.80, .52, .30);
const WOOD_DARK = rgb(.60, .36, .20);
const WOOD_LIGHT = rgb(.93, .68, .42);
const IRON = rgb(.24, .23, .30);
const IRON_LIGHT = rgb(.48, .47, .58);
const BRASS = rgb(1, .80, .36);
const BRASS_DARK = rgb(.76, .52, .18);
const SHINE = rgb(1, 1, .95, .75);
const GLOW = rgb(1, .86, .52);
const GLOW_EDGE = rgb(1, .62, .30, 0);
const CLEAR = rgb(0, 0, 0, 0);

const W = .8;         // slab width (matches DOOR.SIZE.x)
const H = 1.9;        // slab height
const FRAME_W = .14;
const LINE = .05;     // outline width

/**
 * @param {Vector2} feet - bottom center of the doorway
 * @param {{locked:boolean, open:number, rattle:number, exit:boolean}} door
 *        open 0 (closed) .. 1 (swung open); rattle 1 .. 0 while a locked door shakes
 */
export function drawDoor(feet, door, time)
{
    drawEllipse(feet.add(vec2(0, .02)), vec2(W + .5, .16), SHADOW);
    if (door.open > 0 && door.exit)
        drawExitGlow(feet, door.open, time);
    drawFrame(feet);

    // Ease the swing so it starts with a little shove and settles gently.
    const swing = 1 - (1 - door.open) ** 2;
    const squeeze = Math.max(Math.cos(swing * 1.4), .04);
    const shake = door.rattle > 0 ? Math.sin(time * 70) * .035 * door.rattle : 0;
    drawSlab(feet.add(vec2(shake, 0)), squeeze, swing);
    if (door.exit && door.open === 0)
        drawLightUnderDoor(feet, time);
    if (door.locked)
        drawPadlock(feet.add(vec2(W * .28 + shake * 1.6, .78)), door.rattle, time);
}

function drawExitGlow(feet, open, time)
{
    const pulse = 1 + Math.sin(time * 3) * .04;
    drawPoly(archPoints(W, H), GLOW.scale(1, open), 0, CLEAR, feet);
    drawCircleGradient(feet.add(vec2(0, H * .55)), 2.4 * open * pulse, rgb(1, .86, .5, .55 * open), GLOW_EDGE);
}

/** A closed exit door hints at somewhere warm on the other side: light spilling from under it. */
function drawLightUnderDoor(feet, time)
{
    const pulse = .8 + Math.sin(time * 2.5) * .2;
    drawCircleGradient(feet.add(vec2(0, .02)), 1.1, rgb(1, .86, .5, .35 * pulse), GLOW_EDGE);
    drawEllipse(feet.add(vec2(0, .035)), vec2(W * .8, .045), GLOW.scale(1, .9));
}

function drawFrame(feet)
{
    // An arch drawn as a thick line, so the doorway itself stays open (see-through when the door swings).
    const arch = archPoints(W + FRAME_W, H + FRAME_W / 2, 14);
    drawLineList(arch, FRAME_W + LINE * 2, OUTLINE, false, feet);
    drawLineList(arch, FRAME_W, FRAME, false, feet);
    // Lit inner edge on the left: light comes from the moon, upper left.
    drawLineList(arch.slice(0, 6), FRAME_W * .3, FRAME_LIGHT, false, feet.add(vec2(-FRAME_W * .2, 0)));
    // Keystone and two base stones.
    const keystone = roundedRectPoints(.24, .2, .05);
    drawPoly(keystone, FRAME_LIGHT, LINE, OUTLINE, feet.add(vec2(0, H + FRAME_W / 2)));
    for (const side of [-1, 1])
        drawPoly(roundedRectPoints(.26, .14, .04), FRAME, LINE, OUTLINE, feet.add(vec2(side * (W + FRAME_W) / 2, .07)));
}

/** squeeze 1 = facing us (closed) .. ~0 = edge-on (open). The hinge is on the left edge. */
function drawSlab(feet, squeeze, swing)
{
    const hinge = -W / 2;
    const fold = p => vec2(hinge + (p.x - hinge) * squeeze, p.y);
    const at = (x, y) => feet.add(fold(vec2(x, y)));
    // Darker as it turns away from the light.
    const shade = 1 - swing * .3;

    drawPoly(archPoints(W, H).map(fold), WOOD.scale(shade, 1), LINE, OUTLINE, feet);
    // Lit left strip and the plank seams.
    drawPoly(archPoints(W, H).map(p => vec2(Math.min(p.x, -W * .36), p.y)).map(fold), WOOD_LIGHT.scale(shade, 1), 0, CLEAR, feet);
    for (const x of [-W / 6, W / 6])
        drawLine(at(x, .06), at(x, H - W / 2 + Math.sqrt(W * W / 4 - x * x) - .06), .03, WOOD_DARK);
    drawGrain(at, shade);

    for (const y of [.42, H - .62])
        drawHinge(at, y);
    if (squeeze > .45)
        drawKnob(at(W * .3, .95));
}

function drawGrain(at, shade)
{
    // A few short knots and wavy strokes, one or two per plank.
    const grain = WOOD_DARK.scale(shade, .6);
    const strokes = [[-.27, .55, .3], [-.25, 1.3, .22], [0, .8, .35], [.02, 1.45, .2], [.27, .35, .26], [.26, 1.15, .3]];
    for (const [x, y, len] of strokes)
        drawLineList([at(x, y), at(x + .025, y + len * .5), at(x - .01, y + len)], .018, grain);
    drawEllipse(at(-.02, 1.15), vec2(.06, .1), grain);
}

function drawHinge(at, y)
{
    const left = at(-W / 2 - .03, y), right = at(-W / 2 + W * .48, y);
    drawLine(left, right, .11, OUTLINE);
    drawLine(left, right, .07, IRON);
    drawLine(left.add(vec2(0, .015)), right.add(vec2(0, .015)), .02, IRON_LIGHT);
    for (const t of [.2, .75])
        drawCircle(left.lerp(right, t), .05, IRON_LIGHT, .015, OUTLINE);
}

function drawKnob(pos)
{
    drawCircle(pos.add(vec2(0, -.01)), .2, BRASS_DARK, LINE, OUTLINE);   // back plate
    drawCircle(pos, .14, BRASS, LINE * .8, OUTLINE);
    drawCircle(pos.add(vec2(-.025, .03)), .045, SHINE);
}

function drawPadlock(pos, rattle, time)
{
    const swing = rattle > 0 ? Math.sin(time * 40) * .25 * rattle : Math.sin(time * 1.5) * .03;
    const body = pos.add(vec2(Math.sin(swing) * .12, -.1));
    // Shackle: an iron loop hooked over the knob.
    drawCircle(body.add(vec2(0, .1)), .17, CLEAR, .07, OUTLINE);
    drawCircle(body.add(vec2(0, .1)), .17, CLEAR, .035, IRON_LIGHT);
    drawPoly(roundedRectPoints(.26, .22, .07), BRASS, LINE, OUTLINE, body, swing);
    drawPoly(roundedRectPoints(.16, .04, .02), SHINE, 0, CLEAR, body.add(vec2(-.02, .06)), swing);
    drawCircle(body.add(vec2(0, -.005)), .06, OUTLINE);
    drawPoly([vec2(-.02, 0), vec2(.02, 0), vec2(0, -.06)], OUTLINE, 0, CLEAR, body.add(vec2(0, -.01)), swing);
}
