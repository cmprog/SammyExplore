// The shared body of every cat (T-015): physics, the mover hook, and the few ways a mover may
// move her. A cat class (Twyx, later Snowy) extends this and adds her art, her animator and her
// reactions through the hooks at the bottom. Her `catId` comes from data/cats.js.
//
// A real little body: mass, and collisions with tiles and solid objects like Sammy's
// (setCollision(true, false, true)), so she rides lifts, stands on bridges, and waits at closed
// gates. She isn't solid herself: Sammy walks past (and in front of) her and never blocks her.
// What moves her is her `mover`, a CatRoamer at home or a CatFollower as the companion. Movers
// only ever call drive(), leap() and placeAt(), once per step from update() (after physics, so
// `grounded` is this step's).
import { EngineObject, vec2, clamp, timeDelta } from 'littlejs';
import { collidesWithTerrain } from '../systems/terrainCollision.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { COMPANION, WORLD_GRAVITY } from '../data/tuning.js';

const BRAKE = .012;   // per step, settling to a stop
const HEAD_HEIGHT = .8;   // roughly where her eyes are above her feet, for looking at Sammy

export class CatBody extends EngineObject
{
    /**
     * @param {Vector2} cellCenter - center of the cell she stands in (on the tile below it)
     * @param {{id:string, catId:string, roam?:number}} props
     * @param {{playerPos?:() => Vector2|null}} context
     */
    constructor(cellCenter, { id, catId, roam = COMPANION.ROAM_RADIUS }, { playerPos = null } = {})
    {
        const size = vec2(COMPANION.HITBOX.x, COMPANION.HITBOX.y);
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, size.y / 2 + .001)), size);
        this.id = id;
        this.catId = catId;
        this.roam = roam;
        this.home = false;             // the Companion sets this: placed by a companion hub level
        this.playerPos = playerPos;
        this.renderOrder = RENDER_ORDER.cats;
        this.setCollision(true, false, true);
        this.friction = 1;             // her ground speed is ours (drive), not the engine's
        this.gravityScale = COMPANION.GRAVITY_SCALE;
        this.mover = null;
        this.companion = false;        // set by the Companion system
        this.grounded = true;
        this.riding = false;
        this.wantsToMove = false;
        this.lastVelocityY = 0;
        this.leaps = 0;
    }

    /** Bottom center of her body. */
    get feet() { return this.pos.subtract(vec2(0, this.size.y / 2)); }

    collideWithTile(tileData, tilePos)
    {
        return collidesWithTerrain(this, tileData, tilePos);
    }

    setMover(mover)
    {
        this.mover = mover;
    }

    // --- movement (called by the mover) -------------------------------------------------------

    /** Ground speed toward vx (tiles per step). Speeding up is eased; slowing down is instant
     *  (so she never slides over an edge she meant to stop at), or eased if `gentle`. She gets
     *  up from a sit before she sets off. */
    drive(vx, gentle = false)
    {
        if (!this.grounded)
            return;
        this.wantsToMove ||= Math.abs(vx) > .001;
        const v = this.velocity.x;
        vx *= clamp(1 - this.sitAmount() * 1.6, 0, 1);
        if (Math.sign(vx) !== Math.sign(v) && v !== 0 && !gentle)
            this.velocity.x = 0;
        else if (Math.abs(vx) < Math.abs(v))
            this.velocity.x = gentle ? approach(v, vx, BRAKE) : vx;
        else
            this.velocity.x = approach(v, vx, COMPANION.ACCEL);
    }

    /** Spring off the ground with this velocity. */
    leap(vx, vy)
    {
        this.velocity = vec2(vx, vy);
        this.grounded = false;
        this.leaps++;
        if (vy > 0)
            this.onLeapStart();
    }

    /** Put her feet here, standing still (the Companion bringing her to Sammy). */
    placeAt(feet)
    {
        this.pos = feet.add(vec2(0, this.size.y / 2 + .001));
        this.velocity = vec2();
        this.groundObject = undefined;
        this.grounded = true;
        this.lastVelocityY = 0;
    }

    /** Back with Sammy: a little bounce on the spot (not a leap into him), plus her own joy. */
    happyHop()
    {
        this.onHappy();
        if (!this.grounded)
            return;
        this.velocity.y = COMPANION.CAUGHT_UP_HOP;
        this.velocity.x *= .2;
        this.grounded = false;
        this.onLeapStart();
    }

    // --- per step -----------------------------------------------------------------------------

    update()
    {
        const wasGrounded = this.grounded;
        this.grounded = !!this.groundObject;
        if (this.grounded && !wasGrounded)
            this.land();
        this.riding = false;
        this.wantsToMove = false;
        if (this.mover)
            this.mover.update(this);
        else
            this.drive(0);
        this.lastVelocityY = this.velocity.y;
        this.animate({
            vx: this.velocity.x,
            vy: this.velocity.y,
            grounded: this.grounded,
            waiting: !!this.mover?.waiting,
            riding: this.riding,
            wantsToMove: this.wantsToMove,
        });
    }

    /** The engine adds gravity, moves, then we cap: the same order the leap planner steps in. */
    updatePhysics()
    {
        super.updatePhysics();
        if (this.velocity.y < -COMPANION.MAX_FALL_SPEED)
            this.velocity.y = -COMPANION.MAX_FALL_SPEED;
    }

    land()
    {
        // Physics zeroed the velocity on contact; the speed going into this step is the impact.
        const fall = -(this.lastVelocityY + WORLD_GRAVITY * this.gravityScale);
        this.onLanded(clamp(fall / COMPANION.MAX_FALL_SPEED, 0, 1));
    }

    /** Sammy relative to her (head to head), or null when she doesn't notice him (beyond
     *  `notice`). The companion always knows where he is. */
    offsetToPlayer(notice = { x: Infinity, y: Infinity })
    {
        const player = this.playerPos?.();
        if (!player)
            return null;
        const dx = player.x - this.pos.x, dy = player.y - (this.feet.y + HEAD_HEIGHT);
        if (this.companion)
            return { x: dx, y: dy };
        return Math.abs(dx) <= notice.x && Math.abs(player.y - this.pos.y) <= notice.y ? { x: dx, y: dy } : null;
    }

    /** Body state for debugState (a cat class adds her look). */
    bodyDebugState()
    {
        return {
            id: this.id,
            cat: this.catId,
            pos: { x: this.pos.x, y: this.pos.y },
            vel: { x: round(this.velocity.x), y: round(this.velocity.y) },
            grounded: this.grounded,
            companion: this.companion,
            home: this.home,
            roam: this.roam,
            mover: this.mover?.debugState() ?? null,
            leaps: this.leaps,
        };
    }

    // --- hooks for the cat class (art, animator, effects) -------------------------------------

    /** 0 standing .. 1 sitting: she stands up before she walks off. */
    sitAmount() { return 0; }
    onLeapStart() {}
    /** @param {number} impact - fall speed 0..1 */
    onLanded(impact) {}
    onHappy() {}
    /** Her "mrrp?" when she has to wait. */
    mrrp() {}
    /** E asked her along but she can't come just now (another cat is along who can't stay): a no. */
    refuse() {}
    /** @param {{vx:number, vy:number, grounded:boolean, waiting:boolean, riding:boolean, wantsToMove:boolean}} motion */
    animate(motion) {}
}

export function round(value)
{
    return Math.round(value * 1000) / 1000;
}

/** Move `value` toward `target` by at most `step`. */
function approach(value, target, step)
{
    return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}
