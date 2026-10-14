// Turns level data (src/data/levels/<id>.js) into a live Level: terrain collision + art,
// zones, and entities from the registry. Adding a level only means adding a data file.
// A level's `environment` (data/environments.js, default outdoor) says whether it is outdoors
// (`timeOfDay` picks the palettes) or in a room (the `room` block lays out its furniture).
//
// Level data coordinates are tile column/row from the top-left of tileMap (how the map reads);
// the world is y-up with the bottom-left of the map at (0, 0), so rows are flipped here.
import { vec2 } from 'littlejs';
import { TILE_TYPES } from '../data/tileTypes.js';
import { TILE_PALETTES, ROOM_TILE_PALETTES } from '../data/tilePalettes.js';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT } from '../data/environments.js';
import { WORLD_FALL_MARGIN } from '../data/tuning.js';
import { spawnEntity, validateEntity } from '../entities/registry.js';
import { Terrain } from './Terrain.js';
import { Zones, ZONE_TYPES, FALL_ZONE_ID } from './Zones.js';
import { Level } from './Level.js';
import { buildRoomLayout } from './roomLayout.js';
import { validateRoom } from './roomValidation.js';

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
 * @param {{playerPos?:() => Vector2|null}} [host] - what the host scene offers entities (see registry.js)
 */
export function buildLevel(data, { playerPos = () => null } = {})
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
        const environment = data.environment ?? DEFAULT_ENVIRONMENT;
        const indoor = ENVIRONMENTS[environment].kind === 'room';
        const tilePalette = indoor ? ROOM_TILE_PALETTES[ENVIRONMENTS[environment].palette] : TILE_PALETTES[data.timeOfDay];
        const terrain = new Terrain(types, tilePalette);   // cleans up after itself if it throws
        created.push(terrain);

        const worldZones = data.zones.map((zone, index) => toWorldZone(zone, index, height, data.nextLevel));
        worldZones.push(...entityExits(data.entities, height, data.nextLevel));
        const zones = new Zones(data.id, worldZones, size, WORLD_FALL_MARGIN);

        const context = {
            levelId: data.id,
            levelSize: { x: width, y: height },
            triggerExit: exitId => zones.triggerExit(exitId),
            playerPos,
        };
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
        const room = indoor ? buildRoomLayout(data) : null;
        return new Level({ id: data.id, name: data.name, environment, timeOfDay: data.timeOfDay ?? null, room, size, terrain, zones, entities });
    }
    catch (error)
    {
        created.forEach(object => object.destroy?.());
        throw new Error(`level "${data.id}" could not be built: ${error.message}`);
    }
}

/** An entity with an `exitId` (an exit door) gets a manual exit zone: the same exit path as a
 *  walk-in exit zone (level:complete, nextLevel, autosave), fired by the entity instead of by
 *  walking in. Its rect covers the entity's cell and the one above, for the debug view. */
function entityExits(entities, height, nextLevel)
{
    return entities
        .filter(entity => entity.exitId !== undefined)
        .map(({ id, x, y, exitId, nextLevel: ownNextLevel }) =>
        {
            const exit = { type: 'exit', id: exitId, rect: { x, y: y - 1, w: 1, h: 2 }, door: id };
            if (ownNextLevel)
                exit.nextLevel = ownNextLevel;
            return { ...toWorldZone(exit, 0, height, nextLevel), manual: true };
        });
}

function toWorldZone({ type, id, rect, ...props }, index, height, nextLevel)
{
    // Exits carry where they lead (in their level:complete payload). An exit may name its own
    // nextLevel; otherwise it uses the level's.
    if (type === 'exit' && nextLevel && !props.nextLevel)
        props.nextLevel = nextLevel;
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
    const environment = ENVIRONMENTS[data.environment ?? DEFAULT_ENVIRONMENT];
    if (!environment)
        fail(`environment must be one of ${Object.keys(ENVIRONMENTS).join(', ')}`);
    if (environment.kind === 'sky' && !TILE_PALETTES[data.timeOfDay])
        fail(`timeOfDay must be one of ${Object.keys(TILE_PALETTES).join(', ')}`);
    const leadsTo = [...(data.zones ?? []), ...(Array.isArray(data.entities) ? data.entities : [])];
    for (const target of [data.nextLevel, ...leadsTo.map(entry => entry.nextLevel)])
        if (target !== undefined && (typeof target !== 'string' || !LEVEL_ID_PATTERN.test(target)))
            fail(`nextLevel ${JSON.stringify(target)} is not a valid level id`);
    validateMap(data, fail);
    validateEntities(data, fail);
    validateZones(data, fail);
    if (environment.kind === 'room')
        validateRoom(data, environment, fail);
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

function validateEntities(data, fail)
{
    const { entities, tileMap } = data;
    if (!Array.isArray(entities))
        fail('entities must be an array (use [] for none)');
    entities.forEach((entity, index) =>
    {
        if (!entity || typeof entity.type !== 'string')
            fail(`entity ${index} has no type`);
        if (!inBounds(entity.x, entity.y, tileMap))
            fail(`entity ${index} (${entity.type}) is outside the map`);
        validateEntity(entity, fail, data);   // type-specific props (see entities/registry.js)
    });
    // Ids name entities in events and narration keys, so two of the same would be ambiguous.
    const ids = entities.map(entity => entity.id).filter(id => id !== undefined);
    const duplicate = ids.find((entityId, i) => ids.indexOf(entityId) !== i);
    if (duplicate !== undefined)
        fail(`entity id "${duplicate}" is used twice`);
}

function validateZones({ zones, entities }, fail)
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
    // A respawn point inside a closed door would push Sammy out sideways (or trap him).
    const doors = entities.filter(entity => entity.type === 'door');
    zones.forEach((zone, index) =>
    {
        if (zone.type !== 'spawn' && zone.type !== 'checkpoint')
            return;
        const door = doors.find(d => rectHitsColumn(zone.rect, d.x, d.y - 1, d.y));
        if (door)
            fail(`${zone.type} zone ${zone.id ?? index} overlaps door "${door.id}"`);
    });
    if (!zones.some(zone => zone.type === 'spawn'))
        fail('needs a spawn zone');
    // Exit doors' exitIds share the namespace: they are exit ids (save keys) too.
    const exitIds = entities.map(entity => entity.exitId).filter(Boolean);
    if (exitIds.includes(FALL_ZONE_ID))
        fail(`an exitId uses the reserved id "${FALL_ZONE_ID}"`);
    const ids = [...zones.map(zone => zone.id).filter(Boolean), ...exitIds];
    const duplicate = ids.find((zoneId, i) => ids.indexOf(zoneId) !== i);
    if (duplicate)
        fail(`zone/exit id "${duplicate}" is used twice`);
}

/** Does a tile-space rect {x, y, w, h} overlap the cells of column x, rows top..bottom? */
function rectHitsColumn(rect, x, top, bottom)
{
    return rect.x < x + 1 && rect.x + rect.w > x && rect.y < bottom + 1 && rect.y + rect.h > top;
}

function inBounds(x, y, tileMap)
{
    return Number.isInteger(x) && Number.isInteger(y)
        && x >= 0 && y >= 0 && y < tileMap.length && x < tileMap[0].length;
}
