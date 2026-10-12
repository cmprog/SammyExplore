// A little coordinate frame for drawing layered characters from primitives.
//
// Art is authored in "art units" with y up, facing right. A frame maps art points to world space
// through scale, squash/stretch, mirroring (facing left) and rotation, and child frames nest
// (a wing on a shoulder, a face on a tilting head). Every shape is built as a polygon and each
// vertex goes through the full transform, so squash, tilt and mirroring are exact at any depth.
// Angles in art space are counter-clockwise radians (standard math), in the facing-right drawing.
//
// Draws with the engine's WebGL primitives in world space. Ellipses get just enough vertices for
// their size on screen (small in play, smooth when the title draws Sammy big).
// Filled shapes (ellipse, poly) map their vertices into pooled vectors: the engine copies the
// points as soon as drawPoly is called, so the same scratch arrays serve every shape of every
// character each frame instead of allocating a vector per vertex.
import { vec2, drawPoly, drawLineList, BLACK, cameraScale } from '../../lib/littlejs/littlejs.esm.js';

const PIXELS_PER_SIDE = 5;
const MIN_SIDES = 10;
const MAX_SIDES = 48;
const ORIGIN = vec2();
// Unit circles per vertex count, computed once: ellipses only scale and transform them.
const unitCircles = new Map();
// Scratch vertex arrays by vertex count, reused by every filled shape (see the header).
const scratch = new Map();

function scratchPoints(count)
{
    if (!scratch.has(count))
        scratch.set(count, Array.from({ length: count }, () => vec2()));
    return scratch.get(count);
}

function unitCircle(sides)
{
    if (!unitCircles.has(sides))
        unitCircles.set(sides, Array.from({ length: sides }, (_, i) =>
        {
            const a = i / sides * Math.PI * 2;
            return { x: Math.cos(a), y: Math.sin(a) };
        }));
    return unitCircles.get(sides);
}

export class ArtFrame
{
    /**
     * @param {(x:number, y:number, out?:Vector2) => Vector2} map - art point to world point,
     *   written into `out` when given (else a new vector)
     */
    constructor(map)
    {
        this.map = map;
        this.unitLength = null;   // cached by unit()
    }

    /**
     * The root frame of a character.
     * @param {Vector2} origin - world position of the art origin (Sammy: between the feet)
     * @param {{scale?:number, mirror?:number, stretchX?:number, stretchY?:number, tilt?:number, pivotY?:number}} t
     *   tilt (CCW radians, in world terms) turns around (0, pivotY); stretch scales from the origin.
     */
    static root(origin, { scale = 1, mirror = 1, stretchX = 1, stretchY = 1, tilt = 0, pivotY = 0 } = {})
    {
        const c = Math.cos(tilt), s = Math.sin(tilt);
        const pivot = pivotY * stretchY;
        const ox = origin.x, oy = origin.y;
        return new ArtFrame((x, y, out = vec2()) =>
        {
            const px = mirror * x * stretchX, py = y * stretchY - pivot;
            return out.set(ox + (px * c - py * s) * scale, oy + (px * s + py * c + pivot) * scale);
        });
    }

    /** A frame whose origin is art point (x, y) of this one, turned by `angle`, optionally scaled. */
    child(x, y, angle = 0, scaleX = 1, scaleY = scaleX)
    {
        const c = Math.cos(angle), s = Math.sin(angle);
        return new ArtFrame((px, py, out) =>
        {
            px *= scaleX;
            py *= scaleY;
            return this.map(x + px * c - py * s, y + px * s + py * c, out);
        });
    }

    point(x, y)
    {
        return this.map(x, y);
    }

    /** World-space length of one art unit (for line widths). Uses the x axis. */
    unit()
    {
        return this.unitLength ??= this.map(1, 0).distance(this.map(0, 0));
    }

    /** @param {Vector2[]} [out] - vectors to write into (one per vertex); new ones if omitted */
    ellipsePoints(x, y, w, h, angle = 0, out = null)
    {
        const c = Math.cos(angle), s = Math.sin(angle);
        const sides = this.sidesFor(w, h);
        const points = out ?? Array.from({ length: sides }, () => vec2());
        const circle = unitCircle(sides);
        for (let i = 0; i < sides; i++)
        {
            const ex = circle[i].x * w / 2, ey = circle[i].y * h / 2;
            this.map(x + ex * c - ey * s, y + ex * s + ey * c, points[i]);
        }
        return points;
    }

    ellipse(x, y, w, h, color, angle = 0)
    {
        drawPoly(this.ellipsePoints(x, y, w, h, angle, scratchPoints(this.sidesFor(w, h))), color, 0, BLACK, ORIGIN);
    }

    /** Just enough vertices for an ellipse of this size on screen. */
    sidesFor(w, h)
    {
        const pixels = Math.max(w, h) * this.unit() * cameraScale * Math.PI;
        return Math.round(Math.min(MAX_SIDES, Math.max(MIN_SIDES, pixels / PIXELS_PER_SIDE)));
    }

    /** An ellipse with a solid outline of `outline` art units around it. */
    outlinedEllipse(x, y, w, h, color, outlineColor, outline, angle = 0)
    {
        this.ellipse(x, y, w + outline * 2, h + outline * 2, outlineColor, angle);
        this.ellipse(x, y, w, h, color, angle);
    }

    circle(x, y, d, color)
    {
        this.ellipse(x, y, d, d, color);
    }

    /** @param {number[][]} points - [[x, y], ...] in art units */
    poly(points, color, lineWidth = 0, lineColor = BLACK)
    {
        const out = scratchPoints(points.length);
        for (let i = 0; i < points.length; i++)
            this.map(points[i][0], points[i][1], out[i]);
        drawPoly(out, color, lineWidth * this.unit(), lineColor, ORIGIN);
    }

    /** An open polyline; width in art units. */
    line(points, width, color)
    {
        drawLineList(points.map(([x, y]) => this.map(x, y)), width * this.unit(), color, false, ORIGIN);
    }

    /** A smooth arc of an ellipse from angle a0 to a1 (CCW radians), as a line. */
    arc(x, y, w, h, a0, a1, width, color, steps = 8)
    {
        const points = [];
        for (let i = 0; i <= steps; i++)
        {
            const a = a0 + (a1 - a0) * i / steps;
            points.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]);
        }
        this.line(points, width, color);
    }
}
