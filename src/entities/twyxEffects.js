// Recipes for Twyx's particle bursts, spawned into a ParticleField. Numbers in TWYX.
import { vec2, rand } from 'littlejs';
import { drawHeart } from '../art/drawTwyxFx.js';
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
