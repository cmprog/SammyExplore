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

export function optionalOneOf(entity, key, allowed, fail)
{
    if (entity[key] !== undefined && !allowed.includes(entity[key]))
        fail(`${entityLabel(entity)}: "${key}" must be one of ${allowed.map(value => JSON.stringify(value)).join(', ')}`);
}

/** An integer prop within [min, max]; `fallback` when it may be left out (undefined = required). */
export function integerInRange(entity, key, min, max, fail, fallback = undefined)
{
    const value = entity[key] ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max)
        fail(`${entityLabel(entity)}: "${key}" must be a whole number from ${min} to ${max}`);
    return value;
}

/** A trigger's `targets`: a non-empty list of entity ids. Whether each id exists (and can be
 *  driven) is checked across the whole level by validateMechanismLinks in registry.js. */
export function requireTargetList(entity, fail)
{
    const targets = entity.targets;
    if (!Array.isArray(targets) || !targets.length || !targets.every(id => typeof id === 'string' && id))
        fail(`${entityLabel(entity)} needs "targets": a list of the ids it moves, e.g. ["my-bridge"]`);
}

/** Every cell in columns x0..x1, rows y0..y1 (inclusive, tile coords) is inside the map and has
 *  no collision. `what` names the cells in the error. */
export function requireEmptyRect(entity, { x0, y0, x1, y1 }, what, fail, { tileMap, legend })
{
    for (let row = y0; row <= y1; row++)
        for (let col = x0; col <= x1; col++)
        {
            if (row < 0 || row >= tileMap.length || col < 0 || col >= tileMap[0].length)
                fail(`${entityLabel(entity)}: ${what} goes outside the map at (${col}, ${row})`);
            const type = TILE_TYPES[legend[tileMap[row][col]]];
            if (type.collision)
                fail(`${entityLabel(entity)}: ${what} overlaps a ${legend[tileMap[row][col]]} tile at (${col}, ${row})`);
        }
}
