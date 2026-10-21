// Toy colors for mechanisms (T-014): levers, bridges, gates and lifts are kid-made contraptions
// (wooden blocks, a ruler, thread spools and string, plastic bricks, party balloons), so they
// stay bright and primary in every chapter. Picked by the level's `timeOfDay`; night is the day
// set under a cool moonlit tint. A timeOfDay without its own entry (a new chapter or the
// bedroom) uses `day` until it gets one.
import { rgb } from 'littlejs';

const day = {
    outline:     rgb(.20, .11, .09),
    shadow:      rgb(.03, .02, .08, .3),
    wood:        rgb(.86, .62, .38),
    woodLight:   rgb(.97, .80, .56),
    woodDark:    rgb(.64, .42, .24),
    ruler:       rgb(1, .78, .26),
    rulerLight:  rgb(1, .90, .55),
    rulerTick:   rgb(.42, .28, .14),
    string:      rgb(.96, .94, .90),
    spool:       rgb(.93, .36, .45),      // the thread wound on the spool
    spoolLight:  rgb(1, .62, .66),
    // Plastic bricks: red, blue, yellow, green, in that order wherever they repeat.
    bricks:      [rgb(.92, .26, .24), rgb(.24, .50, .92), rgb(1, .80, .18), rgb(.30, .74, .34)],
    plastic:     rgb(.30, .66, .96),      // lift plate
    plasticLight: rgb(.62, .84, 1),
    plate:       rgb(.62, .64, .70),      // the gate's grey base plate
    plateLight:  rgb(.80, .82, .88),
    knob:        rgb(.95, .24, .26),
    knobShine:   rgb(1, .80, .80),
    lightOn:     rgb(.45, 1, .50),
    lightOff:    rgb(.30, .22, .22),
    balloons:    [rgb(1, .42, .58), rgb(.50, .74, 1), rgb(1, .86, .30)],
    shine:       rgb(1, 1, 1, .7),
    key:         rgb(.98, .82, .30),      // the lift's wind-up key
    star:        rgb(1, .94, .45),
    // Cat spot cushion (T-016): a plain velvet cushion with an embroidered paw print. Deliberately
    // no cat's colors (not black, white or tuxedo), so it never hints which cat it wants.
    cushion:      rgb(.42, .62, .86),
    cushionLight: rgb(.62, .80, .98),
    cushionDark:  rgb(.28, .44, .68),
    piping:       rgb(.98, .84, .44),
    pawPrint:     rgb(.96, .92, .84),
    sparkle:      rgb(1, .96, .72),
    // The wind-up toy mouse (T-016): grey felt, pink ears and nose, black bead eyes, a brass key.
    mouseFur:     rgb(.70, .68, .78),
    mouseFurLight: rgb(.86, .85, .92),
    mouseFurDark: rgb(.52, .50, .62),
    mouseBelly:   rgb(.94, .91, .93),
    mouseEar:     rgb(1, .66, .76),
    mouseNose:    rgb(1, .46, .60),
    bead:         rgb(.07, .06, .10),
    wheel:        rgb(.26, .23, .32),
    sweat:        rgb(.62, .86, 1),
    blush:        rgb(1, .55, .68, .55),
    // The toy star (T-018, a placeholder find): a plump golden plush star.
    toyStar:      rgb(1, .86, .30),
    toyStarLight: rgb(1, .97, .72),
    toyStarDark:  rgb(.94, .62, .18),
    toyStarGlow:  rgb(1, .92, .55),
    confetti:     [rgb(1, .55, .70), rgb(.55, .80, 1), rgb(.62, .92, .55), rgb(1, .86, .35), rgb(.80, .66, 1)],
};

/** Moonlight: a little darker and bluer, but the toys still read as toys. */
const NIGHT_TINT = rgb(.80, .82, 1);

export const MECHANISM_PALETTES = {
    day,
    night: tint(day, NIGHT_TINT),
};

export function mechanismPalette(timeOfDay)
{
    return MECHANISM_PALETTES[timeOfDay] ?? MECHANISM_PALETTES.day;
}

function tint(palette, by)
{
    const tintOne = color => rgb(color.r * by.r, color.g * by.g, color.b * by.b, color.a);
    const result = {};
    for (const [key, value] of Object.entries(palette))
        result[key] = Array.isArray(value) ? value.map(tintOne) : key === 'shadow' || key === 'shine' ? value : tintOne(value);
    return result;
}
