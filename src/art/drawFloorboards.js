// Indoor floor tiles (style 'floorboards'): honey wood planks seen a little from above, a
// front edge, a cream trim, and under it chunky blocks, like the base of a toy house.
// Same contract as drawTerrain.js (build once per tile, then outline/body/detail passes into a
// bake context); dispatched from there. Palette: tilePalettes.js ROOM_TILE_PALETTES.
import { vec2, drawRect } from 'littlejs';

const OUTLINE = .06;
const SURFACE = .30;     // depth of the visible floor surface band
const FRONT = .32;       // the floor's front edge under it
const TRIM = .08;
const BOARD_ROWS = 2;    // plank rows across the surface band
const BEVEL = .06;

export function buildFloorboards(pos, same)
{
    const open = { up: !same.up, down: !same.down, left: !same.left, right: !same.right };
    const x0 = pos.x, y0 = pos.y, x1 = pos.x + 1, y1 = pos.y + 1;
    // Planks are three tiles long, each row offset from the one above, so seams stagger.
    const seams = [];
    for (let row = 0; row < BOARD_ROWS; row++)
    {
        const phase = (pos.x + row * 1.5 + (pos.y % 2)) % 3;
        if (phase < 1)
            seams.push({ x: x0 + phase, row });
    }
    return {
        style: 'floorboards', pos, open,
        outline: open.left || open.right || open.down
            ? [x0 - (open.left ? OUTLINE : 0), y0 - (open.down ? OUTLINE : 0), x1 + (open.right ? OUTLINE : 0), y1 + (open.up ? OUTLINE : 0)]
            : null,
        top: open.up, seams,
        alt: hash(pos.x, pos.y) < .5,
        grain: { x: x0 + .15 + hash(pos.x, pos.y + 7) * .4, w: .25 + hash(pos.x + 3, pos.y) * .3 },
    };
}

export function drawFloorboardsOutline(tile, palette, ctx)
{
    if (tile.outline)
        box(ctx, ...tile.outline, palette.outline);
}

export function drawFloorboardsBody(tile, palette, ctx)
{
    const { x, y } = tile.pos;
    // The block underneath: a chunky square with a lit top-left and shaded bottom-right edge.
    box(ctx, x, y, x + 1, y + 1, palette.underDark);
    box(ctx, x, y + BEVEL, x + 1 - BEVEL, y + 1, palette.underLight);
    box(ctx, x + BEVEL, y + BEVEL, x + 1 - BEVEL, y + 1 - BEVEL, tile.alt ? palette.underAlt : palette.under);
    if (!tile.top)
        return;
    const top = y + 1;
    box(ctx, x, top - SURFACE - FRONT - TRIM, x + 1, top - SURFACE - FRONT, palette.trim);
    box(ctx, x, top - SURFACE - FRONT, x + 1, top - SURFACE, palette.boardFront);
    box(ctx, x, top - SURFACE, x + 1, top, palette.boardTop);
}

export function drawFloorboardsDetail(tile, palette, ctx)
{
    if (!tile.top)
        return;
    const { x, y } = tile.pos;
    const top = y + 1, rowH = SURFACE / BOARD_ROWS;
    box(ctx, x, top - .045, x + 1, top, palette.boardShine);
    // A thin gap between the plank rows, and the board ends.
    for (let row = 1; row < BOARD_ROWS; row++)
        box(ctx, x, top - row * rowH - .012, x + 1, top - row * rowH + .012, palette.boardSeam);
    for (const seam of tile.seams)
    {
        const rowTop = top - seam.row * rowH;
        box(ctx, seam.x - .02, rowTop - rowH, seam.x + .02, rowTop - (seam.row ? .012 : .045), palette.boardSeam);
    }
    // The lip where the surface turns into the front edge, and a little grain on the front.
    box(ctx, x, top - SURFACE - .03, x + 1, top - SURFACE, palette.boardSeam);
    const grainY = top - SURFACE - FRONT / 2;
    box(ctx, tile.grain.x, grainY - .015, tile.grain.x + tile.grain.w, grainY + .015, palette.boardGrain);
}

function box(ctx, x0, y0, x1, y1, color)
{
    drawRect(vec2((x0 + x1) / 2, (y0 + y1) / 2), vec2(x1 - x0, y1 - y0), color, 0, !ctx, false, ctx);
}

function hash(x, y)
{
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ 0x5bd1e995;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
