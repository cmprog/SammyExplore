// Shared checks for entity validators (see registry.js). Level files are hand-written, so each
// check names the entity and the exact problem. `fail` throws.
import { TILE_TYPES } from '../data/tileTypes.js';

const BASE_KEYS = ['type', 'x', 'y'];

export function entityLabel(entity)
{
    return `${entity.type}${typeof entity.id === 'string' ? ` "${entity.id}"` : ''} at (${entity.x}, ${entity.y})`;
}

/** Interactable ids appear in events and narration keys (and later save flags), so they are
 *  written by hand rather than generated. */
export function requireId(entity, fail)
{
    if (typeof entity.id !== 'string' || !entity.id)
        fail(`${entity.type} at (${entity.x}, ${entity.y}) needs an "id"`);
}

/** Catch typos like `lock: true` that would otherwise be silently ignored. */
export function allowOnlyProps(entity, allowed, fail)
{
    for (const key of Object.keys(entity))
        if (!BASE_KEYS.includes(key) && !allowed.includes(key))
            fail(`${entityLabel(entity)} has unknown prop "${key}" (known: ${allowed.join(', ')})`);
}

export function optionalBoolean(entity, key, fail)
{
    if (entity[key] !== undefined && typeof entity[key] !== 'boolean')
        fail(`${entityLabel(entity)}: "${key}" must be true or false`);
}

export function optionalString(entity, key, fail)
{
    if (entity[key] !== undefined && (typeof entity[key] !== 'string' || !entity[key]))
        fail(`${entityLabel(entity)}: "${key}" must be a non-empty string`);
}

/** The entity fills `rowsUp` tiles: its own cell plus the cells above it. All must be empty
 *  (inside the map) so it doesn't stand embedded in the ground. */
export function requireEmptyColumn(entity, rowsUp, fail, { tileMap, legend })
{
    for (let i = 0; i < rowsUp; i++)
    {
        const row = entity.y - i;
        if (row < 0)
            fail(`${entityLabel(entity)} is ${rowsUp} tiles tall and pokes out of the top of the map`);
        const type = TILE_TYPES[legend[tileMap[row][entity.x]]];
        if (type.collision)
            fail(`${entityLabel(entity)} overlaps a ${legend[tileMap[row][entity.x]]} tile at row ${row}`);
    }
}
