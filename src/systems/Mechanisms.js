// Mechanisms (T-014): the per-level registry of triggers (levers) and targets (bridges, gates,
// lifts), keyed by id. One is built with each level and destroyed with it.
//
// ACTIVATION API. Anything can drive targets by emitting on the bus; it does not need to be a
// lever, or even registered here (T-016 cat spots, T-017's portal lever):
//   emit('mechanism:toggle', { id: triggerId, on: true|false, targets: [targetId, ...] })
//       -> each target's setActive(on)
//   emit('mechanism:cycle', { id: triggerId, targets: [targetId, ...] })
//       -> each target's cycle() if it has one (e.g. a portal stepping to its next chapter),
//          otherwise it flips: setActive(!active)
// A target id that isn't in the level is reported with console.error (level data is validated
// at load, see validateMechanismLinks in entities/registry.js, so this only catches code bugs).
//
// A MEMBER is any level entity with `mechanismRole`. spawnEntity (entities/registry.js) sets
// mechanismRole and mechanismType from the type's registry entry (`mechanismTarget: true` or
// `mechanismTrigger: true`), so the classes don't repeat it.
//   mechanismRole     'trigger' (drives others) or 'target' (is driven)
//   mechanismType     'lever', 'bridge', 'gate', 'lift', ...
//   id                from level data
//   active            boolean (lever: all its targets on; bridge: lowered; gate: open; lift: at/heading to B)
//   setActive(on, {instant}) -> boolean, whether anything changed
//                     instant = snap with no animation and no events (level start)
//   cycle()           optional
//   targets           triggers only: the ids they drive
//   startsOn          triggers only: snap the targets active at level start
//   bindTargets(read) triggers only, optional: read() returns their targets' `active` flags
//   debugState()      plain data
//
// THE TARGET'S STATE IS THE TRUTH. Several triggers may share a target (a lever and a cat spot),
// so a trigger never trusts its own memory: a toggle lever counts as on exactly when all its
// targets are active, re-reads that right before a throw (then sends the opposite), and shows it.
//
// Level start: a lever placed with startsOn snaps its targets active, silently. Everything else
// starts inactive (bridges up, gates closed, lifts at their first point).
//
// SAVE: mechanism state is NOT saved (for now). Every level load (New Game, Continue at a
// checkpoint, a level change) rebuilds the level from data, so mechanisms start over as placed.
// A correction respawn keeps the level loaded, so mechanisms keep their state through it.
import { on } from '../core/events.js';

export class Mechanisms
{
    /** @param {string} levelId @param {Array<object>} entities - the level's spawned entities */
    constructor(levelId, entities)
    {
        this.levelId = levelId;
        this.members = new Map();
        for (const entity of entities)
            if (entity?.mechanismRole)
                this.members.set(entity.id, entity);
        this.unsubscribers = [];
    }

    /** Listen on the bus and apply startsOn levers. Call once the level is fully built. */
    start()
    {
        this.unsubscribers.push(on('mechanism:toggle', ({ targets = [], on: active } = {}) =>
            targets.forEach(id => this.drive(id, target => target.setActive(!!active)))));
        this.unsubscribers.push(on('mechanism:cycle', ({ targets = [] } = {}) =>
            targets.forEach(id => this.drive(id, target =>
                target.cycle ? target.cycle() : target.setActive(!target.active)))));
        for (const trigger of this.triggers())
        {
            if (trigger.startsOn)
                trigger.targets.forEach(id => this.snapOn(id));
            trigger.bindTargets?.(() => trigger.targets.map(id => !!this.members.get(id)?.active));
        }
    }

    /** Level start: snap a target active, silently, and any targets of its own (an Upset that
     *  starts calm has already done its job). `seen` stops a loop of targets naming each other. */
    snapOn(id, seen = new Set())
    {
        if (seen.has(id))
            return;
        seen.add(id);
        this.drive(id, target => target.setActive(true, { instant: true }));
        for (const next of this.members.get(id)?.targets ?? [])
            this.snapOn(next, seen);
    }

    triggers()
    {
        return [...this.members.values()].filter(member => member.mechanismRole === 'trigger');
    }

    drive(id, action)
    {
        const target = this.members.get(id);
        if (target?.mechanismRole !== 'target')
            return void console.error(`level "${this.levelId}": no mechanism target "${id}"`);
        action(target);
    }

    /** Debug: set a member by id. A lever is thrown (and drives its targets); a target is set
     *  directly. Returns whether anything changed (false for an unknown id). */
    activate(id, active = true)
    {
        const member = this.members.get(id);
        if (!member)
        {
            console.error(`level "${this.levelId}": no mechanism "${id}" (have: ${[...this.members.keys()].join(', ')})`);
            return false;
        }
        return !!member.setActive(!!active);
    }

    destroy()
    {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        this.members.clear();
    }

    /** Plain data for window.__sammy.mechanisms. */
    debugState()
    {
        return [...this.members.values()].filter(member => !member.destroyed).map(member => member.debugState());
    }
}
