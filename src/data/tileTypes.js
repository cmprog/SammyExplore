// Tile types a level legend can refer to. New tile types are added here, not in the engine code.
//   collision - value stored in the engine's tile collision grid (0 = nothing)
//   oneWay    - you can jump up through it and land on top
//   draw      - art style from src/art/drawTerrain.js: 'ground', 'plank', 'floorboards', or null
//               (invisible: furniture and shelves are drawn by the room's furniture art instead,
//               see the `room` block in src/data/levels/bedroom.js)
export const TILE_COLLISION = {
    none: 0,
    solid: 1,
    platform: 2,
};

export const TILE_TYPES = {
    empty:    { collision: TILE_COLLISION.none, draw: null },
    solid:    { collision: TILE_COLLISION.solid, draw: 'ground' },
    platform: { collision: TILE_COLLISION.platform, oneWay: true, draw: 'plank' },
    // Indoors
    floor:     { collision: TILE_COLLISION.solid, draw: 'floorboards' },
    furniture: { collision: TILE_COLLISION.solid, draw: null },
    shelf:     { collision: TILE_COLLISION.platform, oneWay: true, draw: null },
};

/** Tile types whose art comes from a room's furniture pieces; every one of these tiles must lie
 *  inside a furniture piece's rect (checked when the level loads). */
export const FURNITURE_TILE_TYPES = ['furniture', 'shelf'];
