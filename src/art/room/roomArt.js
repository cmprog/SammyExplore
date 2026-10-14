// What every furniture and decor kind in a level's `room` block looks like, and the order the
// room is baked in: the wall, wall decor, furniture (the window cuts its glass out here), then
// the things standing on furniture. Rugs bake into a separate layer in front of the floor.
// Adding a kind = one draw function and one entry here.
//   place: how the level data positions a decor item (checked when the level loads)
//     'rect'  {x, y, w, h} like a zone        'hang' {x, y, w}: hangs from the top of row y
//     'row'   {x, y, w}: stands on row y      'stand' {x, y}: stands on row y, centered on x
import { drawRoomWall } from './drawRoomWall.js';
import { drawWindowFrame } from './drawWindowFrame.js';
import { drawToyChest, drawBookshelf, drawWallShelf, drawDresser, drawCubby } from './furnitureStorage.js';
import { drawDesk, drawBed } from './furnitureDeskBed.js';
import { drawBrickStack, drawBrickHouse, drawBrickCastle, drawBrickTower } from './toyBricks.js';
import { drawPoster, drawBunting, drawFairyLights } from './decorWall.js';
import {
    drawPlush, drawBooks, drawBookStack, drawDeskLamp, drawPencilCup, drawPlant, drawPhoto, drawBin,
} from './decorSmall.js';
import { drawRug } from './decorRug.js';

export const FURNITURE_ART = {
    toyChest: drawToyChest,
    bricks: drawBrickStack,
    wallShelf: drawWallShelf,
    desk: drawDesk,
    window: drawWindowFrame,
    bookshelf: drawBookshelf,
    dresser: drawDresser,
    bed: drawBed,
    cubby: drawCubby,
};

export const DECOR_ART = {
    poster:      { draw: drawPoster, place: 'rect', layer: 'wall' },
    bunting:     { draw: drawBunting, place: 'hang', layer: 'wall' },
    fairyLights: { draw: drawFairyLights, place: 'hang', layer: 'wall' },
    rug:         { draw: drawRug, place: 'row', layer: 'front' },
    plush:       { draw: drawPlush, place: 'stand' },
    books:       { draw: drawBooks, place: 'row' },
    bookStack:   { draw: drawBookStack, place: 'stand' },
    deskLamp:    { draw: drawDeskLamp, place: 'stand' },
    pencilCup:   { draw: drawPencilCup, place: 'stand' },
    brickHouse:  { draw: drawBrickHouse, place: 'stand' },
    brickCastle: { draw: drawBrickCastle, place: 'stand' },
    brickTower:  { draw: drawBrickTower, place: 'stand' },
    plant:       { draw: drawPlant, place: 'stand' },
    photo:       { draw: drawPhoto, place: 'stand' },
    bin:         { draw: drawBin, place: 'stand' },
};

/** Furniture art reaches this far past its rect (legs, curtains, overhangs), for chunk culling. */
const REACH = 3;

/** Everything behind Sammy: the wall and all furniture and decor on it. */
export function drawRoomBack(ctx, room, palette, bounds)
{
    drawRoomWall(ctx, room, palette, bounds);
    for (const item of room.decor)
        DECOR_ART[item.kind].layer === 'wall' && near(item, bounds) && DECOR_ART[item.kind].draw(ctx, item, palette);
    for (const piece of room.furniture)
        near(piece, bounds) && FURNITURE_ART[piece.kind](ctx, piece, palette);
    for (const item of room.decor)
        !DECOR_ART[item.kind].layer && near(item, bounds) && DECOR_ART[item.kind].draw(ctx, item, palette);
}

/** The layer just in front of the floorboards (rugs). */
export function drawRoomFront(ctx, room, palette, bounds)
{
    for (const item of room.decor)
        DECOR_ART[item.kind].layer === 'front' && near(item, bounds) && DECOR_ART[item.kind].draw(ctx, item, palette);
}

/** Bounds of the front layer's art, or null if there is none. */
export function roomFrontBounds(room)
{
    const items = room.decor.filter(item => DECOR_ART[item.kind].layer === 'front');
    if (!items.length)
        return null;
    return {
        x0: Math.floor(Math.min(...items.map(item => item.x)) - 1), x1: Math.ceil(Math.max(...items.map(item => item.x + (item.w ?? 0))) + 1),
        y0: Math.floor(Math.min(...items.map(item => item.base)) - 1), y1: Math.ceil(Math.max(...items.map(item => item.base)) + 1),
    };
}

function near(item, bounds)
{
    // Furniture has its edges; decor is placed by a point or a row and reaches a little around it.
    const x0 = item.x0 ?? (item.w !== undefined ? item.x : item.x - 2);
    const x1 = item.x1 ?? item.x + (item.w ?? 2);
    const y0 = item.y0 ?? (item.h !== undefined ? item.top - item.h : item.base);
    const y1 = item.y1 ?? item.top + 3;
    return x1 + REACH > bounds.x0 && x0 - REACH < bounds.x1 && y1 + REACH > bounds.y0 && y0 - REACH < bounds.y1;
}
