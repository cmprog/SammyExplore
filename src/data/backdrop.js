// Backdrop composition: where each layer sits, how fast it scrolls, how much is in it.
// All positions are screen pixels on the fixed 1920x1080 canvas, y down, measured with the
// camera at the bottom-left of the level. `parallax` is the fraction of camera movement a layer
// follows: 0 = painted on the sky, 1 = moves with the ground.
// Scenery layers are baked into horizontally repeating strips STRIP_WIDTH pixels wide, cut to
// [top, bottom] so no time is spent drawing pixels that a nearer layer always covers.

export const BACKDROP_STRIP_WIDTH = 2048;
/** Seed for the scenery layout, so every visit to a level looks the same. */
export const BACKDROP_SEED = 1337;

export const BACKDROP_LAYOUT = {
    // The sky is one screen-fixed texture from the top of the screen down to horizonY, which must
    // reach below the far ridge's lowest dip (the hills strip is see-through above its ridge).
    sky: { midY: 390, horizonY: 640 },

    // --- night ---
    stars: { height: 600, count: 240, twinkleCount: 36 },
    moon: { x: 1440, y: 220, size: 230, pulseSeconds: 7 },
    fireflies: { parallax: .6, count: 16, top: 430, bottom: 860 },

    // --- day ---
    sun: { x: 380, y: 200, size: 180, rays: 12, raySpinSeconds: 90 },
    clouds: [
        { parallax: .03, drift: 5, top: 40, height: 260, count: 6, scale: .55 },
        { parallax: .07, drift: 12, top: 90, height: 330, count: 4, scale: 1 },
    ],

    // --- scenery (both times of day; colors come from palettes.js) ---
    // `top` can be generous (strips are trimmed to their content). Each `bottom` only has to reach
    // the next nearer layer's solid ground; below that it would never be seen.
    hills: { parallax: .1, top: 400, bottom: 830 },
    trees: { parallax: .25, top: 300, bottom: 885, groves: 6, perGrove: [1, 3] },
    bushes: { parallax: .45, top: 560, bottom: 1080, count: 22 },
};
