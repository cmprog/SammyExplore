// The window, baked into the wall: a chunky white frame with a cross of mullions, a sill Sammy
// can stand on, a curtain rod and tied-back curtains. The glass is cut out of the bake (left
// transparent) so the live view of the sky (systems/WindowView.js) shows through, with a faint
// sheen left on it.
// The window piece's rect: its bottom row is the sill (one-way tiles), and the frame stands on
// the sill one tile in from each end, up to the rect's top.
import { vec2 } from 'littlejs';
import { MOTIFS } from '../../data/roomPixelArt.js';
import { rect, roundRect, outlinedBox, outlinedPoly, panel, circle, poly, pixelArt, OUTLINE } from './roomShapes.js';

const FRAME = .4;
const MULLION = .16;
const CURTAIN_W = 2.3;

/** Frame, glass, and sill rects for a window piece (shared with the view and the lighting). */
export function windowGeometry({ x0, y0, x1, y1 })
{
    const frame = { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1 };
    const glass = { x0: frame.x0 + FRAME, y0: frame.y0 + FRAME, x1: frame.x1 - FRAME, y1: frame.y1 - FRAME };
    return { frame, glass, sillTop: y0 + 1, rodY: y1 + .5 };
}

export function drawWindowFrame(ctx, piece, p)
{
    const { frame, glass, sillTop, rodY } = windowGeometry(piece);
    // Cut the glass out of everything baked so far, then leave a little sheen on it.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    rect(ctx, glass.x0, glass.y0, glass.x1, glass.y1, p.paintLight);
    ctx.restore();
    drawSheen(ctx, glass, p);

    // Frame: an outlined ring around the glass, lit on its inner top edge.
    const ring = (x0, y0, x1, y1, color) =>
    {
        rect(ctx, x0, y0, x1, glass.y0, color);
        rect(ctx, x0, glass.y1, x1, y1, color);
        rect(ctx, x0, y0, glass.x0, y1, color);
        rect(ctx, glass.x1, y0, x1, y1, color);
    };
    ring(frame.x0 - OUTLINE, frame.y0 - OUTLINE, frame.x1 + OUTLINE, frame.y1 + OUTLINE, p.outline);
    ring(frame.x0, frame.y0, frame.x1, frame.y1, p.frameShade);
    ring(frame.x0, frame.y0 + .08, frame.x1 - .08, frame.y1, p.frame);
    rect(ctx, glass.x0 - .06, glass.y1, glass.x1 + .06, glass.y1 + .06, p.frameShade);   // inner lip
    rect(ctx, glass.x0 - OUTLINE, glass.y0 - OUTLINE, glass.x1 + OUTLINE, glass.y0, p.outline);
    rect(ctx, glass.x0 - OUTLINE, glass.y1, glass.x1 + OUTLINE, glass.y1 + OUTLINE, p.outline);
    rect(ctx, glass.x0 - OUTLINE, glass.y0, glass.x0, glass.y1, p.outline);
    rect(ctx, glass.x1, glass.y0, glass.x1 + OUTLINE, glass.y1, p.outline);
    // Mullions: a cross dividing four panes.
    const cx = (glass.x0 + glass.x1) / 2, cy = (glass.y0 + glass.y1) / 2;
    rect(ctx, cx - MULLION / 2 - OUTLINE, glass.y0, cx + MULLION / 2 + OUTLINE, glass.y1, p.outline);
    rect(ctx, glass.x0, cy - MULLION / 2 - OUTLINE, glass.x1, cy + MULLION / 2 + OUTLINE, p.outline);
    rect(ctx, cx - MULLION / 2, glass.y0, cx + MULLION / 2, glass.y1, p.frame);
    rect(ctx, glass.x0, cy - MULLION / 2, glass.x1, cy + MULLION / 2, p.frame);

    drawSill(ctx, piece, sillTop, p);
    drawCurtain(ctx, frame, rodY, sillTop, -1, p);
    drawCurtain(ctx, frame, rodY, sillTop, 1, p);
    drawRod(ctx, frame, rodY, p);
}

/** Two soft diagonal streaks of reflection per pane. */
function drawSheen(ctx, glass, p)
{
    const w = glass.x1 - glass.x0, h = glass.y1 - glass.y0;
    for (const [px, py] of [[0, 0], [.5, 0], [0, .5], [.5, .5]])
    {
        const x = glass.x0 + w * (px + .1), y = glass.y0 + h * (py + .1);
        const streak = (dx, width) => poly(ctx, [vec2(0, 0), vec2(width, 0), vec2(width + h * .3, h * .3), vec2(h * .3, h * .3)], p.glassSheen, x + dx, y);
        streak(w * .05, w * .06);
        streak(w * .15, w * .025);
    }
}

function drawSill(ctx, { x0, x1 }, top, p)
{
    // Little carved brackets under the sill at both ends.
    for (const bx of [x0 + 1.15, x1 - 1.15])
    {
        outlinedBox(ctx, bx - .2, top - 1, bx + .2, top - .35, .12, p.frameShade, p.outline);
        roundRect(ctx, bx - .2, top - .9, bx + .12, top - .35, .1, p.frame);
    }
    panel(ctx, x0 + .1, top - .4, x1 - .1, top, { r: .1, fill: p.frame, light: p.paintLight, shade: p.frameShade, outline: p.outline, shadeSize: .1 });
}

function drawRod(ctx, frame, y, p)
{
    const x0 = frame.x0 - CURTAIN_W * .8, x1 = frame.x1 + CURTAIN_W * .8;
    outlinedBox(ctx, x0, y - .07, x1, y + .07, .07, p.bracket, p.outline);
    for (const x of [x0, x1])
    {
        circle(ctx, x, y, .34 + OUTLINE * 2, p.outline);
        circle(ctx, x, y, .34, p.accent);
        circle(ctx, x - .07, y + .07, .12, p.paintLight);
    }
}

/**
 * A curtain hanging from the rod over one side of the frame (side -1 left, 1 right), gathered
 * by a ribbon at the tie and flaring out again below it.
 */
function drawCurtain(ctx, frame, rodY, sillTop, side, p)
{
    const edge = side < 0 ? frame.x0 : frame.x1;            // the frame's outer edge on this side
    const outer = edge - side * (CURTAIN_W * .62);         // far side of the curtain, out on the wall
    const inner = edge + side * (CURTAIN_W * .38);         // near side, over the frame
    const tieY = sillTop + (rodY - sillTop) * .36;
    const tieInner = edge - side * .15, hemInner = edge + side * .25;
    const shape = [
        vec2(outer, rodY), vec2(inner, rodY),
        vec2(inner - side * .2, rodY - (rodY - tieY) * .45),
        vec2(tieInner, tieY + .3), vec2(tieInner, tieY),
        vec2(hemInner, sillTop + .2), vec2(outer - side * .15, sillTop + .2),
        vec2(outer + side * .05, tieY), vec2(outer, rodY - (rodY - tieY) * .5),
    ];
    outlinedPoly(ctx, shape, p.curtain, p.outline);
    // Folds: darker stripes that gather toward the tie.
    for (const t of [.22, .5, .78])
    {
        const topX = outer + (inner - outer) * t, tieX = outer + side * .1 + (tieInner - outer - side * .1) * t;
        const hemX = outer - side * .15 + (hemInner - outer + side * .15) * t;
        poly(ctx, [vec2(topX - .07, rodY - .05), vec2(topX + .07, rodY - .05), vec2(tieX + .03, tieY + .2), vec2(tieX - .03, tieY + .2)], p.curtainDark);
        poly(ctx, [vec2(tieX - .03, tieY - .1), vec2(tieX + .03, tieY - .1), vec2(hemX + .08, sillTop + .3), vec2(hemX - .08, sillTop + .3)], p.curtainDark);
    }
    // A lit edge, a few little hearts, and the ribbon bow at the tie.
    poly(ctx, [vec2(outer, rodY - .05), vec2(outer + side * .1, rodY - .05), vec2(outer + side * .15, tieY), vec2(outer + side * .05, tieY)], p.curtainLight);
    const heart = MOTIFS.heart, px = .07;
    for (const [t, y] of [[.3, .75], [.65, .55], [.4, .25]])
    {
        const hx = outer + (inner - outer) * t * .9, hy = tieY + (rodY - tieY) * y;
        pixelArt(ctx, heart, { X: p.curtainHeart }, hx - heart[0].length * px / 2, hy, px);
    }
    const bx = (tieInner + outer) / 2 + side * .1;
    for (const dir of [-1, 1])
        poly(ctx, [vec2(0, 0), vec2(dir * .38, .22), vec2(dir * .38, -.22)], p.tie, bx, tieY + .12);
    circle(ctx, bx, tieY + .12, .2 + OUTLINE * 2, p.outline);
    circle(ctx, bx, tieY + .12, .2, p.tie);
    rect(ctx, Math.min(outer, tieInner), tieY + .05, Math.max(outer, tieInner), tieY + .19, p.tie);
}
