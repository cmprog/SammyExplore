// The room's back wall, baked once: pink wallpaper with little pixel hearts and sparkles, a
// paneled wainscot with a chair rail, a baseboard, a blocky crown molding at the ceiling, and
// soft shading into the corners so the room feels like a box you're inside of.
// World units, y up. `room` is the layout from systems/roomLayout.js; `bounds` is the chunk
// being baked (shapes off it are skipped).
import { MOTIFS } from '../../data/roomPixelArt.js';
import { rect, roundRect, gradient, gradientX, pixelArt, hash } from './roomShapes.js';

const WAINSCOT = 3.2;       // height of the lower panels above the floor
const RAIL = .32;
const BASEBOARD = .5;
const CROWN = .62;
const PANEL_EVERY = 3;
const MOTIF_EVERY = 2.6;
const MOTIF_PIXEL = .085;
const CORNER_SHADE = 1.8;

export function drawRoomWall(ctx, room, palette, bounds)
{
    const { floorY, ceilingY, width } = room;
    rect(ctx, bounds.x0, Math.max(bounds.y0, floorY - 1), bounds.x1, Math.min(bounds.y1, ceilingY), palette.wall);
    drawWallpaper(ctx, room, palette, bounds);
    drawWainscot(ctx, room, palette, bounds);
    drawCrown(ctx, room, palette, bounds);
    // Corners and the ceiling line sit in a little shadow.
    gradient(ctx, 0, ceilingY - CROWN - 2.4, width, ceilingY - CROWN, palette.wallShade.withAlpha(0), palette.wallShade);
    gradientX(ctx, 0, floorY, CORNER_SHADE, ceilingY, palette.wallShade, palette.wallShade.withAlpha(0));
    gradientX(ctx, width - CORNER_SHADE, floorY, width, ceilingY, palette.wallShade.withAlpha(0), palette.wallShade);
}

function drawWallpaper(ctx, { floorY, ceilingY }, palette, bounds)
{
    const bottom = floorY + WAINSCOT + RAIL, top = ceilingY - CROWN;
    const heart = MOTIFS.heart, sparkle = MOTIFS.sparkle;
    const heartSize = heart[0].length * MOTIF_PIXEL, sparkleSize = sparkle[0].length * MOTIF_PIXEL;
    for (let row = 0, y = bottom + MOTIF_EVERY * .6; y < top - .4; row++, y += MOTIF_EVERY * .75)
        for (let x = (row % 2) * MOTIF_EVERY / 2 + .6; x < bounds.x1 + 1; x += MOTIF_EVERY)
        {
            if (x < bounds.x0 - 1 || y < bounds.y0 - 1 || y > bounds.y1 + 1)
                continue;
            // Hearts on the grid, tiny sparkles between them, every few a little lighter.
            pixelArt(ctx, heart, { X: palette.wallPattern }, x - heartSize / 2, y + heartSize / 2, MOTIF_PIXEL);
            const sx = x + MOTIF_EVERY / 2, sy = y + MOTIF_EVERY * .37;
            if (sy < top - .3 && hash(sx, sy, 3) < .7)
                pixelArt(ctx, sparkle, { X: palette.wallSparkle }, sx - sparkleSize / 2, sy + sparkleSize / 2, MOTIF_PIXEL);
        }
}

function drawWainscot(ctx, { floorY, width }, palette, bounds)
{
    const top = floorY + WAINSCOT;
    rect(ctx, bounds.x0, floorY - 1, bounds.x1, top, palette.wainscot);
    // Raised panels: lit on the top and left edge, shaded on the bottom and right.
    for (let x = .25; x < width - 1; x += PANEL_EVERY)
    {
        if (x + PANEL_EVERY < bounds.x0 || x > bounds.x1)
            continue;
        const x0 = x + .3, x1 = Math.min(x + PANEL_EVERY - .3, width - .5), y0 = floorY + BASEBOARD + .45, y1 = top - .45;
        roundRect(ctx, x0, y0, x1, y1, .12, palette.wainscotDark);
        roundRect(ctx, x0, y0 + .07, x1 - .07, y1, .12, palette.wainscotLight);
        roundRect(ctx, x0 + .07, y0 + .07, x1 - .07, y1 - .07, .1, palette.wainscot);
    }
    // Chair rail, with the little shadow it casts on the wallpaper.
    gradient(ctx, bounds.x0, top + RAIL, bounds.x1, top + RAIL + .35, palette.wallShade.withAlpha(0), palette.wallShade.withAlpha(.18));
    rect(ctx, bounds.x0, top - .06, bounds.x1, top + RAIL, palette.trimShade);
    rect(ctx, bounds.x0, top, bounds.x1, top + RAIL, palette.trim);
    rect(ctx, bounds.x0, top + RAIL - .07, bounds.x1, top + RAIL - .02, palette.paintLight);
    // Baseboard
    rect(ctx, bounds.x0, floorY - 1, bounds.x1, floorY + BASEBOARD, palette.trimShade);
    rect(ctx, bounds.x0, floorY - 1, bounds.x1, floorY + BASEBOARD - .06, palette.trim);
    rect(ctx, bounds.x0, floorY + BASEBOARD - .14, bounds.x1, floorY + BASEBOARD - .09, palette.trimShade);
}

/** A stepped molding with a row of little blocks (dentils) along its bottom. */
function drawCrown(ctx, { ceilingY }, palette, bounds)
{
    const bottom = ceilingY - CROWN;
    rect(ctx, bounds.x0, bottom, bounds.x1, ceilingY + 1, palette.trim);
    rect(ctx, bounds.x0, bottom + .26, bounds.x1, bottom + .31, palette.trimShade);
    rect(ctx, bounds.x0, bottom, bounds.x1, bottom + .05, palette.trimShade);
    for (let x = Math.floor(bounds.x0 * 2) / 2; x < bounds.x1; x += .5)
    {
        rect(ctx, x + .1, bottom - .16, x + .36, bottom + .02, palette.trimShade);
        rect(ctx, x + .1, bottom - .12, x + .32, bottom + .02, palette.trim);
    }
}
