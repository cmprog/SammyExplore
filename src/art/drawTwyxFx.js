// Twyx's little effects: the hearts that float up when Twyx is petted. Pure functions of
// (pos, particle, time); a ParticleField (src/entities/) moves them.
import { ArtFrame } from './ArtFrame.js';
import { TWYX_PALETTE as P } from '../data/palettes.js';

const HEART = [[0, -.5], [-.42, -.08], [-.5, .12], [.5, .12], [.42, -.08]];

/** A round cartoon heart that pops in big, settles, and fades. @param {{size:number, alpha:number, angle:number, progress:number}} p */
export function drawHeart(pos, p)
{
    const pop = 1 + .35 * Math.max(0, 1 - p.progress * 6);   // overshoots on the way in
    const frame = ArtFrame.root(pos, { scale: p.size * pop }).child(0, 0, p.angle);
    const a = p.alpha;
    const outline = .1;
    for (const side of [-1, 1])
        frame.circle(side * .25, .16, .56 + outline * 2, P.outline.withAlpha(a * .8));
    frame.poly(HEART.map(([x, y]) => [x * 1.18, y * 1.12 - .03]), P.outline.withAlpha(a * .8));
    for (const side of [-1, 1])
        frame.circle(side * .25, .16, .56, P.heart.withAlpha(a));
    frame.poly(HEART, P.heart.withAlpha(a));
    frame.ellipse(-.27, .24, .18, .12, P.heartShine.withAlpha(a * .9), .5);
}
