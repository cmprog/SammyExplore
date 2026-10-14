// A toy lever: a chunky wooden block with a star sticker and a little bulb, and a wooden stick
// with a big red ball on top poking out of a slot. Off leans left, on leans right (and the bulb
// lights up). Thrown, the block squashes and stars pop off the knob.
// Pure drawing: drawLever(feetPos, state, time), drawLeverSpark(pos, particle).
import { vec2, drawEllipse, drawCircleGradient, BLACK } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { drawBlock, roundRectPoints, starPoints, TOY_LINE } from './toyParts.js';

const BASE_W = .76;
const BASE_H = .44;
const STICK_LENGTH = .6;
const KNOB = .28;
const SCALE = 1.25;   // drawn in art units, then scaled up to read well at play size

/** Height of the knob's top above the feet when upright (for the E prompt). */
export const LEVER_TOP = (BASE_H + STICK_LENGTH + KNOB / 2) * SCALE;
/** Where the handle pivots, above the feet (for placing sparks at the knob). */
export const LEVER_PIVOT = (BASE_H - .06) * SCALE;

/**
 * @param {Vector2} feet - bottom center of the block
 * @param {{handleAngle:number, squash:number, on:boolean, locked:boolean, palette:object}} lever
 *        handleAngle: CCW radians from upright (off is positive, leaning left)
 */
export function drawLever(feet, lever, time)
{
    const P = lever.palette;
    drawEllipse(feet.add(vec2(0, .02)), vec2((BASE_W + .4) * SCALE, .18), P.shadow);
    const frame = ArtFrame.root(feet, { scale: SCALE, stretchX: 1 + lever.squash * .5, stretchY: 1 - lever.squash });

    // The handle goes in first: its foot hides in the slot behind the block's top face.
    drawHandle(frame.child(0, BASE_H - .06, lever.handleAngle), P);
    drawBlock(frame, -BASE_W / 2, 0, BASE_W / 2, BASE_H, .09, P.wood, P.woodLight, P.outline);
    frame.poly(roundRectPoints(-.2, BASE_H - .1, .2, BASE_H - .03, .03), P.woodDark, 0, BLACK);   // the slot
    frame.poly(starPoints(-.17, .19, .11, .2), P.star, TOY_LINE * .7, P.outline);
    drawBulb(frame, lever, P, time);
    if (lever.locked)
        frame.circle(0, BASE_H - .02, .1, P.outline);   // a peg holds a one-way lever down
}

function drawHandle(frame, P)
{
    frame.line([[0, 0], [0, STICK_LENGTH]], .13 + TOY_LINE * 2, P.outline);
    frame.line([[0, 0], [0, STICK_LENGTH]], .13, P.woodDark);
    frame.line([[-.025, .05], [-.025, STICK_LENGTH - .05]], .04, P.wood);
    frame.outlinedEllipse(0, STICK_LENGTH + .02, KNOB, KNOB, P.knob, P.outline, TOY_LINE);
    frame.ellipse(-.06, STICK_LENGTH + .08, .09, .07, P.knobShine, .5);
}

function drawBulb(frame, lever, P, time)
{
    const pos = vec2(.18, .19);
    if (lever.on)
    {
        const pulse = .85 + Math.sin(time * 4) * .15;
        drawCircleGradient(frame.point(pos.x, pos.y), .5 * SCALE * pulse, P.lightOn.scale(1, .45), P.lightOn.scale(1, 0));
    }
    frame.outlinedEllipse(pos.x, pos.y, .15, .15, lever.on ? P.lightOn : P.lightOff, P.outline, TOY_LINE * .8);
    frame.ellipse(pos.x - .03, pos.y + .03, .05, .05, P.shine);
}

/** A little star popping off the knob. @param {{size:number, alpha:number, angle:number, color:Color}} p */
export function drawLeverSpark(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size * (1 - p.progress * .4) });
    frame.poly(starPoints(0, 0, 1, p.angle), p.color.withAlpha(p.alpha));
}
