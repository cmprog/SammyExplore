// A drawbridge (a wooden ruler on a string). A mechanism target: active = lowered.
//   { type: 'bridge', x, y, id, length, hinge? }
//   x, y    - the first gap cell it spans (leftmost); it spans `length` cells of row y, and its
//             top is flush with the top of that row ("surface row", see registry.js): level with
//             ground in the same row
//   length  - cells spanned (1..12)
//   hinge   - 'left' (default) or 'right': the ledge it is hinged on (its post stands there)
// Starts raised. Solid (Sammy and cats stand on it) once lowered past BRIDGE.SOLID_AT; not
// solid while raised or on the way up. It never raises while anyone stands on it: switched off,
// it waits (`held`) until they have stepped off, then rises.
// Events: bridge:move {id, down} when it actually starts moving (so a held raise is announced
// when it finally goes up).
import { EngineObject, vec2, rand, time, timeDelta, isOnScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { drawBridge } from '../art/drawBridge.js';
import { drawDust } from '../art/drawSammyFx.js';
import { ParticleField } from './ParticleField.js';
import { BarrierGrace } from './BarrierGrace.js';
import { objectsStandingOn, settleObjectsOnTop } from '../systems/terrainCollision.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { BRIDGE } from '../data/tuning.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import {
    requireId, allowOnlyProps, optionalOneOf, integerInRange, requireEmptyRect, entityLabel,
} from './entityValidation.js';

const PROPS = ['id', 'length', 'hinge'];
const MAX_LENGTH = 12;
const BOUNCE = .025;   // how far (as a fraction of the drop) it bounces back up on landing

export class Bridge extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        const length = integerInRange(entity, 'length', 1, MAX_LENGTH, fail);
        optionalOneOf(entity, 'hinge', ['left', 'right'], fail);
        const { x, y } = entity;
        requireEmptyRect(entity, { x0: x, y0: y, x1: x + length - 1, y1: y }, `its span (${length} cells)`, fail, level);
        const post = entity.hinge === 'right' ? x + length : x - 1;
        if (post < 0 || post >= level.tileMap[0].length)
            fail(`${entityLabel(entity)}: its hinge post at column ${post} is outside the map`);
    }

    /**
     * @param {Vector2} cellCenter - center of the first cell it spans
     * @param {{id:string, length:number, hinge?:string}} props
     * @param {{timeOfDay?:string}} context
     */
    constructor(cellCenter, { id, length, hinge = 'left' }, { timeOfDay } = {})
    {
        const left = cellCenter.x - .5, top = cellCenter.y + .5;
        super(vec2(left + length / 2, top - BRIDGE.THICKNESS / 2), vec2(length, BRIDGE.THICKNESS));
        this.id = id;
        this.length = length;
        this.dir = hinge === 'left' ? 1 : -1;
        this.hinge = vec2(hinge === 'left' ? left : left + length, top);
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;                        // static: never moved by physics
        this.setCollision(true, true, false); // solid once lowered (see collideWithObject)
        this.palette = mechanismPalette(timeOfDay);
        this.grace = new BarrierGrace();
        this.fx = new ParticleField();
        this.active = false;
        this.lowered = 0;                     // 0 raised .. 1 down (SOLID_AT = touchdown)
        this.spool = 0;
        this.held = false;                    // someone is on it, so it won't raise yet
        this.announced = false;               // the direction last announced by bridge:move (true = down)
        this.drawExtent = vec2(length * 2 + 2, length * 2 + 2);
    }

    get solid()
    {
        return this.lowered >= BRIDGE.SOLID_AT;
    }

    /** @returns {boolean} whether anything changed */
    setActive(on, { instant = false } = {})
    {
        on = !!on;
        if (on === this.active)
            return false;
        this.active = on;
        if (instant)
        {
            this.lowered = on ? 1 : 0;
            this.announced = on;
        }
        return true;
    }

    /** Pure (ground probes call it too): solid once lowered, except to anyone it landed on. */
    collideWithObject(other)
    {
        return this.solid && !this.grace.excuses(other);
    }

    updatePhysics()
    {
        super.updatePhysics();
        if (this.solid)
            settleObjectsOnTop(this, other => !this.grace.excuses(other));
    }

    update()
    {
        const wasSolid = this.solid;
        const before = this.lowered;
        this.held = !this.active && this.solid && objectsStandingOn(this).length > 0;
        if (!this.held)
        {
            const rate = this.active ? 1 / BRIDGE.LOWER_TIME : -1 / BRIDGE.RAISE_TIME;
            this.lowered = Math.min(1, Math.max(0, this.lowered + rate * timeDelta));
        }
        if (this.lowered !== before && this.announced !== this.active)
        {
            this.announced = this.active;
            emit('bridge:move', { id: this.id, down: this.active });
        }
        this.spool += (this.lowered - before) * 9;
        if (this.solid && !wasSolid)
        {
            this.grace.capture(this);
            if (this.active)
                this.puffDust();
        }
        this.grace.update(this);
    }

    /** Radians up from flat: falls faster and faster, lands, bounces a touch. Raising plays the
     *  same curve backward, so it leaps up off the ground and slows to a stop at the top. */
    plankAngle()
    {
        const p = this.lowered, land = BRIDGE.SOLID_AT;
        const drop = p < land ? (p / land) ** 2 : 1 - Math.sin((p - land) / (1 - land) * Math.PI) * BOUNCE;
        return BRIDGE.RAISED_ANGLE * (1 - drop);
    }

    puffDust()
    {
        for (let i = 0; i < 6; i++)
        {
            const along = this.dir * this.length * rand(.3, 1);
            this.fx.add({
                draw: drawDust,
                pos: this.hinge.add(vec2(along, -BRIDGE.THICKNESS)),
                vel: vec2(rand(-1, 1), rand(.3, 1)),
                life: rand(.35, .6),
                drag: 3,
                gravity: -.5,
                size: rand(.2, .32),
            });
        }
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    render()
    {
        if (!isOnScreen(this.hinge, this.drawExtent))
            return;
        drawBridge(this.hinge, {
            length: this.length, thickness: BRIDGE.THICKNESS, angle: this.plankAngle(), dir: this.dir,
            spool: this.spool, palette: this.palette,
        }, time);
    }

    debugState()
    {
        return {
            type: 'bridge',
            id: this.id,
            role: this.mechanismRole,
            active: this.active,
            lowered: Math.round(this.lowered * 1000) / 1000,
            solid: this.solid,
            held: this.held,
            excused: this.grace.excused.size,
            pos: { x: this.pos.x, y: this.pos.y },
            size: { x: this.size.x, y: this.size.y },
        };
    }
}
