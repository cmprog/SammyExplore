// A kid-made drawbridge: a big wooden ruler hinged at the edge of a ledge, held by a string that
// runs from its far end to a thread spool on a stack of wooden blocks. Raised, it stands up at
// the ledge; lowered, it lies flat across the gap. The spool's thread stripes roll as it turns.
// Pure drawing: drawBridge(hinge, state, time).
import { vec2, drawEllipse, BLACK } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { drawBlock, roundRectPoints, TOY_LINE } from './toyParts.js';

const POST_OFFSET = .5;   // post center, back from the hinge onto the ledge
const BLOCK = .56;
const SPOOL_Y = BLOCK * 2 + .26;

/**
 * @param {Vector2} hinge - the ruler's hinged top corner (flush with the ledge top)
 * @param {{length:number, thickness:number, angle:number, dir:number, spool:number, palette:object}} bridge
 *        angle: radians up from flat; dir: 1 = reaches right from the hinge, -1 = left;
 *        spool: how far the spool has turned (radians)
 */
export function drawBridge(hinge, bridge, time)
{
    const P = bridge.palette;
    const world = ArtFrame.root(hinge, { mirror: bridge.dir });
    const plank = world.child(0, 0, bridge.angle);
    const tip = plank.point(bridge.length - .12, -.04);
    const spool = world.point(-POST_OFFSET, SPOOL_Y);

    drawEllipse(world.point(-POST_OFFSET, .02), vec2(.8, .14), P.shadow);
    drawPost(world, P);
    drawRuler(plank, bridge.length, bridge.thickness, P);
    drawString(spool, tip, P);   // taut from the ruler's tip to the spool's thread
    drawSpool(world.child(-POST_OFFSET, SPOOL_Y), bridge.spool, P);
}

function drawPost(world, P)
{
    for (let i = 0; i < 2; i++)
    {
        const y = i * BLOCK;
        drawBlock(world, -POST_OFFSET - BLOCK / 2, y, -POST_OFFSET + BLOCK / 2, y + BLOCK, .06,
            i ? P.woodLight : P.wood, i ? P.ruler : P.woodLight, P.outline);
    }
    // The hinge pin, where the ruler meets the ledge.
    world.outlinedEllipse(.1, -.15, .12, .12, P.woodDark, P.outline, TOY_LINE * .7);
}

function drawRuler(plank, length, thickness, P)
{
    plank.poly(roundRectPoints(0, -thickness, length, 0, .07), P.ruler, TOY_LINE, P.outline);
    plank.poly(roundRectPoints(.04, -thickness * .38, length - .04, -.03, .04), P.rulerLight, 0, BLACK);
    // Tick marks along the top edge: long ones every tile, short ones every quarter.
    const ticks = Math.round(length * 4);
    for (let i = 1; i < ticks; i++)
    {
        const x = i / 4;
        const depth = i % 4 === 0 ? .2 : i % 2 === 0 ? .13 : .08;
        plank.line([[x, -.02], [x, -.02 - depth]], i % 4 === 0 ? .04 : .03, P.rulerTick);
    }
    plank.outlinedEllipse(.14, -thickness / 2, .1, .1, P.woodDark, P.outline, TOY_LINE * .6);
}

function drawString(from, to, P)
{
    const frame = ArtFrame.root(vec2());
    frame.line([[from.x, from.y], [to.x, to.y]], .075, P.outline.scale(1, .6));
    frame.line([[from.x, from.y], [to.x, to.y]], .045, P.string);
}

function drawSpool(frame, turn, P)
{
    // Wooden rims top and bottom with the thread wound between; stripes slide as it turns.
    frame.poly(roundRectPoints(-.25, -.2, .25, .2, .06), P.spool, TOY_LINE, P.outline);
    for (let i = 0; i < 5; i++)
    {
        const y = -.18 + ((i / 5 + turn / (Math.PI * 2)) % 1 + 1) % 1 * .33;
        frame.line([[-.23, y], [.23, y + .03]], .03, P.spoolLight);
    }
    for (const y of [-.22, .22])
        drawBlock(frame, -.34, y - .065, .34, y + .065, .05, P.woodLight, null, P.outline);
}
