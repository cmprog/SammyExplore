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
