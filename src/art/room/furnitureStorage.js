// Baked furniture that holds things: the toy chest, the bookshelf, floating wall shelves, the
// dresser, and the toy cubby. Each draws a piece {x0, y0, x1, y1, groundY, ...props} (world
// units, y up; y1 is the top Sammy stands on, groundY the floor under it). Soft plum outlines,
// light from above, chunky and toy-like.
import { vec2 } from 'littlejs';
import { rect, roundRect, outlinedBox, panel, circle, poly, gradient, OUTLINE } from './roomShapes.js';

// --- toy chest: a chunky wooden chest with dark corner bands and a latch -----------------------

export function drawToyChest(ctx, { x0, y0, x1, y1 }, p)
{
    const lid = y1 - .62;
    outlinedBox(ctx, x0, y0, x1, lid, .08, p.wood, p.outline);
    // Planks across the body, a lit edge along each.
    for (let y = y0 + .42; y < lid - .1; y += .42)
    {
        rect(ctx, x0, y - .035, x1, y, p.woodDark);
        rect(ctx, x0, y, x1, y + .04, p.woodLight);
    }
    // The lid overhangs a little and has a rounded top.
    outlinedBox(ctx, x0 - .08, lid - .02, x1 + .08, y1, .16, p.woodDark, p.outline);
    roundRect(ctx, x0 - .08, lid + .1, x1 + .08, y1, .16, p.wood);
    roundRect(ctx, x0 + .1, y1 - .14, x1 - .1, y1 - .06, .04, p.woodLight);
    // Dark iron-look bands at the corners, top to bottom.
    for (const [a, b] of [[x0 - .08, x0 + .3], [x1 - .3, x1 + .08]])
    {
        rect(ctx, a, y0, b, y1 - .02, p.woodDark);
        rect(ctx, a + .06, y0 + .06, a + .12, y1 - .1, p.wood);
    }
    // Latch in the middle of the lid seam.
    const cx = (x0 + x1) / 2;
    outlinedBox(ctx, cx - .24, lid - .34, cx + .24, lid + .22, .06, p.metal, p.outline);
    rect(ctx, cx - .2, lid - .3, cx + .2, lid - .24, p.metalDark);
    circle(ctx, cx, lid - .06, .1, p.metalDark);
    rect(ctx, cx - .025, lid - .2, cx + .025, lid - .08, p.metalDark);
}

// --- bookshelf: a white frame, a pink back, one-way shelves every `shelfEvery` tiles ----------

const SIDE = .34;
const KICK = .4;

export function drawBookshelf(ctx, piece, p)
{
    const { x0, y0, x1, y1 } = piece;
    const every = piece.shelfEvery ?? 3;
    outlinedBox(ctx, x0, y0, x1, y1, .08, p.paintShade, p.outline);
    // The back, with a soft shadow under every shelf.
    rect(ctx, x0 + SIDE, y0 + KICK, x1 - SIDE, y1 - 1, p.back);
    for (let x = x0 + SIDE + 1.5; x < x1 - SIDE - .5; x += 1.5)
        rect(ctx, x - .02, y0 + KICK, x + .02, y1 - 1, p.backDark);
    for (let shelf = y0 + every; shelf <= y1 - 1 + .01; shelf += every)
        gradient(ctx, x0 + SIDE, shelf - 1.1, x1 - SIDE, shelf - .3, p.backDark, p.back.withAlpha(0));
    gradient(ctx, x0 + SIDE, y1 - 2, x1 - SIDE, y1 - 1, p.backDark, p.back.withAlpha(0));
    // Sides and kick plate.
    for (const [a, b] of [[x0, x0 + SIDE], [x1 - SIDE, x1]])
    {
        rect(ctx, a, y0, b, y1, p.paint);
        rect(ctx, a + .06, y0 + .1, a + .12, y1 - .2, p.paintLight);
    }
    panel(ctx, x0, y0, x1, y0 + KICK, { r: .04, fill: p.paint, shade: p.paintShade, outline: p.outline, shadeSize: .08 });
    // Shelves (tops line up with the one-way tiles) and the crown.
    for (let shelf = y0 + every; shelf < y1 - .5; shelf += every)
        shelfBoard(ctx, x0 + SIDE - .02, x1 - SIDE + .02, shelf, p);
    panel(ctx, x0 - .14, y1 - 1, x1 + .14, y1, { r: .1, fill: p.paint, light: p.paintLight, shade: p.paintShade, outline: p.outline });
    rect(ctx, x0 - .14, y1 - .7, x1 + .14, y1 - .55, p.accent);
}

function shelfBoard(ctx, x0, x1, top, p)
{
    rect(ctx, x0, top - .3 - OUTLINE, x1, top + OUTLINE, p.outline);
    rect(ctx, x0, top - .3, x1, top, p.paintShade);
    rect(ctx, x0, top - .2, x1, top, p.paint);
    rect(ctx, x0, top - .06, x1, top - .02, p.paintLight);
}

// --- wall shelf: a floating plank on two little brackets ---------------------------------------

export function drawWallShelf(ctx, { x0, x1, y1 }, p)
{
    for (const bx of [x0 + .7, x1 - .7])
    {
        const bracket = [vec2(-.08, 0), vec2(.5, 0), vec2(-.08, -.75)];
        poly(ctx, bracket.map(v => vec2(v.x * 1.15 - .03, v.y * 1.1 + .05)), p.outline, bx, y1 - .3);
        poly(ctx, bracket, p.bracket, bx, y1 - .3);
    }
    panel(ctx, x0, y1 - .32, x1, y1, { r: .1, fill: p.paint, light: p.paintLight, shade: p.paintShade, outline: p.outline, shadeSize: .1 });
    rect(ctx, x0 + .1, y1 - .24, x1 - .1, y1 - .18, p.accent);
}

// --- dresser: three rows of drawers with round pink knobs ---------------------------------------

export function drawDresser(ctx, { x0, y0, x1, y1 }, p)
{
    const top = y1 - .45, base = y0 + .35;
    // Little feet and a darker kick plate.
    for (const fx of [x0 + .5, x1 - .5])
        outlinedBox(ctx, fx - .22, y0, fx + .22, base, .06, p.paintShade, p.outline);
    outlinedBox(ctx, x0, base, x1, top, .06, p.paintShade, p.outline);
    rect(ctx, x0 + .04, base + .1, x1 - .04, top, p.paint);
    // Drawers: the top row is split in two.
    const rows = 3, h = (top - base - .2) / rows;
    for (let r = 0; r < rows; r++)
    {
        const dy0 = base + .12 + r * h, dy1 = dy0 + h - .12;
        const split = r === rows - 1 ? [[x0 + .25, (x0 + x1) / 2 - .06], [(x0 + x1) / 2 + .06, x1 - .25]] : [[x0 + .25, x1 - .25]];
        for (const [dx0, dx1] of split)
            drawer(ctx, dx0, dy0, dx1, dy1, p);
    }
    panel(ctx, x0 - .15, top, x1 + .15, y1, { r: .12, fill: p.paint, light: p.paintLight, shade: p.paintShade, outline: p.outline, shadeSize: .1 });
    rect(ctx, x0 - .15, top + .1, x1 + .15, top + .18, p.accent);
}

function drawer(ctx, x0, y0, x1, y1, p)
{
    roundRect(ctx, x0, y0, x1, y1, .08, p.paintShade);
    roundRect(ctx, x0, y0 + .05, x1 - .05, y1, .08, p.paintLight);
    roundRect(ctx, x0 + .05, y0 + .05, x1 - .05, y1 - .05, .07, p.paint);
    knob(ctx, (x0 + x1) / 2, (y0 + y1) / 2, p);
}

export function knob(ctx, x, y, p, size = .26)
{
    circle(ctx, x, y - .02, size + OUTLINE * 2, p.outline);
    circle(ctx, x, y - .02, size, p.accentDark);
    circle(ctx, x, y + .01, size * .82, p.accent);
    circle(ctx, x - size * .18, y + size * .2, size * .3, p.paintLight);
}

// --- toy cubby: a white frame with a divider and one-way shelves every `shelfEvery` tiles ------

export function drawCubby(ctx, piece, p)
{
    const { x0, y0, x1, y1 } = piece;
    const every = piece.shelfEvery ?? 3;
    const shelves = [];
    for (let shelf = y0 + every; shelf < y1 - .5; shelf += every)
        shelves.push(shelf);
    outlinedBox(ctx, x0, y0, x1, y1, .08, p.paintShade, p.outline);
    rect(ctx, x0 + SIDE, y0 + KICK, x1 - SIDE, y1 - 1, p.back);
    for (const shelf of [...shelves, y1 - 1])
        gradient(ctx, x0 + SIDE, shelf - 1, x1 - SIDE, shelf - .3, p.backDark, p.back.withAlpha(0));
    const cx = (x0 + x1) / 2;
    rect(ctx, cx - .14 - OUTLINE, y0 + KICK, cx + .14 + OUTLINE, y1 - 1, p.outline);
    rect(ctx, cx - .14, y0 + KICK, cx + .14, y1 - 1, p.paint);
    for (const [a, b] of [[x0, x0 + SIDE], [x1 - SIDE, x1]])
        rect(ctx, a, y0, b, y1, p.paint);
    panel(ctx, x0, y0, x1, y0 + KICK, { r: .04, fill: p.paint, shade: p.paintShade, outline: p.outline, shadeSize: .08 });
    for (const shelf of shelves)
        shelfBoard(ctx, x0 + SIDE - .02, x1 - SIDE + .02, shelf, p);
    panel(ctx, x0 - .12, y1 - 1, x1 + .12, y1, { r: .1, fill: p.paint, light: p.paintLight, shade: p.paintShade, outline: p.outline });
    rect(ctx, x0 - .12, y1 - .7, x1 + .12, y1 - .55, p.accent);
}
