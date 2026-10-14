// A lever: the trigger Sammy throws with E. Placed in level data on the tile it stands on.
//   { type: 'lever', x, y, id, targets: [ids], startsOn?, oneWay?, mode? }
//   targets   - ids of mechanism targets (bridges, gates, lifts) it drives; checked at load
//   startsOn  - placed thrown; its targets start active (snapped, silently)
//   oneWay    - can only be thrown on: once thrown, E has nothing more to offer
//   mode      - 'toggle' (default): E flips it and emits mechanism:toggle {id, on, targets}
//               'cycle': E throws it and it springs back, emitting mechanism:cycle {id, targets}
//               every time (T-017's portal lever steps through chapters this way)
//
// The targets' real state is the truth (see systems/Mechanisms.js): a toggle lever is "on"
// exactly when all its targets are active, re-reads that before every throw (then sends the
// opposite), and its handle follows it, so if a cat spot or another lever changes a shared
// target, this lever shows it.
//
// Interactable (systems/Interaction.js emits interact:lever {id}). A mechanism trigger
// (systems/Mechanisms.js turns its events into target moves; Audio clunks on them).
// Not solid: Sammy and cats walk past it.
import { EngineObject, vec2, rand, time, timeDelta, isOnScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { drawLever, drawLeverSpark, LEVER_TOP, LEVER_PIVOT } from '../art/drawLever.js';
import { ParticleField } from './ParticleField.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { LEVER } from '../data/tuning.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import {
    requireId, allowOnlyProps, optionalBoolean, optionalOneOf, requireTargetList, requireEmptyColumn,
} from './entityValidation.js';

const PROPS = ['id', 'targets', 'startsOn', 'oneWay', 'mode'];
const MODES = ['toggle', 'cycle'];
const SIZE = vec2(.8, 1);
const DRAW_EXTENT = vec2(2.5, 3);

export class Lever extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        requireTargetList(entity, fail);
        optionalBoolean(entity, 'startsOn', fail);
        optionalBoolean(entity, 'oneWay', fail);
        optionalOneOf(entity, 'mode', MODES, fail);
        if (entity.mode === 'cycle' && (entity.oneWay || entity.startsOn))
            fail(`lever "${entity.id}" is a cycle lever: it springs back, so it can't be oneWay or startsOn`);
        requireEmptyColumn(entity, 1, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile the lever stands on
     * @param {{id:string, targets:string[], startsOn?:boolean, oneWay?:boolean, mode?:string}} props
     * @param {{timeOfDay?:string}} context
     */
    constructor(cellCenter, { id, targets, startsOn = false, oneWay = false, mode = 'toggle' }, { timeOfDay } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, SIZE.y / 2)), SIZE.copy());
        this.feet = feet;
        this.id = id;
        this.targets = [...targets];
        this.oneWay = oneWay;
        this.mode = mode;
        this.startsOn = mode === 'toggle' && startsOn;   // Mechanisms snaps the targets on at level start
        this.on = this.startsOn;
        this.spent = oneWay && this.startsOn;             // a one-way lever that has been thrown
        this.readTargets = null;                          // () => [active, ...], from bindTargets
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.setCollision(false, false, false);
        this.palette = mechanismPalette(timeOfDay);
        this.fx = new ParticleField();

        this.handleAngle = this.restAngle();
        this.handleSpeed = 0;
        this.squashTimer = 0;
        this.pulseTimer = 0;
        this.throws = 0;

        // Interactable contract (see systems/Interaction.js)
        this.interactType = 'lever';
        this.interactRadius = LEVER.RADIUS;
    }

    /** Mechanisms hands over a way to read the targets' state (see the header). */
    bindTargets(readTargets)
    {
        this.readTargets = readTargets;
        this.syncFromTargets();
        this.handleAngle = this.restAngle();
    }

    syncFromTargets()
    {
        if (this.mode !== 'toggle' || !this.readTargets)
            return;
        const states = this.readTargets();
        this.on = states.length > 0 && states.every(Boolean);
    }

    get active() { return this.on; }

    get interactPos() { return this.pos; }
    get promptPos()   { return this.feet.add(vec2(0, LEVER_TOP + .05)); }

    /** A one-way lever that has been thrown has nothing more to offer. */
    canInteract()
    {
        return !this.spent;
    }

    interactPayload()
    {
        return { id: this.id };
    }

    interact()
    {
        this.syncFromTargets();
        this.setActive(this.mode === 'cycle' || !this.on);
    }

    /** Throw the lever to `on` (a cycle lever: throw it once, if `on`). Drives its targets.
     *  @returns {boolean} whether it was thrown */
    setActive(on, { instant = false } = {})
    {
        if (this.mode === 'cycle')
        {
            if (on)
                this.pulse();
            return !!on;
        }
        this.syncFromTargets();
        on = !!on;
        if (on === this.on || this.spent)
            return false;
        this.on = on;
        this.spent = this.oneWay && on;
        if (instant)
        {
            this.handleAngle = this.restAngle();
            this.handleSpeed = 0;
            return true;
        }
        this.kick();
        emit('mechanism:toggle', { id: this.id, on, targets: this.targets });
        return true;
    }

    pulse()
    {
        this.pulseTimer = LEVER.PULSE_HOLD;
        this.kick();
        emit('mechanism:cycle', { id: this.id, targets: this.targets });
    }

    restAngle()
    {
        return this.on || this.pulseTimer > 0 ? -LEVER.THROW_ANGLE : LEVER.THROW_ANGLE;
    }

    kick()
    {
        this.throws++;
        this.squashTimer = LEVER.SQUASH_TIME;
        const angle = this.restAngle();   // where the knob is headed
        const knob = this.feet.add(vec2(-Math.sin(angle), Math.cos(angle)).scale(LEVER_TOP - LEVER_PIVOT).add(vec2(0, LEVER_PIVOT)));
        const colors = [this.palette.star, ...this.palette.bricks];
        for (let i = 0; i < LEVER.SPARKS; i++)
        {
            const a = Math.PI / 2 + rand(-1.2, 1.2);
            this.fx.add({
                draw: drawLeverSpark,
                pos: knob.copy(),
                vel: vec2(Math.cos(a), Math.sin(a)).scale(LEVER.SPARK_SPEED * rand(.5, 1)),
                life: LEVER.SPARK_LIFE * rand(.7, 1.1),
                gravity: 3,
                drag: 2,
                spin: rand(-6, 6),
                angle: rand(0, 6.28),
                size: rand(.07, .12),
                color: colors[i % colors.length],
            });
        }
    }

    update()
    {
        this.squashTimer = Math.max(0, this.squashTimer - timeDelta);
        this.pulseTimer = Math.max(0, this.pulseTimer - timeDelta);
        this.syncFromTargets();   // another trigger may have moved a shared target
        // A springy handle: it overshoots its stop a little and wobbles to rest.
        this.handleSpeed = (this.handleSpeed + (this.restAngle() - this.handleAngle) * LEVER.SPRING) * LEVER.DAMPING;
        this.handleAngle += this.handleSpeed;
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        const squashT = this.squashTimer / LEVER.SQUASH_TIME;
        drawLever(this.feet, {
            handleAngle: this.handleAngle,
            squash: LEVER.SQUASH * Math.sin(squashT * Math.PI) * squashT,
            on: this.on || this.pulseTimer > 0,
            locked: this.spent,
            palette: this.palette,
        }, time);
    }

    debugState()
    {
        return {
            type: 'lever',
            id: this.id,
            role: this.mechanismRole,
            active: this.on,
            spent: this.spent,
            mode: this.mode,
            oneWay: this.oneWay,
            targets: [...this.targets],
            throws: this.throws,
            handleAngle: Math.round(this.handleAngle * 1000) / 1000,
            pos: { x: this.pos.x, y: this.pos.y },
        };
    }
}
