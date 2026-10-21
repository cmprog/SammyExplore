// The remembered half of Twyx's animation: which way Twyx faces (toward where she's going, or
// toward Sammy when she stops), the idle routine (stand, sit down, lick a paw), blinks, tail
// swishes, the pet reaction, a squash-and-stretch spring, and (T-015) moving: the trot cycle,
// leaps, glancing up at Sammy or back over her shoulder for him, and the curious sit-and-look
// while she waits, and (T-016) her Comfort ability: lean in, headbutts, grooming licks, then
// curling up close with a purr (timeline TWYX_COMFORT). Twyx calls update() once per step; pose() hands drawTwyx plain data, so the
// drawing stays a pure function of (pos, pose, time).
import { clamp, rand, randBool } from 'littlejs';
import { TWYX as T, TWYX_MOTION as M, TWYX_COMFORT as CF } from '../data/tuning.js';

export const TWYX_ACTIONS = ['stand', 'sit', 'lick'];
/** Ability animations she has (CatBody.performAbility). */
export const TWYX_ABILITIES = ['comfort'];

/** What a still cat reports (no mover). */
const STILL = { vx: 0, vy: 0, grounded: true, waiting: false, riding: false, wantsToMove: false };
const MOVING_SPEED = .006;   // tiles per step: slower than this is standing

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
        // Moving (T-015)
        this.walk = 0;              // trot blend 0..1
        this.gait = 0;              // trot cycle phase, radians
        this.air = 0;               // leap blend 0..1
        this.airLean = 0;           // -1 diving .. 1 rising
        this.headTurn = 1;          // 1 looking where she faces, -1 looking back over her shoulder
        this.lookUp = 0;            // head tilt toward Sammy, radians (up is +)
        this.curious = 0;           // the waiting head tilt
        this.glanceIn = rand(M.GLANCE_EVERY_MIN, M.GLANCE_EVERY_MAX);
        this.glanceAge = Infinity;
        this.glanceBack = false;    // this glance is over her shoulder (else up at Sammy)
        this.mrrpAge = Infinity;
        this.shakeAge = Infinity;
        this.caughtUpAge = Infinity;
        this.settled = false;       // sitting tight: waiting at an edge, or riding a lift
        this.moving = false;
        // Abilities (T-016)
        this.ability = null;        // 'comfort' while she's doing it
        this.abilityTime = 0;
        this.abilityFacing = 1;
        this.comfort = 0;           // blend toward the snuggle shape
        this.curl = 0;              // ...and on toward the curled-up loaf
    }

    /** Start an ability animation, facing whoever it's for. False if she has no such animation. */
    startAbility(name, facing = this.facing)
    {
        if (!TWYX_ABILITIES.includes(name))
            return false;
        this.ability = name;
        this.abilityTime = 0;
        this.abilityFacing = facing < 0 ? -1 : 1;
        this.startAction('stand');
        this.frozen = false;
        return true;
    }

    /** Done: she eases back to her normal stance (and goes back to following). */
    endAbility()
    {
        this.ability = null;
    }

    /** E pressed on Twyx: ears perk, eyes squint happily, a little hop. Stops a paw lick. */
    onPet()
    {
        this.petAge = 0;
        this.kick(T.PET_HOP);
        if (this.action === 'lick')
            this.startAction('sit', rand(T.SIT_TIME_MIN, T.SIT_TIME_MAX));
    }

    onLeap()  { this.kick(M.LEAP_STRETCH); }
    onLand(impact) { this.kick(-(M.LAND_SQUASH + M.LAND_SQUASH_IMPACT * impact)); }
    /** The little "mrrp?" when she has to wait: mouth opens, ears perk. */
    onMrrp() { this.mrrpAge = 0; }
    /** A gentle "not now" head shake. */
    onShake() { this.shakeAge = 0; }
    /** Back with Sammy: a happy squint (the hop itself is real, see Twyx.happyHop). */
    onCaughtUp() { this.caughtUpAge = 0; }

    kick(amount)
    {
        this.squash = amount;
        this.squashVelocity = 0;
    }

    /**
     * @param {number} dt
     * @param {{x:number, y:number}|null} toPlayer - Sammy minus Twyx (head to head), or null when she doesn't notice him
     * @param {{vx:number, vy:number, grounded:boolean, waiting:boolean, riding:boolean, wantsToMove:boolean}} [motion]
     */
    update(dt, toPlayer, motion = STILL)
    {
        this.moving = motion.grounded && Math.abs(motion.vx) > MOVING_SPEED;
        this.settled = (motion.waiting || motion.riding) && !this.ability;
        this.updateAbility(dt);
        this.updateFacing(dt, toPlayer, motion);
        this.updateAction(dt, motion);
        const sitTarget = !this.ability && (this.settled || (this.action !== 'stand' && !this.busy(motion))) ? 1 : 0;
        const sitSpeed = sitTarget ? T.SIT_SPEED : this.busy(motion) ? M.STAND_UP_SPEED : T.SIT_SPEED;
        this.sit = approach(this.sit, sitTarget, sitSpeed * dt);
        const licking = this.action === 'lick' && this.sit > .9 && !this.settled;
        this.lick = approach(this.lick, licking ? 1 : 0, T.LICK_SPEED * dt);
        this.updateMotion(dt, toPlayer, motion);
        this.updateBlink(dt);
        this.updateSwish(dt);
        this.petAge += dt;
        this.mrrpAge += dt;
        this.shakeAge += dt;
        this.caughtUpAge += dt;
        // Comforting, her ears stay soft and relaxed.
        const perked = !this.ability && (this.petAge < T.PET_TIME || this.mrrpAge < M.MRRP_TIME * 2 || this.curious > .5);
        this.perk += ((perked ? 1 : 0) - this.perk) * T.PERK_EASE;
        this.squashVelocity = (this.squashVelocity - this.squash * T.SQUASH_SPRING) * T.SQUASH_DAMPING;
        this.squash = clamp(this.squash + this.squashVelocity, -.4, .4);
    }

    busy(motion)
    {
        return this.moving || motion.wantsToMove || !motion.grounded;
    }

    /** Comfort's two body blends: in over LEAN_IN, curled from CURL_FROM; eased out after. */
    updateAbility(dt)
    {
        if (!this.ability)
        {
            this.comfort = approach(this.comfort, 0, CF.END_EASE * dt);
            this.curl = approach(this.curl, 0, CF.END_EASE * dt);
            return;
        }
        this.abilityTime += dt;
        const t = this.abilityTime;
        this.comfort = clamp(t / CF.LEAN_IN, 0, 1);
        this.curl = clamp((t - CF.CURL_FROM) / CF.CURL_TIME, 0, 1);
    }

    updateFacing(dt, toPlayer, motion)
    {
        if (this.ability)
            this.facing = this.abilityFacing;   // toward whoever she's comforting, not Sammy
        else if (this.moving || (!motion.grounded && Math.abs(motion.vx) > MOVING_SPEED))
            this.facing = Math.sign(motion.vx);
        else if (toPlayer && Math.abs(toPlayer.x) > .1)
            this.facing = Math.sign(toPlayer.x);
        this.turn = approach(this.turn, this.facing, T.TURN_SPEED * dt);
    }

    updateAction(dt, motion)
    {
        this.actionTime += dt;
        if (this.frozen || this.ability)
            return;
        // On the move (or sitting tight), the idle routine waits; it starts over once she's still.
        if (this.busy(motion) || this.settled)
        {
            if (this.action !== 'stand')
                this.startAction('stand');
            return;
        }
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

    /** Trot cycle, leap blend, and where her head points. */
    updateMotion(dt, toPlayer, motion)
    {
        this.walk = approach(this.walk, this.moving ? 1 : 0, M.WALK_BLEND_SPEED * dt);
        if (motion.grounded)
            this.gait = (this.gait + Math.abs(motion.vx) / M.TILES_PER_STRIDE * Math.PI * 2) % (Math.PI * 2);
        this.air = approach(this.air, motion.grounded ? 0 : 1, M.AIR_BLEND_SPEED * dt);
        if (!motion.grounded)
            this.airLean = clamp(motion.vy / .22, -1, 1);
        // Trotting away from Sammy (the trail can lead that way), she looks back over her shoulder
        // for him; and now and then on the move she glances back anyway, or up at him.
        this.updateGlance(dt);
        const behind = this.moving && toPlayer && Math.abs(toPlayer.x) > .5 && Math.sign(toPlayer.x) !== this.facing;
        const glancingBack = this.glanceBack && this.glanceAge < M.GLANCE_TIME;
        this.headTurn = approach(this.headTurn, behind || glancingBack ? -1 : 1, M.HEAD_TURN_SPEED * dt);
        let look = 0;
        if (toPlayer && !this.ability)
            look = clamp(Math.atan2(toPlayer.y, Math.abs(toPlayer.x) + .5) * .7, -M.LOOK_MAX_DOWN, M.LOOK_MAX_UP);
        if (!this.glanceBack)
            look += this.glanceAmount() * M.GLANCE_UP;
        this.lookUp += (look * (1 - this.lick) - this.lookUp) * M.LOOK_EASE;
        this.curious += ((motion.waiting ? 1 : 0) - this.curious) * M.CURIOUS_EASE;
    }

    updateGlance(dt)
    {
        this.glanceAge += dt;
        if (this.walk < .5 || (this.glanceIn -= dt) > 0)
            return;
        this.glanceAge = 0;
        this.glanceBack = randBool(M.GLANCE_BACK_CHANCE);
        this.glanceIn = rand(M.GLANCE_EVERY_MIN, M.GLANCE_EVERY_MAX);
    }

    glanceAmount()
    {
        const x = this.glanceAge / M.GLANCE_TIME;
        return x >= 1 ? 0 : Math.sin(x * Math.PI);
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
        else if (what === 'mrrp')
            this.onMrrp();
        else if (what === 'glanceBack' || what === 'glanceUp')
        {
            this.glanceAge = 0;
            this.glanceBack = what === 'glanceBack';
        }
        else if (what === 'release')
            this.frozen = false;
        else if (TWYX_ABILITIES.includes(what))
            this.startAbility(what, this.facing);
        else if (what === 'endAbility')
            this.endAbility();
    }

    get happy()
    {
        return this.petAge < T.PET_TIME || this.caughtUpAge < M.CAUGHT_UP_TIME || this.contented;
    }

    /** Comforting, past the first look: eyes shut in a content squint for the bunts, licks and curl. */
    get contented()
    {
        return !!this.ability && this.abilityTime > CF.BUNTS[0] - .12;
    }

    /** 0..1..0 over each headbutt. */
    buntAmount()
    {
        if (!this.ability)
            return 0;
        for (const at of CF.BUNTS)
        {
            const x = (this.abilityTime - at) / CF.BUNT_TIME;
            if (x >= 0 && x < 1)
                return Math.sin(x * Math.PI) ** 1.5;
        }
        return 0;
    }

    /** The grooming blend: eased in and out at the ends of its stretch. */
    groomAmount()
    {
        if (!this.ability)
            return 0;
        const t = this.abilityTime, edge = .2;
        return clamp(Math.min(t - CF.GROOM_FROM, CF.GROOM_TO - t) / edge, 0, 1);
    }

    /** Plain data for drawTwyx. */
    pose()
    {
        const mrrp = this.mrrpAge / M.MRRP_TIME;
        const shake = this.shakeAge / M.SHAKE_TIME;
        return {
            turn: this.turn,
            sit: this.sit,
            lick: this.lick,
            lickTime: this.actionTime,
            perk: this.perk,
            happy: this.happy ? 1 : 0,
            blink: this.blinkAge < T.BLINK_TIME ? 1 : 0,
            swish: this.swishAmount(),
            squash: this.squash,
            walk: this.walk * (1 - this.sit),
            gait: this.gait,
            air: this.air,
            airLean: this.airLean,
            headTurn: this.headTurn,
            lookUp: this.lookUp,
            curious: this.curious,
            mrrp: mrrp < 1 ? Math.sin(mrrp * Math.PI) : 0,
            // Side to side three times, fading out.
            shake: shake < 1 ? Math.sin(shake * Math.PI * 6) * (1 - shake) : 0,
            // Comfort (T-016)
            comfort: this.comfort,
            curl: this.curl,
            bunt: this.buntAmount(),
            groom: this.groomAmount(),
            groomPhase: (this.abilityTime - CF.GROOM_FROM) * CF.GROOM_RATE * Math.PI * 2,
            purr: this.ability && this.abilityTime >= CF.PURR_FROM ? 1 : 0,
        };
    }
}

/** Move `value` toward `target` by at most `step`. */
function approach(value, target, step)
{
    return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
