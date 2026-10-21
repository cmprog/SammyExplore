// Bake world-space art into textures once, then draw it as a few quads a frame. Art is drawn
// with the engine's normal world-space draw calls into a 2D context (as Terrain bakes its
// chunks): a temporary camera points at the chunk while the art draws.
// Big areas are cut into chunks no bigger than MAX_CHUNK_PIXELS on a side, a safe texture
// size on any desktop GPU.
import {
    TextureInfo, TileInfo, vec2, drawTile, isOnScreen, glContext, WHITE,
    cameraPos, cameraScale, setCameraPos, setCameraScale, mainCanvasSize,
} from 'littlejs';
import { CAMERA_SCALE } from '../data/tuning.js';
import { bakeGlints, GLINT_CELL, GLINT_KINDS } from '../art/backdropSky.js';

const MAX_CHUNK_PIXELS = 2048;

/**
 * Bake `draw(ctx, bounds)` over the world rect [x0, x1] x [y0, y1].
 * `bounds` is the chunk being drawn ({x0, y0, x1, y1}), so art can skip what is off it.
 * @returns {{pos: Vector2, size: Vector2, tile: TileInfo, textureInfo: TextureInfo}[]} one
 *          sprite per chunk; empty without canvas support (engine headless mode)
 */
export function bakeWorldRect(x0, y0, x1, y1, draw, pixelsPerTile = CAMERA_SCALE)
{
    if (typeof OffscreenCanvas === 'undefined')
        return [];
    const chunkTiles = Math.floor(MAX_CHUNK_PIXELS / pixelsPerTile);
    const sprites = [];
    try
    {
        for (let cy = y0; cy < y1; cy += chunkTiles)
        for (let cx = x0; cx < x1; cx += chunkTiles)
        {
            const bounds = { x0: cx, y0: cy, x1: Math.min(cx + chunkTiles, x1), y1: Math.min(cy + chunkTiles, y1) };
            const sprite = bakeChunk(bounds, draw, pixelsPerTile);
            sprite && sprites.push(sprite);
        }
    }
    catch (error)
    {
        destroySprites(sprites);   // don't leak the chunks baked before the one that failed
        throw error;
    }
    return sprites;
}

function bakeChunk(bounds, draw, pixelsPerTile)
{
    const size = vec2(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
    const canvas = new OffscreenCanvas(Math.ceil(size.x * pixelsPerTile), Math.ceil(size.y * pixelsPerTile));
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    const pos = vec2(bounds.x0, bounds.y0).add(size.scale(.5));
    withBakeCamera(ctx, pos, pixelsPerTile, () => draw(ctx, bounds));
    const textureInfo = new TextureInfo(canvas);
    return { pos, size, textureInfo, tile: new TileInfo().setFullImage(textureInfo) };
}

/** Point the camera at `center` while `draw` runs, so world-space draws land on `ctx`. */
function withBakeCamera(ctx, center, pixelsPerTile, draw)
{
    const savedPos = cameraPos.copy(), savedScale = cameraScale;
    setCameraScale(pixelsPerTile);
    setCameraPos(center);
    // The engine maps the camera to the main canvas center; shift that to the chunk's center.
    ctx.setTransform(1, 0, 0, 1, ctx.canvas.width / 2 - mainCanvasSize.x / 2, ctx.canvas.height / 2 - mainCanvasSize.y / 2);
    try { draw(); }
    finally
    {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        setCameraScale(savedScale);
        setCameraPos(savedPos);
    }
}

/** Draw baked sprites that are on screen. */
export function drawWorldSprites(sprites, color = WHITE)
{
    for (const sprite of sprites)
        if (isOnScreen(sprite.pos, sprite.size))
            drawTile(sprite.pos, sprite.size, sprite.tile, color);
}

export function destroySprites(sprites)
{
    sprites.forEach(sprite => sprite.textureInfo.destroyWebGLTexture());
    sprites.length = 0;
}

/**
 * The soft white glints (glow, dot, sparkle) from the outdoor sky (art/backdropSky.js), baked
 * once into one linear-filtered texture that several systems share. Null without canvas support.
 * @returns {{tiles: {glow: TileInfo, dot: TileInfo, sparkle: TileInfo}, smoother: SmoothTexture, destroy(): void} | null}
 */
export function bakeGlintAtlas()
{
    const strip = bakeGlints();
    if (!strip)
        return null;
    const textureInfo = new TextureInfo(strip.canvas);
    const tiles = {};
    GLINT_KINDS.forEach((kind, i) =>
        tiles[kind] = new TileInfo(vec2(i * GLINT_CELL, 0), vec2(GLINT_CELL), textureInfo, 0, 0));
    return { tiles, smoother: new SmoothTexture(textureInfo), destroy: () => textureInfo.destroyWebGLTexture() };
}

/**
 * Keeps a texture on linear filtering (soft glows drawn at many sizes would look blocky with the
 * engine's pixel-art nearest filtering). The engine recreates every GL texture with its global
 * filter after a WebGL context restore, so call apply() every frame; it only touches GL when
 * the texture object has changed since it was last smoothed.
 */
export class SmoothTexture
{
    constructor(textureInfo)
    {
        this.textureInfo = textureInfo;
        this.smoothed = null;
    }

    apply()
    {
        const texture = this.textureInfo?.glTexture;
        if (!glContext || !texture || texture === this.smoothed)
            return;
        // Restore the previous binding: the engine caches which texture it thinks is bound.
        const bound = glContext.getParameter(glContext.TEXTURE_BINDING_2D);
        glContext.bindTexture(glContext.TEXTURE_2D, texture);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
        glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
        glContext.bindTexture(glContext.TEXTURE_2D, bound);
        this.smoothed = texture;
    }
}
