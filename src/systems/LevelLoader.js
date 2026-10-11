// Turns level data (src/data/levels/<id>.js) into a live Level: terrain collision + art,
// zones, and entities from the registry. Adding a level only means adding a data file.
//
// Level data coordinates are tile column/row from the top-left of tileMap (how the map reads);
// the world is y-up with the bottom-left of the map at (0, 0), so rows are flipped here.
import { vec2 } from '../../lib/littlejs/littlejs.esm.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { TILE_PALETTES } from '../data/tilePalettes.js';
import { WORLD_FALL_MARGIN } from '../data/tuning.js';
import { spawnEntity } from '../entities/registry.js';
import { Terrain } from './Terrain.js';
import { Zones, ZONE_TYPES, FALL_ZONE_ID } from './Zones.js';
import { Level } from './Level.js';

const LEVEL_ID_PATTERN = /^[a-z0-9_-]+$/i;
const ZONE_TYPES_NEEDING_ID = ['checkpoint', 'exit'];

/** Import and validate a level's data module. Rejects with a readable error on bad ids or data. */
export async function fetchLevelData(id)
{
    if (typeof id !== 'string' || !LEVEL_ID_PATTERN.test(id))
        throw new Error(`invalid level id ${JSON.stringify(id)}`);
    let module;
    try { module = await import(`../data/levels/${id}.js`); }
    catch (error) { throw new Error(`level "${id}" could not be loaded: ${error.message}`); }
    validateLevel(module.default, id);
    return module.default;
}

/**
 * Build a live level from validated data. Transactional: if anything throws part way (a bad
 * entity factory, say), everything created so far is destroyed before the error propagates.
 */
export function buildLevel(data)
{
    const height = data.tileMap.length;
    const width = data.tileMap[0].length;
    const size = vec2(width, height);
    const created = [];
    try
    {
        const types = [];
        for (let y = 0; y < height; y++)
            types.push([...data.tileMap[height - 1 - y]].map(char => data.legend[char]));
        const terrain = new Terrain(types, TILE_PALETTES[data.timeOfDay]);   // cleans up after itself if it throws
        created.push(terrain);

        const zones = new Zones(data.id, data.zones.map((zone, index) => toWorldZone(zone, index, height)), size, WORLD_FALL_MARGIN);

        const context = { levelId: data.id, levelSize: { x: width, y: height } };
        const entities = [];
        for (const { type, x, y, ...props } of data.entities)
        {
            const entity = spawnEntity(type, vec2(x + 0.5, height - 1 - y + 0.5), props, context);
            if (entity)
            {
                entities.push(entity);
                created.push(entity);
            }
        }
        return new Level({ id: data.id, name: data.name, timeOfDay: data.timeOfDay, size, terrain, zones, entities });
    }
    catch (error)
    {
        created.forEach(object => object.destroy?.());
        throw new Error(`level "${data.id}" could not be built: ${error.message}`);
    }
}

function toWorldZone({ type, id, rect, ...props }, index, height)
{
    return {
        type,
        id: id ?? `${type}-${index}`,
        pos: vec2(rect.x + rect.w / 2, height - rect.y - rect.h / 2),
        size: vec2(rect.w, rect.h),
        props,
    };
}

// ---------------------------------------------------------------------------------------------
// Validation: level files are hand-written, so fail loudly with the exact problem.

function validateLevel(data, id)
{
    const fail = message => { throw new Error(`level "${id}": ${message}`); };
    if (!data || typeof data !== 'object')
        fail('data module must `export default` the level object');
    if (data.id !== id)
        fail(`id is "${data.id}" but the file is named "${id}.js"`);
    if (!TILE_PALETTES[data.timeOfDay])
        fail(`timeOfDay must be one of ${Object.keys(TILE_PALETTES).join(', ')}`);
    validateMap(data, fail);
    validateEntities(data, fail);
    validateZones(data, fail);
}

function validateMap({ tileMap, legend }, fail)
{
    if (!Array.isArray(tileMap) || !tileMap.length)
        fail('tileMap must be a non-empty array of strings');
    const width = tileMap[0].length;
    if (!width)
        fail('tileMap rows must not be empty');
    for (const [char, type] of Object.entries(legend ?? {}))
        if (!TILE_TYPES[type])
            fail(`legend "${char}" uses unknown tile type "${type}"`);
    tileMap.forEach((row, rowIndex) =>
    {
        if (row.length !== width)
            fail(`tileMap row ${rowIndex} is ${row.length} wide, expected ${width}`);
        for (const char of row)
            if (!legend?.[char])
                fail(`tileMap row ${rowIndex} uses "${char}", which is not in the legend`);
    });
}

function validateEntities({ entities, tileMap }, fail)
{
    if (!Array.isArray(entities))
        fail('entities must be an array (use [] for none)');
    entities.forEach((entity, index) =>
    {
        if (typeof entity.type !== 'string')
            fail(`entity ${index} has no type`);
        if (!inBounds(entity.x, entity.y, tileMap))
            fail(`entity ${index} (${entity.type}) is outside the map`);
    });
}

function validateZones({ zones }, fail)
{
    if (!Array.isArray(zones))
        fail('zones must be an array');
    zones.forEach((zone, index) =>
    {
        if (!ZONE_TYPES.includes(zone.type))
            fail(`zone ${index} has unknown type "${zone.type}" (known: ${ZONE_TYPES.join(', ')})`);
        const r = zone.rect;
        if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0)
            fail(`zone ${index} (${zone.type}) needs rect {x, y, w, h} with positive w and h`);
        if (zone.type === 'narration' && typeof zone.key !== 'string')
            fail(`narration zone ${index} needs a "key"`);
        // Checkpoint and exit ids are save keys, so they must be stable and written by hand.
        if (ZONE_TYPES_NEEDING_ID.includes(zone.type) && (typeof zone.id !== 'string' || !zone.id))
            fail(`${zone.type} zone ${index} needs an explicit "id" (it is used as a save key)`);
        if (zone.id === FALL_ZONE_ID)
            fail(`zone ${index} uses the reserved id "${FALL_ZONE_ID}"`);
    });
    if (!zones.some(zone => zone.type === 'spawn'))
        fail('needs a spawn zone');
    const ids = zones.map(zone => zone.id).filter(Boolean);
    const duplicate = ids.find((zoneId, i) => ids.indexOf(zoneId) !== i);
    if (duplicate)
        fail(`zone id "${duplicate}" is used twice`);
}

function inBounds(x, y, tileMap)
{
    return Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && y >= 0 && y < tileMap.length && x < tileMap[0].length;
}
