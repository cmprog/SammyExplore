// Where can a cat go? Side-effect-free queries over terrain tiles and solid objects, used by the
// companion (entities/CatFollower.js) and by roaming cats (entities/CatRoamer.js). A cat walks,
// hops up a little, leaps small gaps and drops down; she never flies. Limits are COMPANION in
// data/tuning.js. Everything works on a cat's box (`cat.size`) at a feet height, in world space.
//
//   blockersFor(cat)        the solid objects that block her right now (closed gates and doors,
//                           lowered bridges, lifts). Pass the list into the other queries, so one
//                           decision sees one consistent world.
//   walkSpan(cat, x, feet, toX, solids)
//                           walk from x toward toX at this height: how far she gets, and what
//                           stops her ('gap', 'wall', or the blocking object)
//   planLeap(cat, feet, goal, solids)
//                           a hop, leap or drop that lands where goal.accepts(landing) agrees,
//                           found by stepping the engine's own physics rules forward
//   keepClearZones(entities) / inTheWay(pos, size, zones, except)
//                           where a cat must never settle: the boxes lifts sweep through (the
//                           lift would wait for her forever, lift:held), gateways (a gate
//                           closing or rising on her), and the cell of anything upset that
//                           blocks the way (the wind-up mouse, while it does). Passing through is fine.
//
// All of these rely on collideWithObject being side-effect free (see terrainCollision.js).
//
// LEVEL DESIGN NOTE: when the companion can't follow (a closed gate, a raised bridge, a lift that
// isn't there, a ledge too tall) she waits, and only a checkpoint (or a correction, or the next
// level) brings her back to Sammy on its own (systems/Companion.js). So put a checkpoint after
// every gate, bridge or lift she might be left waiting at.
import { vec2, tileCollisionTest, engineObjects, isOverlapping } from 'littlejs';
import { isOneWayTile } from './terrainCollision.js';
import { COMPANION as C, WORLD_GRAVITY } from '../data/tuning.js';

const WALK_SAMPLE = .2;      // walkSpan checks a point every this far
const BODY_LIFT = .06;       // the body box is tested this far up, so flush surfaces don't count as walls
const SUPPORT_W = .3;        // she is standing as long as the middle of her is over something
const SUPPORT_DEPTH = .12;
const SAME_HEIGHT = .35;     // feet within this of a point: the same surface
const MAX_LEAP_STEPS = 180;
const FELL_BELOW = -3;       // a simulated leap that drops below this has fallen off the world
const SWEEP_STEP = .2;       // lift path test spacing (plates are .4 thick)

const solidTile = data => data > 0 && !isOneWayTile(data);

/** Solid objects that would block `cat` (asked through their own collideWithObject). Reads the
 *  live object list, not the engine's per-step collide list, so things built this very step (a
 *  level that just loaded, where she is being put down) already count. Same membership test as
 *  the engine's list (collideSolidObjects), which leaves out the tile layer itself. */
export function blockersFor(cat)
{
    return engineObjects.filter(other =>
        other !== cat && other.collideSolidObjects && other.isSolid && !other.destroyed && other.collideWithObject(cat));
}

/** What her body would bump into standing at x (feet at `feet`): 'wall', an object, or null. */
export function bodyBlocked(cat, x, feet, solids)
{
    const size = vec2(cat.size.x, cat.size.y - .04);
    const pos = vec2(x, feet + BODY_LIFT + size.y / 2);
    if (tileCollisionTest(pos, size, solidTile))
        return 'wall';
    return solids.find(other => isOverlapping(pos, size, other.pos, other.size)) ?? null;
}

/** Is there ground (a tile, one-way plank, or standable object) right under her middle at x? */
export function supportedAt(x, feet, solids)
{
    const probe = vec2(x, feet - SUPPORT_DEPTH / 2), size = vec2(SUPPORT_W, SUPPORT_DEPTH);
    if (tileCollisionTest(probe, size, (data, tilePos) => data > 0 && tilePos.y + 1 <= feet + .03))
        return true;
    return solids.some(other =>
    {
        const top = other.pos.y + other.size.y / 2;
        return top <= feet + .03 && top >= feet - SUPPORT_DEPTH
            && Math.abs(other.pos.x - x) * 2 < other.size.x + SUPPORT_W;
    });
}

/**
 * Walk from fromX toward toX keeping her feet at `feet`.
 * @returns {{x:number, blocked:null|'gap'|'wall'|object}} the furthest x she can stand at, and
 *   what stopped her there (null: she gets all the way)
 */
export function walkSpan(cat, fromX, feet, toX, solids)
{
    const dir = Math.sign(toX - fromX);
    let x = fromX;
    while (dir && (toX - x) * dir > 1e-6)
    {
        const next = Math.abs(toX - x) <= WALK_SAMPLE ? toX : x + dir * WALK_SAMPLE;
        const blocker = bodyBlocked(cat, next, feet, solids);
        if (blocker)
            return { x, blocked: blocker };
        if (!supportedAt(next, feet, solids))
            return { x, blocked: 'gap' };
        x = next;
    }
    return { x, blocked: null };
}

/** Can she walk straight from `feet` (a point) to `to` (a point at the same height)? */
export function canWalkTo(cat, feet, to, solids)
{
    return Math.abs(to.y - feet.y) < SAME_HEIGHT && !walkSpan(cat, feet.x, feet.y, to.x, solids).blocked;
}

// --- leaps -------------------------------------------------------------------------------------

const GRAVITY = () => WORLD_GRAVITY * C.GRAVITY_SCALE;   // per step squared (negative)

/**
 * Find a jump from `feet` that lands somewhere goal.accepts(landing) likes.
 * @param {{x:number, y:number}} goal.toward - where she is heading (sets the direction and the arc)
 * @param {(landing:{feet:Vector2, ground:object|null}) => boolean} goal.accepts
 * @returns {{vx:number, vy:number, landing:{feet:Vector2, ground:object|null, steps:number}}|null}
 */
export function planLeap(cat, feet, goal, solids)
{
    // Aim no higher than she can hop: a goal further up may still be reached by a stepping stone.
    const dx = goal.toward.x - feet.x, dy = Math.min(goal.toward.y - feet.y, C.HOP_MAX_UP);
    const dir = Math.abs(dx) < .1 ? 0 : Math.sign(dx);
    for (const { vx, vy } of leapCandidates(dx, dy, dir))
    {
        const landing = simulateLeap(cat, feet, vx, vy, solids);
        if (landing && withinLimits(feet, landing.feet) && goal.accepts(landing))
            return { vx, vy, landing };
    }
    return null;
}

/** Her limits: a ledge no higher than HOP_MAX_UP, a gap no wider than LEAP_MAX_DX (center to
 *  center), a drop no deeper than DROP_MAX. */
function withinLimits(from, to)
{
    const rise = to.y - from.y;
    return rise <= C.HOP_MAX_UP + .05 && rise >= -C.DROP_MAX && Math.abs(to.x - from.x) <= C.LEAP_MAX_DX + .2;
}

/** Arcs to try, gentlest first: a plain walk off the edge (going down), then hops of rising
 *  height, each aimed at a few landing distances. */
function* leapCandidates(dx, dy, dir)
{
    const g = -GRAVITY();
    if (dy < -.3 && dir)
        yield { vx: dir * C.TROT_SPEED, vy: 0 };
    const up = Math.max(0, dy);
    const reach = dir ? Math.min(Math.abs(dx) + .5, C.LEAP_MAX_DX) : 0;
    const distances = dir
        ? [...new Set([.7, 1.1, 1.6, 2.1, 2.5, C.LEAP_MAX_DX, Math.abs(dx)].filter(d => d <= reach + 1e-6))].sort((a, b) => a - b)
        : [0];
    for (const extra of [.45, .9, 1.4, 2])
    {
        const apex = up + extra;
        if (apex > C.LEAP_APEX_MAX + 1e-6)
            break;
        const vy = Math.sqrt(2 * g * apex);
        const flight = vy / g + Math.sqrt(2 * Math.max(apex - dy, .05) / g);
        for (const distance of distances)
        {
            const vx = dir * distance / flight;
            if (Math.abs(vx) <= C.LEAP_SPEED_MAX)
                yield { vx, vy };
        }
    }
}

/**
 * Step a leap forward with the engine's rules, in its order (gravity, move, then CatBody caps the
 * fall speed after physics; a wall stops the sideways move for that step but she keeps pushing,
 * the way the cat keeps her heading in the air; one-way planks only catch her on the way down).
 * Returns where she lands and after how many steps, or null if she falls away. Gives up as soon
 * as the arc is out of her limits (too deep or too far), so failing plans stay cheap.
 */
export function simulateLeap(cat, feet, vx, vy, solids)
{
    const size = cat.size, half = size.y / 2, g = GRAVITY();
    const lowest = feet.y - C.DROP_MAX - .5 + half, furthest = C.LEAP_MAX_DX + .3;
    let x = feet.x, y = feet.y + half + .001;
    for (let step = 1; step <= MAX_LEAP_STEPS; step++)
    {
        vy += g;
        const bottom = y - half;
        const hits = (px, py) => hitAt(px, py, size, vy, bottom, solids);
        let nx = x + vx;
        if (hits(nx, y))
            nx = x;
        const ny = y + vy;
        const hit = hits(nx, ny);
        if (hit && vy < 0)
        {
            const top = hit === 'tile' ? Math.floor(bottom + 1e-4) : hit.pos.y + hit.size.y / 2;
            return { feet: vec2(nx, top), ground: hit === 'tile' ? null : hit, steps: step };
        }
        x = nx;
        if (hit)
            vy = 0;     // bumped her head
        else
            y = ny;
        vy = Math.max(vy, -C.MAX_FALL_SPEED);
        if (y < lowest || y < FELL_BELOW || Math.abs(x - feet.x) > furthest)
            return null;
    }
    return null;
}

function hitAt(x, y, size, vy, previousBottom, solids)
{
    const pos = vec2(x, y);
    const other = solids.find(o => isOverlapping(pos, size, o.pos, o.size));
    if (other)
        return other;
    const tile = tileCollisionTest(pos, size, (data, tilePos) =>
        isOneWayTile(data) ? vy <= 0 && previousBottom >= tilePos.y + 1 - 1e-6 : data > 0);
    return tile ? 'tile' : null;
}

// --- lifts -------------------------------------------------------------------------------------

/** Where she must not settle: each lift's plate path (the box swept along the segment from A to
 *  B, not their bounding box, so a diagonal lift doesn't claim the ground under it), and each
 *  gate's doorway (its full closed height), plus a little margin. `owner` is the lift or gate. */
export function keepClearZones(entities)
{
    const zones = [];
    for (const entity of entities)
    {
        if (entity?.mechanismType === 'lift' && entity.a && entity.b)
            zones.push({ owner: entity, a: entity.a.copy(), b: entity.b.copy(), size: entity.size.add(vec2(.1, .1)) });
        else if (entity?.mechanismType === 'gate' && entity.feet)
            zones.push({ owner: entity, pos: entity.feet.add(vec2(0, entity.height / 2)), size: vec2(entity.size.x + .1, entity.height) });
        else if (entity && typeof entity.blocking === 'boolean' && entity.pos)
            // An upset thing in the way (entities/Upset.js): its cell, only while it blocks.
            zones.push({ owner: entity, pos: entity.pos.copy(), size: entity.size.add(vec2(.1, .1)), active: () => entity.blocking });
    }
    return zones;
}

/** Would a box at pos overlap a keep-clear zone (other than `except`'s, e.g. the lift Sammy rides)? */
export function inTheWay(pos, size, zones, except = null)
{
    return zones.some(zone => zone.owner !== except && (!zone.active || zone.active()) && (zone.a ? overlapsSweep(pos, size, zone) : isOverlapping(pos, size, zone.pos, zone.size)));
}

/** Box against a box swept along a segment: tested at the plate's positions every SWEEP_STEP,
 *  which is less than the plate's own thickness, so nothing slips between samples. */
function overlapsSweep(pos, size, { a, b, size: plate })
{
    const length = a.distance(b);
    const steps = Math.max(1, Math.ceil(length / SWEEP_STEP));
    // Quick reject against the bounding box first.
    const min = vec2(Math.min(a.x, b.x), Math.min(a.y, b.y)), max = vec2(Math.max(a.x, b.x), Math.max(a.y, b.y));
    if (!isOverlapping(pos, size, min.add(max).scale(.5), max.subtract(min).add(plate)))
        return false;
    for (let i = 0; i <= steps; i++)
        if (isOverlapping(pos, size, a.lerp(b, i / steps), plate))
            return true;
    return false;
}

/** Her box standing with her feet at (x, feet). */
export function boxAt(cat, x, feet)
{
    return vec2(x, feet + cat.size.y / 2);
}

export { SAME_HEIGHT };
