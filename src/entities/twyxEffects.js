// Recipes for Twyx's particle bursts, spawned into a ParticleField. Numbers in TWYX.
import { vec2, rand } from 'littlejs';
import { drawHeart, drawQuestion, drawPurrWave } from '../art/drawTwyxFx.js';
import { drawDust } from '../art/drawSammyFx.js';
import { TWYX } from '../data/tuning.js';

/** Petted: one big heart straight up from the head, and smaller ones drifting off to the sides. */
export function spawnPetHearts(field, headPos)
{
    for (let i = 0; i < TWYX.HEARTS; i++)
    {
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1);
        field.add({
            draw: drawHeart,
            pos: headPos.add(vec2(side * .25, i ? -.05 : .05)),
            vel: vec2(side * rand(.3, .55), TWYX.HEART_RISE * (i ? rand(.6, .8) : 1)),
            life: TWYX.HEART_LIFE * (i ? rand(.75, .95) : 1),
            drag: .6,
            sway: TWYX.HEART_SWAY * (i ? 1 : .4),
            swayPhase: rand(0, 6.28),
            angle: side * -.25,
            size: i ? rand(.16, .2) : .28,
        });
    }
}

/** Back with Sammy: two small hearts bubble up. */
export function spawnHappyHearts(field, headPos)
{
    for (const side of [-1, 1])
        field.add({
            draw: drawHeart,
            pos: headPos.add(vec2(side * .15, 0)),
            vel: vec2(side * rand(.2, .4), TWYX.HEART_RISE * rand(.7, .9)),
            life: TWYX.HEART_LIFE * .8,
            drag: .6,
            sway: TWYX.HEART_SWAY * .6,
            swayPhase: rand(0, 6.28),
            angle: side * -.2,
            size: rand(.15, .19),
        });
}

/** Waiting at an edge: a "?" pops up beside her head, toward the way she wants to go. */
export function spawnMrrp(field, headPos, facing)
{
    field.add({
        draw: drawQuestion,
        pos: headPos.add(vec2(facing * .3, .42)),
        vel: vec2(facing * .12, .35),
        life: 1.5,
        drag: 1.2,
        sway: .15,
        angle: -facing * .15,
        size: .34,
    });
}

/** A soft puff under her paws when she lands from a real drop. */
export function spawnLandPuff(field, feet, impact)
{
    const count = Math.round(2 + impact * 4);
    for (let i = 0; i < count; i++)
    {
        const side = i % 2 ? 1 : -1;
        field.add({
            draw: drawDust,
            pos: feet.add(vec2(side * rand(.1, .3), .05)),
            vel: vec2(side * rand(.6, 1.4) * (.5 + impact), rand(.1, .5)),
            life: rand(.3, .45),
            drag: 4,
            size: rand(.14, .22) * (.6 + impact),
        });
    }
}

/** Comfort (T-016): a purr ripple rising off her back. */
export function spawnPurrWave(field, backPos)
{
    field.add({
        draw: drawPurrWave,
        pos: backPos.copy(),
        vel: vec2(rand(-.1, .1), .45),
        life: 1.3,
        drag: .4,
        sway: .08,
        swayPhase: rand(0, 6.28),
        angle: rand(-.15, .15),
        size: .42,
    });
}

/** Comfort: the moment it works, a warm little burst of hearts over both of them. */
export function spawnComfortHearts(field, between)
{
    for (let i = 0; i < 5; i++)
    {
        const side = (i / 4) * 2 - 1;
        field.add({
            draw: drawHeart,
            pos: between.add(vec2(side * .35, i === 2 ? .1 : 0)),
            vel: vec2(side * rand(.35, .6), TWYX.HEART_RISE * rand(.75, 1)),
            life: TWYX.HEART_LIFE * rand(1, 1.2),
            drag: .5,
            sway: TWYX.HEART_SWAY * .7,
            swayPhase: rand(0, 6.28),
            angle: side * -.3,
            size: i === 2 ? .32 : rand(.17, .23),
        });
    }
}
