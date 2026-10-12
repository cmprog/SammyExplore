// A signpost. Placed in level data on the tile it stands on.
//   { type: 'sign', x, y, id, key }
//   key - narration key: E emits interact:sign {id, key}, and the narrator "reads" the sign with
//         whichever line has trigger 'interact:sign' and that key (or refuses to, or misreads it).
// Not solid: Sammy walks past it.
import { EngineObject, vec2, time, timeDelta, isOnScreen } from 'littlejs';
import { drawSign, SIGN_TOP } from '../art/drawSign.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { SIGN } from '../data/tuning.js';
import { requireId, allowOnlyProps, requireEmptyColumn, entityLabel } from './entityValidation.js';

const PROPS = ['id', 'key'];
const SIZE = vec2(1.1, 1.3);
const DRAW_EXTENT = vec2(1.6, 1.8);

export class Sign extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        if (typeof entity.key !== 'string' || !entity.key)
            fail(`${entityLabel(entity)} needs a narration "key" (what the narrator reads)`);
        requireEmptyColumn(entity, 1, fail, level);
    }

    /** @param {Vector2} cellCenter - center of the tile the sign stands on */
    constructor(cellCenter, { id, key })
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, SIZE.y / 2)), SIZE.copy());
        this.feet = feet;
        this.id = id;
        this.key = key;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.setCollision(false, false, false);
        this.wiggle = 0;

        // Interactable contract (see systems/Interaction.js)
        this.interactType = 'sign';
        this.interactRadius = SIGN.RADIUS;
    }

    get interactPos() { return this.pos; }
    get promptPos()   { return this.feet.add(vec2(0, SIGN_TOP + .1)); }

    canInteract()
    {
        return true;
    }

    interactPayload()
    {
        return { id: this.id, key: this.key };
    }

    /** The reading itself is the narrator's job (it listens for interact:sign); the sign just wobbles. */
    interact()
    {
        this.wiggle = 1;
    }

    update()
    {
        this.wiggle = Math.max(0, this.wiggle - timeDelta / SIGN.WIGGLE_TIME);
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;   // every prop renders every frame otherwise; levels will have many
        drawSign(this.feet, { wiggle: this.wiggle }, time);
    }

    debugState()
    {
        return { type: 'sign', id: this.id, key: this.key, pos: { x: this.pos.x, y: this.pos.y } };
    }
}
