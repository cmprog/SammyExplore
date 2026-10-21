// Twyx's body shapes (T-011a, T-015). drawTwyx blends between `stand` and `sit` by the pose's
// `sit` amount (0..1), so the sit-down is one smooth squish rather than a pop, then toward `trot`
// by `walk` and toward `leap` by `air`. Every shape has the same parts and fields. A paw lick is the sit
// shape plus `lick` (front paw raised to the mouth, head dipped).
//
// Comfort (T-016) blends toward `snuggle` by the pose's `comfort`, then toward `loaf` by `curl`.
//
// Art units: 1 = one tile. Origin between the feet, y up, facing right (+x is the front).
// body/haunch/bib: ellipses {x, y, w, h, tilt}. head: center. legs: x of the near front/back
// leg, the hip height they hang from and their length. tail: base point and base angle (CCW
// from +x), plus how far it bends from base to tip (curl, radians; negative bends clockwise,
// which for a tail pointing back means curling up and over). Most of the bend is near the tip.
export const TWYX_SHAPES = {
    stand: {
        body:   { x: -.02, y: .36, w: .9,  h: .5,  tilt: .04 },
        haunch: { x: -.22, y: .33, w: .36, h: .36, tilt: 0 },
        bib:    { x: .27,  y: .33, w: .3,  h: .36, tilt: -.25 },
        head:   { x: .33,  y: .76 },
        frontLeg: { x: .24,  hip: .3, length: .3 },
        backLeg:  { x: -.27, hip: .3, length: .3 },
        tail:   { x: -.4, y: .44, angle: 2.25, curl: -2.6 },
    },
    sit: {
        body:   { x: -.06, y: .4,  w: .6,  h: .68, tilt: -.18 },
        haunch: { x: -.18, y: .2,  w: .52, h: .4,  tilt: .1 },
        bib:    { x: .11,  y: .44, w: .32, h: .46, tilt: -.15 },
        head:   { x: .1,   y: .96 },
        frontLeg: { x: .14,  hip: .36, length: .36 },
        backLeg:  { x: .02, hip: .12, length: .12 },
        tail:   { x: -.34, y: .09, angle: 3.2, curl: -2.8 },
    },
    // Trotting (T-015): a touch longer and lower, head forward, tail held up in a happy
    // question mark. drawTwyx blends toward it by the pose's `walk` and swings the legs (TWYX_GAIT).
    trot: {
        body:   { x: 0,    y: .38, w: .94, h: .47, tilt: .03 },
        haunch: { x: -.23, y: .35, w: .35, h: .35, tilt: 0 },
        bib:    { x: .29,  y: .35, w: .29, h: .35, tilt: -.3 },
        head:   { x: .39,  y: .75 },
        frontLeg: { x: .25,  hip: .32, length: .32 },
        backLeg:  { x: -.27, hip: .32, length: .32 },
        tail:   { x: -.42, y: .5, angle: 1.62, curl: -2.1 },
    },
    // In the air (a hop or a leap): stretched out long, front paws reaching, tail streaming back.
    leap: {
        body:   { x: .02,  y: .44, w: 1.02, h: .43, tilt: .02 },
        haunch: { x: -.25, y: .42, w: .33, h: .33, tilt: 0 },
        bib:    { x: .33,  y: .42, w: .27, h: .31, tilt: -.38 },
        head:   { x: .44,  y: .78 },
        frontLeg: { x: .29,  hip: .38, length: .3 },
        backLeg:  { x: -.29, hip: .38, length: .3 },
        tail:   { x: -.44, y: .5, angle: 2.75, curl: -.9 },
    },
    // Comfort (T-016), blended in by the pose's `comfort`: low and close, leaning in toward
    // whoever she's comforting, head forward and down, tail curled softly round behind.
    snuggle: {
        body:   { x: .04,  y: .31, w: .94, h: .46, tilt: -.07 },
        haunch: { x: -.22, y: .28, w: .38, h: .37, tilt: 0 },
        bib:    { x: .33,  y: .28, w: .3,  h: .33, tilt: -.38 },
        head:   { x: .47,  y: .63 },
        frontLeg: { x: .29,  hip: .24, length: .24 },
        backLeg:  { x: -.26, hip: .26, length: .26 },
        tail:   { x: -.42, y: .36, angle: 2.7, curl: -2.2 },
    },
    // ...and then by `curl`: curled up close in a cosy loaf, paws tucked under, tail lying
    // along the ground with its tip curled up.
    loaf: {
        body:   { x: .02,  y: .27, w: .92, h: .5,  tilt: -.02 },
        haunch: { x: -.2,  y: .25, w: .44, h: .42, tilt: 0 },
        bib:    { x: .3,   y: .25, w: .3,  h: .3,  tilt: -.3 },
        head:   { x: .42,  y: .6 },
        frontLeg: { x: .27,  hip: .1, length: .08 },
        backLeg:  { x: -.24, hip: .1, length: .08 },
        tail:   { x: -.42, y: .12, angle: 3.25, curl: -1.7 },
    },
};

// The trot: diagonal pairs of legs swing together (near front with far back). Paw offsets in
// art units: `stride` forward/back, `lift` up while swinging forward. The body bobs twice per
// cycle. `reach` is where the paws go in a leap (front forward, back behind), scaled by `air`.
export const TWYX_GAIT = {
    stride: .12,
    lift: .08,
    bob: .028,
    headBob: .012,
    tailBounce: .1,
    reach: { front: { dx: .17, lift: .12 }, back: { dx: -.15, lift: .08 } },
};

// The head turns this far toward the facing side (3/4 view), as in Sammy's face.
export const TWYX_FACE_TURN = .07;
