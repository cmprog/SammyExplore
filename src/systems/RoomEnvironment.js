// An indoor environment (environments.js kind 'room'): the room backdrop, the rug layer, the
// day/night cycle, and room lighting, built from a level's room layout and torn down together.
// The host scene calls tick(dt) every update step and destroy() when the level goes.
import { RENDER_ORDER } from '../data/renderOrder.js';
import { ROOM_PALETTES } from '../data/roomPalettes.js';
import { DAY_CYCLES } from '../data/dayCycle.js';
import { drawRoomFront, roomFrontBounds } from '../art/room/roomArt.js';
import { DayCycle } from './DayCycle.js';
import { RoomBackdrop } from './RoomBackdrop.js';
import { RoomLighting } from './RoomLighting.js';
import { BakedLayer } from './BakedLayer.js';
import { bakeWorldRect } from './worldBake.js';

export class RoomEnvironment
{
    /** @param {Level} level - with `room` (systems/roomLayout.js)  @param {object} environment - an ENVIRONMENTS entry */
    constructor(level, environment)
    {
        this.id = level.environment;
        const palette = ROOM_PALETTES[environment.palette];
        this.cycle = new DayCycle(DAY_CYCLES[environment.dayCycle]);
        this.parts = [];
        try
        {
            this.backdrop = this.own(new RoomBackdrop(level.room, palette, this.cycle));
            const front = roomFrontBounds(level.room);
            if (front)
                this.own(new BakedLayer(bakeWorldRect(front.x0, front.y0, front.x1, front.y1,
                    (ctx, bounds) => drawRoomFront(ctx, level.room, palette, bounds)), RENDER_ORDER.roomFront));
            this.lighting = this.own(new RoomLighting(level.room, palette, this.cycle));
        }
        catch (error)
        {
            this.destroy();
            throw error;
        }
    }

    own(part)
    {
        this.parts.push(part);
        return part;
    }

    tick(dt)
    {
        this.cycle.tick(dt);
        this.lighting.tick(dt);
    }

    /** Jump the clock (tests and debug); 0 = midnight, .5 = noon. */
    setTimeOfDay(t)
    {
        this.cycle.setTime(t);
        this.lighting.tick(0);
    }

    destroy()
    {
        this.parts.forEach(part => part.destroy());
        this.parts = [];
    }

    debugState()
    {
        return { environment: this.id, kind: 'room', ...this.backdrop.debugState(), ...this.lighting.debugState() };
    }

    dayCycleState()
    {
        return this.cycle.debugState();
    }
}
