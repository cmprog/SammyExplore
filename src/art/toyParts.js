// Shared bits for the toy-like mechanism art (T-014): rounded blocks, brick studs, stars.
// All draw into an ArtFrame (art units, y up), so callers can squash, mirror and rotate them.
import { BLACK } from 'littlejs';

export const TOY_LINE = .05;   // outline width, matching the doors and signs

/** [x, y] points of a rounded rect from (x0, y0) to (x1, y1). Corners shrink to fit. */
export function roundRectPoints(x0, y0, x1, y1, r, segments = 3)
{
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
    const corners = [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI], [x1 - r, y0 + r, Math.PI * 1.5]];
    const points = [];
    for (const [cx, cy, start] of corners)
        for (let i = 0; i <= segments; i++)
        {
            const a = start + Math.PI / 2 * i / segments;
            points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
    return points;
}

/** A rounded block with an outline and a lit top strip: the basic wooden/plastic toy piece. */
export function drawBlock(frame, x0, y0, x1, y1, r, color, light, outline, lit = .28)
{
    frame.poly(roundRectPoints(x0, y0, x1, y1, r), color, TOY_LINE, outline);
    const inset = TOY_LINE * .8;
    const top = y1 - inset, height = (y1 - y0) * lit;
    if (light && height > .03)
        frame.poly(roundRectPoints(x0 + inset, top - height, x1 - inset, top, r * .7), light, 0, BLACK);
}

/** Plastic-brick studs along the top edge y, from x0 to x1, `count` of them. */
export function drawStuds(frame, x0, x1, y, count, color, light, outline, height = .09)
{
    const pitch = (x1 - x0) / count;
    const w = pitch * .56;
    for (let i = 0; i < count; i++)
    {
        const cx = x0 + pitch * (i + .5);
        frame.poly(roundRectPoints(cx - w / 2, y - .02, cx + w / 2, y + height, .03), color, TOY_LINE * .8, outline);
        frame.poly(roundRectPoints(cx - w / 2 + .02, y + height * .45, cx - w * .05, y + height - .015, .015), light, 0, BLACK);
    }
}

/** A five-point sticker star centered at (x, y). */
export function starPoints(x, y, radius, spin = 0)
{
    const points = [];
    for (let i = 0; i < 10; i++)
    {
        const a = Math.PI / 2 + spin + i * Math.PI / 5;
        const r = i % 2 ? radius * .45 : radius;
        points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return points;
}
