// A cat spot (T-016): a plump little velvet cushion with gold piping, corner tassels and a
// cream paw print stitched on its front, sitting on the ground. A gentle twinkle drifts up off
// it now and then: "a cat could do something here". It never shows WHICH cat (no cat's
// colors, a plain paw). Once its job is done the twinkle fades out and the print softens.
// Poked with nobody (or the wrong cat), it squashes a little, like a pat on a cushion.
// Pure drawing: drawCatSpot(feet, look, time), drawCatSpotSparkle(pos, particle).
import { vec2, drawEllipse, drawCircleGradient } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { roundRectPoints, TOY_LINE } from './toyParts.js';

const W = .96, H = .3;
const TWINKLES = 3;
const TWINKLE_CYCLE = 2.6;   // seconds per twinkle, staggered

/** Top of the cushion above its feet (for the E prompt). */
export const CATSPOT_TOP = H + .06;

/**
 * @param {Vector2} feet - bottom center
 * @param {{ready:number, squash:number, palette:object}} look
 *   ready: 1 waiting for a cat .. 0 done (the twinkle and glow fade with it)
 */
export function drawCatSpot(feet, look, time)
{
    const P = look.palette;
    const ready = look.ready;
    if (ready > 0)
    {
        const pulse = .8 + Math.sin(time * 1.6) * .2;
        drawCircleGradient(feet.add(vec2(0, .25)), 1.7 * pulse, P.sparkle.withAlpha(.16 * ready), P.sparkle.withAlpha(0));
    }
    drawEllipse(feet.add(vec2(0, .02)), vec2(W + .3, .14), P.shadow);
    const frame = ArtFrame.root(feet, { stretchX: 1 + look.squash * .4, stretchY: 1 - look.squash });
    drawCushion(frame, P);
    drawPawPrint(frame, P, .55 + .45 * ready);
    if (ready > 0)
        drawTwinkles(frame, P, ready, time);
}

function drawCushion(frame, P)
{
    // A puffy pillow: a rounded slab, bulging a little in the middle.
    const body = roundRectPoints(-W / 2, 0, W / 2, H, .13, 4).map(([x, y]) => [x, y + Math.cos(x / W * Math.PI) * .03 * (y > H / 2 ? 1 : -.3)]);
    frame.poly(body, P.cushion, TOY_LINE, P.outline);
    frame.poly(roundRectPoints(-W / 2 + .06, H * .62, W / 2 - .06, H - .03, .07, 3), P.cushionLight);
    frame.poly(roundRectPoints(-W / 2 + .05, .03, W / 2 - .05, .08, .03, 2), P.cushionDark);
    // Gold piping along the top seam, and a tassel at each end.
    frame.line([[-W / 2 + .08, H - .015], [0, H + .02], [W / 2 - .08, H - .015]], .035, P.piping);
    for (const side of [-1, 1])
    {
        const x = side * (W / 2 + .02);
        frame.outlinedEllipse(x, H * .55, .08, .08, P.piping, P.outline, TOY_LINE * .7);
        frame.poly([[x - .04 * side, H * .5], [x + .06 * side, H * .1], [x - .02 * side, H * .08]], P.piping, TOY_LINE * .6, P.outline);
    }
}

/** A plain paw print stitched on the front: a big pad and four toe beans. */
function drawPawPrint(frame, P, strength)
{
    const color = P.pawPrint.withAlpha(strength);
    const y = H * .42;
    frame.ellipse(0, y - .02, .17, .12, color);
    for (const [x, dy, d] of [[-.11, .07, .065], [-.04, .1, .07], [.04, .1, .07], [.11, .07, .065]])
        frame.ellipse(x, y + dy, d, d * 1.1, color);
}

/** A few soft four-point twinkles rising off the cushion, each fading in and out in turn. */
function drawTwinkles(frame, P, ready, time)
{
    for (let i = 0; i < TWINKLES; i++)
    {
        const t = (time / TWINKLE_CYCLE + i / TWINKLES) % 1;
        const cycle = Math.floor(time / TWINKLE_CYCLE + i / TWINKLES);
        const x = Math.sin(cycle * 12.9898 + i * 4.1) * W * .38;
        const fade = Math.sin(t * Math.PI) ** 2 * ready;
        drawTwinkle(frame, x, H + .12 + t * .55, .09 + .05 * Math.sin(t * Math.PI), P.sparkle.withAlpha(fade));
    }
}

function drawTwinkle(frame, x, y, r, color)
{
    const points = [];
    for (let k = 0; k < 8; k++)
    {
        const a = k * Math.PI / 4;
        const rr = k % 2 ? r * .28 : r;
        points.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    frame.poly(points, color);
}

/** A twinkle popping off the cushion when it's patted. @param {{size:number, alpha:number, color:Color}} p */
export function drawCatSpotSparkle(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size * (1 - p.progress * .5) }).child(0, 0, p.angle);
    drawTwinkle(frame, 0, 0, 1, p.color.withAlpha(p.alpha));
}
