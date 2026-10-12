// Flap charges as a little fan of feathers above Sammy's head: bright cream-and-gold when the
// flap is ready, a faint ghost when spent. A feather that is spent puffs up and fades into its
// ghost; one that comes back pops in with a bounce. Sized to read at a glance at 720p.
// Pure function of (pos, state, time).
import { ArtFrame } from './ArtFrame.js';
import { SAMMY_PALETTE as P } from '../data/palettes.js';
import { FLAP_PIPS } from '../data/tuning.js';

const FEATHER = { w: .19, h: .38 };
const SPACING = .22;
const FAN = .34;                 // radians between neighbouring feathers
const OUTLINE = .04;
const SIDES = 10;

/**
 * @param {Vector2} pos - world position of the middle feather's base
 * @param {{charges:number, max:number, alpha:number, pops:number[]}} state - pops: seconds since each
 *   feather last changed (Infinity if never)
 * @param {number} time
 */
export function drawFlapPips(pos, { charges, max, alpha = 1, pops = [] }, time)
{
    if (alpha <= 0)
        return;
    const root = ArtFrame.root(pos);
    for (let i = 0; i < max; i++)
    {
        const offset = i - (max - 1) / 2;
        const full = i < charges;
        const pop = popScale(pops[i] ?? Infinity, full);
        // Ready feathers sway gently, each on its own beat, so they look alive rather than like UI.
        const sway = full ? Math.sin(time * 3 + i * 1.7) * .06 : 0;
        const frame = root.child(offset * SPACING, -Math.abs(offset) * .06, -offset * FAN + sway, pop);
        drawPip(frame, full, alpha);
    }
}

function popScale(age, full)
{
    const t = age / FLAP_PIPS.POP_TIME;
    if (t >= 1)
        return 1;
    // Spent: a quick puff up then settle. Refilled: grow in from nothing with an overshoot.
    return full ? Math.sin(t * Math.PI * .5) * 1 + Math.sin(t * Math.PI) * .35 : 1 + Math.sin(t * Math.PI) * .45;
}

function drawPip(frame, full, alpha)
{
    const { w, h } = FEATHER;
    if (!full)
    {
        frame.poly(featherShape(w + OUTLINE, h + OUTLINE * 1.5), P.pipEmpty.scale(1, alpha));
        frame.line([[0, .02], [0, h * .85]], .03, P.pipOutline.withAlpha(.35 * alpha));
        return;
    }
    frame.poly(featherShape(w + OUTLINE * 2, h + OUTLINE * 3, -OUTLINE), P.pipOutline.withAlpha(alpha));
    frame.poly(featherShape(w, h), P.pipFullTip.withAlpha(alpha));
    frame.poly(featherShape(w * .72, h * .86, h * .02, -w * .08), P.pipFull.withAlpha(alpha));
    frame.line([[.01, -.02], [.004, h * .5], [-.012, h * .9]], .032, P.pipFullTip.withAlpha(alpha));
    frame.ellipse(-w * .2, h * .52, w * .16, h * .3, P.shine.withAlpha(.75 * alpha));
}

/** A feather vane: round at the base, pointed at the top, bending slightly. Art points. */
function featherShape(w, h, y0 = 0, x0 = 0)
{
    const points = [];
    // Up the right edge (both tips included), then back down the left edge (tips skipped).
    for (let side = 1; side >= -1; side -= 2)
        for (let i = side > 0 ? 0 : 1; i <= (side > 0 ? SIDES : SIDES - 1); i++)
        {
            const t = (side > 0 ? i : SIDES - i) / SIDES * Math.PI;
            const y = h * (1 - Math.cos(t)) / 2;
            const x = side * w / 2 * Math.sin(t) * Math.sqrt(1 - .7 * y / h) + .06 * (y / h) ** 2;
            points.push([x0 + x, y0 + y]);
        }
    return points;
}
