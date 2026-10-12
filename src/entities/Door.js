// A door. Placed in level data on the tile it stands on; it fills that tile and the one above.
//   { type: 'door', x, y, id, locked?, exitId?, nextLevel? }
//   locked    - E only rattles it (interact:doorLocked). Nothing unlocks doors yet.
//   exitId    - an exit door: once open, it completes the level through the level's exit path,
//               exactly like walking into an exit zone with that id (level:complete, autosave).
//               nextLevel works as on exit zones (defaults to the level's nextLevel).
//   otherwise - an ordinary door: solid while closed, passable once it swings open.
//
// Interactable (see systems/Interaction.js). Events: door:open {id} when the swing starts,
// interact:doorLocked {id} on a locked door. The Interaction system emits interact:door itself.
import { EngineObject, vec2, time, timeDelta, isOnScreen } from '../../lib/littlejs/littlejs.esm.js';
import { emit } from '../core/events.js';
import { drawDoor } from '../art/drawDoor.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { DOOR } from '../data/tuning.js';
import { requireId, allowOnlyProps, optionalBoolean, optionalString, requireEmptyColumn } from './entityValidation.js';

const PROPS = ['id', 'locked', 'exitId', 'nextLevel'];
const TILES_TALL = 2;
const DRAW_EXTENT = vec2(3, 3);   // the exit glow reaches past the frame

export class Door extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        optionalBoolean(entity, 'locked', fail);
        optionalString(entity, 'exitId', fail);
        if (entity.nextLevel !== undefined && entity.exitId === undefined)
            fail(`door "${entity.id}" has a nextLevel but no exitId (only exit doors lead somewhere)`);
        requireEmptyColumn(entity, TILES_TALL, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile the door stands on
     * @param {{id:string, locked?:boolean, exitId?:string}} props
     * @param {{triggerExit?:(exitId:string) => void}} context
     */
    constructor(cellCenter, { id, locked = false, exitId = null }, { triggerExit = null } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, DOOR.SIZE.y / 2)), vec2(DOOR.SIZE.x, DOOR.SIZE.y));
        this.feet = feet;
        this.id = id;
        this.locked = locked;
        this.exitId = exitId;
        this.triggerExit = triggerExit;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;                        // static: never moved by physics
        this.setCollision(true, true, false); // blocks Sammy while closed (see collideWithObject)
        this.open = 0;                        // 0 closed .. 1 fully swung
        this.opening = false;
        this.exitTimer = -1;                  // counting down to the exit, once fully open
        this.rattle = 0;

        // Interactable contract
        this.interactType = 'door';
        this.interactRadius = DOOR.RADIUS;
    }

    get passable()
    {
        return this.open >= DOOR.PASSABLE_AT;
    }

    /** Where range is measured from, and where the E prompt floats (its top). */
    get interactPos() { return this.pos; }
    get promptPos()   { return this.feet.add(vec2(0, DOOR.SIZE.y + .1)); }

    /** Nothing more to do once it starts opening. Locked doors can be rattled forever. */
    canInteract()
    {
        return !this.opening && this.open === 0;
    }

    interactPayload()
    {
        return { id: this.id };
    }

    interact()
    {
        if (this.locked)
        {
            this.rattle = 1;
            emit('interact:doorLocked', { id: this.id });
            return;
        }
        this.opening = true;
        emit('door:open', { id: this.id });
    }

    collideWithObject()
    {
        return !this.passable;
    }

    update()
    {
        this.rattle = Math.max(0, this.rattle - timeDelta / DOOR.RATTLE_TIME);
        if (this.opening && this.open < 1)
        {
            this.open = Math.min(1, this.open + timeDelta / DOOR.OPEN_TIME);
            if (this.open === 1 && this.exitId)
                this.exitTimer = DOOR.EXIT_DELAY;
        }
        if (this.exitTimer >= 0 && (this.exitTimer -= timeDelta) < 0)
            this.triggerExit?.(this.exitId);
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;   // every prop renders every frame otherwise; levels will have many
        drawDoor(this.feet, { locked: this.locked, open: this.open, rattle: this.rattle, exit: !!this.exitId }, time);
    }

    debugState()
    {
        return {
            type: 'door',
            id: this.id,
            locked: this.locked,
            exitId: this.exitId,
            open: Math.round(this.open * 1000) / 1000,
            opening: this.opening,
            passable: this.passable,
            pos: { x: this.pos.x, y: this.pos.y },
        };
    }
}
