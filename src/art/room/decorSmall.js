// Baked small decor standing on furniture: blocky plushies, rows of books, desk things, plants,
// a framed picture, and fabric storage bins with pixel patterns. Standing items arrive as
// {x (center), base (the surface they stand on), ...props}; rows as {x (left), w, base}.
import { vec2 } from 'littlejs';
import { POSTERS, MOTIFS } from '../../data/roomPixelArt.js';
import {
    rect, roundRect, outlinedBox, outlinedPoly, circle, ellipse, poly, line, pixelArt, hash, OUTLINE,
} from './roomShapes.js';

// --- blocky plushies --------------------------------------------------------------------------------

/** A soft cube animal sitting up: square body, square head, and ears by variant. */
export function drawPlush(ctx, { x, base, variant = 'bunny' }, p)
{
    const c = p.plush[variant] ?? p.plush.bunny;
    ellipse(ctx, x, base, 1.05, .14, p.shadow);
    if (variant === 'jelly')
        return drawJelly(ctx, x, base, c, p);
    const body = { x0: x - .36, x1: x + .36, y0: base, y1: base + .52 };
    const head = { x0: x - .4, x1: x + .4, y0: body.y1 - .06, y1: body.y1 + .6 };
    drawEars(ctx, variant, x, head.y1, c, p);
    cube(ctx, body.x0, body.y0, body.x1, body.y1, c, p);
    // Stubby arms and a lighter tummy patch.
    for (const side of [-1, 1])
        outlinedBox(ctx, x + side * .36 - .1, base + .12, x + side * .36 + .1, base + .38, .06, c.shade, p.outline);
    roundRect(ctx, x - .2, base + .06, x + .2, base + .36, .08, c.inner);
    cube(ctx, head.x0, head.y0, head.x1, head.y1, c, p);
    if (variant === 'cat')
        roundRect(ctx, x - .2, head.y0 + .04, x + .2, head.y0 + .28, .08, c.inner);   // white muzzle
    if (variant === 'bear')
        roundRect(ctx, x - .16, head.y0 + .06, x + .16, head.y0 + .26, .07, c.inner);
    drawFace(ctx, x, head.y0 + .3, variant, p);
}

function cube(ctx, x0, y0, x1, y1, c, p)
{
    outlinedBox(ctx, x0, y0, x1, y1, .1, c.shade, p.outline);
    roundRect(ctx, x0, y0 + .07, x1 - .06, y1, .1, c.body);
    roundRect(ctx, x0 + .07, y1 - .12, x1 - .16, y1 - .05, .03, p.paintLight.withAlpha(.6));
}

function drawEars(ctx, variant, x, top, c, p)
{
    const pair = (draw) => [-1, 1].forEach(side => draw(x + side * .24, side));
    if (variant === 'bunny')
        pair(ex => { outlinedBox(ctx, ex - .1, top - .1, ex + .1, top + .5, .09, c.body, p.outline); roundRect(ctx, ex - .045, top, ex + .045, top + .42, .04, c.inner); });
    else if (variant === 'bear')
        pair(ex => { outlinedBox(ctx, ex - .14, top - .12, ex + .14, top + .14, .1, c.shade, p.outline); roundRect(ctx, ex - .07, top - .06, ex + .07, top + .08, .05, c.inner); });
    else if (variant === 'cat')
        pair((ex, side) => outlinedPoly(ctx, [vec2(-.15, -.1), vec2(.15, -.1), vec2(side * .1, .26)], c.body, p.outline, ex, top));
    else if (variant === 'frog')
        pair(ex => { circle(ctx, ex, top + .02, .3 + OUTLINE * 2, p.outline); circle(ctx, ex, top + .02, .3, c.body); circle(ctx, ex, top + .04, .16, p.paintLight); circle(ctx, ex, top + .03, .09, p.face); });
}

function drawFace(ctx, x, y, variant, p)
{
    if (variant !== 'frog')
        for (const side of [-1, 1])
        {
            rect(ctx, x + side * .17 - .045, y, x + side * .17 + .045, y + .11, variant === 'cat' ? p.plush.frog.body.lerp(p.face, .2) : p.face);
            rect(ctx, x + side * .17 - .035, y + .06, x + side * .17 - .005, y + .095, p.paintLight);
        }
    for (const side of [-1, 1])
        ellipse(ctx, x + side * .27, y - .04, .12, .07, p.blush);
    // A little "w" of a mouth.
    line(ctx, x - .07, y - .06, x, y - .1, .03, p.face);
    line(ctx, x, y - .1, x + .07, y - .06, .03, p.face);
}

/** A wobbly pink jelly cube, slightly see-through at the top. */
function drawJelly(ctx, x, base, c, p)
{
    outlinedBox(ctx, x - .42, base, x + .42, base + .78, .2, c.shade, p.outline);
    roundRect(ctx, x - .42, base + .08, x + .36, base + .78, .2, c.body);
    roundRect(ctx, x - .3, base + .5, x + .1, base + .68, .08, c.inner);
    rect(ctx, x - .3, base + .2, x - .22, base + .32, c.inner);
    drawFace(ctx, x, base + .32, 'jelly', p);
}

// --- books ----------------------------------------------------------------------------------------------

/** A row of books standing on a shelf, the last one leaning on its neighbor. */
export function drawBooks(ctx, { x, w, base }, p)
{
    let bx = x, i = 0;
    while (bx < x + w - .15)
    {
        const width = Math.min(.18 + hash(x, i, 1) * .16, x + w - bx);
        const height = .8 + hash(x, i, 2) * .5;
        const color = p.books[Math.floor(hash(x, i, 3) * p.books.length)];
        const leaning = bx + width >= x + w - .2 && i > 2;
        if (leaning)
        {
            // A book tipped over against the row.
            poly(ctx, bookShape(width, height, OUTLINE), p.outline, bx + .05, base, -.35);
            poly(ctx, bookShape(width, height, 0), color, bx + .05, base, -.35);
            break;
        }
        book(ctx, bx, base, width, height, color, p);
        bx += width + .02;
        i++;
    }
}

function bookShape(width, height, grow)
{
    return [vec2(-grow, -grow), vec2(width + grow, -grow), vec2(width + grow, height + grow), vec2(-grow, height + grow)];
}

function book(ctx, x0, base, width, height, color, p)
{
    outlinedBox(ctx, x0, base, x0 + width, base + height, .03, color.lerp(p.outline, .25), p.outline);
    rect(ctx, x0, base + .02, x0 + width - .04, base + height, color);
    rect(ctx, x0, base + height - .16, x0 + width - .04, base + height - .11, p.paintLight.withAlpha(.6));
    rect(ctx, x0, base + .12, x0 + width - .04, base + .17, p.paintLight.withAlpha(.6));
}

/** Books lying in a stack. */
export function drawBookStack(ctx, { x, base }, p)
{
    let y = base;
    for (let i = 0; i < 3; i++)
    {
        const w = 1.05 - i * .12 + hash(x, i, 6) * .1, h = .2 + hash(x, i, 7) * .06;
        const color = p.books[Math.floor(hash(x, i, 8) * p.books.length)];
        const nudge = (hash(x, i, 9) - .5) * .16;
        outlinedBox(ctx, x - w / 2 + nudge, y, x + w / 2 + nudge, y + h, .04, color.lerp(p.outline, .25), p.outline);
        rect(ctx, x - w / 2 + nudge, y + .04, x + w / 2 + nudge - .05, y + h, color);
        rect(ctx, x + w / 2 + nudge - .2, y + .04, x + w / 2 + nudge - .08, y + h - .04, p.paper);
        y += h + OUTLINE;
    }
}

// --- desk things ------------------------------------------------------------------------------------

export function drawDeskLamp(ctx, { x, base }, p)
{
    ellipse(ctx, x, base + .08, .8 + OUTLINE * 2, .22 + OUTLINE * 2, p.outline);
    ellipse(ctx, x, base + .08, .8, .22, p.accentDark);
    // A two-part arm, then a cone shade tilted down toward the desk.
    line(ctx, x, base + .1, x + .3, base + 1.0, .1 + OUTLINE * 2, p.outline);
    line(ctx, x + .3, base + 1.0, x + .85, base + 1.25, .1 + OUTLINE * 2, p.outline);
    line(ctx, x, base + .1, x + .3, base + 1.0, .1, p.paint);
    line(ctx, x + .3, base + 1.0, x + .85, base + 1.25, .1, p.paint);
    circle(ctx, x + .3, base + 1.0, .16, p.accent);
    outlinedPoly(ctx, [vec2(-.18, .22), vec2(.22, .1), vec2(.42, -.42), vec2(-.42, -.2)], p.accent, p.outline, x + .95, base + 1.2);
    poly(ctx, [vec2(-.12, .14), vec2(.0, .1), vec2(-.2, -.25), vec2(-.32, -.18)], p.paintLight.withAlpha(.5), x + .95, base + 1.2);
}

export function drawPencilCup(ctx, { x, base }, p)
{
    const pencils = [[-.12, .8, p.books[0]], [.02, .95, p.books[3]], [.14, .75, p.books[2]]];
    for (const [dx, h, color] of pencils)
    {
        outlinedBox(ctx, x + dx - .05, base + .3, x + dx + .05, base + h, .02, color, p.outline);
        outlinedPoly(ctx, [vec2(-.05, 0), vec2(.05, 0), vec2(0, .12)], p.wood.lerp(p.paintLight, .4), p.outline, x + dx, base + h);
    }
    outlinedBox(ctx, x - .25, base, x + .25, base + .55, .06, p.plush.frog.shade, p.outline);
    roundRect(ctx, x - .25, base + .05, x + .2, base + .55, .06, p.plush.frog.body);
    pixelArt(ctx, MOTIFS.sparkle, { X: p.paintLight }, x - .1, base + .38, .06);
}

/** A little potted succulent with plump blocky leaves. */
export function drawPlant(ctx, { x, base }, p)
{
    for (const [dx, dy, w, h, angle] of [[-.18, .62, .22, .5, -.5], [.18, .62, .22, .5, .5], [0, .72, .24, .56, 0], [-.1, .56, .2, .36, -1], [.12, .56, .2, .36, 1]])
    {
        ellipse(ctx, x + dx, base + dy, w + OUTLINE * 2, h + OUTLINE * 2, p.outline, angle);
        ellipse(ctx, x + dx, base + dy, w, h, p.plant, angle);
        ellipse(ctx, x + dx - .02, base + dy + .06, w * .4, h * .5, p.plantLight, angle);
    }
    outlinedPoly(ctx, [vec2(-.3, .5), vec2(.3, .5), vec2(.22, 0), vec2(-.22, 0)], p.pot, p.outline, x, base);
    rect(ctx, x - .32, base + .4, x + .32, base + .52, p.pot.lerp(p.paintLight, .3));
}

/** A framed picture on a little stand: a tiny blocky landscape. */
export function drawPhoto(ctx, { x, base }, p)
{
    const w = 1.0, h = .85, art = POSTERS.landscape;
    poly(ctx, [vec2(0, 0), vec2(.22, 0), vec2(.02, .5)], p.accentDark, x + .2, base);
    outlinedBox(ctx, x - w / 2, base, x + w / 2, base + h, .06, p.accent, p.outline);
    rect(ctx, x - w / 2 + .1, base + .1, x + w / 2 - .1, base + h - .1, art.paper);
    const px = (w - .26) / art.rows[0].length;
    pixelArt(ctx, art.rows, art.colors, x - w / 2 + .13, base + h - .13, px);
}

// --- storage bins (in the cubby) -----------------------------------------------------------------

const BIN_W = 1.8, BIN_H = 1.5;

/** A fabric bin with a pattern by variant: a grass block, a gem, a heart, a star. */
export function drawBin(ctx, { x, base, variant = 'grass' }, p)
{
    const c = p.bins[variant] ?? p.bins.grass;
    const x0 = x - BIN_W / 2, x1 = x + BIN_W / 2, y1 = base + BIN_H;
    outlinedBox(ctx, x0, base, x1, y1, .1, c.side.lerp(p.outline, .2), p.outline);
    roundRect(ctx, x0, base + .06, x1 - .05, y1, .1, c.side);
    // A band along the top (the grass on a grass block), then little pixel specks.
    roundRect(ctx, x0, y1 - .42, x1 - .05, y1, .1, c.top);
    for (let i = 0; i < 9; i++)
    {
        const sx = x0 + .15 + hash(x, i, 11) * (BIN_W - .45), sy = base + .15 + hash(x, i, 12) * (BIN_H - .75);
        rect(ctx, sx, sy, sx + .14, sy + .14, c.speck);
    }
    for (let i = 0; i < 5; i++)
    {
        const sx = x0 + .12 + hash(x, i, 13) * (BIN_W - .4);
        rect(ctx, sx, y1 - .5, sx + .14, y1 - .36, c.top);           // grass dripping over the edge
        rect(ctx, sx + .3, y1 - .3, sx + .42, y1 - .18, c.topSpeck);
    }
    if (variant === 'heart' || variant === 'star' || variant === 'gem')
    {
        const motif = variant === 'star' ? MOTIFS.sparkle : variant === 'gem' ? POSTERS.gem.rows : MOTIFS.heart;
        const px = variant === 'gem' ? .07 : .12;
        const colors = variant === 'gem' ? POSTERS.gem.colors : { X: c.speck };
        pixelArt(ctx, motif, colors, x - motif[0].length * px / 2, base + .3 + motif.length * px, px);
    }
    // Handle hole.
    roundRect(ctx, x - .3, y1 - .3, x + .3, y1 - .14, .08, c.side.lerp(p.outline, .55));
}
