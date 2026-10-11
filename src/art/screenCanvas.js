// Screen-space Canvas2D drawing for UI art (text box, overlays) in plain canvas pixels,
// y down, origin top-left of the 1920x1080 game canvas.
//
// drawCanvas2D flips Y (scale(x, -y)) to match world space; passing size (1, -1) cancels that.
// The main 2D canvas sits above the WebGL canvas, so this draws over the whole world.
import { drawCanvas2D, vec2 } from '../../lib/littlejs/littlejs.esm.js';

const ORIGIN = vec2(-.5, -.5);   // drawCanvas2D adds a half-pixel offset; undo it
const UNFLIP = vec2(1, -1);

export function drawScreenCanvas(drawFunction)
{
    drawCanvas2D(ORIGIN, UNFLIP, 0, false, drawFunction, true);
}
