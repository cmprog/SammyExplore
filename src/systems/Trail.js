// Sammy's recent ground path, as breadcrumbs for the companion to follow. Only ground is
// remembered (where he stood), never the air: a cat can't follow a flap or a glide, so a jump
// shows up as two crumbs with nothing between them (the second marked `air`), and the cat works
// out for herself whether she can make that hop.
//
// A crumb is { x, y, air } (his feet, world space), or { lift, air } while he rides a lift: a
// lift moves, so its crumb means "get on this lift" rather than a place.
// The companion consumes crumbs from the front as she reaches them (see CatFollower).
import { COMPANION } from '../data/tuning.js';

export class Trail
{
    constructor()
    {
        this.crumbs = [];
        this.wasGrounded = true;
    }

    clear()
    {
        this.crumbs = [];
    }

    get length()
    {
        return this.crumbs.length;
    }

    /** Call once per step, after physics. @param {Sammy} player */
    record(player)
    {
        if (!player.grounded)
        {
            this.wasGrounded = false;
            return;
        }
        const air = !this.wasGrounded;
        this.wasGrounded = true;
        const feet = player.feetPos;
        const ground = player.groundObject;
        const last = this.crumbs.at(-1);
        if (ground?.mechanismType === 'lift')
        {
            if (last?.lift !== ground)
                this.push({ lift: ground, air });
            return;
        }
        if (!last || air || last.lift || Math.hypot(feet.x - last.x, feet.y - last.y) >= COMPANION.CRUMB_SPACING)
            this.push({ x: feet.x, y: feet.y, air });
    }

    push(crumb)
    {
        this.crumbs.push(crumb);
        if (this.crumbs.length > COMPANION.TRAIL_MAX)
            this.crumbs.splice(1, 1);   // keep the one she is heading for
    }

    /** Plain data for the debug hook: the first few crumbs and how many there are. */
    debugState()
    {
        const plain = crumb => crumb.lift
            ? { lift: crumb.lift.id, air: crumb.air }
            : { x: round(crumb.x), y: round(crumb.y), air: crumb.air };
        return { length: this.crumbs.length, next: this.crumbs.slice(0, 3).map(plain) };
    }
}

function round(value)
{
    return Math.round(value * 1000) / 1000;
}
