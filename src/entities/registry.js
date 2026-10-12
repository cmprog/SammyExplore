// Entity type registry: level data says `{ type: 'door', x, y, ...props }`, this maps the type
// to a factory and a validator. New entity kinds (cats, ...) add one entry to ENTITY_TYPES.
//
// A factory receives (pos, props, context):
//   pos     - world-space center of the tile cell the entity was placed on
//   props   - everything in the entity entry except type/x/y
//   context - { levelId, levelSize, triggerExit(exitId), playerPos() }
//             triggerExit fires one of the level's exits (level:complete), e.g. for an exit door
//             playerPos() is Sammy's center (a Vector2) or null; read-only, e.g. a cat facing him
// and returns the created object (usually an EngineObject) so the level can destroy it on unload.
//
// Collision: Sammy collides with every SOLID engine object (that is how closed doors block).
// An entity Sammy should walk through (signs, cats, pickups) must pass isSolid=false, e.g.
// setCollision(false, false, false). A solid one may return false from collideWithObject() to
// let Sammy through (an open door).
//
// A validator receives (entity, fail, level): the raw level-data entry, a fail(message) that
// throws a readable error, and the whole level data (for tile checks). It runs when the level
// file is loaded, so a typo fails loudly instead of quietly making a broken door.
import { Door } from './Door.js';
import { Sign } from './Sign.js';
import { Twyx } from './Twyx.js';

const ENTITY_TYPES = {
    door: { create: (pos, props, context) => new Door(pos, props, context), validate: Door.validateEntry },
    sign: { create: (pos, props) => new Sign(pos, props), validate: Sign.validateEntry },
    twyx: { create: (pos, props, context) => new Twyx(pos, props, context), validate: Twyx.validateEntry },
};

const types = new Map(Object.entries(ENTITY_TYPES));

/** Add or replace a factory at runtime (debug tools and tests use this). */
export function registerEntityType(type, factory, validate = null)
{
    types.set(type, { create: factory, validate });
}

export function entityTypes()
{
    return [...types.keys()];
}

/** Validate one level-data entity entry. Unknown types pass here; spawnEntity skips them with a warning. */
export function validateEntity(entity, fail, level)
{
    types.get(entity.type)?.validate?.(entity, fail, level);
}

/** Create one entity, or return null (with a warning) if the type is unknown. */
export function spawnEntity(type, pos, props, context)
{
    const entry = types.get(type);
    if (!entry)
    {
        console.warn(`level "${context.levelId}": unknown entity type "${type}", skipped`);
        return null;
    }
    return entry.create(pos, props, context) ?? null;
}
