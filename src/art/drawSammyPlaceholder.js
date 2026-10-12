// Placeholder Sammy for T-004 (T-005 draws the real owl). A round body tinted per movement
// state so playtests and screenshots can tell states apart, eyes and a beak that face the
// way Sammy faces, and one dot per flap charge above the head.
import { vec2, rgb, drawEllipse, drawCircle, drawPoly } from '../../lib/littlejs/littlejs.esm.js';

const OUTLINE = rgb(.10, .07, .16);
const BELLY = rgb(1, .93, .78);
const EYE_WHITE = rgb(1, 1, .95);
const PUPIL = rgb(.12, .08, .14);
const BEAK = rgb(1, .7, .2);
const PIP_FULL = rgb(1, .95, .55);
const PIP_EMPTY = rgb(.35, .32, .45);

export const STATE_COLORS = {
    idle: rgb(.62, .45, .30),   // brown
    run:  rgb(.90, .55, .25),   // orange
    jump: rgb(.95, .85, .30),   // yellow
    flap: rgb(.95, .45, .65),   // pink
    fall: rgb(.40, .55, .90),   // blue
    glide: rgb(.35, .80, .65),  // teal
    land: rgb(.65, .45, .85),   // purple
};

/** @param {{size:Vector2, facing:number, state:string, flapCharges:number, maxFlapCharges:number}} sammy */
export function drawSammyPlaceholder(pos, sammy, time)
{
    const size = sammy.size;
    const body = STATE_COLORS[sammy.state] ?? STATE_COLORS.idle;
    const center = pos.add(vec2(0, Math.sin(time * 3) * 0.015));
    const f = sammy.facing;

    drawEllipse(center, size.add(vec2(.08)), OUTLINE);
    drawEllipse(center, size, body);
    drawEllipse(center.add(vec2(f * .06, -size.y * .12)), size.multiply(vec2(.55, .5)), BELLY);

    const blink = (time % 3.7) < 0.12;
    for (const side of [-1, 1])
    {
        const eyePos = center.add(vec2(f * .08 + side * .17, size.y * .14));
        drawCircle(eyePos, .24, OUTLINE);
        drawCircle(eyePos, blink ? .04 : .2, EYE_WHITE);
        if (!blink)
            drawCircle(eyePos.add(vec2(f * .04, 0)), .1, PUPIL);
    }
    const beakBase = center.add(vec2(f * .1, size.y * .02));
    drawPoly([vec2(-.06, 0), vec2(.06, 0), vec2(f * .12, -.1)], BEAK, .02, OUTLINE, beakBase);

    drawChargePips(center.add(vec2(0, size.y / 2 + .18)), sammy.flapCharges, sammy.maxFlapCharges);
}

function drawChargePips(pos, charges, max)
{
    for (let i = 0; i < max; i++)
    {
        const pipPos = pos.add(vec2((i - (max - 1) / 2) * .16, 0));
        drawCircle(pipPos, .11, i < charges ? PIP_FULL : PIP_EMPTY, .02, OUTLINE);
    }
}
