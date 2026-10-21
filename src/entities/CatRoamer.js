// A cat at home (not the companion): she ambles gently between spots near her home and then
// does cat things for a while (TwyxAnimator's idle routine: sit, lick a paw, swish). She only
// wanders where she can walk (her own surface, no edges or walls), never into a lift's path, and
// stays put to watch Sammy while he's close. `radius` 0 keeps her where she is.
import { rand, timeDelta } from 'littlejs';
import { walkSpan, blockersFor, inTheWay, boxAt, SAME_HEIGHT } from '../systems/catNavigation.js';
import { COMPANION as C } from '../data/tuning.js';

const SPOT_TRIES = 6;

export class CatRoamer
{
    /**
     * @param {{x:number, y:number}} home - feet position she wanders around
     * @param {number} radius - tiles either side
     * @param {{player:() => (Sammy|null), keepClearZones:Array}} options
     */
    constructor(home, radius, { player = () => null, keepClearZones = [] } = {})
    {
        this.home = { x: home.x, y: home.y };
        this.radius = radius;
        this.player = player;
        this.zones = keepClearZones;
        this.goal = null;
        this.pause = rand(C.ROAM_PAUSE_MIN * .3, C.ROAM_PAUSE_MAX * .5);   // not all at once on arrival
    }

    get waiting() { return false; }

    update(cat)
    {
        if (!cat.grounded || this.radius <= 0 || this.sammyIsClose(cat))
        {
            this.goal = null;
            return cat.drive(0, true);
        }
        if (this.goal === null && (this.pause -= timeDelta) > 0)
            return cat.drive(0, true);
        const feet = cat.feet;
        if (this.goal === null)
            this.goal = this.pickSpot(cat, feet);
        if (this.goal === null || Math.abs(this.goal - feet.x) < .1)
            return this.arrive(cat);
        const span = walkSpan(cat, feet.x, feet.y, this.goal, blockersFor(cat));
        if (span.blocked && Math.abs(span.x - feet.x) < .1)
            return this.arrive(cat);   // something moved into the way (a gate closed): stop here
        const dx = span.x - cat.pos.x;
        cat.drive(Math.max(-C.ROAM_SPEED, Math.min(C.ROAM_SPEED, dx * .2)));
    }

    arrive(cat)
    {
        this.goal = null;
        this.pause = rand(C.ROAM_PAUSE_MIN, C.ROAM_PAUSE_MAX);
        cat.drive(0, true);
    }

    sammyIsClose(cat)
    {
        const player = this.player();
        return !!player && player.feetPos.distance(cat.feet) < C.ROAM_NOTICE;
    }

    /** A spot on her own surface, within reach of home, that she can walk straight to. */
    pickSpot(cat, feet)
    {
        if (Math.abs(feet.y - this.home.y) >= SAME_HEIGHT)
            this.home = { x: feet.x, y: feet.y };   // she's been moved (a lift, a bridge): this is home now
        const solids = blockersFor(cat);
        for (let i = 0; i < SPOT_TRIES; i++)
        {
            const x = this.home.x + rand(-this.radius, this.radius);
            if (Math.abs(x - feet.x) < 1)
                continue;
            if (inTheWay(boxAt(cat, x, feet.y), cat.size, this.zones))
                continue;
            if (!walkSpan(cat, feet.x, feet.y, x, solids).blocked)
                return x;
        }
        return null;
    }

    debugState()
    {
        return { state: 'roaming', goal: this.goal === null ? null : Math.round(this.goal * 1000) / 1000, home: this.home };
    }
}
