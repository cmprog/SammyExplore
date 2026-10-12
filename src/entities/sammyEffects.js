// Recipes for Sammy's particle bursts, spawned into a ParticleField. Numbers in SAMMY_FX.
import { vec2, rand } from 'littlejs';
import { drawLooseFeather, drawWhoosh, drawDust } from '../art/drawSammyFx.js';
import { SAMMY_FX as FX } from '../data/tuning.js';

/** A wing stroke: loose feathers flung out from under the wings, and a ring of pushed air. */
export function spawnFlapBurst(field, feetPos)
{
    field.add({ draw: drawWhoosh, pos: feetPos.add(vec2(0, .1)), vel: vec2(0, -1.5), life: FX.WHOOSH_TIME });
    for (let i = 0; i < FX.FLAP_FEATHERS; i++)
    {
        // Alternate sides so the burst is always balanced, mostly out and down.
        const side = i % 2 ? 1 : -1;
        const angle = rand(-.35, .55) * Math.PI;
        const speed = FX.FEATHER_SPEED * rand(.5, 1);
        field.add({
            draw: drawLooseFeather,
            pos: feetPos.add(vec2(side * rand(.4, .75), rand(.3, .6))),   // out at the wingtips
            vel: vec2(side * Math.cos(angle) * speed, -Math.abs(Math.sin(angle)) * speed * .6),
            life: FX.FEATHER_LIFE * rand(.75, 1.15),
            gravity: FX.FEATHER_GRAVITY,
            drag: FX.FEATHER_DRAG,
            sway: FX.FEATHER_SWAY * rand(.6, 1),
            swayPhase: rand(0, 6.28),
            angle: rand(-1, 1),
            spin: rand(-2, 2),
            size: rand(.13, .19),
            alt: i % 3 === 0,
        });
    }
}

/** Dust kicked out sideways from the feet; more, faster and bigger the harder the landing. */
export function spawnLandDust(field, feetPos, impact)
{
    if (impact < FX.DUST_MIN_IMPACT)
        return;
    const strength = (impact - FX.DUST_MIN_IMPACT) / (1 - FX.DUST_MIN_IMPACT);
    const count = Math.round(FX.DUST_PUFFS_MIN + (FX.DUST_PUFFS_MAX - FX.DUST_PUFFS_MIN) * strength);
    for (let i = 0; i < count; i++)
    {
        const side = i % 2 ? 1 : -1;
        const speed = FX.DUST_SPEED * (.4 + .6 * impact) * rand(.4, 1);
        const size = FX.DUST_SIZE * (.55 + .45 * impact) * rand(.6, 1.1);
        field.add({
            draw: drawGrowingDust,
            pos: feetPos.add(vec2(side * rand(.05, .3), rand(.02, .12))),
            vel: vec2(side * speed, rand(.2, 1.2)),
            life: FX.DUST_LIFE * rand(.7, 1.2),
            drag: FX.DUST_DRAG,
            gravity: -.5,                  // dust drifts up a little as it spreads
            size,
        });
    }
}

function drawGrowingDust(pos, p, time)
{
    drawDust(pos, { size: p.size * (.6 + .8 * p.progress), alpha: p.alpha }, time);
}
