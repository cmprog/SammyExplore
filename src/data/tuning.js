// Tuning constants (movement, camera, flaps, timings) live here so feel can be adjusted
// without touching system code. Filled in by T-003 / T-004 and later tasks.
// The engine runs a fixed 60 updates per second, so "per step" values assume 1/60 s.
export const TUNING_VERSION = 1;

// --- World (T-003) ---
/** World units per tile is 1; this is screen pixels per tile (1920 px wide = 30 tiles across). */
export const CAMERA_SCALE = 64;
/** Downward acceleration per step squared. T-004 may retune this for Sammy's feel. */
export const WORLD_GRAVITY = -0.02;
/** How far below the level's bottom edge the implicit "fell off the world" correction zone starts. */
export const WORLD_FALL_MARGIN = 2;

// --- Camera (T-003) ---
/** Fraction of the remaining distance covered per step (higher = snappier). */
export const CAMERA_FOLLOW_LERP_X = 0.09;
export const CAMERA_FOLLOW_LERP_Y = 0.06;
/** Tiles the camera leads ahead of the direction of travel, so you can see where you're going. */
export const CAMERA_LOOK_AHEAD = 3;
/** How quickly the look-ahead swings to the other side when you turn around. */
export const CAMERA_LOOK_AHEAD_LERP = 0.025;
/** Horizontal speed (tiles per step) above which the camera treats the target as "heading" somewhere. */
export const CAMERA_LOOK_AHEAD_MIN_SPEED = 0.02;
/** Frame the target a little below center so there's more sky to look at. */
export const CAMERA_OFFSET_Y = 1.5;

// --- Temporary test box (T-003 only; T-004 replaces it with Sammy) ---
export const TEMP_BOX_SIZE = 0.8;
export const TEMP_BOX_SPEED = 0.14;
export const TEMP_BOX_ACCEL = 0.2;
export const TEMP_BOX_JUMP = 0.32;

// --- Narrator (T-006) ---
// Narrator text box: reveal speed and how long a line stays up. Reading speed is aimed at a
// 9-year-old reading on their own, so holds are generous.
export const NARRATOR = {
    CHARS_PER_SECOND: 40,      // typewriter reveal speed
    HOLD_BASE: 1.6,            // seconds a fully revealed line stays up...
    HOLD_PER_WORD: 0.33,       // ...plus this per word
    MIN_SHOW_BEFORE_SKIP: 0.2, // a press this soon after a line starts is the same press that caused it
    EASE_IN: 0.22,             // box slide/fade in
    EASE_OUT: 0.18,            // box slide/fade out
    GAP_BETWEEN_LINES: 0.25,   // breath between queued lines
    QUEUE_MAX: 3,              // older low-priority lines are dropped beyond this
    QUEUE_STALE: 8,            // seconds a queued reaction stays relevant
    DEFAULT_PRIORITY: 10,
    DEFAULT_SPAM: { count: 6, seconds: 3 },
};

// Correction ("rewrite the page") sequence timings, in seconds. The reset happens at the
// end of SCRIBBLE_IN, while the page is fully covered.
export const CORRECTION = {
    SCRIBBLE_IN: 0.75,
    HOLD: 0.35,
    SCRIBBLE_OUT: 0.8,
};

// --- Screens and save (T-008) --- seconds unless noted
export const SCREENS = {
    MENU_HIGHLIGHT_SPEED: 12,      // how fast a menu item eases into / out of its highlight (per second)
    SCREEN_FADE_IN: 0.35,          // title / overlays fade in
    PAUSE_DIM: 0.55,               // how dark the frozen world gets behind the pause menu (0..1)
    VOLUME_STEP: 0.1,              // one press of left/right on the volume slider
    SAVE_ICON_TIME: 2.2,           // the "saved" feather stays up this long
    LEVEL_COMPLETE_MIN_TIME: 1.2,  // can't skip the celebration before this (the exit press isn't a skip)
    CONFETTI_COUNT: 90,
    CONFETTI_GRAVITY: 520,         // px/s^2, screen space
    TO_BE_CONTINUED_MIN_TIME: 1.0,
    TO_BE_CONTINUED_AUTO_TIME: 6,  // back to the title on its own after this
};
