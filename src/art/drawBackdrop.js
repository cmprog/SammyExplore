// Live backdrop drawing, every frame: the baked textures blitted at their parallax offsets, and
// the few cheap animated touches (twinkling stars, the moon's breathing glow, sun rays,
// fireflies). Everything is in screen pixels on the fixed 1920x1080 canvas, y down.
// Pure functions of (state, palette, time); the Backdrop system owns the baked textures.
import {
    vec2, drawRect, drawCircle, drawPoly, drawTile,
    mainCanvasSize, BLACK, WHITE,
} from 'littlejs';

const TAU = Math.PI * 2;
/** Engine screen positions are pixel indices (it adds half a pixel to reach the center), so a
 *  quad spanning whole pixels needs its center pulled back by half a pixel. */
const PIXEL_ALIGN = -.5;

/** Draw a baked layer centered on a screen position. Whole pixels keep nearest filtering crisp. */
export function drawSprite(layer, x, y)
{
    drawTile(vec2(Math.round(x) + PIXEL_ALIGN, Math.round(y) + PIXEL_ALIGN), vec2(layer.width, layer.height), layer.tile,
        WHITE, 0, false, undefined, undefined, true);
}

/**
 * Blit a baked, horizontally repeating strip so it covers the screen width. Each column is its
 * own quad that starts at that column's content, so empty sky above it costs no fill.
 * @param {{columns: {tile: TileInfo, x: number, width: number, top: number}[], width: number, height: number}} layer
 * @param {number} scrollX - how far the layer has scrolled, in pixels
 * @param {number} top - screen y of the strip's top edge
 */
export function drawStrip(layer, scrollX, top)
{
    top = Math.round(top);
    const start = -wrap(Math.round(scrollX), layer.width);
    for (let x = start; x < mainCanvasSize.x; x += layer.width)
        for (const column of layer.columns)
        {
            const left = x + column.x, height = layer.height - column.top;
            if (left >= mainCanvasSize.x || left + column.width <= 0 || height <= 0)
                continue;
            drawTile(vec2(left + column.width / 2 + PIXEL_ALIGN, top + column.top + height / 2 + PIXEL_ALIGN), vec2(column.width, height),
                column.tile, WHITE, 0, false, undefined, undefined, true);
        }
}

/** A plain full-width band between two screen heights (extends a layer past its baked bottom). */
export function drawBand(top, bottom, color)
{
    top = Math.round(top);
    bottom = Math.min(Math.round(bottom), mainCanvasSize.y);
    if (bottom > top)
        drawRect(vec2(mainCanvasSize.x / 2 + PIXEL_ALIGN, (top + bottom) / 2 + PIXEL_ALIGN), vec2(mainCanvasSize.x, bottom - top), color, 0, undefined, true);
}

/** Clouds drift along a repeating band; each is its own little sprite. */
export function drawClouds(sprites, scrollX, bandWidth)
{
    for (const cloud of sprites)
    {
        const x = onScreenX(cloud.x - scrollX, bandWidth, cloud.layer.width / 2);
        x === null || drawSprite(cloud.layer, x, cloud.y);
    }
}

/** A tinted glint from the glint atlas (see bakeGlints): glints.glow, glints.dot, glints.sparkle. */
function drawGlint(tile, pos, size, color)
{
    drawTile(pos, vec2(size), tile, color, 0, false, undefined, undefined, true);
}

/** The bigger stars, fixed in the sky, each on its own twinkle rhythm. `offset` (screen pixels)
 *  moves the whole field, `fade` (0..1) dims it (the bedroom window at dawn). */
export function drawTwinkles(twinkles, glints, palette, time, offset = null, fade = 1)
{
    for (const star of twinkles)
    {
        const pos = offset ? vec2(star.x + offset.x, star.y + offset.y) : vec2(star.x, star.y);
        // Mostly bright with a quick soft dip, like real twinkling, not a slow fade.
        const wave = .5 + .5 * Math.sin(time * star.speed + star.phase);
        const glow = .35 + .65 * wave ** 3;
        const color = star.cool ? palette.starCool : palette.star;
        drawGlint(glints.glow, pos, star.size * 5, color.withAlpha(.4 * glow * fade));
        if (star.sparkle)
            drawGlint(glints.sparkle, pos, star.size * (2.4 + glow * 1.6), color.withAlpha((.5 + .5 * glow) * fade));
        drawGlint(glints.dot, pos, star.size * (.8 + .25 * glow), color.withAlpha((.6 + .4 * glow) * fade));
    }
}

/** The baked halo is static; this extra glow breathes slowly in front of it, under the moon. */
export function drawMoon(moon, glints, pos, size, palette, pulseSeconds, time)
{
    const breath = .5 + .5 * Math.sin(time * TAU / pulseSeconds);
    drawGlint(glints.glow, pos, size * (1.6 + .25 * breath), palette.moonHalo.withAlpha(.18 + .2 * breath));
    moon && drawSprite(moon, pos.x, pos.y);
}

/** Soft tapered rays, long and short in turn, turning very slowly around the (baked) sun. */
export function drawSunRays(pos, size, palette, layout, time)
{
    const spin = time * TAU / layout.raySpinSeconds;
    const rayColor = palette.sunHalo.withAlpha(.85);
    for (let i = 0; i < layout.rays; i++)
    {
        const angle = spin + i * TAU / layout.rays;
        // Each ray breathes a little on its own beat.
        const length = size * (i % 2 ? .22 : .36) * (1 + .1 * Math.sin(time * 1.3 + i * 1.7));
        const dir = vec2(Math.cos(angle), Math.sin(angle));
        const side = vec2(-dir.y, dir.x);
        const base = dir.scale(size * .6), tip = dir.scale(size * .6 + length);
        drawPoly([base.add(side.scale(size * .085)), tip.add(side.scale(size * .02)), tip.subtract(side.scale(size * .02)),
            base.subtract(side.scale(size * .085))], rayColor, 0, BLACK, pos, 0, undefined, true);
        drawCircle(pos.add(vec2(tip.x, -tip.y)), size * .04, rayColor, 0, BLACK, undefined, true);
    }
}

export function drawFireflies(flies, glints, palette, scrollX, width, offsetY, time)
{
    for (const fly of flies)
    {
        const t = time * fly.speed + fly.phase;
        // Two different frequencies make a lazy figure-eight instead of a circle.
        const x = onScreenX(fly.x - scrollX + Math.sin(t) * fly.rangeX, width, fly.size * 4);
        if (x === null)
            continue;
        const pos = vec2(x, fly.y + offsetY + Math.sin(t * 1.7) * fly.rangeY);
        const blink = Math.max(0, Math.sin(time * fly.blinkSpeed + fly.blinkPhase));
        const glow = .15 + .85 * blink * blink;
        drawGlint(glints.glow, pos, fly.size * 8, palette.fireflyGlow.withAlpha(.65 * glow));
        drawGlint(glints.dot, pos, fly.size * (.6 + .4 * glow), palette.firefly.withAlpha(.35 + .65 * glow));
    }
}

/** Screen x of something on a repeating strip, or null if no copy of it is on screen. */
function onScreenX(x, width, margin)
{
    x = wrap(x, width);
    if (x > width - margin)
        x -= width;
    return x < mainCanvasSize.x + margin ? x : null;
}

function wrap(value, period)
{
    return ((value % period) + period) % period;
}
