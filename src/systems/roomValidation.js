// Load-time checks for an indoor level's `room` block (see src/data/levels/bedroom.js). Level
// files are written by hand, so each check names the exact problem. `fail` throws.
import { TILE_TYPES, FURNITURE_TILE_TYPES } from '../data/tileTypes.js';
import { ROOM_TILE_PALETTES } from '../data/tilePalettes.js';
import { ROOM_PALETTES } from '../data/roomPalettes.js';
import { DAY_CYCLES } from '../data/dayCycle.js';
import { POSTERS } from '../data/roomPixelArt.js';
import { FURNITURE_ART, DECOR_ART } from '../art/room/roomArt.js';
import { LOOK_COLORS, LOOK_AMOUNTS } from './DayCycle.js';

/** @param {object} environment - the level's ENVIRONMENTS entry (kind 'room') */
export function validateRoom(data, environment, fail)
{
    const { room, tileMap, legend } = data;
    if (!ROOM_PALETTES[environment.palette] || !ROOM_TILE_PALETTES[environment.palette])
        fail(`environment "${data.environment}" names palette "${environment.palette}", missing from roomPalettes.js or tilePalettes.js`);
    if (!DAY_CYCLES[environment.dayCycle])
        fail(`environment "${data.environment}" names day cycle "${environment.dayCycle}", missing from dayCycle.js`);
    validateDayCycle(DAY_CYCLES[environment.dayCycle], `day cycle "${environment.dayCycle}"`, fail);
    if (!room || typeof room !== 'object')
        fail('an indoor level needs a "room" block (furniture, decor)');
    if (!Array.isArray(room.furniture) || !Array.isArray(room.decor))
        fail('room.furniture and room.decor must be arrays (use [] for none)');
    const size = { w: tileMap[0].length, h: tileMap.length };
    const typeAt = (x, y) => legend[tileMap[y][x]];
    validateFurniture(room.furniture, size, typeAt, fail);
    room.decor.forEach((item, i) => validateDecor(item, `room decor ${i} (${item?.kind})`, size, fail));
    if (room.nightlight !== undefined && !cellInMap(room.nightlight, size))
        fail('room.nightlight needs a cell {x, y} inside the map');
    if (room.reserved !== undefined && !Array.isArray(room.reserved))
        fail('room.reserved must be an array');
    (room.reserved ?? []).forEach(region => validateReserved(region, data, size, typeAt, fail));
}

function validateFurniture(furniture, size, typeAt, fail)
{
    furniture.forEach((piece, i) =>
    {
        if (!piece || typeof piece !== 'object')
            fail(`room furniture ${i} must be an object like { kind, x, y, w, h }`);
        const label = `room furniture ${i} (${piece.kind})`;
        if (!FURNITURE_ART[piece?.kind])
            fail(`${label}: unknown kind (known: ${Object.keys(FURNITURE_ART).join(', ')})`);
        requireRect(piece, label, size, fail, true);
        if (!cellsIn(piece).some(([x, y]) => TILE_TYPES[typeAt(x, y)].collision))
            fail(`${label}: its rect holds no furniture tiles, so nothing could stand on it`);
    });
    if (furniture.filter(piece => piece.kind === 'window').length > 1)
        fail('a room has at most one window');
    // Furniture tiles are invisible: each must belong to a piece that draws it.
    for (let y = 0; y < size.h; y++)
        for (let x = 0; x < size.w; x++)
            if (FURNITURE_TILE_TYPES.includes(typeAt(x, y)) && !furniture.some(piece => covers(piece, x, y)))
                fail(`the ${typeAt(x, y)} tile at column ${x}, row ${y} is not inside any room furniture rect (it would be invisible)`);
}

function validateDecor(item, label, size, fail)
{
    if (!item || typeof item !== 'object')
        fail(`${label}: must be an object like { kind, x, y }`);
    const art = DECOR_ART[item.kind];
    if (!art)
        fail(`${label}: unknown kind (known: ${Object.keys(DECOR_ART).join(', ')})`);
    const needs = { rect: ['x', 'y', 'w', 'h'], hang: ['x', 'y', 'w'], row: ['x', 'y', 'w'], stand: ['x', 'y'] }[art.place];
    for (const key of needs)
        if (!Number.isFinite(item[key]))
            fail(`${label}: needs a number "${key}" (placed as '${art.place}', see art/room/roomArt.js)`);
    if ((item.w !== undefined && item.w <= 0) || (item.h !== undefined && item.h <= 0))
        fail(`${label}: w and h must be positive`);
    if (item.x < 0 || item.y < 0 || item.x + (item.w ?? 0) > size.w || item.y > size.h)
        fail(`${label}: is outside the map`);
    if (item.kind === 'poster' && !POSTERS[item.art])
        fail(`${label}: "art" must be one of ${Object.keys(POSTERS).join(', ')}`);
}

/** Reserved regions stay empty for later tasks: nothing solid, no entities, zones, or decor.
 *  `allowFurniture` lets placeholder furniture (and its tiles) stand there, `allowDecor` lets
 *  decor sit there; entities and zones are never allowed. */
function validateReserved(region, { room, entities, zones }, size, typeAt, fail)
{
    const label = `reserved region "${region?.id}"`;
    if (typeof region?.id !== 'string' || !region.id)
        fail('every room.reserved region needs an "id"');
    requireRect(region, label, size, fail, true);
    if (!region.allowFurniture)
    {
        const solid = cellsIn(region).find(([x, y]) => TILE_TYPES[typeAt(x, y)].collision);
        if (solid)
            fail(`${label}: has a ${typeAt(...solid)} tile at column ${solid[0]}, row ${solid[1]}`);
        const piece = room.furniture.find(other => overlaps(region, other));
        if (piece)
            fail(`${label}: overlaps room furniture "${piece.kind}"`);
    }
    if (!region.allowDecor)
    {
        const item = room.decor.find(other => overlaps(region, decorRect(other)));
        if (item)
            fail(`${label}: has decor "${item.kind}" in it`);
    }
    const entity = entities.find(other => covers(region, other.x, other.y));
    if (entity)
        fail(`${label}: has entity "${entity.id ?? entity.type}" in it`);
    const zone = zones.find(other => overlaps(region, other.rect));
    if (zone)
        fail(`${label}: overlaps zone "${zone.id ?? zone.type}"`);
}

/** The tiles a decor item covers, in level coordinates. Standing things reach about a tile up
 *  from the row they stand on; hanging things about a tile down from where they hang. */
function decorRect(item)
{
    switch (DECOR_ART[item.kind].place)
    {
    case 'rect': return { x: item.x, y: item.y, w: item.w, h: item.h };
    case 'hang': return { x: item.x, y: item.y, w: item.w, h: 1 };
    case 'row': return { x: item.x, y: item.y - 1, w: item.w, h: 2 };
    default: return { x: item.x - .5, y: item.y - 1, w: 1, h: 2 };
    }
}

/** A day cycle's data (data/dayCycle.js): timings in range and every look key complete. */
export function validateDayCycle(cycle, label, fail)
{
    const inClock = t => Number.isFinite(t) && t >= 0 && t < 1;
    if (!Number.isFinite(cycle.period) || cycle.period < 0)
        fail(`${label}: "period" must be seconds (0 = the clock stands still)`);
    if (!inClock(cycle.start))
        fail(`${label}: "start" must be in 0..1`);
    if (!Array.isArray(cycle.phases) || cycle.phases.some(p => typeof p.phase !== 'string' || !(p.from < p.to) || !inClock(p.from) || p.to > 1))
        fail(`${label}: "phases" must be [{phase, from, to}] with 0 <= from < to <= 1`);
    if (typeof cycle.otherwise !== 'string')
        fail(`${label}: "otherwise" must name the phase for times not in "phases"`);
    for (const body of ['sun', 'moon'])
        if (!(cycle[body]?.rise < cycle[body]?.set))
            fail(`${label}: "${body}" needs {rise, set} with rise before set`);
    if (!inClock(cycle.nightlight?.on) || !inClock(cycle.nightlight?.off))
        fail(`${label}: "nightlight" needs {on, off} in 0..1`);
    const keys = cycle.keys;
    if (!Array.isArray(keys) || !keys.length || keys[0].t !== 0)
        fail(`${label}: "keys" must start with a key at t: 0`);
    keys.forEach((key, i) =>
    {
        if (!inClock(key.t) || (i > 0 && !(key.t > keys[i - 1].t)))
            fail(`${label}: key ${i} (t ${key.t}) must be in 0..1 and after the key before it`);
        for (const field of LOOK_COLORS)
            if (![key[field]?.r, key[field]?.g, key[field]?.b, key[field]?.a].every(Number.isFinite))
                fail(`${label}: key ${i} (t ${key.t}) needs a color "${field}"`);
        for (const field of LOOK_AMOUNTS)
            if (!Number.isFinite(key[field]))
                fail(`${label}: key ${i} (t ${key.t}) needs a number "${field}"`);
    });
}

function requireRect(rect, label, size, fail, integer = false)
{
    const ok = [rect.x, rect.y, rect.w, rect.h].every(v => integer ? Number.isInteger(v) : Number.isFinite(v));
    if (!ok || rect.w <= 0 || rect.h <= 0)
        fail(`${label}: needs a rect {x, y, w, h} of whole tiles with positive w and h`);
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > size.w || rect.y + rect.h > size.h)
        fail(`${label}: its rect reaches outside the map`);
}

function cellInMap(cell, size)
{
    return Number.isInteger(cell?.x) && Number.isInteger(cell?.y) && cell.x >= 0 && cell.y >= 0 && cell.x < size.w && cell.y < size.h;
}

function cellsIn({ x, y, w, h })
{
    const cells = [];
    for (let cy = y; cy < y + h; cy++)
        for (let cx = x; cx < x + w; cx++)
            cells.push([cx, cy]);
    return cells;
}

function covers(rect, x, y)
{
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

function overlaps(a, b)
{
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
