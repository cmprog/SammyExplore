// Tuning constants (movement, camera, flaps, timings) live here so feel can be adjusted
// without touching system code. Filled in by T-003 / T-004 and later tasks.
// The engine runs a fixed 60 updates per second, so "per step" values assume 1/60 s.
export const TUNING_VERSION = 1;

// --- World (T-003) ---
/** World units per tile is 1; this is screen pixels per tile (1920 px wide = 30 tiles across). */
export const CAMERA_SCALE = 64;
/** Downward acceleration per step squared. Sammy scales it per situation (SAMMY.GRAVITY_*). */
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

// --- Sammy (T-004) ---
// Speeds are tiles per step (x60 = tiles per second), accelerations tiles per step squared,
// times in seconds. Gravity is WORLD_GRAVITY times the GRAVITY_* scale for Sammy's situation.
//
// Resulting movement, for level design (T-011). Heights are of Sammy's feet above the takeoff
// ground. Measured in game by tools/playtest/sammy_scenario.py (real key presses) unless
// marked "sim" (a step-exact simulation of the same numbers):
//   Full jump (Space held) ......... apex 2.57 tiles, ~0.32 s up
//   Short hop (Space tapped) ....... ~1.1-1.6 tiles (depends how quickly Space is released)
//   One flap at the apex ........... +~1.0 tile
//   Jump + all 3 flaps ............. 5.66 at frame-perfect apex timing (sim; flaps add +3.1)
//                                    5.2-5.3 flapping by eye near each apex (measured)
//                                    ~4.9 mashing Space (measured)
//                                    5.9 hard ceiling at any timing (sim): a ledge 6+ tiles up is unreachable
//   Run speed ...................... 8.4 tiles/s
//   Running full jump .............. ~4.9 tiles across, landing at takeoff height (sim)
//   Glide .......................... falls 3.3 tiles/s, up to 9 tiles/s sideways:
//                                    2.7 tiles across per tile of drop
//   Running jump + glide ........... ~9.9 tiles across, landing at takeoff height (sim)
//   Air refill ..................... +1 flap after 3 s airborne; all 3 come back on landing
//   Coyote / buffer ................ 0.1 s each (6 steps)
// Plan "must reach" heights at <= 5 tiles and "must not reach" at >= 6.
export const SAMMY = {
    HITBOX: { x: 0.8, y: 0.9 },

    // Ground
    RUN_SPEED: 0.14,
    RUN_ACCEL: 0.022,        // reach full speed in ~0.1 s
    RUN_FRICTION: 0.03,      // stop in ~0.08 s when you let go
    // Air (not gliding)
    AIR_MAX_SPEED: 0.14,
    AIR_ACCEL: 0.012,
    AIR_DRAG: 0.004,         // keeps a little drift after letting go
    MAX_FALL_SPEED: 0.38,

    // Gravity scales: lighter on the way up than down so Sammy hangs at the top a moment.
    GRAVITY_RISE: 0.8,
    GRAVITY_FALL: 0.9,
    GRAVITY_GLIDE: 0.5,      // used only while gliding slower than GLIDE_FALL_SPEED

    // Jump
    JUMP_VELOCITY: 0.295,
    JUMP_CUT: 0.45,          // upward speed kept when Space is released early
    COYOTE_TIME: 0.1,        // can still jump this long after walking off a ledge
    JUMP_BUFFER: 0.1,        // a press this long before landing still jumps

    // Flap: upward speed = max(current, max(current, 0) * FLAP_KEEP + FLAP_VELOCITY).
    // FLAP_KEEP lets a flap during the rise still pop; the cooldown stops mashing from stacking it.
    FLAP_VELOCITY: 0.19,
    FLAP_KEEP: 0.2,
    FLAP_CHARGES: 3,
    FLAP_COOLDOWN: 0.15,     // after a jump or flap; a press during it fires when it ends
    FLAP_AIR_REFILL: 3,      // seconds airborne per charge regained
    FLAP_STATE_TIME: 0.2,    // how long the 'flap' state shows (art hook)

    // Glide (hold Space while falling)
    GLIDE_FALL_SPEED: 0.055,
    GLIDE_BRAKE: 0.2,        // fraction of extra fall speed removed per step when a glide starts fast
    GLIDE_MAX_SPEED: 0.15,
    GLIDE_ACCEL: 0.016,      // a bit more air control than a plain fall

    // Land
    LAND_STATE_TIME: 0.12,   // squash moment (art hook); movement isn't slowed
};

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
    TITLE_NOTICE_TIME: 6,          // how long a title-screen notice (e.g. a level failed to load) stays up
};
