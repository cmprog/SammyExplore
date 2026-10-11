// Shared tile-collision rule for anything that walks on terrain (the test box now, Sammy in T-004,
// cats later). Objects opt in by overriding EngineObject.collideWithTile:
//     collideWithTile(tileData, tilePos) { return collidesWithTerrain(this, tileData, tilePos); }
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
