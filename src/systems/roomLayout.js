// Turns a level's `room` block (tile columns/rows from the top-left, like zones) into the
// world-space layout (y up) the room art, window view, and lighting work from.
//   furniture: {kind, ...props, x0, y0, x1, y1, groundY}   groundY = the surface under the piece
//   decor:     {kind, ...props, x, w, h, top, base}         top = top edge of row y, base = its bottom
//   window:    {frame, glass, open, sillTop, rodY} or null  (see art/room/drawWindowFrame.js)
//   nightlight: {x, base} or null; reserved: [{id, task, x0, y0, x1, y1}]
import { TILE_TYPES } from '../data/tileTypes.js';
import { windowGeometry } from '../art/room/drawWindowFrame.js';

export function buildRoomLayout({ room, tileMap, legend })
{
    const height = tileMap.length, width = tileMap[0].length;
    const collides = (x, y) => y >= 0 && y < height && x >= 0 && x < width
        && TILE_TYPES[legend[tileMap[height - 1 - y][x]]].collision > 0;
    const groundBelow = (x, y) =>
    {
        for (let cy = Math.ceil(y) - 1; cy >= 0; cy--)
            if (collides(Math.floor(x), cy))
                return cy + 1;
        return 0;
    };
    const furniture = room.furniture.map(({ kind, x, y, w, h, ...props }) =>
    {
        const y0 = height - y - h;
        return { kind, ...props, x0: x, x1: x + w, y0, y1: height - y, groundY: groundBelow(x + w / 2, y0) };
    });
    const windowPiece = furniture.find(piece => piece.kind === 'window');
    const nightlight = room.nightlight ? { x: room.nightlight.x + .5, base: height - 1 - room.nightlight.y } : null;
    return {
        width, height,
        floorY: floorTop(tileMap, legend),
        ceilingY: height,
        furniture,
        decor: room.decor.map(({ kind, x, y, w, h, ...props }) => ({ kind, ...props, x, w, h, top: height - y, base: height - 1 - y })),
        window: windowPiece ? windowGeometry(windowPiece) : null,
        nightlight,
        reserved: (room.reserved ?? []).map(({ id, task, x, y, w, h }) => ({ id, task, x0: x, x1: x + w, y0: height - y - h, y1: height - y })),
    };
}

/** The floor's surface height: the top of the 'floor' tiles, as most columns have it. */
function floorTop(tileMap, legend)
{
    const height = tileMap.length, counts = new Map();
    for (let x = 0; x < tileMap[0].length; x++)
    {
        let top = 0;
        for (let row = height - 1; row >= 0 && legend[tileMap[row][x]] === 'floor'; row--)
            top = height - row;
        counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
