// Baked furniture: the desk (walk-under) and the bed. Pieces are {x0, y0, x1, y1, groundY}
// in world units, y up; see the bedroom level for how the collision tiles line up.
import { vec2 } from 'littlejs';
import { MOTIFS } from '../../data/roomPixelArt.js';
import { rect, roundRect, outlinedBox, panel, circle, ellipse, poly, softShadow, pixelArt, hash, OUTLINE } from './roomShapes.js';
import { knob } from './furnitureStorage.js';

// --- desk: a thick top with two drawers in its apron, on tapered legs ---------------------------

export function drawDesk(ctx, { x0, y0, x1, y1, groundY }, p)
{
    // Shade on the wall under the desk, then the back legs and crossbar (behind, darker).
    softShadow(ctx, (x0 + x1) / 2, groundY, x1 - x0, (y0 - groundY) * 1.6, p.shadow.withAlpha(.35));
    rect(ctx, x0 + .9, y0 - 2.1, x1 - .9, y0 - 1.85, p.paintShade);
    for (const lx of [x0 + .9, x1 - .9])
        leg(ctx, lx, groundY + .25, y0, .32, p.paintShade, p.paintShade, p);
    for (const lx of [x0 + .45, x1 - .45])
        leg(ctx, lx, groundY, y0, .42, p.paint, p.paintShade, p);
    // The top: a lit surface strip and a front apron with two drawers.
    panel(ctx, x0, y0, x1, y1 - .28, { r: .06, fill: p.paint, shade: p.paintShade, outline: p.outline, shadeSize: .08 });
    const mid = (x0 + x1) / 2;
    for (const [dx0, dx1] of [[x0 + .35, mid - .1], [mid + .1, x1 - .35]])
    {
        roundRect(ctx, dx0, y0 + .12, dx1, y1 - .4, .06, p.paintShade);
        roundRect(ctx, dx0 + .04, y0 + .16, dx1 - .04, y1 - .4, .05, p.paint);
        knob(ctx, (dx0 + dx1) / 2, (y0 + y1 - .28) / 2 + .02, p, .2);
    }
    panel(ctx, x0 - .15, y1 - .3, x1 + .15, y1, { r: .1, fill: p.paint, light: p.paintLight, shade: p.paintShade, outline: p.outline, shadeSize: .08 });
    rect(ctx, x0 - .15, y1 - .26, x1 + .15, y1 - .2, p.accent);
}

/** A leg that tapers toward the floor, with a lit left edge. */
function leg(ctx, x, bottom, top, width, fill, shade, p)
{
    const w = width / 2;
    const shape = [vec2(-w, top), vec2(w, top), vec2(w * .6, bottom), vec2(-w * .6, bottom)];
    poly(ctx, shape.map(v => vec2(v.x * 1 + Math.sign(v.x) * OUTLINE, v.y + (v.y === bottom ? -OUTLINE : 0))), p.outline, x, 0);
    poly(ctx, shape, shade, x, 0);
    poly(ctx, shape.map(v => vec2(v.x < 0 ? v.x : v.x * .2, v.y)), fill, x, 0);
}

// --- bed: footboard (1 wide) on the left, mattress, headboard (2 wide) on the right ------------

const MATTRESS = 2;
const FOOT_W = 1, FOOT_H = 3, HEAD_W = 2;
const QUILT_SQUARE = .5;

export function drawBed(ctx, { x0, y0, x1, y1, groundY }, p)
{
    const bedLeft = x0 + FOOT_W, bedRight = x1 - HEAD_W, top = y0 + MATTRESS;
    // A soft shadow under the bed, so the space beneath reads as a cozy cave.
    softShadow(ctx, (bedLeft + bedRight) / 2, groundY, bedRight - bedLeft + 1, (y0 - groundY) * 2.4, p.shadow.withAlpha(.55));
    // Little legs at the middle, behind.
    leg(ctx, (bedLeft + bedRight) / 2, groundY, y0 + .2, .45, p.bedFrameDark, p.bedFrameDark, p);
    drawHeadboard(ctx, bedRight, groundY, x1, y1, p);
    // Side rail, mattress, and the quilt over it.
    panel(ctx, bedLeft - .1, y0, bedRight + .1, y0 + .55, { r: .08, fill: p.bedFrame, light: p.bedFrameLight, shade: p.bedFrameDark, outline: p.outline, shadeSize: .1 });
    outlinedBox(ctx, bedLeft, y0 + .5, bedRight, top - .55, .14, p.mattress, p.outline);
    for (let x = bedLeft + .35; x < bedRight - .2; x += .55)
        circle(ctx, x, y0 + .82, .07, p.pillowShade);
    drawQuilt(ctx, bedLeft, bedRight - .25, y0 + .25, top, p);
    drawPillow(ctx, bedRight - 2.45, bedRight - .2, top, p);
    drawFootboard(ctx, x0, groundY, x0 + FOOT_W, y0 + FOOT_H, p);
}

function drawHeadboard(ctx, x0, groundY, x1, y1, p)
{
    const panelBottom = groundY + 2.1;
    // Posts at both sides, a rounded panel between them with a pixel heart.
    outlinedBox(ctx, x0 + .15, panelBottom, x1 - .15, y1 - .5, .9, p.bedFrameDark, p.outline);
    roundRect(ctx, x0 + .15, panelBottom + .12, x1 - .27, y1 - .5, .85, p.bedFrame);
    roundRect(ctx, x0 + .45, panelBottom + .5, x1 - .55, y1 - 1.2, .6, p.bedFrameLight);
    roundRect(ctx, x0 + .55, panelBottom + .6, x1 - .6, y1 - 1.3, .5, p.bedFrame);
    const heart = MOTIFS.heart, px = .16;
    pixelArt(ctx, heart, { X: p.quilt[0] }, (x0 + x1) / 2 - heart[0].length * px / 2, y1 - 2.3, px);
    for (const [a, b] of [[x0, x0 + .4], [x1 - .4, x1]])
        post(ctx, a, groundY, b, y1 - .25, p);
}

function drawFootboard(ctx, x0, groundY, x1, top, p)
{
    outlinedBox(ctx, x0 + .1, groundY + 1.7, x1 - .05, top - .45, .3, p.bedFrameDark, p.outline);
    roundRect(ctx, x0 + .1, groundY + 1.8, x1 - .15, top - .45, .28, p.bedFrame);
    post(ctx, x0, groundY, x0 + .38, top - .2, p);
}

/** A round-topped bed post with a ball on top. */
function post(ctx, x0, bottom, x1, top, p)
{
    outlinedBox(ctx, x0, bottom, x1, top, .08, p.bedFrameDark, p.outline);
    rect(ctx, x0 + .02, bottom + .08, x1 - .12, top - .02, p.bedFrame);
    rect(ctx, x0 + .07, bottom + .2, x0 + .13, top - .1, p.bedFrameLight);
    const cx = (x0 + x1) / 2, d = (x1 - x0) * 1.35;
    circle(ctx, cx, top + d * .4, d + OUTLINE * 2, p.outline);
    circle(ctx, cx, top + d * .4, d, p.bedFrameDark);
    circle(ctx, cx - d * .06, top + d * .45, d * .86, p.bedFrame);
    circle(ctx, cx - d * .2, top + d * .6, d * .3, p.bedFrameLight);
}

/** A puffy pillow resting on the mattress, its top a little above the quilt. */
function drawPillow(ctx, x0, x1, top, p)
{
    const y0 = top - .55, y1 = top + .75;
    outlinedBox(ctx, x0, y0, x1, y1, .4, p.pillowShade, p.outline);
    roundRect(ctx, x0 + .06, y0 + .14, x1 - .08, y1, .36, p.pillow);
    rect(ctx, x0 + .35, (y0 + y1) / 2 - .05, x1 - .35, (y0 + y1) / 2 + .07, p.quilt[0]);
    ellipse(ctx, x0 + .7, y1 - .3, .7, .16, p.paintLight);
}

/** The quilt: pixel-block squares across the top, draped down over the foot end. */
function drawQuilt(ctx, x0, x1, bottom, top, p)
{
    const drapeX = x0 + 1.2;
    // Body with its outline, a rounded top edge, and the drape hanging lower at the foot end.
    roundRect(ctx, x0 - OUTLINE - .05, bottom - .55 - OUTLINE, drapeX, top + OUTLINE, .2, p.outline);
    outlinedBox(ctx, x0 - .05, top - 1.05, x1 + .2, top, .18, p.quiltShade, p.outline);
    roundRect(ctx, x0 - .05, bottom - .55, drapeX - .05, top, .18, p.quiltShade);
    roundRect(ctx, x0 - .05, bottom - .45, drapeX - .1, top, .16, p.quiltBase);
    roundRect(ctx, x0 - .05, top - .95, x1 + .2, top, .16, p.quiltBase);
    // Block squares in two rows; colors from the quilt palette, stitched apart.
    const rowsTop = top - .1;
    for (let row = 0; row < 2; row++)
        for (let x = x0 + .1, i = 0; x < x1; x += QUILT_SQUARE, i++)
        {
            const color = p.quilt[Math.floor(hash(i, row, 4) * p.quilt.length)];
            const y1 = rowsTop - row * QUILT_SQUARE * .8;
            rect(ctx, x + .04, y1 - QUILT_SQUARE * .8 + .04, Math.min(x + QUILT_SQUARE - .04, x1 + .1), y1 - .04, color);
        }
    // The drape at the foot end: squares running down, then a scalloped hem.
    for (let y = rowsTop - QUILT_SQUARE * 1.6, i = 0; y > bottom - .2; y -= QUILT_SQUARE * .8, i++)
        rect(ctx, x0 + .05, Math.max(y - QUILT_SQUARE * .8 + .04, bottom - .35), drapeX - .2, y - .04, p.quilt[(i + 1) % p.quilt.length]);
    for (let x = x0 + .15; x < drapeX - .1; x += .32)
        circle(ctx, x, bottom - .5, .26, p.quiltBase);
    // A lit fold along the top.
    roundRect(ctx, x0 + .15, top - .1, x1, top - .03, .03, p.quilt[3]);
}
