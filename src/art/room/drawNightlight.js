// The nightlight: a little mushroom plugged into a wall outlet. By day it's off and fast
// asleep (eyes shut); when the room gets dark it clicks on with a squish, its cap glows warm,
// and it opens its eyes to keep watch. Drawn live (WebGL, world space) because it changes.
// Pure function of (pos, state, time): pos = where it stands on the floor; state = {on: 0..1,
// pop: 0..1 (the switch-on squish, 1 = just clicked), glow (a tile for the halo, may be null)}.
// Art units are scaled by SIZE into tiles.
import { vec2, rgb, drawRect, drawEllipse, drawCircle, drawPoly, drawTile, drawLine } from 'littlejs';
import { roundedRectPoints } from '../shapes.js';

const SIZE = 1.4;
const OUTLINE = .05;
const PLATE_UP = 1.0;        // the outlet's center above the floor, art units
const CAP_W = .78, CAP_H = .5, STEM_W = .36, STEM_H = .42;
const SHINE = rgb(1, 1, 1);
const BLUSH = rgb(1, .5, .6, .6);

/** Where the lamp's glowing cap is, for the light it throws (systems/RoomLighting.js). */
export function nightlightGlowPos(pos)
{
    return pos.add(vec2(0, (PLATE_UP + .2) * SIZE));
}

export function drawNightlight(pos, { on, pop, glow }, time, palette, ink)
{
    const n = palette;
    const at = (x, y) => pos.add(vec2(x * SIZE, y * SIZE));
    const center = at(0, PLATE_UP);
    // The outlet plate on the wall, with its top socket showing above the lamp.
    roundBox(center, .62, .86, .1, ink);
    roundBox(center, .62 - OUTLINE * 2, .86 - OUTLINE * 2, .08, n.plateShade);
    roundBox(at(-.02, PLATE_UP + .02), .52, .72, .07, n.plate);
    for (const dx of [-.09, .09])
        drawRect(at(dx, PLATE_UP + .22), vec2(.04, .12).scale(SIZE), ink);
    // The lamp, squished for a moment when it clicks on, breathing gently while it shines.
    const squish = Math.sin(pop * Math.PI) * .14;
    const breathe = on * Math.sin(time * 1.7) * .015;
    const sx = 1 + squish + breathe, sy = 1 - squish * .8 + breathe;
    const stem = at(0, PLATE_UP - .12);
    if (glow && on > 0)
        drawTile(stem.add(vec2(0, .28 * SIZE)), vec2(2.1 * SIZE * (1 + breathe * 3)), glow, n.glow.withAlpha(.55 * on));
    roundBox(stem, STEM_W * sx + OUTLINE * 2, STEM_H * sy + OUTLINE * 2, .12, ink);
    roundBox(stem, STEM_W * sx, STEM_H * sy, .1, n.stemShade);
    roundBox(stem.add(vec2(-.02, .02).scale(SIZE)), STEM_W * sx - .05, STEM_H * sy - .04, .09, n.stem);
    drawFace(stem.add(vec2(0, -.03 * SIZE)), on, ink);
    drawCap(stem.add(vec2(0, (STEM_H * sy / 2 + .02) * SIZE)), sx, sy, on, n, ink);
}

function drawCap(base, sx, sy, on, n, ink)
{
    const w = CAP_W * sx, h = CAP_H * sy;
    const cap = n.capOff.lerp(n.capOn, on), dot = n.dotOff.lerp(n.dotOn, on);
    const dome = (width, height, color, lift = 0) =>
    {
        const points = [];
        for (let i = 0; i <= 14; i++)
        {
            const a = Math.PI * i / 14;
            points.push(vec2(Math.cos(a) * width / 2, Math.sin(a) * height + lift).scale(SIZE));
        }
        drawPoly(points, color, 0, undefined, base);
    };
    dome(w + OUTLINE * 2, h + OUTLINE, ink, -OUTLINE);
    dome(w, h, cap.lerp(ink, .15));
    dome(w - .06, h - .05, cap, .04);
    drawEllipse(base.add(vec2(0, .02 * SIZE)), vec2(w, .1).scale(SIZE), cap.lerp(ink, .25));
    for (const [dx, dy, d] of [[-.2, .2, .13], [.12, .32, .1], [.24, .12, .08], [-.04, .1, .07]])
        drawCircle(base.add(vec2(dx * sx, dy * sy).scale(SIZE)), d * SIZE, dot);
    drawEllipse(base.add(vec2(-.16 * sx, .36 * sy).scale(SIZE)), vec2(.14, .07).scale(SIZE), n.dotOn.withAlpha(.7), .4);
}

/** Asleep (shut eyes) while off; wide awake and smiling while on. */
function drawFace(center, on, ink)
{
    const at = (x, y) => center.add(vec2(x * SIZE, y * SIZE));
    for (const side of [-1, 1])
    {
        const eye = at(side * .085, .05);
        if (on > .5)
        {
            drawEllipse(eye, vec2(.06, .085).scale(SIZE), ink);
            drawCircle(eye.add(vec2(-.012, .02).scale(SIZE)), .025 * SIZE, SHINE);
        }
        else
            drawLine(eye.add(vec2(-.035, .01).scale(SIZE)), eye.add(vec2(.035, .01).scale(SIZE)), .025 * SIZE, ink);
        drawEllipse(at(side * .13, -.04), vec2(.07, .04).scale(SIZE), BLUSH);
    }
    drawLine(at(-.035, -.05), at(0, -.075), .022 * SIZE, ink);
    drawLine(at(0, -.075), at(.035, -.05), .022 * SIZE, ink);
}

function roundBox(pos, w, h, r, color)
{
    drawPoly(roundedRectPoints(w * SIZE, h * SIZE, r * SIZE, 3), color, 0, undefined, pos);
}
