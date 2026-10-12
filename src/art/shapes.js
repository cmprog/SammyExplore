// Point lists for rounded shapes, for drawPoly / drawLineList. All relative to a local origin,
// y up (world space). Pure helpers shared by prop art.
import { vec2 } from 'littlejs';

/** A door-style arch: flat bottom at y = 0, straight sides, semicircular top. Total height h.
 *  Starts bottom-left and goes clockwise (up the left side, over, down the right). */
export function archPoints(w, h, segments = 12)
{
    const r = w / 2;
    const shoulder = h - r;
    const points = [vec2(-r, 0)];
    for (let i = 0; i <= segments; i++)
    {
        const a = Math.PI - Math.PI * i / segments;
        points.push(vec2(Math.cos(a) * r, shoulder + Math.sin(a) * r));
    }
    points.push(vec2(r, 0));
    return points;
}

/** A rectangle centered on the origin with rounded corners of radius r. */
export function roundedRectPoints(w, h, r, segments = 4)
{
    r = Math.min(r, w / 2, h / 2);
    const corners = [
        [w / 2 - r, h / 2 - r, 0],
        [-w / 2 + r, h / 2 - r, Math.PI / 2],
        [-w / 2 + r, -h / 2 + r, Math.PI],
        [w / 2 - r, -h / 2 + r, Math.PI * 1.5],
    ];
    const points = [];
    for (const [cx, cy, start] of corners)
        for (let i = 0; i <= segments; i++)
        {
            const a = start + Math.PI / 2 * i / segments;
            points.push(vec2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
        }
    return points;
}
