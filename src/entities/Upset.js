// Upset (T-016): the base for anything a cat can calm with Comfort. The wind-up toy mouse
// (M2) is the first; Snowy with her collar stuck in her mouth (M3) is meant to be the next.
//
// A mechanism target (systems/Mechanisms.js): active = calm, or calming down. A cat spot drives
// it with mechanism:toggle {on: true} when her Comfort works. Something calm never gets upset
// again, so setActive(false) changes nothing (returns false).
//
// States (also debugState().state):
//   upset    frazzled: the subclass shows it (shaking, sweating) and may block the way
//   calming  eases from frazzled to calm over UPSET.CALM_TIME (`calmAmount` 0..1)
//   calm     done. On arriving here it does its job: the subclass's onCalmed() (move aside,
//            open up, ...) and, if it has `targets`, its own mechanism:toggle {id, on: true,
//            targets, by: 'upset'} so it can open a gate or lower a bridge in turn. Then
//            upset:calmed {id, kind} (kind = its entity type, so Audio can pick its sound).
// Snapped calm at level start (a startsOn lever), Mechanisms snaps its own targets too.
// While a cat is comforting it, the CatSpots system calls soothe(progress 0..1) each step, so
// the frazzle visibly settles before the moment it works.
//
// Subclass hooks: onCalming(), onCalmed(instant), and update logic of its own (call super.update()).
// `upsetAmount()` (1 frazzled .. 0 calm, soothing included) drives the frazzled look.
import { EngineObject, timeDelta } from 'littlejs';
import { emit } from '../core/events.js';
import { UPSET } from '../data/tuning.js';

export class Upset extends EngineObject
{
    /**
     * @param {Vector2} pos @param {Vector2} size
     * @param {{id:string, targets?:string[]}} props
     */
    constructor(pos, size, { id, targets = [] })
    {
        super(pos, size);
        this.id = id;
        this.targets = [...targets];
        this.state = 'upset';
        this.calmAmount = 0;
        this.soothing = 0;
        this.mass = 0;
    }

    get active() { return this.state !== 'upset'; }

    /** @returns {boolean} whether anything changed */
    setActive(on, { instant = false } = {})
    {
        if (!on || this.state !== 'upset')
            return false;
        this.state = 'calming';
        this.calmAmount = 0;
        this.onCalming();
        if (instant)
            this.finishCalming(true);
        return true;
    }

    /** A cat comforting it, `progress` 0..1 toward the moment it works. Never undoes itself. */
    soothe(progress)
    {
        this.soothing = Math.max(this.soothing, Math.min(1, Math.max(0, progress)));
    }

    /** The comfort was called off before it worked: back to fully frazzled. */
    unsoothe()
    {
        if (this.state === 'upset')
            this.soothing = 0;
    }

    /** 1 fully frazzled .. 0 calm. */
    upsetAmount()
    {
        const soothed = 1 - this.soothing * (1 - UPSET.SOOTHED_SHAKE);
        return this.state === 'calm' ? 0 : soothed * (1 - this.calmAmount);
    }

    update()
    {
        if (this.state !== 'calming')
            return;
        this.calmAmount = Math.min(1, this.calmAmount + timeDelta / UPSET.CALM_TIME);
        if (this.calmAmount >= 1)
            this.finishCalming(false);
    }

    finishCalming(instant)
    {
        this.state = 'calm';
        this.calmAmount = 1;
        this.onCalmed(instant);
        if (instant)
            return;   // level start: its own targets were set up as placed, silently
        if (this.targets.length)
            emit('mechanism:toggle', { id: this.id, on: true, targets: this.targets, by: 'upset' });
        emit('upset:calmed', { id: this.id, kind: this.mechanismType ?? 'upset' });
    }

    // --- hooks --------------------------------------------------------------------------------

    onCalming() {}
    /** @param {boolean} instant - snapped calm (no animation, no events) */
    onCalmed(instant) {}

    upsetDebugState()
    {
        return {
            id: this.id,
            role: this.mechanismRole,
            active: this.active,
            state: this.state,
            calm: Math.round(this.calmAmount * 1000) / 1000,
            soothing: Math.round(this.soothing * 1000) / 1000,
            targets: [...this.targets],
            pos: { x: this.pos.x, y: this.pos.y },
        };
    }

    debugState()
    {
        return { type: 'upset', ...this.upsetDebugState() };
    }
}
