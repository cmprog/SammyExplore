// A toy-brick gate: a wall of chunky plastic bricks (red, blue, yellow, green) standing in a
// grey base plate. Opening, the wall sinks down into the plate until only its top studs peek
// out; closing, it rises back up with a little wobble.
// Pure drawing: drawGate(feetPos, state, time).
import { vec2, drawEllipse, BLACK } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { drawBlock, drawStuds, roundRectPoints, TOY_LINE } from './toyParts.js';

const PLATE_H = .16;
const PLATE_W = 1.2;
const BRICK_H = .48;
const STUD_H = .09;
const PEEK = .02;   // how much of the top brick stays above the plate when fully open

/** Height of the wall's top (studs included) above the feet, for a gate `height` tall that is
 *  `open` (eased, 0..1) sunk. The Gate's collision box follows this, so it blocks exactly what
 *  is drawn. */
export function gateWallTop(height, open)
{
    return height - open * (height - PLATE_H - STUD_H - PEEK);
}

/**
 * @param {Vector2} feet - bottom center of the gate's cell
 * @param {{width:number, height:number, open:number, wobble:number, palette:object}} gate
 *        open: 0 standing .. 1 sunk into its plate (already eased)
 */
export function drawGate(feet, gate, time)
{
    const P = gate.palette;
    const frame = ArtFrame.root(feet);
    drawEllipse(feet.add(vec2(0, .02)), vec2(PLATE_W + .3, .14), P.shadow);

    const bricks = Math.max(1, Math.round((gate.height - PLATE_H) / BRICK_H));
    const brickH = (gate.height - PLATE_H - STUD_H) / bricks;
    const sink = gate.open * (bricks * brickH - PEEK);
    const w = gate.width / 2;
    const sway = Math.sin(time * 14) * .02 * gate.wobble;
    for (let i = 0; i < bricks; i++)
    {
        const y0 = PLATE_H + i * brickH - sink, y1 = y0 + brickH;
        if (y1 <= PLATE_H)
            continue;   // all the way down inside the plate
        const color = P.bricks[i % P.bricks.length];
        const light = color.lerp(P.shine.withAlpha(1), .35);
        const bottom = Math.max(y0, PLATE_H - .02);
        drawBlock(frame.child(sway * (i + 1), 0), -w, bottom, w, y1, .05, color, light, P.outline, .22);
        if (i === bricks - 1)
            drawStuds(frame.child(sway * (i + 1), 0), -w, w, y1, 2, color, light, P.outline, STUD_H);
    }
    // The base plate goes on top, hiding where the bricks slide in.
    frame.poly(roundRectPoints(-PLATE_W / 2, 0, PLATE_W / 2, PLATE_H, .04), P.plate, TOY_LINE, P.outline);
    frame.poly(roundRectPoints(-PLATE_W / 2 + .04, PLATE_H * .55, PLATE_W / 2 - .04, PLATE_H - .03, .02), P.plateLight, 0, BLACK);
    drawStuds(frame, -PLATE_W / 2 + .02, -w - .02, PLATE_H, 1, P.plate, P.plateLight, P.outline, .06);
    drawStuds(frame, w + .02, PLATE_W / 2 - .02, PLATE_H, 1, P.plate, P.plateLight, P.outline, .06);
}
