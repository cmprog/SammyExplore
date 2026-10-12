// A wooden signpost: a stubby post in a grass tuft, a rounded two-plank board with nails and
// some painted "writing" squiggles (the narrator reads it, so the art never needs real words).
// Wobbles when read. Pure drawing: drawSign(feetPos, state, time).
import { vec2, rgb, drawPoly, drawLineList, drawLine, drawCircle, drawEllipse } from 'littlejs';
import { roundedRectPoints } from './shapes.js';

const OUTLINE = rgb(.16, .09, .07);
const SHADOW = rgb(.03, .02, .08, .35);
const POST = rgb(.55, .35, .21);
const POST_LIGHT = rgb(.68, .46, .3);
const BOARD = rgb(.88, .64, .40);
const BOARD_LIGHT = rgb(.97, .78, .54);
const SEAM = rgb(.62, .40, .23);
const PAINT = rgb(.30, .17, .10);
const NAIL = rgb(.45, .44, .52);
const GRASS = rgb(.30, .55, .34);
const GRASS_LIGHT = rgb(.45, .72, .42);
const CLEAR = rgb(0, 0, 0, 0);

const BOARD_SIZE = vec2(1.15, .62);
const BOARD_Y = 1.0;    // board center above the feet
const LINE = .05;

/** Height of the sign's top above its feet (for placing the E prompt). */
export const SIGN_TOP = BOARD_Y + BOARD_SIZE.y / 2;

/**
 * @param {Vector2} feet - bottom center of the post
 * @param {{wiggle:number}} sign - 1 .. 0 after being read
 */
export function drawSign(feet, sign, time)
{
    drawEllipse(feet.add(vec2(0, .02)), vec2(.9, .14), SHADOW);
    // Post
    drawPoly(roundedRectPoints(.2, 1.0, .05), POST, LINE, OUTLINE, feet.add(vec2(0, .5)));
    drawLine(feet.add(vec2(-.04, .08)), feet.add(vec2(-.04, .7)), .04, POST_LIGHT);
    drawTuft(feet, time);

    // Board: a slight resting tilt, plus a wobble that dies down after being read.
    const wobble = sign.wiggle > 0 ? Math.sin(time * 22) * .14 * sign.wiggle ** 2 : 0;
    const angle = -.05 + wobble;
    const center = feet.add(vec2(0, BOARD_Y));
    drawPoly(roundedRectPoints(BOARD_SIZE.x, BOARD_SIZE.y, .12), BOARD, LINE, OUTLINE, center, angle);
    // Moonlit top edge.
    drawPoly(roundedRectPoints(BOARD_SIZE.x - .24, .05, .025), BOARD_LIGHT, 0, CLEAR, center.add(vec2(0, .23).rotate(angle)), angle);
    drawBoardDetails(center, angle);
}

function drawBoardDetails(center, angle)
{
    // Seam between the two planks, then painted squiggles standing in for words.
    const local = points => points.map(p => p.rotate(angle).add(center));
    drawLine(...local([vec2(-.52, 0), vec2(.52, 0)]), .025, SEAM);
    const words = [[-.38, .12, .3], [-.02, .12, .34], [-.3, -.13, .42], [.18, -.13, .2]];
    for (const [x, y, len] of words)
    {
        const squiggle = [];
        for (let i = 0; i <= 6; i++)
            squiggle.push(vec2(x + len * i / 6, y + Math.sin(i * 2.1 + x * 9) * .025));
        drawLineList(local(squiggle), .04, PAINT);
    }
    // A painted arrow on the right: signs point places.
    drawPoly(local([vec2(.36, .18), vec2(.48, .12), vec2(.36, .06)]), PAINT, 0, CLEAR);
    for (const x of [-.44, .44])
        drawCircle(local([vec2(x, -.2)])[0], .06, NAIL, .015, OUTLINE);
}

function drawTuft(feet, time)
{
    const sway = Math.sin(time * 1.7) * .03;
    for (const [x, h, light] of [[-.18, .22, false], [.16, .2, false], [-.08, .16, true], [.07, .17, true]])
    {
        const base = feet.add(vec2(x, 0));
        drawPoly([vec2(-.07, 0), vec2(.07, 0), vec2(sway + x * .2, h)], light ? GRASS_LIGHT : GRASS, 0, CLEAR, base);
    }
}
