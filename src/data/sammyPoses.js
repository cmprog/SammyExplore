// Sammy's body language per movement state (T-005). SammyAnimator eases toward these;
// drawSammy draws whatever it is handed, so a new state only needs a row here.
//
// wing.rot: radians from hanging straight down (0) through straight out (PI/2) to straight up (PI).
// wing.spread: 0 = folded (primaries tucked), 1 = fanned out. wing.length: 1 = folded size.
// Wings below FRONT_WING_MAX_ROT draw in front of the body (folded at the sides); higher ones behind.
// eyes.open: 1 = normal, < 1 = happy squint (cheeks push up), > 1 = wide. eyes.pupil: pupil size (1 = normal).
export const FRONT_WING_MAX_ROT = 1.1;

export const SAMMY_POSES = {
    idle:  { wing: { rot: .16, spread: 0,   length: 1 },    eyes: { open: 1,    pupil: 1 } },
    run:   { wing: { rot: .5,  spread: .15, length: 1 },    eyes: { open: 1,    pupil: 1 } },
    jump:  { wing: { rot: 2.25, spread: .6, length: 1.1 },  eyes: { open: 1.05, pupil: .95 } },
    flap:  { wing: { rot: 1.5, spread: .85, length: 1.15 }, eyes: { open: .75,  pupil: 1 } },
    fall:  { wing: { rot: 2.0, spread: .75, length: 1.1 },  eyes: { open: 1.15, pupil: .8 } },
    glide: { wing: { rot: 1.62, spread: 1,  length: 1.45 }, eyes: { open: .7,   pupil: 1.05 } },
    land:  { wing: { rot: .9,  spread: .35, length: 1 },    eyes: { open: .55,  pupil: 1 } },
};

// One wing stroke (a flap), as keyframes over FLAP_STROKE_TIME: snap up, whoosh down, recover.
export const FLAP_STROKE = [
    { t: 0,    rot: 1.9,  spread: .7, length: 1.15 },
    { t: .22,  rot: 2.85, spread: 1,  length: 1.25 },
    { t: .62,  rot: .7,   spread: 1,  length: 1.2 },
    { t: 1,    rot: 1.5,  spread: .85, length: 1.15 },
];
