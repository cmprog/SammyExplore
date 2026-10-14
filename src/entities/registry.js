// Entity type registry: level data says `{ type: 'door', x, y, ...props }`, this maps the type
// to a factory and a validator. New entity kinds (cats, ...) add one entry to ENTITY_TYPES.
//
// A factory receives (pos, props, context):
//   pos     - world-space center of the tile cell the entity was placed on
//   props   - everything in the entity entry except type/x/y
//   context - { levelId, levelSize, timeOfDay, triggerExit(exitId), playerPos() }
//             triggerExit fires one of the level's exits (level:complete), e.g. for an exit door
//             playerPos() is Sammy's center (a Vector2) or null; read-only, e.g. a cat facing him
// and returns the created object (usually an EngineObject) so the level can destroy it on unload.
//
// Collision: Sammy collides with every SOLID engine object (that is how closed doors block).
// An entity Sammy should walk through (signs, cats, pickups) must pass isSolid=false, e.g.
// setCollision(false, false, false). A solid one may return false from collideWithObject() to
// let Sammy through (an open door).
//
// Rows: most entities use the "door-style" y: the cell they stand in (on the tile below it),
// filling that cell and maybe some above. Surfaces (bridge, lift) use the "surface-row" y: the
// row whose top their top is flush with, so they line up with ground tiles in that same row.
//
// Mechanisms (T-014): an entry with `mechanismTarget: true` can be named in a trigger's
// `targets` (a lever's, later a cat spot's) and `mechanismTrigger: true` marks a trigger;
// spawnEntity copies that onto the instance as mechanismRole/mechanismType, and
// validateMechanismLinks checks every `targets` list against the level. See
// systems/Mechanisms.js for the activation API.
//
// Cells: an entry's `blocksCells(entity)` gives the tile rect {x0, y0, x1, y1} (inclusive, level
// coordinates) it can block (a door, gate or lowered bridge), and `keepsClear(entity)` the rect
// that must stay free of those (a lift's path). validateCellClaims checks them against each
// other and against spawn/checkpoint zones (a respawn inside a closed gate would trap Sammy).
//
// A validator receives (entity, fail, level): the raw level-data entry, a fail(message) that
// throws a readable error, and the whole level data (for tile checks). It runs when the level
// file is loaded, so a typo fails loudly instead of quietly making a broken door.
import { Door } from './Door.js';
import { Sign } from './Sign.js';
import { Twyx } from './Twyx.js';
import { Lever } from './Lever.js';
import { Bridge } from './Bridge.js';
import { Gate } from './Gate.js';
import { Lift } from './Lift.js';

const ENTITY_TYPES = {
    door: {
        create: (pos, props, context) => new Door(pos, props, context), validate: Door.validateEntry,
        blocksCells: ({ x, y }) => ({ x0: x, y0: y - 1, x1: x, y1: y }),
    },
    sign: { create: (pos, props) => new Sign(pos, props), validate: Sign.validateEntry },
    twyx: { create: (pos, props, context) => new Twyx(pos, props, context), validate: Twyx.validateEntry },
    lever: {
        create: (pos, props, context) => new Lever(pos, props, context), validate: Lever.validateEntry,
        mechanismTrigger: true,
    },
    bridge: {
        create: (pos, props, context) => new Bridge(pos, props, context), validate: Bridge.validateEntry,
        mechanismTarget: true,
        blocksCells: ({ x, y, length }) => ({ x0: x, y0: y, x1: x + length - 1, y1: y }),
    },
    gate: {
        create: (pos, props, context) => new Gate(pos, props, context), validate: Gate.validateEntry,
        mechanismTarget: true,
        blocksCells: ({ x, y, height = 2 }) => ({ x0: x, y0: y - height + 1, x1: x, y1: y }),
    },
    lift: {
        create: (pos, props, context) => new Lift(pos, props, context), validate: Lift.validateEntry,
        mechanismTarget: true,
        keepsClear: entity => Lift.pathCells(entity),
    },
};

const types = new Map(Object.entries(ENTITY_TYPES));

/** Add or replace a factory at runtime (debug tools and tests use this). `extra` takes the
 *  optional entry fields: mechanismTarget, mechanismTrigger, blocksCells, keepsClear. */
export function registerEntityType(type, factory, validate = null, extra = {})
{
    types.set(type, { create: factory, validate, ...extra });
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

/** Every entity with a `targets` list must name entities in this level that can be driven
 *  (types registered with mechanismTarget). Runs after each entity passed its own validator. */
export function validateMechanismLinks({ entities }, fail)
{
    const byId = new Map(entities.filter(entity => entity.id !== undefined).map(entity => [entity.id, entity]));
    const drivable = [...types].filter(([, entry]) => entry.mechanismTarget).map(([type]) => type);
    for (const entity of entities.filter(other => Array.isArray(other.targets)))
        for (const id of entity.targets)
        {
            const target = byId.get(id);
            if (!target)
                fail(`${entity.type} "${entity.id}" targets "${id}", but no entity has that id`);
            if (!drivable.includes(target.type))
                fail(`${entity.type} "${entity.id}" targets "${id}", a ${target.type}, which can't be moved (only ${drivable.join(', ')})`);
        }
}

/** Tile rects can't overlap: lift paths vs blocking cells, and spawn/checkpoint zones vs both.
 *  Runs after every entity passed its own validator. */
export function validateCellClaims({ entities, zones }, fail)
{
    const claims = (field) => entities
        .filter(entity => types.get(entity.type)?.[field])
        .map(entity => ({ entity, rect: types.get(entity.type)[field](entity) }));
    const blockers = claims('blocksCells');
    const clear = claims('keepsClear');
    for (const { entity, rect } of clear)
        for (const blocker of blockers)
            if (blocker.entity !== entity && rectsOverlap(rect, blocker.rect))
                fail(`${entity.type} "${entity.id}": its path runs through ${blocker.entity.type} "${blocker.entity.id}"`);
    zones.forEach((zone, index) =>
    {
        if (zone.type !== 'spawn' && zone.type !== 'checkpoint')
            return;
        const r = zone.rect;
        const zoneCells = { x0: r.x, y0: r.y, x1: r.x + r.w - 1e-9, y1: r.y + r.h - 1e-9 };
        const hit = [...blockers, ...clear].find(claim => rectsOverlap(zoneCells, claim.rect, true));
        if (hit)
            fail(`${zone.type} zone ${zone.id ?? index} overlaps ${hit.entity.type} "${hit.entity.id}"`);
    });
}

/** Inclusive cell rects; `continuous` treats a's x1/y1 as exact edges (zone rects can be fractional). */
function rectsOverlap(a, b, continuous = false)
{
    const end = continuous ? 0 : 1;
    return a.x0 < b.x1 + 1 && a.x1 + end > b.x0 && a.y0 < b.y1 + 1 && a.y1 + end > b.y0;
}

/** Create one entity, or return null (with a warning) if the type is unknown. Mechanism members
 *  get mechanismRole and mechanismType from their entry. */
export function spawnEntity(type, pos, props, context)
{
    const entry = types.get(type);
    if (!entry)
    {
        console.warn(`level "${context.levelId}": unknown entity type "${type}", skipped`);
        return null;
    }
    const entity = entry.create(pos, props, context) ?? null;
    const role = entry.mechanismTarget ? 'target' : entry.mechanismTrigger ? 'trigger' : null;
    if (entity && role)
    {
        entity.mechanismRole = role;
        entity.mechanismType = type;
    }
    return entity;
}
