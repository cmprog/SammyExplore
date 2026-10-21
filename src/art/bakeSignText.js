// Painted words for a world-space sign (the chapter portal's), baked once into a small texture so
// they draw in the WebGL pass with everything else: the room's lighting falls on them like on the
// wood, and a flipping board can squash them. Drawn with the game's UI font stack (system fonts,
// no font files), in dark paint with a soft light edge, like the rest of the game's lettering.
import { TextureInfo, TileInfo } from 'littlejs';
import { UI_FONT } from './drawMenu.js';
import { SmoothTexture } from '../systems/worldBake.js';

const HEIGHT = 96;            // texture pixels tall: crisp at the play zoom, and when zoomed in
const PAD = 14;
const PAINT = '#4a2a16';
const EDGE = 'rgba(255, 236, 196, .85)';

/**
 * @returns {{tile: TileInfo, aspect: number, smoother: SmoothTexture, destroy(): void} | null}
 *          null without canvas support (engine headless mode)
 */
export function bakeSignText(text)
{
    if (typeof OffscreenCanvas === 'undefined')
        return null;
    const font = `bold ${Math.round(HEIGHT * .66)}px ${UI_FONT}`;
    const measure = new OffscreenCanvas(1, 1).getContext('2d');
    if (!measure)
        return null;
    measure.font = font;
    const width = Math.ceil(measure.measureText(text).width) + PAD * 2;
    const canvas = new OffscreenCanvas(width, HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = EDGE;
    ctx.strokeText(text, width / 2, HEIGHT / 2 + 3);
    ctx.fillStyle = PAINT;
    ctx.fillText(text, width / 2, HEIGHT / 2 + 3);
    const textureInfo = new TextureInfo(canvas);
    return {
        tile: new TileInfo().setFullImage(textureInfo),
        aspect: width / HEIGHT,
        smoother: new SmoothTexture(textureInfo),
        destroy: () => textureInfo.destroyWebGLTexture(),
    };
}
