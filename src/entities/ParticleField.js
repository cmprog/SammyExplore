// A pool of short-lived cartoon particles (feathers, dust, whooshes) drawn by art functions.
// The engine's ParticleEmitter draws square or textured sprites; ours are drawn shapes, so they
// match the rest of the hand-drawn look. One field per owner; the owner destroys it.
//
// A particle is plain data: { draw, pos, vel, life, age, gravity, drag, sway?, spin?, ... }.
// `draw(pos, particle, time)` gets the particle with `progress` (0..1) and `alpha` filled in.
import { EngineObject, vec2, time, timeDelta } from '../../lib/littlejs/littlejs.esm.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { SAMMY_FX } from '../data/tuning.js';

export class ParticleField extends EngineObject
{
    constructor()
    {
        super(vec2(), vec2());
        this.renderOrder = RENDER_ORDER.characters + 1;   // in front of Sammy
        this.mass = 0;
        this.gravityScale = 0;
        this.particles = [];
    }

    /** @param {object} particle - see the file header */
    add(particle)
    {
        // Hard cap so mashing can never pile up particles: the oldest one makes room.
        if (this.particles.length >= SAMMY_FX.MAX_PARTICLES)
            this.particles.shift();
        this.particles.push({ age: 0, gravity: 0, drag: 0, spin: 0, angle: 0, sway: 0, swayPhase: 0, ...particle });
    }

    /** Remove every particle at once (e.g. Sammy was put back somewhere else). */
    clear()
    {
        this.particles = [];
    }

    update()
    {
        const dt = timeDelta;
        for (const p of this.particles)
        {
            p.age += dt;
            p.vel = p.vel.scale(Math.max(0, 1 - p.drag * dt));
            p.vel.y -= p.gravity * dt;
            // Feathers rock side to side as they drift down.
            const sway = p.sway ? Math.cos(p.age * 5 + p.swayPhase) * p.sway : 0;
            p.pos = p.pos.add(vec2((p.vel.x + sway) * dt, p.vel.y * dt));
            p.angle += (p.spin + sway * .6) * dt;
        }
        this.particles = this.particles.filter(p => p.age < p.life);
    }

    render()
    {
        for (const p of this.particles)
        {
            p.progress = Math.min(p.age / p.life, 1);
            // Quick fade in, long fade out, so a burst appears at once but lingers softly.
            p.alpha = Math.min(1, p.progress * 12) * Math.min(1, (1 - p.progress) * 2.5);
            p.draw(p.pos, p, time);
        }
    }

    get count()
    {
        return this.particles.length;
    }
}
