// Twyx the tuxedo cat (T-011a). Placed in level data on the tile it stands on.
//   { type: 'twyx', x, y, id }
// Stays put for now (following Sammy comes later). Idles (tail swish, blink, sits, licks a paw),
// turns to face Sammy when he's near, and is an interactable: E emits interact:twyx {id} (Audio
// meows, the narrator remarks) and Twyx reacts with perked ears, a happy squint and hearts.
// Not solid: Sammy walks past (and in front of) Twyx.
import { EngineObject, vec2, lerp, time, timeDelta, isOnScreen } from '../../lib/littlejs/littlejs.esm.js';
import { drawTwyx } from '../art/drawTwyx.js';
import { TwyxAnimator } from './TwyxAnimator.js';
import { ParticleField } from './ParticleField.js';
import { spawnPetHearts } from './twyxEffects.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { TWYX } from '../data/tuning.js';
import { TWYX_SHAPES } from '../data/twyxPoses.js';
import { requireId, allowOnlyProps, requireEmptyColumn } from './entityValidation.js';

const PROPS = ['id'];
const SIZE = vec2(.9, .9);
const DRAW_EXTENT = vec2(2, 2.2);
const HEARTS_ABOVE_HEAD = .45;   // hearts start just over the ears, never over the face
const PROMPT_ABOVE_HEAD = .5;    // the E bubble's tail, clear of the ear tips

export class Twyx extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        requireEmptyColumn(entity, 1, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile Twyx stands on
     * @param {{id:string}} props
     * @param {{playerPos?:() => Vector2|null}} context
     */
    constructor(cellCenter, { id }, { playerPos = null } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, SIZE.y / 2)), SIZE.copy());
        this.feet = feet;
        this.id = id;
        this.playerPos = playerPos;
        this.renderOrder = RENDER_ORDER.cats;
        this.mass = 0;
        this.setCollision(false, false, false);
        this.animator = new TwyxAnimator();
        this.fx = new ParticleField();
        this.pets = 0;

        // Interactable contract (see systems/Interaction.js)
        this.interactType = 'twyx';
        this.interactRadius = TWYX.RADIUS;
    }

    get interactPos() { return this.pos; }
    get promptPos()   { return vec2(this.feet.x, this.headPos().y + PROMPT_ABOVE_HEAD); }   // rises when Twyx sits

    canInteract()
    {
        return true;
    }

    interactPayload()
    {
        return { id: this.id };
    }

    /** The meow and the narrator's remark come from interact:twyx; Twyx just looks delighted. */
    interact()
    {
        this.pets++;
        this.animator.onPet();
        spawnPetHearts(this.fx, this.headPos().add(vec2(0, HEARTS_ABOVE_HEAD)));
    }

    /** Center of the head in world space, standing or sitting. */
    headPos()
    {
        const { stand, sit } = TWYX_SHAPES;
        const amount = this.animator.sit;
        const x = lerp(stand.head.x, sit.head.x, amount) * this.animator.facing;
        return this.feet.add(vec2(x, lerp(stand.head.y, sit.head.y, amount)));
    }

    update()
    {
        this.animator.update(timeDelta, this.offsetToPlayer());
    }

    /** Sammy's x relative to Twyx, or null when he's too far away to notice. */
    offsetToPlayer()
    {
        const player = this.playerPos?.();
        if (!player)
            return null;
        const dx = player.x - this.pos.x, dy = player.y - this.pos.y;
        return Math.abs(dx) <= TWYX.NOTICE_RADIUS && Math.abs(dy) <= TWYX.NOTICE_HEIGHT ? dx : null;
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        drawTwyx(this.feet, this.animator.pose(), time);
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    debugState()
    {
        const a = this.animator;
        return {
            type: 'twyx',
            id: this.id,
            pos: { x: this.pos.x, y: this.pos.y },
            facing: a.facing,
            turn: round(a.turn),
            action: a.action,
            sit: round(a.sit),
            lick: round(a.lick),
            blinking: a.blinkAge < TWYX.BLINK_TIME,
            swish: round(a.swishAmount()),
            reacting: a.petAge < TWYX.PET_TIME,
            perk: round(a.perk),
            pets: this.pets,
            hearts: this.fx.count,
        };
    }

    /** Debug and pose captures (window.__sammy.commands.entityAction). */
    debugAction(what, hold = false)
    {
        if (what === 'pet')
            return void this.interact();
        this.animator.force(what, hold);
    }
}

function round(value)
{
    return Math.round(value * 1000) / 1000;
}
