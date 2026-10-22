// Twyx the tuxedo cat (T-011a, T-015). Placed in level data on the tile she stands on:
//   { type: 'twyx', x, y, id, roam? }
//   roam - tiles she wanders either side of her spot while she's at home (default
//          COMPANION.ROAM_RADIUS; 0 keeps her exactly where the level puts her)
// She idles (tail swish, blink, sits, licks a paw), turns to face Sammy when he's near, and is an
// interactable: E emits interact:twyx {id} (Audio meows, the narrator remarks) and she reacts
// with perked ears, a happy squint and hearts. In a companion hub level the Companion system
// (systems/Companion.js) uses that same E to ask her along, or to let her stay.
//
// Her body, physics and movement are CatBody's; this class is her look: art, animator, effects.
// T-016: her ability is Comfort (data/abilities.js). At a cat spot she snuggles in close to
// whoever is upset, bunts them, grooms them, then curls up purring; hearts and purr ripples rise.
import { vec2, lerp, time, timeDelta, isOnScreen } from 'littlejs';
import { CatBody, round } from './CatBody.js';
import { drawTwyx } from '../art/drawTwyx.js';
import { TwyxAnimator } from './TwyxAnimator.js';
import { ParticleField } from './ParticleField.js';
import {
    spawnPetHearts, spawnHappyHearts, spawnMrrp, spawnLandPuff, spawnPurrWave, spawnComfortHearts,
} from './twyxEffects.js';
import { TWYX, COMPANION, TWYX_COMFORT } from '../data/tuning.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { TWYX_SHAPES } from '../data/twyxPoses.js';
import { CATS } from '../data/cats.js';
import { requireId, allowOnlyProps, requireEmptyColumn, entityLabel } from './entityValidation.js';

const PROPS = ['id', 'roam'];
const DRAW_EXTENT = vec2(2.4, 2.6);
const HEARTS_ABOVE_HEAD = .45;   // hearts start just over the ears, never over the face
const PROMPT_ABOVE_HEAD = .5;    // the E bubble's tail, clear of the ear tips
const PUFF_MIN_IMPACT = .25;
const NOTICE = { x: TWYX.NOTICE_RADIUS, y: TWYX.NOTICE_HEIGHT };

export class Twyx extends CatBody
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        requireEmptyColumn(entity, 1, fail, level);
        if (entity.roam !== undefined && !(Number.isFinite(entity.roam) && entity.roam >= 0 && entity.roam <= 12))
            fail(`${entityLabel(entity)}: "roam" must be a number of tiles from 0 to 12`);
    }

    /**
     * @param {Vector2} cellCenter - center of the cell Twyx stands in (on the tile below it)
     * @param {{id:string, roam?:number}} props
     * @param {{playerPos?:() => Vector2|null}} context
     */
    constructor(cellCenter, { id, roam = COMPANION.ROAM_RADIUS }, context = {})
    {
        super(cellCenter, { id, roam, catId: CATS.twyx.id }, context);
        this.animator = new TwyxAnimator();
        this.fx = new ParticleField();
        this.pets = 0;

        // Interactable contract (see systems/Interaction.js)
        this.interactType = 'twyx';
        this.interactRadius = TWYX.RADIUS;
    }

    get interactPos() { return this.pos; }
    get promptPos()   { return vec2(this.pos.x, this.headPos().y + PROMPT_ABOVE_HEAD); }   // rises when Twyx sits

    /** Not while she's on her way to a cat spot or comforting someone: a pet would knock her out
     *  of it, and in a hub E could even send her home. */
    canInteract()
    {
        return !this.busyWithErrand;
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
        const { stand, sit, snuggle, loaf } = TWYX_SHAPES;
        const a = this.animator;
        let x = lerp(stand.head.x, sit.head.x, a.sit), y = lerp(stand.head.y, sit.head.y, a.sit);
        x = lerp(lerp(x, snuggle.head.x, a.comfort), loaf.head.x, a.curl);
        y = lerp(lerp(y, snuggle.head.y, a.comfort), loaf.head.y, a.curl);
        return this.feet.add(vec2(x * a.facing, y));
    }

    // --- CatBody hooks ------------------------------------------------------------------------

    sitAmount() { return this.animator.sit; }
    onLeapStart() { this.animator.onLeap(); }

    onLanded(impact)
    {
        this.animator.onLand(impact);
        if (impact >= PUFF_MIN_IMPACT)
            spawnLandPuff(this.fx, this.feet, impact);
    }

    /** She had to stop: a little "mrrp?" with a question mark. */
    mrrp()
    {
        this.animator.onMrrp();
        spawnMrrp(this.fx, this.headPos(), this.animator.facing);
    }

    /** Not just now: a little head shake. */
    refuse()
    {
        this.animator.onShake();
    }

    /** Back with Sammy: a happy squint and a couple of hearts (the hop is CatBody's). */
    onHappy()
    {
        this.animator.onCaughtUp();
        spawnHappyHearts(this.fx, this.headPos().add(vec2(0, HEARTS_ABOVE_HEAD)));
    }

    animate(motion)
    {
        const before = this.animator.abilityTime;
        this.animator.update(timeDelta, this.offsetToPlayer(NOTICE), motion);
        if (this.animator.ability === 'comfort')
            this.comfortCues(before, this.animator.abilityTime);
    }

    // --- Comfort (T-016) ----------------------------------------------------------------------

    performAbility(animation, facing)
    {
        if (!this.animator.startAbility(animation, facing))
            return false;
        // The star of the moment: in front of Sammy, so standing on the cushion never hides her.
        this.renderOrder = RENDER_ORDER.characters + .5;
        return true;
    }

    /** It worked: a warm burst of hearts between her and whoever she comforted. */
    abilityEffect()
    {
        const head = this.headPos();
        spawnComfortHearts(this.fx, head.add(vec2(this.animator.facing * .35, HEARTS_ABOVE_HEAD)));
    }

    endAbility()
    {
        this.animator.endAbility();
        this.renderOrder = RENDER_ORDER.cats;
    }

    get performing() { return this.animator.ability; }
    get abilityTime() { return this.animator.abilityTime; }

    /** Purr ripples off her back, and a little heart at each bunt and mid-groom. */
    comfortCues(from, to)
    {
        const C = TWYX_COMFORT;
        const crossed = at => from < at && to >= at;
        if (to >= C.PURR_FROM && Math.floor((to - C.PURR_FROM) / C.PURR_EVERY) !== Math.floor((from - C.PURR_FROM) / C.PURR_EVERY))
            spawnPurrWave(this.fx, this.feet.add(vec2(-.1 * this.animator.facing, .75)));
        if (C.HEARTS_AT.some(crossed))
            spawnHappyHearts(this.fx, this.headPos().add(vec2(this.animator.facing * .15, HEARTS_ABOVE_HEAD)));
    }

    // --- drawing and debug --------------------------------------------------------------------

    render()
    {
        if (!isOnScreen(this.pos.add(vec2(0, .3)), DRAW_EXTENT))
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
            ...this.bodyDebugState(),
            facing: a.facing,
            turn: round(a.turn),
            action: a.action,
            sit: round(a.sit),
            lick: round(a.lick),
            walk: round(a.walk),
            air: round(a.air),
            headTurn: round(a.headTurn),
            lookUp: round(a.lookUp),
            curious: round(a.curious),
            mrrping: a.mrrpAge < 1,
            shaking: a.shakeAge < 1,
            blinking: a.blinkAge < TWYX.BLINK_TIME,
            swish: round(a.swishAmount()),
            reacting: a.petAge < TWYX.PET_TIME,
            happy: a.happy,
            perk: round(a.perk),
            pets: this.pets,
            hearts: this.fx.count,
            ability: a.ability,
            abilityTime: round(a.abilityTime),
            comfort: round(a.comfort),
            curl: round(a.curl),
            renderOrder: this.renderOrder,
            onErrand: this.busyWithErrand,
        };
    }

    /** Debug and pose captures (window.__sammy.commands.entityAction): also 'comfort' (plays the
     *  animation where she stands, toward where she faces), 'abilityEffect' and 'endAbility'. */
    debugAction(what, hold = false)
    {
        if (what === 'pet')
            return void this.interact();
        if (what === 'mrrp')
            return void this.mrrp();
        if (what === 'comfort')
            return void this.performAbility('comfort', this.animator.facing);
        if (what === 'endAbility')
            return void this.endAbility();
        if (what === 'abilityEffect')
            return void this.abilityEffect();
        this.animator.force(what, hold);
    }
}
