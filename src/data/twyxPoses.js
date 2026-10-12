// Twyx's body shapes (T-011a). drawTwyx blends between `stand` and `sit` by the pose's `sit`
// amount (0..1), so the sit-down is one smooth squish rather than a pop. A paw lick is the sit
// shape plus `lick` (front paw raised to the mouth, head dipped).
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
};

// The head turns this far toward the facing side (3/4 view), as in Sammy's face.
export const TWYX_FACE_TURN = .07;
