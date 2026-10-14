// A gate: a toy-brick wall that blocks the way until something opens it. A mechanism target:
// active = open. Placed in level data on the tile it stands on.
//   { type: 'gate', x, y, id, height? }
//   height - cells tall, counting up from its own cell (1..4, default 2)
// Starts closed. Solid while closed or mostly closed (cats wait at it); passable once it has
// sunk past GATE.PASSABLE_AT. Its collision box is exactly the drawn wall (gateWallTop), so it
// shrinks as it sinks and grows as it rises. Rising, it lifts anyone standing on it; anyone
// it closes or rises into is let out rather than trapped (BarrierGrace).
// Events: gate:move {id, open} when it starts moving.
import { EngineObject, vec2, smoothStep, time, timeDelta, isOnScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { drawGate, gateWallTop } from '../art/drawGate.js';
import { objectsStandingOn, solidGroundAt, solidObjectAt } from '../systems/terrainCollision.js';
import { BarrierGrace } from './BarrierGrace.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { GATE } from '../data/tuning.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import { requireId, allowOnlyProps, integerInRange, requireEmptyColumn } from './entityValidation.js';

const PROPS = ['id', 'height'];
const DEFAULT_HEIGHT = 2;
const WOBBLE_TIME = .45;

export class Gate extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        const height = integerInRange(entity, 'height', 1, 4, fail, DEFAULT_HEIGHT);
        requireEmptyColumn(entity, height, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile the gate stands on
     * @param {{id:string, height?:number}} props
     * @param {{timeOfDay?:string}} context
     */
    constructor(cellCenter, { id, height = DEFAULT_HEIGHT }, { timeOfDay } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, height / 2)), vec2(GATE.WIDTH, height));
        this.feet = feet;
        this.id = id;
        this.height = height;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.setCollision(true, true, false);   // blocks while closed (see collideWithObject)
        this.palette = mechanismPalette(timeOfDay);
        this.grace = new BarrierGrace();
        this.active = false;
        this.open = 0;          // 0 closed .. 1 sunk into its plate
        this.wobble = 0;
        this.drawExtent = vec2(2, height + 2);
    }

    get passable()
    {
        return this.open >= GATE.PASSABLE_AT;
    }

    /** @returns {boolean} whether anything changed */
    setActive(on, { instant = false } = {})
    {
        on = !!on;
        if (on === this.active)
            return false;
        this.active = on;
        if (instant)
            this.open = on ? 1 : 0;
        else
            emit('gate:move', { id: this.id, open: on });
        return true;
    }

    collideWithObject(other)
    {
        return !this.passable && !this.grace.excuses(other);
    }

    update()
    {
        const wasPassable = this.passable;
        const before = this.open;
        const rate = this.active ? 1 / GATE.OPEN_TIME : -1 / GATE.CLOSE_TIME;
        this.open = Math.min(1, Math.max(0, this.open + rate * timeDelta));
        this.fitToWall();
        if (wasPassable && !this.passable)
            this.grace.capture(this);
        if (before > 0 && this.open === 0)
            this.wobble = 1;   // bumps up against the top of its travel
        this.wobble = Math.max(0, this.wobble - timeDelta / WOBBLE_TIME);
        this.grace.update(this);
    }

    /** Match the collision box to the drawn wall. */
    fitToWall()
    {
        const top = gateWallTop(this.height, smoothStep(this.open));
        const grow = top - this.size.y;
        if (!grow)
            return;
        const standing = grow > 0 ? objectsStandingOn(this) : [];
        this.size = vec2(GATE.WIDTH, top);
        this.pos = this.feet.add(vec2(0, top / 2));
        for (const other of standing)
        {
            const lifted = other.pos.add(vec2(0, grow));
            if (!solidGroundAt(lifted, other.size) && !solidObjectAt(other, lifted, this))
                other.pos = lifted;
        }
        if (grow > 0 && !this.passable)
            this.grace.capture(this);   // anyone it rose into (and couldn't lift) may get out
    }

    render()
    {
        if (!isOnScreen(this.pos, this.drawExtent))
            return;
        drawGate(this.feet, {
            width: GATE.WIDTH, height: this.height, open: smoothStep(this.open), wobble: this.wobble,
            palette: this.palette,
        }, time);
    }

    debugState()
    {
        return {
            type: 'gate',
            id: this.id,
            role: this.mechanismRole,
            active: this.active,
            open: Math.round(this.open * 1000) / 1000,
            passable: this.passable,
            excused: this.grace.excused.size,   // objects it closed on, still allowed out
            pos: { x: this.pos.x, y: this.pos.y },
            size: { x: this.size.x, y: this.size.y },
        };
    }
}
