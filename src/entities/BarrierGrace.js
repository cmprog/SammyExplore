// Lets anything already inside a barrier get out when the barrier turns solid (a gate closing
// on Sammy, a bridge landing on him mid-flap). The engine can only push an object that starts
// a step overlapping a solid one out very slowly, so it would look stuck. Instead the barrier
// ignores those objects until they are clear of it. Used by Bridge and Gate.
import { engineObjectsCollide } from 'littlejs';

export class BarrierGrace
{
    constructor()
    {
        this.excused = new Set();
    }

    /** The barrier just became solid: excuse every moving object overlapping it right now. */
    capture(barrier)
    {
        for (const other of engineObjectsCollide)
            if (other !== barrier && other.mass > 0 && !other.destroyed && barrier.isOverlappingObject(other))
                this.excused.add(other);
    }

    /** Forget objects that have got clear (or are gone). Call every update. */
    update(barrier)
    {
        for (const other of this.excused)
            if (other.destroyed || !barrier.isOverlappingObject(other))
                this.excused.delete(other);
    }

    excuses(other)
    {
        return this.excused.has(other);
    }

    clear()
    {
        this.excused.clear();
    }
}
