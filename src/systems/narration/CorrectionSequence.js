// The "rewrite" that follows a correction: scribble the page out, put Sammy back while the
// page is covered, then unscribble. Gameplay input is locked for the whole thing.
//
// Emits correction:reset {zoneId} at the midpoint (the player/level system moves Sammy then)
// and correction:done {zoneId} at the end.
import { emit } from '../../core/events.js';
import { lockGameplay, unlockGameplay } from '../../core/input.js';
import { CORRECTION } from '../../data/tuning.js';

const LOCK_REASON = 'correction';

export class CorrectionSequence
{
    constructor()
    {
        this.active = null;
        this.count = 0;   // used as a seed so each scribble looks different
    }

    get running() { return !!this.active; }

    /** Returns false if a correction is already running (overlapping zones fire together). */
    start(zoneId)
    {
        if (this.active)
            return false;
        lockGameplay(LOCK_REASON);
        this.active = { zoneId, t: 0, resetSent: false, seed: ++this.count };
        return true;
    }

    update(dt)
    {
        const active = this.active;
        if (!active)
            return;
        active.t += dt;
        if (!active.resetSent && active.t >= CORRECTION.SCRIBBLE_IN)
        {
            active.resetSent = true;
            emit('correction:reset', { zoneId: active.zoneId });
        }
        if (active.t >= totalDuration())
            this.finish();
    }

    finish()
    {
        const { zoneId } = this.active;
        this.active = null;
        unlockGameplay(LOCK_REASON);
        emit('correction:done', { zoneId });
    }

    /** Stop without events (host scene leaving). Always releases the input lock. */
    cancel()
    {
        this.active = null;
        unlockGameplay(LOCK_REASON);
    }

    /** { phase: 'in'|'hold'|'out', progress 0..1 within the phase, seed } or null. */
    visualState()
    {
        if (!this.active)
            return null;
        const { t, seed } = this.active;
        const { SCRIBBLE_IN, HOLD, SCRIBBLE_OUT } = CORRECTION;
        if (t < SCRIBBLE_IN)
            return { phase: 'in', progress: t / SCRIBBLE_IN, seed };
        if (t < SCRIBBLE_IN + HOLD)
            return { phase: 'hold', progress: (t - SCRIBBLE_IN) / HOLD, seed };
        return { phase: 'out', progress: Math.min(1, (t - SCRIBBLE_IN - HOLD) / SCRIBBLE_OUT), seed };
    }

    debugState()
    {
        if (!this.active)
            return null;
        const { zoneId, resetSent } = this.active;
        return { zoneId, phase: this.visualState().phase, resetSent };
    }
}

function totalDuration()
{
    return CORRECTION.SCRIBBLE_IN + CORRECTION.HOLD + CORRECTION.SCRIBBLE_OUT;
}
