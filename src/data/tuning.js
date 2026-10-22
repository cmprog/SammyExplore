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
/** Added to CAMERA_OFFSET_Y while the narrator's text box is up: the camera eases down so what
 *  lies below Sammy (a landing spot, the ground) shows above the box instead of under it.
 *  The level-bottom clamp still applies, so on low ground nothing moves. */
export const CAMERA_NARRATION_OFFSET_Y = -2.5;
/** Seconds the narration framing holds after the text box closes, so the short breath between
 *  two lines doesn't bob the camera up and back down. */
export const CAMERA_NARRATION_HOLD = 1;
/** T-016: while a cat's ability plays, the camera eases in a little on her and whoever she's
 *  helping. Keep the zoom at or below 1.2 so the baked terrain (pixels per tile) stays crisp. */
export const CAMERA_ABILITY = {
    ZOOM: 1.15,
    EASE: 2.2,          // per second (exponential ease of the zoom, in and out)
    WANDER: .5,         // Sammy further than this many zoomed view-widths from the middle: ease back out
};

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
//   Running jump + 3 flaps, no glide  ~14.3 across at takeoff height with perfect timing (sim),
//                                    ~9.5 mashing; 5 tiles lower: ~16.5 (measured 16.4)
//   Running jump + glide, 5 lower .. ~23.5 across (sim; measured ~24)
//   So flaps carry Sammy further than a glide at equal heights: a gap only REQUIRES gliding when
//   the far side is lower (the sandbox's Great Gap: 19 across, 5 down).
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
    LEVEL_COMPLETE_LINE_WAIT: 5,   // the continue prompt waits for the narrator's line to be fully shown, at most this long
    CONFETTI_COUNT: 90,
    CONFETTI_GRAVITY: 520,         // px/s^2, screen space
    TITLE_NOTICE_TIME: 6,          // how long a title-screen notice (e.g. a level failed to load) stays up
};

// --- Interaction (T-007) --- distances in tiles, times in seconds
export const INTERACTION = {
    // interactPriority: what E picks when several things are in range (higher first; then the one
    // on the side Sammy faces; then the nearest). A cat beside Sammy must never steal E from the
    // lever or door he walked up to, so cats rank below everything else.
    PRIORITY_DEFAULT: 1,
    PRIORITY_CAT: 0,
    PROMPT_FADE_IN: 0.16,     // the E bubble pops in...
    PROMPT_FADE_OUT: 0.12,    // ...and out a little faster, so swapping targets feels snappy
    PROMPT_LIFT: 0.2,         // gap between an interactable's top and the bubble's tail
    PROMPT_BOB: 0.07,         // bob height
    PROMPT_BOB_SPEED: 3.2,    // radians per second
};

// Doors: Sammy is "in range" when the distance from Sammy's center to the door's center is
// under RADIUS. 1.4 covers standing right beside the door (~1.0) with a little slack.
export const DOOR = {
    RADIUS: 1.4,
    SIZE: { x: 0.8, y: 1.9 },  // the slab: what blocks Sammy while closed (the frame is art only)
    OPEN_TIME: 0.5,            // swing animation; matches the creak in sounds.doorOpen
    PASSABLE_AT: 0.6,          // fraction of the swing after which Sammy can walk through
    EXIT_DELAY: 0.25,          // an exit door finishes opening, then the level completes after this
    RATTLE_TIME: 0.4,          // a locked door shakes this long
};

export const SIGN = {
    RADIUS: 1.3,
    WIGGLE_TIME: 0.6,          // the board wobbles when read
};

// --- Twyx the cat (T-011a) --- distances in tiles, times in seconds, angles in radians
// TwyxAnimator picks the idle moments at random between the MIN/MAX pairs.
export const TWYX = {
    RADIUS: 1.4,               // E range, from Twyx's center to Sammy's center
    NOTICE_RADIUS: 6,          // Twyx turns to face Sammy within this many tiles sideways...
    NOTICE_HEIGHT: 3,          // ...and this many up or down
    TURN_SPEED: 6,             // facing swings -1 <-> 1 at this rate per second (a quick squeeze)

    ACTION_EVERY_MIN: 4,       // standing this long before sitting down (or licking a paw)
    ACTION_EVERY_MAX: 8,
    LICK_CHANCE: 0.45,         // otherwise it's a plain sit
    SIT_TIME_MIN: 3,
    SIT_TIME_MAX: 6,
    LICK_TIME: 3.2,
    SIT_SPEED: 2.5,            // sit blend per second (0 standing .. 1 sitting)
    LICK_SPEED: 4,

    BLINK_EVERY_MIN: 2.2,
    BLINK_EVERY_MAX: 5.5,
    BLINK_TIME: 0.2,
    BREATHE_SPEED: 2.1,

    TAIL_SWAY: 0.12,           // gentle wave all the time...
    TAIL_SPEED: 2.2,
    SWISH_EVERY_MIN: 2.5,      // ...and every so often a big swish
    SWISH_EVERY_MAX: 6,
    SWISH_TIME: 1.3,
    SWISH_SWAY: 0.5,
    SWISH_SPEED: 7,

    PET_TIME: 1.5,             // ears perked and eyes happily squinted this long after E
    PET_HOP: 0.2,              // squash-and-stretch kick when petted
    PERK_EASE: 0.25,           // per step
    SQUASH_SPRING: 0.22,
    SQUASH_DAMPING: 0.74,

    HEARTS: 3,                 // one big heart and a couple of small ones float up when petted
    HEART_LIFE: 1.4,
    HEART_RISE: 1.3,           // tiles per second
    HEART_SWAY: 0.6,
};

// --- Indoor rooms (T-013) --- distances in tiles, times in seconds
// Light strengths are 0..1 additions to the room's light (dayCycle.js `ambient` is the base).
export const ROOM_LIGHT = {
    LIGHTMAP_SCALE: .25,        // the light map is this fraction of the screen (it is soft anyway)
    NIGHTLIGHT_FADE: .7,        // the nightlight eases on and off over this long
    NIGHTLIGHT_POP: .35,        // a little squash when it clicks on
    NIGHTLIGHT_RADIUS: 8.5,     // its warm pool of light...
    NIGHTLIGHT_STRENGTH: .62,
    NIGHTLIGHT_CORE: 1.6,       // ...and the bright heart of it, so the lamp itself glows
    NIGHTLIGHT_FLICKER: .04,    // a gentle candle-like breathing, never a flicker you notice
    FAIRY_RADIUS: 2.4,
    FAIRY_STRENGTH: .3,
    FAIRY_TWINKLE: .25,         // how much each bulb's brightness drifts
    WINDOW_LIGHT: .8,           // the glow over the open glass (drawn twice, so ~full in the middle)
    WINDOW_LIGHT_SPREAD: 1.25,  // ...and its size as a multiple of the open glass, so it fades out softly
    WINDOW_GLOW: 7,             // radius of the glow around the window
    BEAM_LENGTH: 12,            // the light shaft through the window
    BEAM_MAX_SLANT: 1.0,        // radians from straight down, so a low sun doesn't shine sideways
    MOTES: 14,                  // dust specks drifting in a sunbeam
};

// The view out of the window: far things shift a little as the camera moves, for depth.
export const ROOM_WINDOW = {
    SKY_PARALLAX: .06,          // fraction of the camera's offset from the window
    VIEW_PARALLAX: .12,
    PARALLAX_MAX: .7,           // tiles; the baked view has this much margin past the glass
    CLOUD_DRIFT: .12,           // tiles per second
    BODY_SIZE: 1.5,             // sun and moon diameter
};

// --- Mechanisms (T-014): levers and what they move --- distances in tiles, times in seconds,
// angles in radians. Sizes here are the collision boxes; the art is drawn to match.
export const LEVER = {
    RADIUS: 1.3,               // E range, from the lever's center to Sammy's center
    THROW_ANGLE: 0.62,         // handle tilt either side of upright (off = left, on = right)
    SPRING: 0.28,              // handle spring per step: overshoots a little, then settles
    DAMPING: 0.72,
    SQUASH: 0.18,              // the base squashes this much when thrown...
    SQUASH_TIME: 0.3,          // ...and springs back over this long
    PULSE_HOLD: 0.2,           // cycle mode: the handle stays over this long before springing back
    SPARKS: 5,                 // little stars that pop off the knob on a throw
    SPARK_LIFE: 0.55,
    SPARK_SPEED: 2.2,
};

// --- The chapter portal (T-017) --- tiles and seconds
export const PORTAL = {
    ENTER_HALF_WIDTH: 1.2,
    REARM_AFTER: 1,            // a step in that started no trip: the portal works again after this (Portal.js)     // Sammy's center this close to the middle (sideways), inside the opening, steps through
    SWITCH_TIME: 0.6,          // the swirl's color blends to the new chapter's over this long...
    FLIP_TIME: 0.5,            // ...while the sign flips over to the new title
    SPIN: 0.9,                 // swirl turns, radians per second
    SPIN_BOOST: 7,             // extra spin right after the lever is thrown (fades over SWITCH_TIME)
    POP: 0.08,                 // the swirl swells this much on a switch, and springs back
    MOTE_EVERY: 0.22,          // a glowing mote drifts out of the swirl this often
    MOTE_LIFE: 2.4,
    BURST: 14,                 // sparkles on a switch
    ENTER_BURST: 26,           // and when Sammy steps in
    LIGHT_RADIUS: 4.5,         // the soft glow it casts in the room's light map (diameter = 2x)
    LIGHT_STRENGTH: 0.8,
    LIGHT_PULSE: 0.08,
};

// The swirl that carries Sammy between the bedroom and a chapter (screen effect), seconds.
export const SWIRL_TRANSITION = {
    CLOSE_TIME: 0.85,          // the swirl closes in over the view...
    HOLD_MIN: 0.2,             // ...stays shut at least this long (and until the new level is built)...
    HOLD_MAX: 6,               // ...but never longer than this, even if the level is slow to load
    OPEN_TIME: 0.9,            // ...then opens out on the new place
};

export const BRIDGE = {
    THICKNESS: 0.36,           // the plank; its top is flush with the top of its row
    LOWER_TIME: 0.9,           // drops with a little bounce at the end
    RAISE_TIME: 1.1,           // winds back up more slowly
    SOLID_AT: 0.8,             // lowered fraction from which it can be stood on (where it touches down)
    RAISED_ANGLE: 1.35,        // radians up from flat when raised (a touch short of upright)
};

export const GATE = {
    WIDTH: 0.8,
    OPEN_TIME: 0.7,            // the brick wall sinks into its base plate
    CLOSE_TIME: 0.6,
    PASSABLE_AT: 0.85,         // opened fraction from which Sammy (and cats) can walk through
};

export const LIFT = {
    THICKNESS: 0.4,            // the plate; its top is flush with the top of its row
    SPEED: 2.2,                // tiles per second at the middle of a leg (each leg eases in and out)
    START_DELAY: 0.45,         // winds up for this long before setting off (time to hop on)
    END_PAUSE: 0.9,            // loop mode: waits this long at each end
    RIDE_EPSILON: 0.05,        // feet within this of the top count as riding
    HEADROOM: 2,               // rows above the path that must be free of solid tiles (level validation)
};

// --- Companion (T-015): a cat following Sammy --- distances in tiles, speeds in tiles per step
// (x60 = tiles per second), times in seconds. A cat walks, hops and drops; she CANNOT fly or
// glide, so these are her limits. Heights are of her feet above the ground she leaves from.
//   Hop up ............. a ledge at most HOP_MAX_UP above her (2 tiles: the test level's hill)
//   Gap ................ about GAP_MAX tiles edge to edge (LEAP_MAX_DX is center to center)
//   Drop ............... at most DROP_MAX tiles down
// Anything beyond that and she waits at the edge (companion:waiting) until the way opens.
export const COMPANION = {
    HITBOX: { x: 0.8, y: 0.8 },
    GRAVITY_SCALE: 0.9,        // of WORLD_GRAVITY; a touch floatier than a stone
    MAX_FALL_SPEED: 0.38,

    TROT_SPEED: 0.085,         // 5.1 tiles/s: a happy trot (Sammy runs 8.4)
    CATCHUP_SPEED: 0.13,       // 7.8 tiles/s: hurrying back to him
    CATCHUP_DISTANCE: 5,       // further than this from Sammy: hurry
    ACCEL: 0.01,               // speeding up per step (slowing down is instant, so she never overshoots an edge)

    FOLLOW_STOP: 1.8,          // she starts settling this close to Sammy (feet to feet; she comes to rest ~1.5)...
    FOLLOW_START: 2.8,         // ...and sets off again when he is further than this
    PERSONAL_SPACE: .9,        // settled closer than this to Sammy (he walked up to her): she steps aside...
    ROOM_BESIDE: 1.4,          // ...to this far beside him, so she's never hidden behind him

    HOP_MAX_UP: 2.1,
    GAP_MAX: 2.2,
    LEAP_MAX_DX: 2.9,
    DROP_MAX: 7,
    LEAP_APEX_MAX: 2.7,        // highest arc she will try, above her takeoff
    LEAP_SPEED_MAX: 0.17,      // sideways speed in a leap

    CRUMB_SPACING: 0.5,        // Sammy's ground path is remembered as a point every this far
    TRAIL_MAX: 1500,           // crumbs kept (about 750 tiles of walking)
    SHORTCUT_RANGE: 8,         // she skips ahead to a later crumb she can walk straight to
    WAIT_RECHECK: 0.25,        // while waiting, how often she checks whether the way has opened
    STUCK_TIME: 3,             // trying to move but not getting anywhere this long: wait instead

    ENTRY_DISTANCE: 3,         // she trots in to Sammy from about this far (correction, level start)
    CATCHUP_FAR: 12,           // a checkpoint fetches her if she is waiting, or this far behind, out of sight
    STRANDED_FETCH_AFTER: 8,   // stuck for good (in a blocker or keep-clear zone, nothing under her) out of sight this long: fetched anyway
    FETCH_FALLBACK_AFTER: 3,   // no unseen spot to bring her in from for this long: just past the screen edge,
                               // or (a level narrower than the view) under a quick page flip
    COVER_TIME: 0.8,           // the page flip: sweeps across, she's put down at full cover, sweeps away
    NARROW_LEVEL_SCREENS: 2,   // a level under this many screens wide with gates/bridges/lifts gets a load warning
    CAUGHT_UP_HOP: 0.13,       // the happy little hop on catching up (upward speed)

    ROAM_RADIUS: 3,            // default `roam` for a placed cat: wanders this far either side of home
    ROAM_SPEED: 0.03,          // a gentle amble
    ROAM_PAUSE_MIN: 5,
    ROAM_PAUSE_MAX: 11,
    ROAM_NOTICE: 3,            // stops wandering to watch Sammy when he is this close
};

// Twyx moving (T-015): her trot, leaps and waiting look. Shapes in data/twyxPoses.js.
export const TWYX_MOTION = {
    WALK_BLEND_SPEED: 6,       // trot blend per second (0 standing .. 1 trotting)
    STAND_UP_SPEED: 7,         // sit blend per second when she has somewhere to go (quicker than sitting down)
    AIR_BLEND_SPEED: 10,
    TILES_PER_STRIDE: 0.9,     // one full trot cycle per this many tiles
    HEAD_TURN_SPEED: 7,        // looking back over her shoulder
    LOOK_EASE: 0.12,           // head tilt toward Sammy, per step
    LOOK_MAX_UP: 0.38,         // radians
    LOOK_MAX_DOWN: 0.2,
    GLANCE_EVERY_MIN: 2.5,     // trotting, she glances up at Sammy or back over her shoulder now and then
    GLANCE_EVERY_MAX: 5,
    GLANCE_TIME: 0.7,
    GLANCE_UP: 0.3,
    GLANCE_BACK_CHANCE: 0.5,   // otherwise the glance is up at Sammy
    LEAP_STRETCH: 0.22,
    LAND_SQUASH: 0.14,
    LAND_SQUASH_IMPACT: 0.18,
    CURIOUS_EASE: 0.1,         // the waiting head tilt eases in
    MRRP_TIME: 0.6,            // mouth open for the "mrrp?"
    SHAKE_TIME: 0.6,           // the "not now" head shake
    SHAKE_ANGLE: 0.22,         // radians at its widest
    CAUGHT_UP_TIME: 1.2,       // happy squint after catching up
};

// --- Cat spots and abilities (T-016) --- tiles and seconds. Abilities themselves are data/abilities.js.
export const CATSPOT = {
    RADIUS: 1.4,               // E range, from the cushion to Sammy's center
    GIVE_UP_DISTANCE: 9,       // Sammy this far from a spot his companion is still heading for: she follows him again
    POKE_TIME: 0.45,           // E with no cat or the wrong one: the cushion squashes and puffs a few sparkles
    POKE_SQUASH: 0.22,
    POKE_SPARKS: 6,
    DONE_FADE: 1.2,            // the sparkle fades out over this long once its targets are all done
};

// Twyx's Comfort (T-016): the animation's timeline, seconds from the start. data/abilities.js
// takes the ability's length (LENGTH) and its "it worked" moment (CURL_FROM) from here.
export const TWYX_COMFORT = {
    LEAN_IN: 0.55,             // settles low and close
    BUNTS: [0.75, 1.3],        // two gentle headbutts...
    BUNT_TIME: 0.42,           // ...each this long (push in, ease back)
    GROOM_FROM: 1.75,          // little grooming licks...
    GROOM_TO: 3.0,
    GROOM_RATE: 2.4,           // ...this many per second
    CURL_FROM: 3.05,           // then she curls up close (a loaf), eyes shut, purring
    CURL_TIME: 0.6,
    PURR_FROM: 0.35,           // purr waves ripple off her back every PURR_EVERY
    PURR_EVERY: 0.6,
    PURR_SHIVER: 0.012,        // the tiny body vibration of a purr
    HEARTS_AT: [0.95, 1.5, 2.3],   // a small heart at each bunt and mid-groom; a big burst at effectAt
    END_EASE: 4,               // blend per second back to her normal stance when it ends
    LENGTH: 4.6,               // the whole thing; she stays curled up purring until then
};

// Upset things that a cat can calm (T-016, entities/Upset.js), and the wind-up toy mouse.
export const UPSET = {
    CALM_TIME: 0.8,            // setActive(true): eases from frazzled to calm over this long
    SHAKE: 0.045,              // frazzled jitter, tiles
    SHAKE_SPEED: 47,
    SOOTHED_SHAKE: 0.35,       // being comforted shrinks the jitter to this fraction before it calms
};

export const WINDUP_MOUSE = {
    SIZE: { x: 0.8, y: 0.62 },  // its solid box while it blocks the way
    SWEAT_EVERY: 0.38,         // a sweat drop flies off this often while frazzled
    KEY_SPIN_UPSET: 16,        // radians per second: whirring frantically
    KEY_SPIN_CALM: 1.4,        // a lazy turn
    HOP_EVERY: 1.1,            // frazzled little hops in place
    HOP_HEIGHT: 0.08,
    SCOOT_DELAY: 0.7,          // calm: a relieved sigh, then it scoots off...
    SCOOT_SPEED: 3.2,          // ...at up to this many tiles per second (eased at both ends)
};

// --- Finds (T-018): a placeholder pickup (the toy star) until the hat collectibles exist --------
// Distances in tiles, times in seconds.
export const COLLECTIBLE = {
    RADIUS: .8,                // Sammy's center this close to its center picks it up
    FLOAT: .55,                // its center floats this far above the floor of its cell
    BOB: .08,                  // gentle up-and-down while it waits
    BOB_SPEED: 2.2,            // radians per second
    SWAY: .14,                 // rocks side to side (radians)
    SWAY_SPEED: 1.4,
    TWINKLE_EVERY: .45,        // a sparkle drifts off it this often
    BLINK_EVERY: 3.6,
    // Found: it hops up, spins and swells, then pops into sparkles, a ring and confetti.
    FOUND_TIME: .9,
    FOUND_RISE: .8,            // tiles it rises before popping
    FOUND_SPIN: 4 * Math.PI,   // radians over FOUND_TIME
    FOUND_SWELL: .5,           // grows by this fraction before it pops
    BURST_SPARKS: 18,
    BURST_CONFETTI: 24,
    LIGHT_RADIUS: 2.4,         // its glow in a room's light map
    LIGHT_STRENGTH: .55,
};
