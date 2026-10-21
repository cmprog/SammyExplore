// Sound catalog (ZzFX) plus the event -> sound mapping and audio defaults.
// Audio.js reads this; nothing else should call zzfx or build sounds.
import { abilityDef } from './abilities.js';
//
// ZzFX parameter order (unset = ZzFX default):
//  [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
//   pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay,
//   tremolo, filter]
//  shape: 0 sine, 1 triangle, 2 saw, 3 tan, 4 noise, 5 square.  slide: +1 = +500 Hz per second.
//  filter: negative = low-pass cutoff (Hz), positive = high-pass.
//
// An entry is either a single ZzFX array, or { layers, minInterval, loop } where each layer is
// { zzfx, at = seconds after trigger, semitones = pitch shift, volume = extra scale }.
// Layers let one name be a little phrase (a chime, a fanfare) without hand-mixing samples.
// minInterval (seconds) drops repeats that come faster than that, so spammy events can't stack.

// Default settings for a fresh install. Modest, since kids often play with the laptop turned up.
export const AUDIO_DEFAULTS = {
    volume: .5,          // master
    muted: false,
    musicVolume: .6,     // relative to master
    sfxVolume: .8,       // relative to master
};

export const AUDIO_TUNING = {
    MUSIC_LEVEL: .55,           // music sits under the effects even at equal slider values
    DEFAULT_MIN_INTERVAL: .03,  // seconds; same-name retriggers faster than this are dropped
    GLIDE_FADE_IN: .2,          // seconds
    GLIDE_FADE_OUT: .25,        // seconds
    MUSIC_FADE_IN: 2,           // seconds; music eases in instead of starting abruptly
    LAND_IMPACT_FLOOR: .35,     // land volume = lerp(floor, 1, impact): soft hops stay audible
    PORTAL_SAME_VOLUME: .35,    // the portal shimmer when the lever finds no other chapter: just a fizzle
};

// One bell-ish note reused for chimes and the fanfare (pitched with `semitones`). C5 base.
const BELL = [.35, 0, 523.25, .004, .06, .5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .45, .09];
// Softer, longer bell for the last fanfare note.
const BELL_LONG = [.35, 0, 523.25, .006, .25, .9, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .5, .12];
// Short rounded tick for menus.
const TICK = [.22, 0, 660, 0, .012, .05, 1, 1];

export const SOUNDS = {
    // Soft rising "bwoop": sine sliding up ~300 Hz.
    jump: [.3, .06, 300, .01, .04, .1, 0, 1, 4],

    // Whoosh (low-passed noise) plus a fast wing flutter (tremolo at ~33 Hz).
    flap: { layers: [
        { zzfx: [.35, .1, 420, .01, .05, .14, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .7, .03, 0, -1100] },
        { zzfx: [.25, .1, 260, .005, .08, .08, 4, 1, 0, 0, 0, 0, .03, 0, 0, 0, 0, .8, 0, .85, -1600] },
    ] },

    // Sad little puff: breathy sine sagging downward, quiet.
    flapEmpty: [.25, .05, 240, .01, .05, .16, 0, 1, -1.2, 0, 0, 0, 0, .9, 0, 0, 0, .7, .03, 0, -900],

    // Airy wind for a looping bed: low-passed noise with a slow swell. No attack/release so the
    // loop seam is inaudible; one second = two tremolo periods, so the swell lines up too.
    glide: { loop: true, layers: [
        { zzfx: [.22, 0, 300, 0, 1, 0, 4, 1, 0, 0, 0, 0, .5, 0, 0, 0, 0, 1, 0, .35, -650] },
    ] },

    // Soft low thump with a little dust.
    land: [.35, .05, 190, 0, .02, .08, 0, 1, -3, 0, 0, 0, 0, .35, 0, 0, 0, 1, 0, 0, -700],

    // Friendly "bip-bop": jumps a fifth up.
    interact: [.3, .03, 520, .004, .03, .08, 0, 1, 0, 0, 260, .035],

    // "Nothing here": a soft, slightly downturned boop.
    interactNothing: [.22, .03, 360, .005, .02, .08, 1, 1, -1.2],

    // Wooden creak (stick-slip pulses) then a soft settle.
    doorOpen: { layers: [
        { zzfx: [.3, .05, 150, .02, .22, .12, 2, 1, .5, 0, 0, 0, .03, 0, 0, 0, 0, .8, .02, .6, -1300] },
        { zzfx: [.3, .05, 170, 0, .02, .1, 0, 1, -2, 0, 0, 0, 0, .3, 0, 0, 0, 1, 0, 0, -800], at: .32 },
    ] },

    // Two low "dun-dun" rattles: the knob doesn't budge.
    doorLocked: [.38, .05, 200, 0, .12, .06, 1, 1, -2.5, 0, 0, 0, .08, .4, 0, 0, 0, 1, 0, 0, -1100],

    // Lever: a wooden "clack" (a click and a knock a fifth down) as the handle hits its stop.
    leverThrow: { layers: [
        { zzfx: [.3, .04, 900, 0, .01, .03, 1, 1, 0, 0, 0, 0, 0, .2, 0, 0, 0, 1, 0, 0, -2600] },
        { zzfx: [.38, .04, 220, 0, .03, .1, 0, 1, -4, 0, 0, 0, 0, .25, 0, 0, 0, 1, 0, 0, -1200], at: .05 },
    ] },

    // Bridge: the spool's ratchet ticking as the string pays out, then a wooden thunk on landing.
    bridgeMove: { layers: [
        { zzfx: [.18, .1, 1300, 0, .62, .05, 1, 1, 0, 0, 0, 0, .05, .3, 0, 0, 0, .7, 0, .9, -3000] },
        { zzfx: [.4, .05, 140, 0, .04, .14, 0, 1, -3, 0, 0, 0, 0, .35, 0, 0, 0, 1, 0, 0, -800], at: .7 },
    ] },

    // Gate: plastic bricks sliding (a short shushing slide down), then a snug click.
    gateMove: { layers: [
        { zzfx: [.2, .05, 500, .02, .4, .15, 4, 1, -.8, 0, 0, 0, 0, 0, 0, 0, 0, .6, 0, 0, -1500] },
        { zzfx: [.28, .03, 700, 0, .015, .04, 1, 1, 0, 0, 0, 0, 0, .1, 0, 0, 0, 1, 0, 0, -2400], at: .6 },
    ] },

    // Lift: a wind-up toy's buzzing whirr (a soft square wave with a fast flutter), about as
    // long as a short trip.
    liftHum: { minInterval: .3, layers: [
        { zzfx: [.14, .02, 170, .12, 1.1, .35, 5, 1, 0, 0, 0, 0, .04, 0, 0, 0, 0, .8, 0, .6, -900] },
    ] },

    // Lift arrives: a soft bump.
    liftArrive: [.26, .04, 180, 0, .02, .09, 0, 1, -2.5, 0, 0, 0, 0, .3, 0, 0, 0, 1, 0, 0, -900],

    // Two-note chime, G5 then C6.
    checkpoint: { layers: [
        { zzfx: BELL, semitones: 7 },
        { zzfx: BELL, semitones: 12, at: .13 },
    ] },

    // "Rewind": a warbly zip (frequency-modulated saw), then a bright fwip as the page is fixed.
    correction: { layers: [
        { zzfx: [.22, 0, 600, .05, .3, .15, 2, 1, -1, 0, 0, 0, 0, 0, 12, 0, 0, .8, 0, 0, -2400] },
        { zzfx: [.22, 0, 500, .01, .08, .2, 0, 1, 8], at: .42 },
    ] },

    // Typewriter blip: tiny and quiet so it can fire per letter without nagging.
    narratorBlip: { minInterval: .045, layers: [
        { zzfx: [.07, .12, 880, 0, .012, .025, 0, 1] },
    ] },

    menuMove: TICK,

    // Tick up a fifth: "ti-ting".
    menuSelect: { layers: [
        { zzfx: TICK },
        { zzfx: TICK, semitones: 7, at: .06 },
    ] },

    // Twyx: nasal low-passed saw that slides up, peaks ~0.1s, then curls back down.
    meow: [.3, .06, 560, .02, .09, .1, 2, 1, 10, -100, 0, 0, 0, 0, 0, 0, 0, .8, 0, 0, -1600],

    // Twyx waiting at an edge (T-015): a soft trilled "mrrp?" (tremolo trill, sliding up at the end).
    mrrp: [.24, .05, 330, .015, .12, .08, 2, 1, 7, 0, 0, 0, 0, 0, 0, 0, 0, .75, .02, .55, -1300],

    // Twyx back with Sammy: a happy little chirrup, two quick rising chirps.
    chirp: { minInterval: .4, layers: [
        { zzfx: [.2, .04, 520, .01, .03, .05, 2, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, .8, 0, 0, -1800] },
        { zzfx: [.2, .04, 520, .01, .03, .06, 2, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, .8, 0, 0, -1800], semitones: 5, at: .09 },
    ] },

    // Portal turns to another chapter (T-017): a warbly rising shimmer and two high bell notes,
    // just after the lever's clack.
    portalSelect: { minInterval: .15, layers: [
        { zzfx: [.12, 0, 700, .03, .22, .3, 0, 1, 7, 0, 0, 0, 0, 0, 6, 0, 0, .7, 0, .45, 0], at: .06 },
        { zzfx: BELL, semitones: 19, at: .14, volume: .55 },
        { zzfx: BELL, semitones: 24, at: .24, volume: .45 },
    ] },

    // Stepping into the portal: a swirling whoosh that winds upward, then a sparkle as the
    // swirl closes.
    portalEnter: { minInterval: .5, layers: [
        { zzfx: [.28, 0, 180, .08, .55, .35, 0, 1, 5, 0, 0, 0, 0, .2, 9, 0, 0, .6, 0, .35, -2200] },
        { zzfx: [.14, 0, 1400, .01, .08, .4, 0, 1, 3, 0, 0, 0, .06, 0, 0, 0, 0, .6, 0, .5], at: .55 },
        { zzfx: BELL_LONG, semitones: 24, at: .6, volume: .5 },
    ] },

    // Cat spots (T-016). A soft "pff" pat on the cushion (E with no cat, or the wrong one).
    catspotPoke: { minInterval: .2, layers: [
        { zzfx: [.22, 0, 200, .005, .03, .12, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .6, .04, 0, -700] },
        { zzfx: [.08, 0, 1800, .005, .02, .2, 0, 1, 0, 0, 0, 0, .05, 0, 0, 0, 0, .5, 0, .4], at: .04 },
    ] },

    // Twyx's Comfort: a low, warm purr that rumbles (tremolo at ~22 Hz) for the whole snuggle.
    purr: { minInterval: 1, layers: [
        { zzfx: [.32, 0, 58, .35, 2.6, 1, 2, 1, 0, 0, 0, 0, .045, .25, 0, 0, 0, .9, 0, .85, -420] },
    ] },

    // The moment Comfort works: a slow, soft rising chime.
    comfortChime: { minInterval: .5, layers: [
        { zzfx: BELL, semitones: 7, volume: .45 },
        { zzfx: BELL, semitones: 12, at: .16, volume: .45 },
        { zzfx: BELL_LONG, semitones: 16, at: .32, volume: .5 },
    ] },

    // The wind-up mouse calms down: a happy little two-note squeak.
    mouseRelief: { minInterval: .5, layers: [
        { zzfx: [.16, 0, 1400, .01, .04, .06, 0, 1, 6, 0, 0, 0, 0, 0, 0, 0, 0, .7, 0, 0, 0] },
        { zzfx: [.16, 0, 1700, .01, .05, .08, 0, 1, 8, 0, 0, 0, 0, 0, 0, 0, 0, .7, 0, 0, 0], at: .1 },
    ] },

    // Little arpeggio C-E-G-C, a ringing top note, and a sparkle on top.
    levelComplete: { minInterval: .5, layers: [
        { zzfx: BELL, semitones: 0 },
        { zzfx: BELL, semitones: 4, at: .12 },
        { zzfx: BELL, semitones: 7, at: .24 },
        { zzfx: BELL_LONG, semitones: 12, at: .38 },
        { zzfx: BELL_LONG, semitones: 16, at: .38, volume: .5 },
        { zzfx: [.12, 0, 2100, .01, .05, .3, 0, 1, 2, 0, 0, 0, .05, 0, 0, 0, 0, .6, 0, .5], at: .5 },
    ] },
};

// Bus event -> sound name (contract: docs/EVENTS.md). Change sounds for gameplay events here,
// not in Audio.js. Glide start/stop is a loop, handled by Audio.js directly (GLIDE_*_EVENTS).
// player:land is listed here and Audio.js scales its volume by the payload's {impact}.
export const SOUND_EVENTS = {
    'player:jump':          'jump',
    'player:flap':          'flap',
    'player:flapEmpty':     'flapEmpty',
    'player:land':          'land',
    'interact:door':        'interact',
    'interact:doorLocked':  'doorLocked',
    'interact:sign':        'interact',
    'interact:nothing':     'interactNothing',
    'interact:twyx':        'meow',
    'companion:waiting':    'mrrp',
    'companion:caughtUp':   'chirp',
    'door:open':            'doorOpen',
    'mechanism:cycle':      'leverThrow',
    'portal:select':        'portalSelect',  // quieter when it found no other chapter (Audio.js)
    'portal:enter':         'portalEnter',
    'bridge:move':          'bridgeMove',
    'gate:move':            'gateMove',
    'lift:move':            'liftHum',
    'lift:arrive':          'liftArrive',
    'checkpoint:reached':   'checkpoint',
    'correction:triggered': 'correction',
    'narrator:blip':        'narratorBlip',
    'menu:move':            'menuMove',
    'menu:select':          'menuSelect',
    'level:complete':       'levelComplete',
    'interact:catspot':     'catspotPoke',  // the pat; the right cat then purrs (ability:start)
};

// An upset thing's sound when it calms down, by its entity type (upset:calmed {kind}).
export const UPSET_CALM_SOUNDS = {
    windupMouse: 'mouseRelief',
};

// The start sound of an ability (sounds.start) stops early on ability:cancel (Audio.js).
export const ABILITY_CANCEL_EVENT = 'ability:cancel';

// Events whose sound depends on the payload: payload -> sound name, or null for none.
export const SOUND_EVENT_CHOOSERS = {
    // Any trigger thrown clunks, except a cat spot (her ability has its own sounds) or an upset
    // thing doing its job (its calm sound plays).
    'mechanism:toggle': data => data?.by === 'catspot' || data?.by === 'upset' ? null : 'leverThrow',
    'upset:calmed': data => UPSET_CALM_SOUNDS[data?.kind] ?? null,
    'ability:start': data => abilityDef(data?.ability)?.sounds?.start ?? null,
    'ability:used': data => abilityDef(data?.ability)?.sounds?.used ?? null,
};

export const GLIDE_START_EVENTS = ['player:glideStart'];
// Anything that means "not gliding any more" (or the world changed underneath).
// player:glideEnd is the contract; the rest are a safety net in case it is ever missed.
// scene:change is handled by Audio itself: a full change stops the loop, while an overlay
// (push) only pauses it and closing the overlay (pop) resumes it, so a held glide carries on.
export const GLIDE_STOP_EVENTS = [
    'player:glideEnd', 'player:land', 'player:flap', 'player:jump',
    'correction:triggered', 'level:complete',
];
