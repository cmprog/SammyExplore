// Title screen art: the real Sammy (drawSammy) perched on a branch, placed in screen pixels.
// The sky behind is the game's own Backdrop (the title scene owns one), so the title matches play.
//
// Everything here draws with the WebGL primitives, which sit under the 2D canvas that the title
// text and menus use, so call it from the scene's renderPost *outside* drawScreenCanvas.
import { screenToWorld, vec2, rgb, cameraScale } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { drawSammy } from './drawSammy.js';

const BRANCH = rgb(.29, .20, .15);
const BRANCH_LIGHT = rgb(.37, .26, .19);
const BRANCH_OUTLINE = rgb(.12, .08, .19);
const LEAF = rgb(.25, .48, .29);
const LEAF_LIGHT = rgb(.36, .60, .38);

/**
 * Sammy on a branch, idling (head tilts, looks at you, blinks).
 * @param {{x:number, y:number}} pos - screen pixels (y down) where Sammy's feet grip the branch
 * @param {{size:number, idleTime:number}} state - size: screen pixels per art unit (Sammy's body
 *   is ~0.9 art units tall); idleTime: seconds since the title appeared (drives the idle routine)
 * @param {number} time - seconds
 */
export function drawTitleSammy(pos, { size, idleTime }, time)
{
    const feet = screenToWorld(vec2(pos.x, pos.y));
    const scale = size / cameraScale;
    drawBranch(ArtFrame.root(feet, { scale }));
    drawSammy(feet, { state: 'idle', facing: 1, grounded: true, shadow: false, stateTime: idleTime }, time, { scale });
}

/** A gently curved branch running off the left edge, with a couple of leaves. Art units. */
function drawBranch(frame)
{
    const points = [];
    for (let i = 0; i <= 16; i++)
    {
        // Quadratic curve: start far left, sag up under Sammy, end just right of him.
        const t = i / 16;
        const a = [-2.2, -.17], c = [0, .01], b = [1.05, -.09];
        points.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
            (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1] - .04]);
    }
    frame.line(points, .17, BRANCH_OUTLINE);
    frame.circle(...points.at(-1), .17, BRANCH_OUTLINE);
    frame.line(points, .12, BRANCH);
    frame.circle(...points.at(-1), .12, BRANCH);
    frame.line(points.slice(2, -2).map(([x, y]) => [x, y + .025]), .03, BRANCH_LIGHT);
    for (const [x, y, angle] of [[-1.25, -.05, .6], [.72, -.03, -.5]])
    {
        const leaf = frame.child(x, y, angle);
        leaf.ellipse(0, .13, .13, .27, BRANCH_OUTLINE);
        leaf.ellipse(0, .13, .09, .22, LEAF);
        leaf.ellipse(-.015, .16, .03, .14, LEAF_LIGHT);
    }
}
