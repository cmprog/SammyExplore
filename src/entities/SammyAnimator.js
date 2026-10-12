// The remembered half of Sammy's animation: a squash-and-stretch spring, wings easing between
// poses (or playing a flap stroke), body lean, ear-tuft lag, run phase, and flap-pip pops.
// Sammy calls the on*() hooks from its moves and update() once per step; pose() hands
// drawSammy plain data, so the drawing stays a pure function of (pos, pose, time).
import { clamp, lerp, sign } from '../../lib/littlejs/littlejs.esm.js';
import { SAMMY_POSES, FLAP_STROKE } from '../data/sammyPoses.js';
import { SAMMY, SAMMY_ANIM as A, FLAP_PIPS } from '../data/tuning.js';

export class SammyAnimator
{
    constructor()
    {
        this.reset();
    }

    reset()
    {
        this.squash = 0;
        this.squashVelocity = 0;
        this.wing = { ...SAMMY_POSES.idle.wing };
        this.eyes = { ...SAMMY_POSES.idle.eyes };
        this.flapAge = Infinity;     // seconds since the last flap
        this.tilt = 0;
        this.tuft = 0;
        this.runPhase = 0;
        this.state = 'idle';
        this.stateTime = 0;
        this.pips = { alpha: 1, fullTime: 0, pops: [], lastCharges: SAMMY.FLAP_CHARGES };
    }

    onJump()
    {
        this.kickSquash(A.JUMP_STRETCH);
    }

    onFlap()
    {
        this.flapAge = 0;
        this.kickSquash(A.FLAP_STRETCH);
    }

    /** @param {number} impact - 0..1, as in player:land */
    onLand(impact)
    {
        this.flapAge = Infinity;
        this.kickSquash(-(A.LAND_SQUASH_MIN + A.LAND_SQUASH_IMPACT * impact));
    }

    kickSquash(amount)
    {
        this.squash = clamp(amount, -A.SQUASH_LIMIT, A.SQUASH_LIMIT);
        this.squashVelocity = 0;
    }

    /** @param {Sammy} sammy  @param {number} dt - seconds */
    update(sammy, dt)
    {
        if (sammy.state !== this.state)
        {
            this.state = sammy.state;
            this.stateTime = 0;
        }
        this.stateTime += dt;
        this.flapAge += dt;
        this.updateSquash(sammy);
        this.updateWings();
        this.updateLean(sammy);
        if (sammy.state === 'run')
            this.runPhase += Math.abs(sammy.velocity.x) / A.RUN_TILES_PER_CYCLE * Math.PI * 2;
        this.updatePips(sammy, dt);
    }

    updateSquash(sammy)
    {
        // Falling fast (not gliding) pulls Sammy a little long, like a dropping water balloon.
        const falling = sammy.state === 'fall' ? clamp(-sammy.velocity.y / SAMMY.MAX_FALL_SPEED, 0, 1) : 0;
        const target = falling * A.FALL_STRETCH_MAX;
        this.squashVelocity = (this.squashVelocity + (target - this.squash) * A.SQUASH_SPRING) * A.SQUASH_DAMPING;
        this.squash = clamp(this.squash + this.squashVelocity, -A.SQUASH_LIMIT, A.SQUASH_LIMIT);
    }

    updateWings()
    {
        const rest = SAMMY_POSES[this.state] ?? SAMMY_POSES.idle;
        if (this.flapAge < A.FLAP_STROKE_TIME)
            this.wing = strokeAt(this.flapAge / A.FLAP_STROKE_TIME);
        else
            for (const key of ['rot', 'spread', 'length'])
                this.wing[key] = lerp(this.wing[key], rest.wing[key], A.WING_EASE);
        for (const key of ['open', 'pupil'])
            this.eyes[key] = lerp(this.eyes[key], rest.eyes[key], A.WING_EASE);
    }

    updateLean(sammy)
    {
        // CCW radians, so leaning right (toward +x) is negative.
        const vx = sammy.velocity.x;
        let lean = 0;
        if (sammy.state === 'glide')
            lean = -(sign(vx || sammy.facing)) * (A.GLIDE_LEAN + Math.abs(vx) * A.GLIDE_LEAN_PER_SPEED);
        else if (sammy.state === 'run')
            lean = -sammy.facing * .06;
        this.tilt = lerp(this.tilt, lean, A.TILT_EASE);
        const tuftTarget = clamp(sammy.velocity.y * A.TUFT_LAG, -.6, .6);
        this.tuft = lerp(this.tuft, tuftTarget, A.TUFT_EASE);
    }

    /** Flap feathers: fade out when grounded with every flap, pop when one is spent or comes back. */
    updatePips(sammy, dt)
    {
        const pips = this.pips;
        const full = sammy.flapCharges >= SAMMY.FLAP_CHARGES;
        pips.fullTime = sammy.grounded && full ? pips.fullTime + dt : 0;
        const hide = FLAP_PIPS.HIDE_WHEN_FULL_AFTER !== null && pips.fullTime > FLAP_PIPS.HIDE_WHEN_FULL_AFTER;
        pips.alpha = clamp(pips.alpha + (hide ? -dt : dt) * FLAP_PIPS.FADE_SPEED, 0, 1);
        if (sammy.flapCharges !== pips.lastCharges)
        {
            const low = Math.min(sammy.flapCharges, pips.lastCharges);
            const high = Math.max(sammy.flapCharges, pips.lastCharges);
            for (let i = low; i < high; i++)
                pips.pops[i] = 0;
            pips.lastCharges = sammy.flapCharges;
        }
        pips.pops = pips.pops.map(age => age === undefined ? undefined : age + dt);
    }

    /** Plain data for drawSammy. */
    pose(sammy)
    {
        return {
            state: sammy.state,
            facing: sammy.facing,
            grounded: sammy.grounded,
            stateTime: this.stateTime,
            squash: this.squash,
            wing: { ...this.wing },
            eyes: { ...this.eyes },
            flapAge: this.flapAge,
            tilt: this.tilt,
            tuft: this.tuft,
            runPhase: this.runPhase,
        };
    }

    /** Plain data for drawFlapPips. */
    pipState(sammy)
    {
        return {
            charges: sammy.flapCharges,
            max: SAMMY.FLAP_CHARGES,
            alpha: this.pips.alpha,
            pops: this.pips.pops.map(age => age ?? Infinity),
        };
    }
}

/** The flap stroke keyframes (data/sammyPoses.js) at progress t (0..1), smoothly eased. */
function strokeAt(t)
{
    let i = 1;
    while (i < FLAP_STROKE.length - 1 && FLAP_STROKE[i].t < t)
        i++;
    const a = FLAP_STROKE[i - 1], b = FLAP_STROKE[i];
    let u = clamp((t - a.t) / (b.t - a.t), 0, 1);
    u = u * u * (3 - 2 * u);
    return { rot: lerp(a.rot, b.rot, u), spread: lerp(a.spread, b.spread, u), length: lerp(a.length, b.length, u) };
}
