// Shared tile-collision rule for anything that walks on terrain (Sammy now,
// cats later). Objects opt in by overriding EngineObject.collideWithTile:
//     collideWithTile(tileData, tilePos) { return collidesWithTerrain(this, tileData, tilePos); }
import { vec2, tileCollisionTest, engineObjectsCollect, engineObjectsCollide, isOverlapping } from 'littlejs';
import { TILE_TYPES } from '../data/tileTypes.js';

/** Collision values of tile types marked oneWay in data/tileTypes.js. */
const ONE_WAY_COLLISION = new Set(Object.values(TILE_TYPES).filter(type => type.oneWay).map(type => type.collision));

/**
 * One-way tiles only block an object that is moving down and whose feet were at or above the
 * tile top before this physics step.
 *
 * The engine calls this during updatePhysics, after `pos += velocity`, so the previous bottom is
 * `pos.y - velocity.y - size.y/2`. The engine only asks about tiles that overlap the box it is
 * testing, which is why the "was I already stuck?" test at the old position never sees a platform
 * the object was resting on top of, and a platform the object is passing up through stays passable.
 * No tolerance is needed: after landing, the engine leaves the feet a hair above the top.
 */
export function collidesWithTerrain(object, tileData, tilePos)
{
    if (ONE_WAY_COLLISION.has(tileData))
    {
        if (object.velocity.y > 0)
            return false;
        const previousBottom = object.pos.y - object.velocity.y - object.size.y / 2;
        return previousBottom >= tilePos.y + 1;
    }
    return tileData > 0;
}

/**
 * Is there something to stand on within `distance` below the object's feet? Used to tell a
 * press just before landing (a buffered jump) from a press in mid-air (a flap).
 * A one-way platform counts only if the feet are already above its top. Solid objects (a
 * closed door) count too, if the feet are above their top and they would block the object.
 */
export function hasGroundWithin(object, distance)
{
    // Probe the whole span swept below the feet, so a thin platform is found even when the
    // drop to it is shorter than the object is tall.
    const bottom = object.pos.y - object.size.y / 2;
    const probe = vec2(object.pos.x, bottom - distance / 2);
    const probeSize = vec2(object.size.x, distance);
    if (tileCollisionTest(probe, probeSize, (tileData, tilePos) =>
        ONE_WAY_COLLISION.has(tileData) ? bottom >= tilePos.y + 1 : tileData > 0))
        return true;
    return solidObjectBelow(object, probe, probeSize, bottom);
}

function solidObjectBelow(object, probe, probeSize, bottom)
{
    if (!object.collideSolidObjects)
        return false;
    const epsilon = .01;   // physics leaves a resting object a hair above the top
    return engineObjectsCollect(probe, probeSize, engineObjectsCollide).some(other =>
        other !== object && other.isSolid && !other.destroyed
        && bottom >= other.pos.y + other.size.y / 2 - epsilon
        && other.collideWithObject(object));
}

/** Would a box at `pos` of `size` overlap solid ground (one-way platforms don't count)? For
 *  things that move other objects (a lift checks it won't carry a rider into a wall). */
export function solidGroundAt(pos, size)
{
    return !!tileCollisionTest(pos, size, tileData => tileData > 0 && !ONE_WAY_COLLISION.has(tileData));
}

// ---------------------------------------------------------------------------------------------
// Moving and standable solid objects (lifts, bridges, gates). All of these are pure queries
// except settleObjectsOnTop, which a surface calls from its own updatePhysics. Nothing here may
// be called from collideWithObject: ground probes (hasGroundWithin) call collideWithObject too,
// so it must stay free of side effects.

/** Things that walk and fall (Sammy, cats): dynamic objects that collide with solid objects. */
function isMover(other, surface)
{
    return other !== surface && !other.destroyed && other.mass > 0 && other.collideSolidObjects;
}

function overlapsHorizontally(a, b)
{
    return Math.abs(a.pos.x - b.pos.x) * 2 < a.size.x + b.size.x;
}

/** Movers standing on top of `surface`: grounded on it, or feet within `epsilon` of its top and
 *  not rising (e.g. they landed on it this step, before or after it moved). */
export function objectsStandingOn(surface, epsilon = .05)
{
    const top = surface.pos.y + surface.size.y / 2;
    return engineObjectsCollide.filter(other =>
    {
        if (!isMover(other, surface) || !overlapsHorizontally(other, surface))
            return false;
        const bottom = other.pos.y - other.size.y / 2;
        return other.groundObject === surface || (Math.abs(bottom - top) < epsilon && other.velocity.y <= .001);
    });
}

/** Would `object`, moved to `pos`, overlap a solid object that blocks it (a closed gate or door,
 *  a lowered bridge, a lift)? `ignore` is left out (e.g. the lift doing the carrying). Pure:
 *  relies on collideWithObject being side-effect free. */
export function solidObjectAt(object, pos, ignore = null)
{
    return engineObjectsCollide.some(other =>
        other !== object && other !== ignore && other.isSolid && !other.destroyed
        && isOverlapping(pos, object.size, other.pos, other.size) && other.collideWithObject(object));
}

/**
 * The engine only nudges an object that starts a step already overlapping a solid one, very
 * gently, so a mover resting exactly on a surface's top (placed there, or a hair inside it from
 * float error) would sink through it. A standable surface calls this from its updatePhysics:
 * movers whose feet are just inside its top (within `tolerance`) and that aren't rising are put
 * back on top and grounded. `accepts(other)` lets the surface skip ones it doesn't block.
 */
export function settleObjectsOnTop(surface, accepts = () => true, tolerance = .05)
{
    const top = surface.pos.y + surface.size.y / 2;
    for (const other of engineObjectsCollide)
    {
        if (!isMover(other, surface) || other.velocity.y > 0 || !overlapsHorizontally(other, surface))
            continue;
        const bottom = other.pos.y - other.size.y / 2;
        if (bottom >= top || bottom < top - tolerance || !accepts(other))
            continue;
        other.pos.y = top + other.size.y / 2 + .001;
        other.velocity.y = 0;
        other.groundObject = surface;
    }
}
