// The time of day in an indoor environment: a clock t in 0..1 (0 = midnight, .5 = noon) that
// goes round once per `period` seconds of game time, and the look of the world at that moment.
// The cycle's data is in data/dayCycle.js.
//
// The host calls tick(dt) once per update step (it freezes under the pause menu with the rest
// of the level). setTime(t) jumps (tests and debug).
//
// Events emitted:
//   daycycle:phase {phase}   the phase (dawn, day, dusk, night) changed; also sent once when
//                            the cycle starts, so listeners know the phase a visit begins in
import { Color, smoothStep } from 'littlejs';
import { emit } from '../core/events.js';

/** The fields every key of a cycle's look carries (data/dayCycle.js): colors, then 0..1 amounts. */
export const LOOK_COLORS = ['skyTop', 'skyMid', 'skyHorizon', 'ambient', 'viewTint', 'beam', 'spill'];
export const LOOK_AMOUNTS = ['stars', 'clouds', 'dayView', 'fairy'];

export class DayCycle
{
    /** @param {object} config - an entry of DAY_CYCLES  @param {number} [start] - t to start at */
    constructor(config, start = config.start)
    {
        this.config = config;
        this.t = wrap(start);
        this.phase = this.phaseAt(this.t);
        // One look object, refilled in place: it is read by several systems every frame.
        this.current = Object.fromEntries([...LOOK_COLORS.map(key => [key, new Color()]), ...LOOK_AMOUNTS.map(key => [key, 0])]);
        this.sample();
        emit('daycycle:phase', { phase: this.phase });
    }

    tick(dt)
    {
        if (this.config.period > 0)
            this.setTime(this.t + dt / this.config.period);
    }

    setTime(t)
    {
        this.t = wrap(t);
        this.sample();
        const phase = this.phaseAt(this.t);
        if (phase === this.phase)
            return;
        this.phase = phase;
        emit('daycycle:phase', { phase });
    }

    phaseAt(t)
    {
        const match = this.config.phases.find(({ from, to }) => t >= from && t < to);
        return match ? match.phase : this.config.otherwise;
    }

    /** The current look (see data/dayCycle.js for the fields). Shared and reused: don't keep it. */
    get look() { return this.current; }

    /** How far a sky body ({rise, set}) is across the sky: {u: 0 rising .. 1 setting, up: 0..1
     *  height}, or null while it is below the horizon. */
    body(name)
    {
        const { rise, set } = this.config[name];
        let t = this.t;
        if (t < rise)
            t += 1;   // a moon that sets after midnight
        const u = (t - rise) / (set - rise);
        return u >= 0 && u <= 1 ? { u, up: Math.sin(u * Math.PI) } : null;
    }

    /** Should the nightlight be on? (It switches on in the evening and off in the morning.) */
    get nightlightOn()
    {
        const { on, off } = this.config.nightlight;
        return on > off ? this.t >= on || this.t < off : this.t >= on && this.t < off;
    }

    sample()
    {
        const keys = this.config.keys;
        let next = keys.findIndex(key => key.t > this.t);
        if (next < 0)
            next = 0;
        const prev = (next + keys.length - 1) % keys.length;
        const a = keys[prev], b = keys[next];
        const span = wrap(b.t - a.t) || 1;
        const blend = smoothStep(wrap(this.t - a.t) / span);
        for (const key of LOOK_COLORS)
            this.current[key].set(...lerpColor(a[key], b[key], blend));
        for (const key of LOOK_AMOUNTS)
            this.current[key] = a[key] + (b[key] - a[key]) * blend;
    }

    debugState()
    {
        return { t: Math.round(this.t * 1e4) / 1e4, phase: this.phase, period: this.config.period, nightlightOn: this.nightlightOn };
    }
}

function lerpColor(a, b, blend)
{
    return [a.r + (b.r - a.r) * blend, a.g + (b.g - a.g) * blend, a.b + (b.b - a.b) * blend, a.a + (b.a - a.a) * blend];
}

function wrap(t)
{
    return ((t % 1) + 1) % 1;
}
