// A lift: a balloon-carried brick plate that travels between two points. A mechanism target:
// active = at (or heading to) its second point. Placed in level data by its plate's left cell.
//   { type: 'lift', x, y, id, toX, toY, width?, loop? }
//   x, y      - left cell of the plate at its first point (A); the plate's top is flush with the
//               top of that row ("surface row", see registry.js), so it lines up with ground in
//               the same row. A needs standable ground right beside it (left or right).
//   toX, toY  - the same cell at its second point (B); any direction
//   width     - cells wide (1..6, default 2)
//   loop      - false (default): active goes to B, inactive comes back to A.
//               true: while active it shuttles A <-> B, pausing at each end; switched off, it
//               finishes the trip it is on and stops there.
// The whole path must be free of solid tiles (plus LIFT.HEADROOM rows above it), of doors, gates
// and bridges, and of spawn and checkpoint zones (checked across the level in registry.js).
//
// Riding: the engine does not carry objects standing on a moving solid (it only blends ground
// velocity through friction, and Sammy's friction is 1), and a platform that moves into its
// rider during physics makes the rider sink into it. So the lift moves itself in updatePhysics
// and moves its riders by exactly the same amount in the same step: no jitter going up, no
// falling through going down. A rider is carried in any direction unless that would put them
// into solid ground or a blocking object (a closed gate or door); then they are left where they
// are (moving sideways, the plate slides out from under them). The lift never squashes anyone:
// if the next step would push into someone it isn't carrying, it waits (lift:held).
// Events: lift:move {id, toward: 'a'|'b'} as it sets off, lift:arrive {id, at: 'a'|'b'},
// lift:held {id} when it starts waiting for someone to get out of the way.
import { EngineObject, vec2, smoothStep, isOverlapping, engineObjectsCollide, time, timeDelta, isOnScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { drawLift, drawLiftPath } from '../art/drawLift.js';
import { solidGroundAt, solidObjectAt, objectsStandingOn, settleObjectsOnTop } from '../systems/terrainCollision.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { LIFT } from '../data/tuning.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import {
    requireId, allowOnlyProps, optionalBoolean, integerInRange, requireEmptyRect, entityLabel,
} from './entityValidation.js';

const PROPS = ['id', 'toX', 'toY', 'width', 'loop'];
const DEFAULT_WIDTH = 2;

export class Lift extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        optionalBoolean(entity, 'loop', fail);
        const columns = level.tileMap[0].length, rows = level.tileMap.length;
        const width = integerInRange(entity, 'width', 1, 6, fail, DEFAULT_WIDTH);
        integerInRange(entity, 'toX', 0, columns - width, fail);
        integerInRange(entity, 'toY', 0, rows - 1, fail);
        const { x, y } = entity;
        if (x + width > columns)
            fail(`${entityLabel(entity)}: a ${width}-wide plate pokes out of the right of the map`);
        if (entity.toX === x && entity.toY === y)
            fail(`${entityLabel(entity)}: toX/toY is where it starts, so it would never move`);
        const path = Lift.pathCells(entity);
        requireEmptyRect(entity, path, 'its path', fail, level);
        const headroom = { ...path, y0: Math.max(0, path.y0 - LIFT.HEADROOM), y1: path.y0 - 1 };
        if (headroom.y1 >= headroom.y0)
            requireEmptyRect(entity, headroom, `the ${LIFT.HEADROOM} rows of headroom above its path`, fail, level);
        const standable = col => col >= 0 && col < columns && TILE_TYPES[level.legend[level.tileMap[y][col]]].collision;
        if (!standable(x - 1) && !standable(x + width))
            fail(`${entityLabel(entity)}: at its first point it needs ground to step on from, right beside it in row ${y}`);
    }

    /** Tile cells the plate sweeps between A and B (inclusive rect in level coordinates). */
    static pathCells({ x, y, toX, toY, width = DEFAULT_WIDTH })
    {
        return { x0: Math.min(x, toX), x1: Math.max(x, toX) + width - 1, y0: Math.min(y, toY), y1: Math.max(y, toY) };
    }

    /**
     * @param {Vector2} cellCenter - center of the plate's left cell at A
     * @param {{id:string, toX:number, toY:number, width?:number, loop?:boolean}} props
     * @param {{timeOfDay?:string, levelSize:{x:number, y:number}}} context
     */
    constructor(cellCenter, { id, toX, toY, width = DEFAULT_WIDTH, loop = false }, { timeOfDay, levelSize })
    {
        const half = vec2(width / 2, -LIFT.THICKNESS / 2);
        const a = vec2(cellCenter.x - .5, cellCenter.y + .5).add(half);
        super(a.copy(), vec2(width, LIFT.THICKNESS));
        this.a = a;
        this.b = vec2(toX, levelSize.y - toY).add(half);
        this.id = id;
        this.loop = loop;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;                        // moves itself (see updatePhysics), never by gravity
        this.setCollision(true, true, false); // always solid
        this.palette = mechanismPalette(timeOfDay);
        this.active = false;
        this.t = 0;                           // 0 at A .. 1 at B (position eases with smoothStep)
        this.goal = 0;
        this.waitTimer = 0;                   // winding up before setting off / pausing at an end
        this.moving = false;
        this.held = false;                    // waiting for someone to get out of the way
        this.holds = 0;
        this.riderCount = 0;
        this.key = 0;
        const distance = this.a.distance(this.b);
        this.legRate = LIFT.SPEED / (1.5 * distance);   // smoothStep peaks at 1.5x the average speed
        this.drawCenter = this.a.lerp(this.b, .5).add(vec2(0, 1));
        this.drawExtent = vec2(Math.abs(this.a.x - this.b.x) + width + 3, Math.abs(this.a.y - this.b.y) + 6);
    }

    get top() { return this.pos.y + this.size.y / 2; }

    /** @returns {boolean} whether anything changed */
    setActive(on, { instant = false } = {})
    {
        on = !!on;
        if (on === this.active)
            return false;
        this.active = on;
        if (this.loop)
        {
            on ? this.startLoop() : this.stopLoop();
            return true;
        }
        this.goal = on ? 1 : 0;
        if (instant)
        {
            this.t = this.goal;
            this.pos = this.positionAt(this.t);
        }
        else if (this.moving)
            this.depart();                    // turned around mid-trip: no second wind-up
        else
            this.waitTimer = LIFT.START_DELAY;
        return true;
    }

    startLoop()
    {
        if (this.moving)
            return;                           // already on its way; it carries on looping from there
        this.goal = this.t < .5 ? 1 : 0;
        this.waitTimer = LIFT.START_DELAY;
    }

    stopLoop()
    {
        if (!this.moving)
        {
            this.goal = this.t;               // waiting at an end: stay there
            this.waitTimer = 0;
        }
    }

    positionAt(t)
    {
        return this.a.lerp(this.b, smoothStep(t));
    }

    depart()
    {
        this.waitTimer = 0;
        this.moving = true;
        emit('lift:move', { id: this.id, toward: this.goal === 1 ? 'b' : 'a' });
    }

    arrive()
    {
        this.moving = false;
        emit('lift:arrive', { id: this.id, at: this.goal === 1 ? 'b' : 'a' });
        if (this.loop && this.active)
        {
            this.goal = 1 - this.goal;
            this.waitTimer = LIFT.END_PAUSE;
        }
    }

    // Runs in the engine's physics pass instead of the default (see the header).
    updatePhysics()
    {
        if (this.destroyed)
            return;
        settleObjectsOnTop(this);
        if (this.waitTimer > 0)
        {
            this.waitTimer -= timeDelta;
            if (this.waitTimer <= 0 && this.goal !== this.t)
                this.depart();
            return;
        }
        if (this.t === this.goal)
            return;
        if (!this.moving)
            this.depart();
        const t = this.goal > this.t ? Math.min(this.goal, this.t + this.legRate * timeDelta)
                                     : Math.max(this.goal, this.t - this.legRate * timeDelta);
        this.moveTo(t);
    }

    moveTo(t)
    {
        const next = this.positionAt(t);
        const delta = next.subtract(this.pos);
        const riders = objectsStandingOn(this, LIFT.RIDE_EPSILON).filter(rider =>
        {
            const carried = rider.pos.add(delta);
            return !solidGroundAt(carried, rider.size) && !solidObjectAt(rider, carried, this);
        });
        this.riderCount = riders.length;
        const blocked = this.blockedAt(next, riders);
        if (blocked && !this.held)
        {
            this.holds++;
            emit('lift:held', { id: this.id });
        }
        this.held = blocked;
        if (blocked)
            return;
        this.t = t;
        this.pos = next;
        for (const rider of riders)
            rider.pos = rider.pos.add(delta);
        if (t === this.goal)
            this.arrive();
    }

    /** Would the plate at `pos` push into anyone it isn't carrying? */
    blockedAt(pos, riders)
    {
        return engineObjectsCollide.some(other =>
            other !== this && !other.destroyed && other.mass > 0 && !riders.includes(other)
            && isOverlapping(pos, this.size, other.pos, other.size));
    }

    update()
    {
        // The wind-up key spins fast while winding up and steadily on the way.
        const spin = this.waitTimer > 0 && this.goal !== this.t ? 18 : this.moving && !this.held ? 8 : 0;
        this.key += spin * timeDelta;
    }

    render()
    {
        if (!isOnScreen(this.drawCenter, this.drawExtent))
            return;
        const lift = { width: this.size.x, thickness: this.size.y, key: this.key, moving: this.moving, palette: this.palette };
        const toTop = vec2(0, this.size.y / 2);
        drawLiftPath(this.a.add(toTop), this.b.add(toTop), lift, time);
        drawLift(this.pos.add(toTop), lift, time);
    }

    debugState()
    {
        const round = value => Math.round(value * 1000) / 1000;
        return {
            type: 'lift',
            id: this.id,
            role: this.mechanismRole,
            active: this.active,
            loop: this.loop,
            t: round(this.t),
            at: this.moving ? null : this.t === 0 ? 'a' : this.t === 1 ? 'b' : null,
            moving: this.moving,
            held: this.held,
            holds: this.holds,
            riders: this.riderCount,
            pos: { x: this.pos.x, y: this.pos.y },
            size: { x: this.size.x, y: this.size.y },
            a: { x: this.a.x, y: this.a.y },
            b: { x: this.b.x, y: this.b.y },
        };
    }
}
