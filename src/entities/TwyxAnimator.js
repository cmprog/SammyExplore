// The remembered half of Twyx's animation: which way Twyx faces (turning toward Sammy when he's
// near), the idle routine (stand, sit down, lick a paw), blinks, tail swishes, the pet reaction
// and a squash-and-stretch spring. Twyx calls update() once per step and onPet() on E; pose()
// hands drawTwyx plain data, so the drawing stays a pure function of (pos, pose, time).
import { clamp, rand, randBool } from '../../lib/littlejs/littlejs.esm.js';
import { TWYX as T } from '../data/tuning.js';

export const TWYX_ACTIONS = ['stand', 'sit', 'lick'];

export class TwyxAnimator
{
    constructor()
    {
        this.reset();
    }

    reset()
    {
        this.facing = 1;
        this.turn = 1;              // eases between -1 and 1; drawTwyx squeezes through 0
        this.action = 'stand';
        this.actionTime = 0;
        this.actionLength = Infinity;
        this.nextActionIn = rand(T.ACTION_EVERY_MIN, T.ACTION_EVERY_MAX);
        this.sit = 0;
        this.lick = 0;
        this.blinkIn = rand(T.BLINK_EVERY_MIN, T.BLINK_EVERY_MAX);
        this.blinkAge = Infinity;
        this.swishIn = rand(T.SWISH_EVERY_MIN, T.SWISH_EVERY_MAX);
        this.swishAge = Infinity;
        this.petAge = Infinity;
        this.perk = 0;
        this.squash = 0;
        this.squashVelocity = 0;
        this.frozen = false;        // debug: hold the current action (pose captures)
    }

    /** E pressed on Twyx: ears perk, eyes squint happily, a little hop. Stops a paw lick. */
    onPet()
    {
        this.petAge = 0;
        this.squash = T.PET_HOP;
        this.squashVelocity = 0;
        if (this.action === 'lick')
            this.startAction('sit', rand(T.SIT_TIME_MIN, T.SIT_TIME_MAX));
    }

    /** @param {number} dt  @param {number|null} toPlayer - Sammy's x minus Twyx's x, or null when far */
    update(dt, toPlayer)
    {
        if (toPlayer !== null && Math.abs(toPlayer) > .1)
            this.facing = Math.sign(toPlayer);
        this.turn = approach(this.turn, this.facing, T.TURN_SPEED * dt);
        this.updateAction(dt);
        this.sit = approach(this.sit, this.action === 'stand' ? 0 : 1, T.SIT_SPEED * dt);
        const licking = this.action === 'lick' && this.sit > .9;
        this.lick = approach(this.lick, licking ? 1 : 0, T.LICK_SPEED * dt);
        this.updateBlink(dt);
        this.updateSwish(dt);
        this.petAge += dt;
        this.perk += ((this.petAge < T.PET_TIME ? 1 : 0) - this.perk) * T.PERK_EASE;
        this.squashVelocity = (this.squashVelocity - this.squash * T.SQUASH_SPRING) * T.SQUASH_DAMPING;
        this.squash = clamp(this.squash + this.squashVelocity, -.4, .4);
    }

    updateAction(dt)
    {
        this.actionTime += dt;
        if (this.frozen)
            return;
        if (this.action !== 'stand')
        {
            if (this.actionTime >= this.actionLength)
                this.startAction('stand');
            return;
        }
        if ((this.nextActionIn -= dt) > 0)
            return;
        if (randBool(T.LICK_CHANCE))
            this.startAction('lick', T.LICK_TIME);
        else
            this.startAction('sit', rand(T.SIT_TIME_MIN, T.SIT_TIME_MAX));
    }

    startAction(action, length = Infinity)
    {
        this.action = action;
        this.actionTime = 0;
        this.actionLength = length;
        if (action === 'stand')
            this.nextActionIn = rand(T.ACTION_EVERY_MIN, T.ACTION_EVERY_MAX);
    }

    updateBlink(dt)
    {
        this.blinkAge += dt;
        if ((this.blinkIn -= dt) > 0)
            return;
        this.blinkAge = 0;
        this.blinkIn = rand(T.BLINK_EVERY_MIN, T.BLINK_EVERY_MAX);
    }

    updateSwish(dt)
    {
        this.swishAge += dt;
        if ((this.swishIn -= dt) > 0)
            return;
        this.swishAge = 0;
        this.swishIn = T.SWISH_TIME + rand(T.SWISH_EVERY_MIN, T.SWISH_EVERY_MAX);
    }

    /** 0..1..0 over the swish, eased at both ends. */
    swishAmount()
    {
        const x = this.swishAge / T.SWISH_TIME;
        return x >= 1 ? 0 : Math.sin(x * Math.PI) ** 2;
    }

    /** Debug and pose captures: start an action now (and optionally hold it), blink, or swish. */
    force(what, hold = false)
    {
        if (TWYX_ACTIONS.includes(what))
        {
            this.startAction(what, what === 'stand' ? Infinity : T.LICK_TIME);
            this.frozen = hold;
            if (hold)   // jump straight into the pose, so a capture doesn't wait for the blend
            {
                this.sit = what === 'stand' ? 0 : 1;
                this.lick = what === 'lick' ? 1 : 0;
            }
        }
        else if (what === 'blink')
            this.blinkAge = 0;
        else if (what === 'swish')
            this.swishAge = 0;
        else if (what === 'release')
            this.frozen = false;
    }

    /** Plain data for drawTwyx. */
    pose()
    {
        return {
            turn: this.turn,
            sit: this.sit,
            lick: this.lick,
            lickTime: this.actionTime,
            perk: this.perk,
            happy: this.petAge < T.PET_TIME ? 1 : 0,
            blink: this.blinkAge < T.BLINK_TIME ? 1 : 0,
            swish: this.swishAmount(),
            squash: this.squash,
        };
    }
}

/** Move `value` toward `target` by at most `step`. */
function approach(value, target, step)
{
    return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
