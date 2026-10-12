// The level's ground: engine tile collision plus procedural drawing.
// TileCollisionLayer does the collision. The static tile art is baked once, at load, into a few
// chunk canvases (engine CanvasLayers), so each frame costs one textured quad per chunk instead
// of thousands of shapes. Only the swaying grass blades and flowers are drawn live.
import {
    TileCollisionLayer, CanvasLayer, vec2, time,
    cameraPos, cameraScale, setCameraPos, setCameraScale, getCameraSize, mainCanvasSize,
} from 'littlejs';
import { TILE_TYPES } from '../data/tileTypes.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { CAMERA_SCALE } from '../data/tuning.js';
import {
    buildTerrainTile, drawTerrainOutline, drawTerrainBody, drawTerrainDetail,
    drawTerrainAnimated, terrainTileIsAnimated,
} from '../art/drawTerrain.js';

/** Chunk size in tiles. 32 tiles at 64 px is a 2048 px texture, safe on any desktop GPU. */
const CHUNK_TILES = 32;
/** Bake at the camera's pixel density so the art is crisp at 1920x1080. */
const BAKE_PIXELS_PER_TILE = CAMERA_SCALE;
/** Overhangs (outlines, grass, drips) reach less than this far into the neighboring tile. */
const BAKE_MARGIN_TILES = 1;
/** Thickness of the invisible walls left and right of the map and the ceiling above it.
 *  More than one tile so nothing fast can tunnel through. The bottom stays open (world-bottom). */
const BOUNDS_THICKNESS = 2;

export class Terrain extends TileCollisionLayer
{
    /**
     * @param {string[][]} types - tile type names indexed [y][x] in world space (y = 0 is the bottom row)
     * @param {object} palette - terrain colors (see data/tilePalettes.js)
     */
    constructor(types, palette)
    {
        const mapSize = vec2(types[0].length, types.length);
        // The collision grid is wider and taller than the map to hold the implicit bounds.
        // No tileInfo: we never draw through the layer's own canvas, so keep it tiny.
        super(vec2(-BOUNDS_THICKNESS, 0), mapSize.add(vec2(BOUNDS_THICKNESS * 2, BOUNDS_THICKNESS)),
            null, RENDER_ORDER.terrain + 1, false);
        this.mapSize = mapSize;
        this.types = types;
        this.palette = palette;
        this.tiles = [];          // drawable tile shapes, indexed y * width + x (null for empty)
        this.animatedTiles = [];  // the subset with live grass blades or flowers
        this.chunks = [];
        try
        {
            this.buildCollision();
            this.buildTiles();
            this.bakeChunks();
        }
        catch (error)
        {
            this.destroy();       // don't leave a half-built layer (or its chunks) in the world
            throw error;
        }
    }

    destroy()
    {
        if (this.destroyed)
            return;
        this.chunks.forEach(chunk => chunk.destroy());
        this.chunks = [];
        super.destroy();
    }

    buildCollision()
    {
        const solid = TILE_TYPES.solid.collision;
        for (let gy = 0; gy < this.size.y; gy++)
        for (let gx = 0; gx < this.size.x; gx++)
        {
            const x = gx - BOUNDS_THICKNESS, y = gy;
            const inMap = x >= 0 && x < this.mapSize.x && y < this.mapSize.y;
            this.setCollisionData(vec2(gx, gy), inMap ? TILE_TYPES[this.types[y][x]].collision : solid);
        }
    }

    buildTiles()
    {
        for (let y = 0; y < this.mapSize.y; y++)
        for (let x = 0; x < this.mapSize.x; x++)
        {
            const style = this.styleAt(x, y);
            const tile = style ? buildTerrainTile(style, x, y, this.neighbors(style, x, y)) : null;
            this.tiles.push(tile);
            tile && terrainTileIsAnimated(tile) && this.animatedTiles.push(tile);
        }
    }

    styleAt(x, y)
    {
        return TILE_TYPES[this.types[y][x]].draw;
    }

    /** Which neighbors are drawn in the same style. The invisible walls and ceiling count as
     *  ground, so ground runs flat into them; below the map is open, so cliff bottoms round off. */
    neighbors(style, x, y)
    {
        const same = (nx, ny) =>
        {
            if (ny < 0)
                return false;
            if (nx < 0 || nx >= this.mapSize.x || ny >= this.mapSize.y)
                return style === 'ground';
            return this.styleAt(nx, ny) === style;
        };
        // Walls only count inside the map: the level edge shouldn't sprout corner bushes.
        const wall = nx => nx >= 0 && nx < this.mapSize.x && y + 1 < this.mapSize.y
            && this.styleAt(nx, y) === style && this.styleAt(nx, y + 1) === style;
        return {
            up: same(x, y + 1), down: same(x, y - 1), left: same(x - 1, y), right: same(x + 1, y),
            wallLeft: wall(x - 1), wallRight: wall(x + 1),
        };
    }

    // --- baking -----------------------------------------------------------------------------------

    bakeChunks()
    {
        for (let y0 = 0; y0 < this.mapSize.y; y0 += CHUNK_TILES)
        for (let x0 = 0; x0 < this.mapSize.x; x0 += CHUNK_TILES)
        {
            const chunkSize = vec2(Math.min(CHUNK_TILES, this.mapSize.x - x0), Math.min(CHUNK_TILES, this.mapSize.y - y0));
            // Include a margin so neighbors' overhangs are drawn into this chunk too: seamless edges.
            const tiles = this.tilesIn(x0 - BAKE_MARGIN_TILES, y0 - BAKE_MARGIN_TILES,
                x0 + chunkSize.x - 1 + BAKE_MARGIN_TILES, y0 + chunkSize.y - 1 + BAKE_MARGIN_TILES);
            if (!tiles.length)
                continue;    // all sky: no canvas, no texture
            const center = vec2(x0, y0).add(chunkSize.scale(0.5));
            // Created without a GL texture; updateWebGL() uploads it once, after baking.
            const chunk = new CanvasLayer(center, chunkSize, 0, RENDER_ORDER.terrain,
                chunkSize.scale(BAKE_PIXELS_PER_TILE), false);
            this.chunks.push(chunk);
            if (!chunk.context)    // no canvas in engine headless mode; nothing to bake
                continue;
            this.bakeChunk(chunk, tiles);
            chunk.updateWebGL();
        }
    }

    /**
     * Draw the static tile art into one chunk canvas with the normal world-space draw functions.
     * The engine maps world to pixels through the camera, so we point a temporary camera at the
     * chunk and shift the context so the main canvas center lands on the chunk canvas center.
     */
    bakeChunk(chunk, tiles)
    {
        const ctx = chunk.context;
        const savedPos = cameraPos.copy(), savedScale = cameraScale;
        setCameraScale(BAKE_PIXELS_PER_TILE);
        setCameraPos(chunk.pos);
        ctx.setTransform(1, 0, 0, 1,
            chunk.canvas.width / 2 - mainCanvasSize.x / 2, chunk.canvas.height / 2 - mainCanvasSize.y / 2);
        try
        {
            for (const tile of tiles) drawTerrainOutline(tile, this.palette, ctx);
            for (const tile of tiles) drawTerrainBody(tile, this.palette, ctx);
            for (const tile of tiles) drawTerrainDetail(tile, this.palette, ctx);
        }
        finally
        {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            setCameraScale(savedScale);
            setCameraPos(savedPos);
        }
    }

    tilesIn(minX, minY, maxX, maxY)
    {
        const tiles = [];
        for (let y = Math.max(minY, 0); y <= Math.min(maxY, this.mapSize.y - 1); y++)
        for (let x = Math.max(minX, 0); x <= Math.min(maxX, this.mapSize.x - 1); x++)
        {
            const tile = this.tiles[y * this.mapSize.x + x];
            tile && tiles.push(tile);
        }
        return tiles;
    }

    // --- live drawing -------------------------------------------------------------------------

    render()
    {
        // One tile of margin so blades and flowers don't pop in at the screen edge.
        const half = getCameraSize().scale(0.5).add(vec2(1));
        for (const tile of this.animatedTiles)
            if (Math.abs(tile.pos.x + 0.5 - cameraPos.x) < half.x && Math.abs(tile.pos.y + 0.5 - cameraPos.y) < half.y)
                drawTerrainAnimated(tile, this.palette, time);
    }
}
