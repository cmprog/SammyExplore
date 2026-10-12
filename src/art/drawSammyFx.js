// Little effects around Sammy: loose feathers from a flap, the ring of air the wings push down,
// and dust puffs from a hard landing. Pure functions of (pos, particle, time); ParticleField
// (src/entities/) moves them.
import { ArtFrame } from './ArtFrame.js';
import { SAMMY_PALETTE as P } from '../data/palettes.js';

/** A small curled feather. @param {{angle:number, size:number, alpha:number, alt:boolean}} p */
export function drawLooseFeather(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size }).child(0, 0, p.angle);
    const color = (p.alt ? P.featherAlt : P.feather).withAlpha(p.alpha);
    frame.ellipse(0, 0, .42 + .12, 1 + .12, P.outline.withAlpha(p.alpha * .8));
    frame.ellipse(0, 0, .42, 1, color);
    frame.ellipse(-.06, .1, .2, .6, P.shine.withAlpha(.35 * p.alpha));
    frame.line([[0, -.62], [.02, 0], [-.04, .4]], .07, P.outline.withAlpha(.6 * p.alpha));
}

/** Air pushed down by a wing stroke: two curved streaks under the wings, spreading out. */
export function drawWhoosh(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: 1 + p.progress * .8 });
    const color = P.whoosh.scale(1, 1 - p.progress);
    for (const side of [-1, 1])
        frame.arc(side * .32, .05, .7, .35, side > 0 ? Math.PI * 1.15 : Math.PI * 1.35,
            side > 0 ? Math.PI * 1.65 : Math.PI * 1.85, .06 * (1 - p.progress * .5), color, 8);
}

/** A soft round dust cloud with a lighter top. @param {{size:number, alpha:number}} p */
export function drawDust(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size });
    frame.circle(0, 0, 1, P.dust.withAlpha(.55 * p.alpha));
    frame.circle(-.1, .12, .62, P.dust.lerp(P.shine, .4).withAlpha(.5 * p.alpha));
}
