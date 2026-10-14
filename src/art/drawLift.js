// A balloon lift: a chunky plastic brick plate, studs on top, carried by a bunch of party
// balloons on strings, with a wind-up key on its side that spins while it travels. A dotted
// line of little beads shows where it goes.
// Pure drawing: drawLift(topCenter, state, time), drawLiftPath(from, to, state, time).
import { vec2, drawCircle } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { drawBlock, drawStuds, TOY_LINE } from './toyParts.js';

const STUD_H = .08;
const BALLOON = vec2(.62, .74);
const BALLOON_HEIGHT = 2.05;   // above the plate top
const PATH_SPACING = .45;

/**
 * @param {Vector2} top - center of the plate's top (what riders stand on)
 * @param {{width:number, thickness:number, key:number, moving:boolean, palette:object}} lift
 *        key: how far the wind-up key has turned (radians)
 */
export function drawLift(top, lift, time)
{
    const P = lift.palette;
    const frame = ArtFrame.root(top);
    const w = lift.width / 2;
    drawBalloons(frame, w, P, time);
    drawKey(frame.child(w + .05, -lift.thickness / 2), lift.key, P);
    drawBlock(frame, -w, -lift.thickness, w, -STUD_H, .08, P.plastic, P.plasticLight, P.outline, .3);
    drawStuds(frame, -w + .04, w - .04, -STUD_H - .01, Math.round(lift.width * 2), P.plastic, P.plasticLight, P.outline, STUD_H);
}

function drawBalloons(frame, w, P, time)
{
    const spots = [[-w * .55, BALLOON_HEIGHT - .15], [w * .55, BALLOON_HEIGHT - .1], [0, BALLOON_HEIGHT + .25]];
    spots.forEach(([x, y], i) =>
    {
        // Balloons drift on their own; the plate (what riders stand on) never does.
        const bx = x + Math.sin(time * 1.3 + i * 2.1) * .06;
        const by = y + Math.sin(time * 1.7 + i * 1.3) * .05;
        const anchor = [x * .7 + (i === 2 ? 0 : Math.sign(x) * w * .45), -STUD_H];
        frame.line([anchor, [(anchor[0] + bx) / 2 + .05, (by + anchor[1]) / 2], [bx, by - BALLOON.y / 2 - .05]], .03, P.string);
        const color = P.balloons[i % P.balloons.length];
        frame.outlinedEllipse(bx, by, BALLOON.x, BALLOON.y, color, P.outline, TOY_LINE);
        frame.ellipse(bx - .11, by + .12, .1, .17, P.shine, .4);
        frame.poly([[bx - .06, by - BALLOON.y / 2 - .07], [bx + .06, by - BALLOON.y / 2 - .07], [bx, by - BALLOON.y / 2 + .02]],
            color, TOY_LINE * .6, P.outline);
    });
}

/** The key's bow is seen edge-on as it turns, so it squeezes to nothing and back. */
function drawKey(frame, turn, P)
{
    frame.line([[0, 0], [.16, 0]], .06 + TOY_LINE, P.outline);
    frame.line([[0, 0], [.16, 0]], .06, P.key);
    const squeeze = Math.max(.12, Math.abs(Math.cos(turn)));
    for (const side of [-1, 1])
        frame.outlinedEllipse(.24, side * .1 * squeeze, .14, .18 * squeeze, P.key, P.outline, TOY_LINE * .7);
}

/** Beads every PATH_SPACING tiles from one end of the trip to the other, twinkling gently. */
export function drawLiftPath(from, to, lift, time)
{
    const length = from.distance(to);
    const count = Math.floor(length / PATH_SPACING);
    for (let i = 1; i < count; i++)
    {
        const p = from.lerp(to, i / count);
        const glow = .45 + .2 * Math.sin(time * 2 + i * .7);
        drawCircle(p, .13, lift.palette.outline.scale(1, glow * .6));
        drawCircle(p, .09, lift.palette.string.scale(1, glow));
    }
}
