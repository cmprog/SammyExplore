// The rug, baked into its own layer drawn just in front of the floorboards (and behind Sammy):
// a block-pattern rug lying on the floor's surface band, with tassels at both ends.
// Decor item: {x (left), w, base (the floor top)}.
import { rect, roundRect, hash } from './roomShapes.js';

const DEPTH = .3;       // matches the floor's surface band (drawFloorboards.js)
const LIFT = .12;       // a thick, fluffy rug: it sits a little proud of the floor
const SQUARE = .5;

export function drawRug(ctx, { x, w, base }, p)
{
    const x0 = x, x1 = x + w, y0 = base - DEPTH + .02, y1 = base + LIFT;
    // Tassels poking out at both ends.
    for (const end of [x0, x1])
        for (let y = y0 + .05; y < y1 - .02; y += .08)
            rect(ctx, end - .14, y, end + .14, y + .035, p.rugEdge);
    roundRect(ctx, x0 - .04, y0 - .05, x1 + .04, y1 + .03, .06, p.outline);
    roundRect(ctx, x0, y0, x1, y1, .05, p.rugEdge);
    // Two rows of blocky squares, like a pixel quilt underfoot.
    const rows = 2, rowH = (y1 - y0 - .1) / rows;
    for (let r = 0; r < rows; r++)
        for (let i = 0, sx = x0 + .08; sx < x1 - .1; sx += SQUARE, i++)
        {
            const color = p.rug[Math.floor(hash(i, r, 21) * p.rug.length)];
            rect(ctx, sx, y0 + .05 + r * rowH + .01, Math.min(sx + SQUARE - .03, x1 - .08), y0 + .05 + (r + 1) * rowH - .01, color);
        }
    rect(ctx, x0 + .05, y1 - .03, x1 - .05, y1, p.paintLight.withAlpha(.5));
}
