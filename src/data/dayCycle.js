// Day/night cycles for indoor environments (systems/DayCycle.js). Time of day `t` runs 0..1
// around the clock: 0 = midnight, .25 = sunrise, .5 = noon, .75 = sunset.
//
// `keys` are looks at moments of the day; DayCycle eases between neighbors (and wraps from the
// last key back to the first). Every key lists every field:
//   skyTop, skyMid, skyHorizon - the sky seen through the window (top to horizon)
//   ambient   - room light: the whole scene is multiplied by it (white = no change)
//   stars     - 0..1 how visible the stars are
//   clouds    - 0..1 how visible the clouds are
//   dayView   - 0..1 blend of the scenery outside: 0 = night colors, 1 = day colors
//   viewTint  - multiplies the outside scenery and clouds (sunrise and sunset glow)
//   beam      - the shaft of sun or moon light through the window (alpha = strength)
//   spill     - the soft glow the window throws on the wall around it (alpha = strength)
//   fairy     - 0..1 how brightly the fairy lights shine
// The sun and moon cross the window between `rise` and `set` (moon times may pass 1: it sets
// the next morning). The nightlight switches on at `nightlight.on` and off at `nightlight.off`.
import { rgb } from 'littlejs';
import { BACKDROP_PALETTES } from './palettes.js';

const { night: NIGHT_SKY, day: DAY_SKY } = BACKDROP_PALETTES;

const NIGHT = {
    skyTop: NIGHT_SKY.skyTop, skyMid: NIGHT_SKY.skyMid, skyHorizon: NIGHT_SKY.skyHorizon,
    ambient: rgb(.41, .37, .63),
    stars: 1, clouds: 0, dayView: 0,
    viewTint: rgb(1, 1, 1),
    beam: rgb(.55, .62, 1, .34),
    spill: rgb(.50, .55, 1, .22),
    fairy: 1,
};

const DAWN = {
    skyTop: rgb(.38, .45, .80), skyMid: rgb(.90, .66, .84), skyHorizon: rgb(1, .80, .64),
    ambient: rgb(.82, .70, .84),
    stars: .15, clouds: .75, dayView: .65,
    viewTint: rgb(1, .80, .86),
    beam: rgb(1, .72, .70, .30),
    spill: rgb(1, .75, .78, .22),
    fairy: .35,
};

const DAY = {
    skyTop: DAY_SKY.skyTop, skyMid: DAY_SKY.skyMid, skyHorizon: DAY_SKY.skyHorizon,
    ambient: rgb(.95, .94, .93),
    stars: 0, clouds: 1, dayView: 1,
    viewTint: rgb(1, 1, 1),
    beam: rgb(1, .93, .68, .20),
    spill: rgb(1, .96, .85, .10),
    fairy: 0,
};

const DUSK = {
    skyTop: rgb(.26, .22, .55), skyMid: rgb(.88, .48, .60), skyHorizon: rgb(1, .64, .40),
    ambient: rgb(.84, .62, .66),
    stars: .3, clouds: .65, dayView: .5,
    viewTint: rgb(1, .70, .62),
    beam: rgb(1, .62, .38, .36),
    spill: rgb(1, .66, .50, .24),
    fairy: .7,
};

export const DAY_CYCLES = {
    // The bedroom. Night is the main setting, so it gets the biggest share of the clock.
    home: {
        period: 300,        // seconds for a whole day
        start: .86,         // a visit starts here: night, with the nightlight on
        // [from, to) on the clock; any time not listed is `otherwise`.
        phases: [
            { phase: 'dawn', from: .21, to: .30 },
            { phase: 'day', from: .30, to: .68 },
            { phase: 'dusk', from: .68, to: .77 },
        ],
        otherwise: 'night',
        sun: { rise: .215, set: .775 },
        moon: { rise: .70, set: 1.27 },
        nightlight: { on: .745, off: .265 },
        keys: [
            { t: 0, ...NIGHT },
            { t: .19, ...NIGHT },
            { t: .245, ...DAWN },
            { t: .32, ...DAY },
            { t: .655, ...DAY },
            { t: .725, ...DUSK },
            { t: .80, ...NIGHT },
        ],
    },
};
