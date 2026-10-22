// The companion's following brain (T-015). She trots after Sammy along his breadcrumb trail
// (systems/Trail.js), hops and leaps where a cat can, and where she can't she sits at the edge
// and looks at him until the way opens (a bridge lowers, a gate opens, a lift comes back).
// When she gets back to him after being apart, she does a happy little hop.
//
// States (also __sammy.companion.state):
//   following   on her way along the trail (or to a goTo() spot)
//   idle        settled near Sammy (within FOLLOW_STOP..FOLLOW_START), doing cat things
//   waiting     the trail needs something she can't do. `reason`: 'gap' | 'ledge' | 'gate' |
//               'door' | 'lift'. Every WAIT_RECHECK she looks again (including for a plain walk
//               straight to Sammy, at any distance) and carries on by herself.
//   catchingUp  hurrying back to him: after waiting, or after being brought in beside him
//               (`via` says how, for companion:caughtUp)
//
// The cat calls update(cat) from her own update(), after physics (so `grounded` is this step's).
// It only ever sets her velocity; the one place she is moved directly is Companion.placeBeside.
// She never settles inside a lift's path or a gateway (catNavigation.keepClearZones), and never
// on a lift Sammy isn't riding: she gets off toward him. Passing through is fine.
//
// goTo(pos) (for T-016's cat spots) sends her somewhere other than Sammy: she walks/hops there
// the same way and stays there until goTo(null).
import { clamp, timeDelta } from 'littlejs';
import {
    walkSpan, canWalkTo, planLeap, blockersFor, inTheWay, boxAt, SAME_HEIGHT,
} from '../systems/catNavigation.js';
import { COMPANION as C } from '../data/tuning.js';

const REACHED = .3;             // a crumb this close (sideways) is reached
const AT_GOAL = .08;            // goTo(): she eases in this close to the spot
const AT_TAKEOFF = .15;         // close enough to the edge/wall to try the leap from here
const SHORTCUT_EVERY = .15;     // seconds between looks for a later crumb she can walk straight to
const SHORTCUT_TRIES = 8;       // walk checks per look, newest crumbs first
const RECONNECT_TRIES = 24;     // while waiting: walk checks per re-check, at any range
const MIN_GAP_TO_SAMMY = 1.1;   // stepping out of the way, she'd rather keep a little room beside him
const ESCAPE_SEARCH = 4;        // tiles either side to look for a spot out of the way
const BOARD_MARGIN = .25;       // seconds of slack she wants before a lift leaves

export class CatFollower
{
    /**
     * @param {{trail:Trail, player:() => (Sammy|null), keepClearZones:Array, onWaiting:(reason:string) => void,
     *          onCaughtUp:(via:string) => void}} options
     */
    constructor({ trail, player, keepClearZones, onWaiting, onCaughtUp })
    {
        this.trail = trail;
        this.player = player;
        this.zones = keepClearZones;
        this.onWaiting = onWaiting;
        this.onCaughtUp = onCaughtUp;
        this.state = 'following';
        this.reason = null;
        this.waitedFor = new Set();   // reasons already announced since she last made progress
        this.via = 'walked';
        this.held = false;            // placed under the correction page: wait for it to lift
        this.leap = null;
        this.recheck = 0;
        this.shortcutIn = 0;
        this.escapeX = null;
        this.roomX = null;            // giveRoom(): where she's stepping to, beside Sammy...
        this.roomFor = null;          // ...and where he stood when she picked it
        this.stuckTime = 0;
        this.lastX = null;
        this.goal = null;             // goTo(): {x, y}, or null to follow Sammy
        this.atGoal = false;
    }

    /** She was just put down near Sammy (Companion.placeBeside): trot in from there. */
    enter(via, hold = false)
    {
        this.state = 'catchingUp';
        this.reason = null;
        this.waitedFor.clear();
        this.via = via;
        this.held = hold;
        this.leap = null;
        this.escapeX = null;
        this.stuckTime = 0;
        this.trail.clear();
    }

    release()
    {
        this.held = false;
    }

    /** Send her to a spot instead of following Sammy (T-016: walk to the cat spot). null: follow again. */
    goTo(pos)
    {
        this.goal = pos ? { x: pos.x, y: pos.y } : null;
        this.atGoal = false;
        this.trail.clear();
        if (this.state === 'idle' || this.state === 'waiting')
            this.state = 'following';
    }

    get waiting() { return this.state === 'waiting'; }

    update(cat)
    {
        const player = this.player();
        if (this.held || !player)
            return cat.drive(0);
        if (!cat.grounded)
            return this.steerInAir(cat);
        this.leap = null;
        const feet = cat.feet, solids = blockersFor(cat);
        const riding = cat.groundObject?.mechanismType === 'lift' ? cat.groundObject : null;
        if (riding?.moving)
            return this.ride(cat);
        if (this.goal)
            return this.toGoal(cat, feet, solids, riding);

        const sammyFeet = player.feetPos;
        const distance = feet.distance(sammyFeet);
        const sammyLift = player.groundObject?.mechanismType === 'lift' ? player.groundObject : null;
        const settle = this.state === 'idle' ? C.FOLLOW_START : C.FOLLOW_STOP;
        if (distance <= settle)
        {
            // Never settle on a lift Sammy isn't on: it would carry her off. Get off toward him.
            if (riding && riding !== sammyLift)
                return this.getOffToward(cat, feet, sammyFeet, solids);
            const except = riding ? riding : null;
            const inTheWay = this.inTheWay(cat, feet, except);
            const makingRoom = !inTheWay && this.giveRoom(cat, feet, player, solids);
            this.rest(cat, !inTheWay && !makingRoom);
            if (inTheWay)   // settle somewhere out of a lift's way or a gateway
                this.stepOutOfTheWay(cat, feet, solids, except, Math.sign(sammyFeet.x - feet.x), sammyFeet.x);
            else if (canWalkTo(cat, feet, sammyFeet, solids))
                this.trail.clear();
            return;
        }
        this.roomX = null;   // not settled beside him: any spot picked there is stale
        if (this.state === 'waiting')
        {
            if ((this.recheck -= timeDelta) > 0)
                return this.keepWaiting(cat, feet, solids);
            this.reconnect(cat, feet, sammyFeet, solids);
        }

        const target = this.nextTarget(cat, feet, solids);
        if (!target)
            return this.headFor(cat, feet, sammyFeet, solids, distance);
        return this.goToward(cat, feet, target, solids, distance, riding);
    }

    // --- choosing where to go ---------------------------------------------------------------

    nextTarget(cat, feet, solids)
    {
        const crumbs = this.trail.crumbs;
        while (crumbs.length && this.reached(cat, feet, crumbs[0]))
        {
            crumbs.shift();
            this.waitedFor.clear();   // real progress: a new wait is worth a new mrrp
        }
        if ((this.shortcutIn -= timeDelta) <= 0)
        {
            this.shortcutIn = SHORTCUT_EVERY;
            this.shortcut(cat, feet, solids, C.SHORTCUT_RANGE, SHORTCUT_TRIES);
        }
        const crumb = crumbs[0];
        if (!crumb)
            return null;
        if (!crumb.lift)
            return crumb;
        const lift = crumb.lift;
        return { x: lift.pos.x, y: lift.pos.y + lift.size.y / 2, lift };
    }

    reached(cat, feet, crumb)
    {
        if (crumb.lift)
            return cat.groundObject === crumb.lift || crumb.lift.destroyed;
        return Math.abs(crumb.x - feet.x) < REACHED && Math.abs(crumb.y - feet.y) < SAME_HEIGHT;
    }

    /** Sammy doubled back, or the trail wiggles: skip to the newest crumb she can walk straight to. */
    shortcut(cat, feet, solids, range, maxTries)
    {
        const crumbs = this.trail.crumbs;
        let tries = 0;
        for (let i = crumbs.length - 1; i > 0 && tries < maxTries; i--)
        {
            const crumb = crumbs[i];
            if (crumb.lift || Math.abs(crumb.y - feet.y) >= SAME_HEIGHT || Math.abs(crumb.x - feet.x) > range)
                continue;
            tries++;
            if (canWalkTo(cat, feet, crumb, solids))
            {
                crumbs.splice(0, i);
                return true;
            }
        }
        return false;
    }

    /** Waiting, she looks again: maybe he went over something and came back down onto her own
     *  ground, however far ahead. A straight walk to him, or to his newest crumb at her height,
     *  drops the part of the trail she couldn't follow. */
    reconnect(cat, feet, sammyFeet, solids)
    {
        if (canWalkTo(cat, feet, sammyFeet, solids))
            return void this.trail.clear();
        this.shortcut(cat, feet, solids, Infinity, RECONNECT_TRIES);
    }

    goToward(cat, feet, target, solids, distance, riding)
    {
        const speed = this.speedFor(distance);
        const span = walkSpan(cat, feet.x, feet.y, target.x, solids);
        if (target.lift && !span.blocked && !this.canBoard(target.lift, Math.abs(target.x - feet.x) / speed * timeDelta))
            return this.wait(cat, feet, solids, 'lift');   // it's about to leave: wait for the next one
        if (!target.lift && Math.abs(target.y - feet.y) < SAME_HEIGHT && !span.blocked)
            return this.walk(cat, target.x, speed, false);
        // On a lift Sammy rode, heading for where he got off: stay aboard and let it carry her
        // there, unless she can hop off to it from here.
        if (riding)
            return this.jumpOff(cat, feet, target, solids) ?? this.waitAboard(cat);
        // Somewhere she has to hop, leap or drop to: first get to the edge, the foot of the wall,
        // or right under it, then see whether she can make it from there. Never from inside a
        // lift's path or a gateway, since she may end up waiting there. (Walking onto a lift
        // standing at its stop is boarding, not waiting.)
        const boarding = target.lift && !span.blocked;
        const takeoff = boarding ? span.x : this.clearOfTheWay(cat, feet, span.x);
        if (Math.abs(takeoff - feet.x) > AT_TAKEOFF)
            return this.walk(cat, takeoff, speed, true);
        if (span.blocked && typeof span.blocked === 'object')
            return this.wait(cat, feet, solids, reasonFor(span.blocked, target, feet));
        const leap = this.findLeap(cat, feet, target, solids);
        if (leap)
            return this.jump(cat, leap);
        return this.wait(cat, feet, solids, reasonFor(span.blocked, target, feet));
    }

    jumpOff(cat, feet, target, solids)
    {
        const leap = this.findLeap(cat, feet, target, solids);
        return leap ? this.jump(cat, leap) ?? true : null;
    }

    /** On a lift Sammy isn't riding, near him: walk (or hop) off toward him. Stays aboard only if
     *  there is no way off from here yet. */
    getOffToward(cat, feet, sammyFeet, solids)
    {
        const x = this.findClearSpot(cat, feet, solids, null, Math.sign(sammyFeet.x - feet.x) || 1, sammyFeet.x);
        if (x !== null)
            return this.walk(cat, x, C.TROT_SPEED, true);
        return this.jumpOff(cat, feet, sammyFeet, solids) ?? this.waitAboard(cat);
    }

    /** Sitting tight on a lift that isn't moving: it will take her when it goes. */
    waitAboard(cat)
    {
        this.ride(cat);
        this.enterWaiting('lift');
    }

    /** A leap straight onto the target's surface, or else onto a stepping stone toward it. */
    findLeap(cat, feet, target, solids)
    {
        if (target.lift)
        {
            if (target.lift.moving)
                return null;   // only ever on board a lift that's standing still...
            const leap = planLeap(cat, feet, { toward: target, accepts: landing => landing.ground === target.lift }, solids);
            // ...and not one that will have left by the time she lands.
            return leap && this.canBoard(target.lift, leap.landing.steps * timeDelta) ? leap : null;
        }
        const direct = landing => Math.abs(landing.feet.y - target.y) < SAME_HEIGHT && canWalkTo(cat, landing.feet, target, solids);
        const closer = landing => Math.abs(landing.feet.x - target.x) < Math.abs(feet.x - target.x) - .6
            && landing.feet.y > Math.min(feet.y, target.y) - SAME_HEIGHT
            && !this.inTheWay(cat, landing.feet);
        return planLeap(cat, feet, { toward: target, accepts: direct }, solids)
            ?? planLeap(cat, feet, { toward: target, accepts: closer }, solids);
    }

    /** Is this lift staying put for at least `seconds` (plus a little slack)? */
    canBoard(lift, seconds)
    {
        if (lift.moving)
            return false;
        // Heading somewhere else (winding up, pausing at an end, or about to set off this very
        // step with its timer already run out): only if it waits long enough.
        const leaving = lift.goal !== lift.t;
        return !leaving || lift.waitTimer > seconds + BOARD_MARGIN;
    }

    /** No trail to follow (he is in the air, or just put her down): walk toward him if she can. */
    headFor(cat, feet, sammyFeet, solids, distance)
    {
        const stopX = sammyFeet.x - Math.sign(sammyFeet.x - feet.x) * (C.FOLLOW_STOP - .3);
        const span = walkSpan(cat, feet.x, feet.y, stopX, solids);
        // Stop out of the way: the clear spot nearest where she meant to stop, through a gateway if need be.
        const x = this.nearestClearX(cat, feet, span.x, solids) ?? this.clearOfTheWay(cat, feet, span.x);
        if (Math.abs(x - feet.x) > AT_TAKEOFF)
            return this.walk(cat, x, this.speedFor(distance), true);
        // Already as close as she can sensibly stand, with a clear walk to him: she's with him.
        if (canWalkTo(cat, feet, sammyFeet, solids))
            return this.rest(cat);
        return cat.drive(0);
    }

    /** The walkable spot nearest x (either side) where she's out of the way, or null. */
    nearestClearX(cat, feet, x, solids)
    {
        if (!this.inTheWay(cat, { x, y: feet.y }))
            return x;
        // Onward first (through the gateway, toward where she's going), then back.
        const toward = Math.sign(x - feet.x) || 1;
        for (const side of [toward, -toward])
            for (let d = .2; d <= ESCAPE_SEARCH + 1e-6; d += .2)
            {
                const at = x + side * d;
                if (!this.inTheWay(cat, { x: at, y: feet.y }) && !walkSpan(cat, feet.x, feet.y, at, solids).blocked)
                    return at;
            }
        return null;
    }

    /** goTo(): her own errand. Same moves as following; she stays once she's there. */
    toGoal(cat, feet, solids, riding)
    {
        const goal = this.goal;
        const dx = goal.x - feet.x, sameHeight = Math.abs(goal.y - feet.y) < SAME_HEIGHT;
        // Close enough, or already settled there (a nudge doesn't send her off again).
        if (sameHeight && Math.abs(dx) < (this.atGoal ? REACHED : AT_GOAL))
        {
            this.atGoal = true;
            this.state = 'idle';
            this.reason = null;
            return cat.drive(0, true);
        }
        this.atGoal = false;
        if (this.state === 'waiting' && (this.recheck -= timeDelta) > 0)
            return this.keepWaiting(cat, feet, solids);
        // The last stretch: ease in to stop right on the spot (a cat spot wants her just there).
        if (sameHeight && Math.abs(dx) < 1 && !walkSpan(cat, feet.x, feet.y, goal.x, solids).blocked)
            return this.walk(cat, goal.x, C.TROT_SPEED, true);
        return this.goToward(cat, feet, goal, solids, C.CATCHUP_DISTANCE, riding);
    }

    // --- doing it ---------------------------------------------------------------------------

    speedFor(distance)
    {
        return this.state === 'catchingUp' || distance > C.CATCHUP_DISTANCE ? C.CATCHUP_SPEED : C.TROT_SPEED;
    }

    /** exact: slow down to stop right at x (an edge, a wall). Otherwise trot on through it. */
    walk(cat, x, speed, exact)
    {
        const dx = x - cat.pos.x;
        cat.drive(exact ? clamp(dx * .3, -speed, speed) : Math.sign(dx) * speed);
        this.setMoving();
        this.trackStuck(cat);
    }

    jump(cat, leap)
    {
        this.leap = leap;
        cat.leap(leap.vx, leap.vy);
        this.setMoving();
        this.stuckTime = 0;
        this.waitedFor.clear();
    }

    steerInAir(cat)
    {
        // She keeps her heading through the air; a wall only stops her until she clears its top.
        if (this.leap)
            cat.velocity.x = this.leap.vx;
    }

    ride(cat)
    {
        cat.drive(0);
        cat.riding = true;
        this.stuckTime = 0;
    }

    setMoving()
    {
        if (this.state === 'waiting')
        {
            this.state = 'catchingUp';
            this.via = 'walked';
        }
        else if (this.state === 'idle')
            this.state = 'following';
        this.reason = null;
        this.escapeX = null;
    }

    /** brake: ease to a stop here (not when she's about to step aside). */
    rest(cat, brake = true)
    {
        if (brake)
            cat.drive(0, true);
        this.stuckTime = 0;
        if (this.state === 'catchingUp' || this.state === 'waiting')
        {
            // Sammy came back to her, or she made her way back to him.
            const via = this.state === 'waiting' ? 'met' : this.via;
            this.onCaughtUp(via);
        }
        this.state = 'idle';
        this.reason = null;
        this.waitedFor.clear();
    }

    /** She can't go on from here. If she's standing in a lift's way or a gateway she steps out
     *  first, but she is waiting all the same (so the next re-check doesn't walk her back in). */
    wait(cat, feet, solids, reason)
    {
        if (!(this.inTheWay(cat, feet) && this.stepOutOfTheWay(cat, feet, solids)))
            cat.drive(0);
        this.stuckTime = 0;
        this.enterWaiting(reason);
    }

    enterWaiting(reason)
    {
        this.recheck = C.WAIT_RECHECK;
        this.state = 'waiting';
        this.reason = reason;
        if (this.waitedFor.has(reason))
            return;   // the same hold-up (or one flip-flopping between reasons): one mrrp each is enough
        this.waitedFor.add(reason);
        this.onWaiting(reason);
    }

    keepWaiting(cat, feet, solids)
    {
        if (cat.groundObject?.mechanismType === 'lift')
            return this.ride(cat);   // waiting aboard: she stays on
        if (this.inTheWay(cat, feet) && this.stepOutOfTheWay(cat, feet, solids))
            return;
        cat.drive(0);
    }

    /** Walking but not getting anywhere (something the plan didn't expect): wait and re-check. */
    trackStuck(cat)
    {
        const moved = this.lastX === null ? 1 : Math.abs(cat.pos.x - this.lastX);
        this.lastX = cat.pos.x;
        this.stuckTime = moved < .002 ? this.stuckTime + timeDelta : 0;
        if (this.stuckTime >= C.STUCK_TIME)
        {
            this.stuckTime = 0;
            this.wait(cat, cat.feet, blockersFor(cat), 'ledge');
        }
    }

    /** Settled right under Sammy (he walked up to her, or asked her along): she steps to his
     *  side, behind him if she can, so she's never hidden behind the owl. Only while he stands
     *  still (walking past her is fine). Returns whether she's on her way. */
    giveRoom(cat, feet, player, solids)
    {
        const sammy = player.feetPos;
        const still = player.grounded && Math.abs(player.velocity.x) < .01 && Math.abs(feet.y - sammy.y) < SAME_HEIGHT;
        // A spot picked beside him where he stood: dropped once she's there, or if he moved, or if
        // the way there is no longer a plain walk.
        if (this.roomX !== null && (!still || Math.abs(this.roomX - cat.pos.x) < .1 || Math.abs(this.roomFor - sammy.x) > .05
            || walkSpan(cat, feet.x, feet.y, this.roomX, solids).blocked))
            this.roomX = null;
        else if (this.roomX === null && still && Math.abs(feet.x - sammy.x) < C.PERSONAL_SPACE)
        {
            const first = Math.sign(feet.x - sammy.x) || -player.facing;
            for (const side of [first, -first])
            {
                const x = sammy.x + side * C.ROOM_BESIDE;
                if (!this.inTheWay(cat, { x, y: feet.y }) && !walkSpan(cat, feet.x, feet.y, x, solids).blocked)
                {
                    this.roomX = x;
                    this.roomFor = sammy.x;
                    break;
                }
            }
        }
        if (this.roomX === null)
            return false;
        cat.drive(clamp((this.roomX - cat.pos.x) * .3, -C.TROT_SPEED, C.TROT_SPEED));
        return true;
    }

    // --- keeping out of the way (lift paths, gateways) --------------------------------------

    inTheWay(cat, feet, except = null)
    {
        return inTheWay(boxAt(cat, feet.x, feet.y), cat.size, this.zones, except);
    }

    /** x, or the nearest point back toward her from x where she's out of the way. */
    clearOfTheWay(cat, feet, x)
    {
        const back = Math.sign(feet.x - x);
        while (back && (feet.x - x) * back > 1e-6 && this.inTheWay(cat, { x, y: feet.y }))
            x = Math.abs(feet.x - x) <= .2 ? feet.x : x + back * .2;
        return x;
    }

    /** Walk to the nearest spot on this surface that's out of the way (`prefer`: the side to try
     *  first). With nowhere to go she eases to a stop (no sliding) and it returns undefined. */
    stepOutOfTheWay(cat, feet, solids, except = null, prefer = 1, sammyX = null)
    {
        if (this.escapeX === null || this.inTheWay(cat, { x: this.escapeX, y: feet.y }, except))
            this.escapeX = this.findClearSpot(cat, feet, solids, except, prefer || 1, sammyX);
        if (this.escapeX === null)
        {
            cat.drive(0, true);
            return undefined;
        }
        const dx = this.escapeX - cat.pos.x;
        cat.drive(clamp(dx * .3, -C.TROT_SPEED, C.TROT_SPEED));
        return true;
    }

    /** The nearest walkable spot out of the way. Ideally with room beside Sammy and on her side of
     *  him; if that's the only clear ground, right next to him or just past him will do. */
    findClearSpot(cat, feet, solids, except, prefer, sammyX = null)
    {
        const clear = x => !this.inTheWay(cat, { x, y: feet.y }, except) && !walkSpan(cat, feet.x, feet.y, x, solids).blocked;
        const roomy = x => sammyX === null
            || (Math.abs(x - sammyX) >= MIN_GAP_TO_SAMMY && Math.sign(x - sammyX) === Math.sign(feet.x - sammyX));
        for (const polite of [true, false])
            for (let d = .2; d <= ESCAPE_SEARCH + 1e-6; d += .2)
                for (const side of [prefer, -prefer])
                {
                    const x = feet.x + side * d;
                    if ((!polite || roomy(x)) && clear(x))
                        return x;
                }
        return null;
    }

    debugState()
    {
        return {
            state: this.state, reason: this.reason, held: this.held, leaping: !!this.leap,
            escapeX: this.escapeX, roomX: this.roomX, goal: this.goal, atGoal: this.atGoal, trail: this.trail.debugState(),
        };
    }
}

// What blocked her, as a waiting reason. A bridge that's in the way is a gap she's waiting to have
// bridged; anything else solid and unknown is treated like a gate.
const OBJECT_REASONS = { gate: 'gate', bridge: 'gap', lift: 'lift', door: 'door' };

/** Why she can't go on: what's in the way, or what the jump would need. */
function reasonFor(blocked, target, feet)
{
    if (target.lift)
        return 'lift';
    if (blocked && typeof blocked === 'object')
        return OBJECT_REASONS[blocked.mechanismType ?? blocked.interactType] ?? 'gate';
    if (target.y - feet.y > C.HOP_MAX_UP)
        return 'ledge';
    if (blocked === 'gap')
        return 'gap';
    return blocked === 'wall' || target.y - feet.y > SAME_HEIGHT ? 'ledge' : 'gap';
}

