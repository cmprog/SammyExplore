// Shared tile-collision rule for anything that walks on terrain (Sammy now,
// cats later). Objects opt in by overriding EngineObject.collideWithTile:
//     collideWithTile(tileData, tilePos) { return collidesWithTerrain(this, tileData, tilePos); }
import { vec2, tileCollisionTest, engineObjectsCollect, engineObjectsCollide } from 'littlejs';
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
