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

// --- Sammy's look (T-005) ---
// Animation feel for SammyAnimator (src/entities/) and drawSammy (src/art/). Seconds unless noted.
// Squash is signed: + is stretched tall, - is squashed flat (0.3 = 30% taller, ~15% thinner).
export const SAMMY_ANIM = {
    SQUASH_SPRING: 0.22,        // pull back toward 0 per step (higher = snappier wobble)
    SQUASH_DAMPING: 0.72,       // velocity kept per step (lower = fewer wobbles)
    SQUASH_LIMIT: 0.42,
    JUMP_STRETCH: 0.3,
    FLAP_STRETCH: 0.22,
    LAND_SQUASH_MIN: 0.1,       // even a soft hop lands with a little squish...
    LAND_SQUASH_IMPACT: 0.32,   // ...plus this much more at full impact
    FALL_STRETCH_MAX: 0.12,     // gently stretched while falling fast (not gliding)

    WING_EASE: 0.28,            // fraction of the way to the state's wing pose per step
    FLAP_STROKE_TIME: 0.26,     // one wing stroke (overrides the state pose while it plays)
    TILT_EASE: 0.15,            // body lean eases toward its target per step
    GLIDE_LEAN: 0.2,            // radians, leaning into the direction of travel
    GLIDE_LEAN_PER_SPEED: 1.0,  // extra lean per tile/step of sideways speed
    TUFT_LAG: 3.2,              // ear-tuft droop per tile/step of vertical speed (radians)
    TUFT_EASE: 0.2,

    RUN_TILES_PER_CYCLE: 1.1,   // one left+right waddle per this many tiles run
    RUN_BOUNCE: 0.06,           // tiles of hop per footfall
    RUN_SWAY: 0.1,              // radians of side-to-side waddle

    BREATHE_SPEED: 2.4,         // radians per second
    BLINK_EVERY: 3.4,
    BLINK_TIME: 0.14,
    // Idle personality: a curious head tilt, then a look at the camera, repeating.
    IDLE_CYCLE: 7,
    IDLE_TILT_AT: 2.2,          // seconds into the cycle
    IDLE_TILT_TIME: 1.3,
    IDLE_TILT: 0.2,             // radians
    IDLE_LOOK_AT: 4.6,
    IDLE_LOOK_TIME: 1.5,
};

// Feather burst on a flap, dust puff on a hard landing. Distances in tiles, times in seconds.
export const SAMMY_FX = {
    FLAP_FEATHERS: 6,
    FEATHER_LIFE: 1.1,
    FEATHER_SPEED: 4.5,         // tiles per second at spawn, mostly sideways and down
    FEATHER_GRAVITY: 3,         // tiles/s^2; feathers float, so much less than Sammy
    FEATHER_DRAG: 2.5,          // per second
    FEATHER_SWAY: 2.2,          // side-to-side flutter while drifting
    WHOOSH_TIME: 0.32,          // the ring of air pushed down by the wings

    DUST_MIN_IMPACT: 0.3,       // landings softer than this make no dust
    DUST_PUFFS_MIN: 4,
    DUST_PUFFS_MAX: 10,         // at full impact
    DUST_LIFE: 0.55,
    DUST_SPEED: 4,              // tiles per second at full impact
    DUST_DRAG: 5,
    DUST_SIZE: 0.32,            // at full impact

    MAX_PARTICLES: 60,          // per field; the oldest particle is dropped beyond this
};

// Flap feathers shown above Sammy's head (one per charge).
export const FLAP_PIPS = {
    HIDE_WHEN_FULL_AFTER: 1.2,  // grounded with every flap: fade out after this long (null = always show)
    FADE_SPEED: 4,              // alpha per second
    POP_TIME: 0.3,              // spent / refilled feather pop animation
    HEIGHT: 1.28,               // tiles above Sammy's feet (clear of the ear tufts)
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
