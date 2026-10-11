// Sound catalog (ZzFX) plus the event -> sound mapping and audio defaults.
// Audio.js reads this; nothing else should call zzfx or build sounds.
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

// Bus event -> sound name. Change sounds for gameplay events here, not in Audio.js.
// Glide start/stop is a loop, handled by Audio.js directly (see GLIDE_*_EVENTS).
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
    'door:open':            'doorOpen',
    'checkpoint:reached':   'checkpoint',
    'correction:triggered': 'correction',
    'narrator:blip':        'narratorBlip',
    'menu:move':            'menuMove',
    'menu:select':          'menuSelect',
    'level:complete':       'levelComplete',
};

export const GLIDE_START_EVENTS = ['player:glideStart'];
// Anything that means "not gliding any more" (or the world changed underneath).
export const GLIDE_STOP_EVENTS = [
    'player:glideEnd', 'player:land', 'correction:triggered', 'level:complete', 'scene:change',
];
