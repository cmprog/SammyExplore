// Tile types a level legend can refer to. New tile types are added here, not in the engine code.
//   collision - value stored in the engine's tile collision grid (0 = nothing)
//   oneWay    - you can jump up through it and land on top
//   draw      - art style from src/art/drawTerrain.js: 'ground', 'plank', or null (invisible)
export const TILE_COLLISION = {
    none: 0,
    solid: 1,
    platform: 2,
};

export const TILE_TYPES = {
    empty:    { collision: TILE_COLLISION.none, draw: null },
    solid:    { collision: TILE_COLLISION.solid, draw: 'ground' },
    platform: { collision: TILE_COLLISION.platform, oneWay: true, draw: 'plank' },
};
