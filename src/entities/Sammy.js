// Sammy the owl: the player character. Runs, jumps, flaps (limited charges), and glides.
// All feel numbers live in SAMMY in data/tuning.js; the drawing lives in src/art/.
//
// The engine runs physics BEFORE update() each step, so update() sees where this step's
// physics left Sammy (groundObject set on landing) and sets the velocity the next step uses.
//
// Events (see docs/EVENTS.md): player:jump, player:flap {chargesLeft}, player:flapEmpty,
// player:glideStart, player:glideEnd (on any exit from glide), player:land {impact 0..1}.
import { EngineObject, vec2, clamp, lerp, sign, time, timeDelta } from '../../lib/littlejs/littlejs.esm.js';
import { isDown, wasPressed } from '../core/input.js';
import { emit } from '../core/events.js';
import { collidesWithTerrain, hasGroundWithin } from '../systems/terrainCollision.js';
import { drawSammyPlaceholder } from '../art/drawSammyPlaceholder.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { SAMMY, WORLD_GRAVITY } from '../data/tuning.js';

const STEPS_PER_SECOND = 1 / timeDelta;

export class Sammy extends EngineObject
{
    /** @param {Vector2} feetPos - where Sammy's feet (bottom-center of the hitbox) start */
    constructor(feetPos)
    {
        super(feetPos.add(vec2(0, SAMMY.HITBOX.y / 2)), vec2(SAMMY.HITBOX.x, SAMMY.HITBOX.y));
        this.renderOrder = RENDER_ORDER.characters;
        // Collides with solid objects (closed doors) as well as tiles; Sammy isn't solid itself.
        // So any entity Sammy should pass through (signs, cats, pickups) must keep isSolid=false.
        this.setCollision(true, false, true);
        this.friction = 1;          // ground friction is ours (RUN_FRICTION), not the engine's
        this.resetMotionState();
    }

    resetMotionState()
    {
        this.facing = 1;
        this.state = 'idle';
        this.grounded = true;       // so a reset onto the ground doesn't count as a landing
        this.coyoteReady = false;   // walked off a ledge (not jumped, not reset): may still jump briefly
        this.jumpCutReady = false;  // a jump can be cut short once, by releasing Space
        this.airTime = 0;           // seconds since last grounded
        this.pressTimer = 0;        // buffered Space press, seconds left
        this.pressReportedEmpty = false;
        this.flapCharges = SAMMY.FLAP_CHARGES;
        this.flapCooldown = 0;
        this.flapTimer = 0;
        this.refillTimer = 0;
        this.landTimer = 0;
        this.gliding = false;
        this.lastVelocityY = 0;
    }

    collideWithTile(tileData, tilePos)
    {
        return collidesWithTerrain(this, tileData, tilePos);
    }

    update()
    {
        const dt = timeDelta;
        this.tickTimers(dt);
        if (wasPressed('jump'))
        {
            this.pressTimer = SAMMY.JUMP_BUFFER;
            this.pressReportedEmpty = false;
        }
        this.updateGrounded(dt);
        this.handleJumpCut();
        this.handlePress();
        this.updateGlide();
        this.updateHorizontal();
        this.updateVertical();
        this.state = this.pickState();
        this.lastVelocityY = this.velocity.y;
    }

    tickTimers(dt)
    {
        this.pressTimer = Math.max(0, this.pressTimer - dt);
        this.flapCooldown = Math.max(0, this.flapCooldown - dt);
        this.flapTimer = Math.max(0, this.flapTimer - dt);
        this.landTimer = Math.max(0, this.landTimer - dt);
    }

    updateGrounded(dt)
    {
        const grounded = !!this.groundObject;
        if (grounded && !this.grounded)
            this.land();
        this.grounded = grounded;
        if (grounded)
        {
            this.airTime = 0;
            this.coyoteReady = true;
            return;
        }
        this.airTime += dt;
        this.refillInAir(dt);
    }

    refillInAir(dt)
    {
        if (this.flapCharges >= SAMMY.FLAP_CHARGES)
        {
            this.refillTimer = 0;
            return;
        }
        this.refillTimer += dt;
        if (this.refillTimer >= SAMMY.FLAP_AIR_REFILL)
        {
            this.refillTimer = 0;
            this.flapCharges++;
        }
    }

    land()
    {
        this.endGlide();
        // Physics zeroed the velocity on contact; the speed going into this step is the impact.
        const fallSpeed = -(this.lastVelocityY + WORLD_GRAVITY * this.gravityScale);
        const impact = clamp(fallSpeed / SAMMY.MAX_FALL_SPEED, 0, 1);
        this.flapCharges = SAMMY.FLAP_CHARGES;
        this.refillTimer = 0;
        this.flapTimer = 0;
        this.jumpCutReady = false;
        this.landTimer = SAMMY.LAND_STATE_TIME;
        emit('player:land', { impact: Math.round(impact * 1000) / 1000 });
    }

    handleJumpCut()
    {
        if (!this.jumpCutReady || isDown('jump'))
            return;
        this.jumpCutReady = false;
        if (this.velocity.y > 0)
            this.velocity.y *= SAMMY.JUMP_CUT;
    }

    // One buffered press, used by whichever move fits first: jump (grounded or coyote),
    // otherwise a flap. Held back while landing is imminent (so it becomes a jump) or while
    // the flap cooldown runs (so it fires when the cooldown ends).
    handlePress()
    {
        if (this.pressTimer <= 0)
            return;
        if (this.grounded || (this.coyoteReady && this.airTime <= SAMMY.COYOTE_TIME))
            return this.jump();
        // Waiting for an expected landing, but not past the end of the buffer: if Sammy drifts
        // off the ledge instead, the press still flaps (or reports empty) on its last step.
        if (this.landingSoon() && !this.pressExpiring())
            return;
        if (this.flapCooldown > 0)
        {
            // Keep the press until the cooldown ends, so a quick double-tap still flaps.
            this.pressTimer = Math.max(this.pressTimer, this.flapCooldown + timeDelta);
            return;
        }
        if (this.flapCharges > 0)
            return this.flap();
        if (!this.pressReportedEmpty)
        {
            // Stay buffered: if Sammy lands within the window, the press still jumps.
            this.pressReportedEmpty = true;
            emit('player:flapEmpty');
        }
    }

    pressExpiring()
    {
        return this.pressTimer <= timeDelta + 1e-9;
    }

    landingSoon()
    {
        if (this.velocity.y >= 0)
            return false;
        const reach = -this.velocity.y * SAMMY.JUMP_BUFFER * STEPS_PER_SECOND;
        return hasGroundWithin(this, reach);
    }

    jump()
    {
        this.pressTimer = 0;
        this.velocity.y = SAMMY.JUMP_VELOCITY;
        this.grounded = false;
        this.coyoteReady = false;
        this.jumpCutReady = true;
        this.landTimer = 0;
        this.flapCooldown = SAMMY.FLAP_COOLDOWN;
        emit('player:jump');
    }

    flap()
    {
        this.pressTimer = 0;
        this.endGlide();
        const rising = Math.max(this.velocity.y, 0);
        this.velocity.y = Math.max(this.velocity.y, rising * SAMMY.FLAP_KEEP + SAMMY.FLAP_VELOCITY);
        this.flapCharges--;
        this.flapCooldown = SAMMY.FLAP_COOLDOWN;
        this.flapTimer = SAMMY.FLAP_STATE_TIME;
        this.jumpCutReady = false;
        emit('player:flap', { chargesLeft: this.flapCharges });
    }

    updateGlide()
    {
        // Not while a press is still pending (e.g. a buffered jump about to land): that press
        // isn't a glide yet, and a one-frame glide would blip the glide sound. A press already
        // reported empty is just Space being held, so it may glide straight away.
        const pressPending = this.pressTimer > 0 && !this.pressReportedEmpty;
        const wantsGlide = !this.grounded && isDown('jump') && this.velocity.y < 0 && !pressPending;
        if (wantsGlide && !this.gliding)
        {
            this.gliding = true;
            emit('player:glideStart');
        }
        else if (!wantsGlide)
            this.endGlide();
    }

    endGlide()
    {
        if (!this.gliding)
            return;
        this.gliding = false;
        emit('player:glideEnd');
    }

    inputDirection()
    {
        return (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
    }

    updateHorizontal()
    {
        const direction = this.inputDirection();
        if (direction)
            this.facing = direction;
        const { maxSpeed, accel, drag } = this.horizontalProfile();
        const target = direction * maxSpeed;
        const vx = this.velocity.x;
        let rate = direction ? accel : drag;
        if (direction && sign(vx) === -direction)
            rate = accel + drag;            // turning around is snappier than starting
        else if (Math.abs(vx) > maxSpeed && sign(vx) === sign(target || vx))
            rate = drag;                    // e.g. landing from a fast glide: ease down, don't snap
        this.velocity.x = approach(vx, target, rate);
    }

    horizontalProfile()
    {
        if (this.grounded)
            return { maxSpeed: SAMMY.RUN_SPEED, accel: SAMMY.RUN_ACCEL, drag: SAMMY.RUN_FRICTION };
        if (this.gliding)
            return { maxSpeed: SAMMY.GLIDE_MAX_SPEED, accel: SAMMY.GLIDE_ACCEL, drag: SAMMY.AIR_DRAG };
        return { maxSpeed: SAMMY.AIR_MAX_SPEED, accel: SAMMY.AIR_ACCEL, drag: SAMMY.AIR_DRAG };
    }

    // Gravity for the next physics step, plus the fall-speed caps. At a cap gravity is switched
    // off so the cap is exact rather than overshooting by one step of gravity.
    updateVertical()
    {
        const vy = this.velocity.y;
        if (this.gliding && vy <= -SAMMY.GLIDE_FALL_SPEED)
        {
            this.velocity.y = lerp(vy, -SAMMY.GLIDE_FALL_SPEED, SAMMY.GLIDE_BRAKE);
            this.gravityScale = 0;
        }
        else if (this.gliding)
            this.gravityScale = SAMMY.GRAVITY_GLIDE;
        else if (vy <= -SAMMY.MAX_FALL_SPEED)
        {
            this.velocity.y = -SAMMY.MAX_FALL_SPEED;
            this.gravityScale = 0;
        }
        else
            this.gravityScale = vy > 0 ? SAMMY.GRAVITY_RISE : SAMMY.GRAVITY_FALL;
    }

    pickState()
    {
        if (this.grounded)
        {
            if (this.landTimer > 0)
                return 'land';
            return this.inputDirection() || Math.abs(this.velocity.x) > 0.01 ? 'run' : 'idle';
        }
        if (this.gliding)
            return 'glide';
        if (this.velocity.y > 0)
            return this.flapTimer > 0 ? 'flap' : 'jump';
        return 'fall';
    }

    /** Put Sammy's feet at `feetPos`, stopped, with full flaps. Ends a glide (with its event). */
    resetTo(feetPos)
    {
        this.endGlide();
        const facing = this.facing;
        this.pos = feetPos.add(vec2(0, this.size.y / 2));
        this.velocity = vec2();
        this.groundObject = undefined;
        this.gravityScale = 1;
        this.resetMotionState();
        this.facing = facing;
    }

    destroy(immediate)
    {
        if (!this.destroyed)
            this.endGlide();   // listeners (the glide sound) must never be left hanging
        super.destroy(immediate);
    }

    render()
    {
        drawSammyPlaceholder(this.pos, {
            size: this.size,
            facing: this.facing,
            state: this.state,
            flapCharges: this.flapCharges,
            maxFlapCharges: SAMMY.FLAP_CHARGES,
        }, time);
    }

    debugState()
    {
        return {
            pos: { x: this.pos.x, y: this.pos.y },
            vel: { x: this.velocity.x, y: this.velocity.y },
            size: { x: this.size.x, y: this.size.y },
            state: this.state,
            grounded: this.grounded,
            flapCharges: this.flapCharges,
            flapCooldown: this.flapCooldown,
            airTime: this.airTime,
            facing: this.facing,
            gliding: this.gliding,
        };
    }
}

/** Move `value` toward `target` by at most `step`. */
function approach(value, target, step)
{
    return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
