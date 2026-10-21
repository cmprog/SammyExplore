// Craft blocks (T-018): chunky foam toy cubes with pixel-art faces, the blocky-game kind every kid's
// room has a few of. Decor (they never collide): {kind: 'craftBlock', x, y, variant, size?}
// stands on row y, centered on x. Variants: grass (a grass block), plank, stone, gem (stone with
// gems in it). Nothing here is a logo or a character from a game.
// World units, y up. A cube shows its front face and a sliver of its top, lit from the upper left.
import { vec2 } from 'littlejs';
import { rect, outlinedPoly, hash, OUTLINE } from './roomShapes.js';

const DEFAULT_SIZE = .8;
const PIXELS = 8;          // texture pixels across a face
const TOP_DEPTH = .22;     // how much of the top face shows (as a fraction of the size)

/** @param {{x:number, base:number, variant?:string, size?:number}} item */
export function drawCraftBlock(ctx, { x, base, variant = 'grass', size = DEFAULT_SIZE }, p)
{
    const c = p.craftBlocks[variant] ?? p.craftBlocks.grass;
    const x0 = x - size / 2, x1 = x + size / 2, y1 = base + size;
    const lean = size * TOP_DEPTH;
    // Outline around the front and the top together, then the top face, then the front.
    rect(ctx, x0 - OUTLINE, base - OUTLINE, x1 + OUTLINE, y1 + OUTLINE, p.outline);
    outlinedPoly(ctx, [vec2(x0, y1), vec2(x1, y1), vec2(x1 - lean * .5, y1 + lean), vec2(x0 + lean * .5, y1 + lean)], c.top, p.outline);
    rect(ctx, x0, base, x1, y1, c.side);
    drawFace(ctx, x0, base, size, variant, c);
    // Light on the left edge, shade along the bottom.
    rect(ctx, x0, base, x0 + size * .08, y1, c.light.withAlpha(.5));
    rect(ctx, x0, base, x1, base + size * .08, c.shade.withAlpha(.6));
}

/** The pixel texture on the front face, fixed per variant and position (same on every visit). */
function drawFace(ctx, x0, y0, size, variant, c)
{
    const px = size / PIXELS;
    const dot = (col, row, color) => rect(ctx, x0 + col * px, y0 + row * px, x0 + (col + 1) * px, y0 + (row + 1) * px, color);
    const seed = Math.round(x0 * 7 + y0 * 3);
    for (let row = 0; row < PIXELS; row++)
        for (let col = 0; col < PIXELS; col++)
        {
            const n = hash(col + seed, row, 31);
            if (variant === 'grass')
            {
                // Grass across the top two rows, dripping a little into the dirt.
                const drip = row === PIXELS - 3 && hash(col + seed, 0, 32) < .4;
                if (row >= PIXELS - 2 || drip)
                    dot(col, row, n < .3 ? c.topSpeck : c.top);
                else if (n < .22)
                    dot(col, row, c.speck);
            }
            else if (variant === 'plank')
            {
                if (row % 2 === 1 && (n < .85))
                    dot(col, row, c.speck);   // the seams between planks
                else if (n < .1)
                    dot(col, row, c.light);
            }
            else if (variant === 'gem')
            {
                const gem = (col % 4 === 1 || col % 4 === 2) && (row % 4 === 1 || row % 4 === 2) && hash(Math.floor(col / 4) + seed, Math.floor(row / 4), 33) < .6;
                if (gem)
                    dot(col, row, (col + row) % 2 ? c.gem : c.gemLight);
                else if (n < .25)
                    dot(col, row, c.speck);
            }
            else if (n < .3)
                dot(col, row, n < .12 ? c.light : c.speck);   // stone: speckled grey
        }
}
