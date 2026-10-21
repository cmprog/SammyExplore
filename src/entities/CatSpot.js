// A cat spot (T-016): a marked place where a companion's ability is needed. It reads as "a cat
// could do something here" but never shows which cat. Placed in level data on the tile it sits on:
//   { type: 'catspot', x, y, id, ability, targets: [ids], key? }
//   ability - an ability id from data/abilities.js (e.g. 'comfort')
//   targets - mechanism target ids its ability drives (a comfort target like the wind-up mouse,
//             or a gate, bridge, ...); checked at load
//   key     - optional narration key, sent as `key` in catspot:noCat / catspot:wrongCat /
//             catspot:unreachable / ability:used, so a level can give this spot its own lines
//
// Interactable: E emits interact:catspot {id, ability, key?}; the CatSpots system
// (systems/CatSpots.js) decides what happens: no companion, the wrong one, or she walks over and
// does it. A mechanism trigger: when her ability works, the CatSpots system calls applyEffect(),
// which emits mechanism:toggle {id, on, targets, by: 'catspot'}.
// The targets' state is the truth (systems/Mechanisms.js): for an 'activate' ability the spot
// is done exactly when all its targets are active, however they got there (another spot, a
// lever), and then it has nothing more to offer.
// Not solid: Sammy and cats walk (and sit) on it.
import { EngineObject, vec2, rand, time, timeDelta, isOnScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { drawCatSpot, drawCatSpotSparkle, CATSPOT_TOP } from '../art/drawCatSpot.js';
import { ParticleField } from './ParticleField.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { CATSPOT } from '../data/tuning.js';
import { ABILITIES, abilityDef } from '../data/abilities.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import {
    requireId, allowOnlyProps, requireTargetList, requireEmptyColumn, optionalString, entityLabel,
} from './entityValidation.js';

const PROPS = ['id', 'ability', 'targets', 'key'];
const SIZE = vec2(1, .4);
const DRAW_EXTENT = vec2(2.5, 2.5);
const CENTER_HEIGHT = .45;   // its E range is measured from here (about Sammy's center height)

export class CatSpot extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        if (!abilityDef(entity.ability))
            fail(`${entityLabel(entity)}: "ability" must be one of ${Object.keys(ABILITIES).join(', ')}`);
        requireTargetList(entity, fail);
        optionalString(entity, 'key', fail);
        requireEmptyColumn(entity, 1, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile cell it sits in
     * @param {{id:string, ability:string, targets:string[], key?:string}} props
     * @param {{timeOfDay?:string}} context
     */
    constructor(cellCenter, { id, ability, targets, key }, { timeOfDay } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, SIZE.y / 2)), SIZE.copy());
        this.feet = feet;
        this.id = id;
        this.ability = ability;
        this.targets = [...targets];
        this.key = key ?? null;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.setCollision(false, false, false);
        this.palette = mechanismPalette(timeOfDay);
        this.fx = new ParticleField();
        this.readTargets = null;   // () => [active, ...], from Mechanisms.bindTargets
        this.busy = false;         // a cat is on her way or doing it (set by CatSpots)
        this.done = false;
        this.ready = 1;            // eases to 0 once done (the twinkle fades)
        this.pokeTimer = 0;
        this.uses = 0;
        this.pokes = 0;

        // Interactable contract (see systems/Interaction.js)
        this.interactType = 'catspot';
        this.interactRadius = CATSPOT.RADIUS;
    }

    get def() { return abilityDef(this.ability); }

    /** Where the cat stands to do it (her feet), facing her work (1 right, -1 left). */
    catPosFor(facing)
    {
        return this.feet.add(vec2(-facing * (this.def.backoff ?? 0), 0));
    }

    get interactPos() { return this.feet.add(vec2(0, CENTER_HEIGHT)); }
    get promptPos()   { return this.feet.add(vec2(0, CATSPOT_TOP + .1)); }

    /** For a trigger, `active` is "all my targets are active" (the targets are the truth). */
    get active() { return this.allTargetsActive(); }

    bindTargets(readTargets)
    {
        this.readTargets = readTargets;
        this.syncFromTargets();
        this.ready = this.done ? 0 : 1;
    }

    allTargetsActive()
    {
        const states = this.readTargets?.() ?? [];
        return states.length > 0 && states.every(Boolean);
    }

    syncFromTargets()
    {
        this.done = this.def.effect === 'activate' && this.allTargetsActive();
    }

    canInteract()
    {
        return !this.busy && !this.done;
    }

    interactPayload()
    {
        return this.key ? { id: this.id, ability: this.ability, key: this.key } : { id: this.id, ability: this.ability };
    }

    /** What the event carries for CatSpots' own events (catspot:*, ability:*). */
    eventPayload(extra = {})
    {
        const payload = { spotId: this.id, ability: this.ability, ...extra };
        if (this.key)
            payload.key = this.key;
        return payload;
    }

    /** E: the CatSpots system (on interact:catspot) works out what happens next. */
    interact() {}

    /** No cat, or the wrong one: a little pat on the cushion. It gives nothing away. */
    poke()
    {
        this.pokes++;
        this.pokeTimer = CATSPOT.POKE_TIME;
        for (let i = 0; i < CATSPOT.POKE_SPARKS; i++)
        {
            const a = Math.PI / 2 + rand(-1.1, 1.1);
            this.fx.add({
                draw: drawCatSpotSparkle, pos: this.feet.add(vec2(rand(-.3, .3), .3)),
                vel: vec2(Math.cos(a), Math.sin(a)).scale(rand(.8, 1.6)), life: rand(.45, .7),
                drag: 2.5, spin: rand(-3, 3), size: rand(.06, .1), color: this.palette.sparkle,
            });
        }
    }

    /** Her ability worked: drive the targets through the activation API. */
    applyEffect()
    {
        this.uses++;
        const on = this.def.effect === 'toggle' ? !this.allTargetsActive() : true;
        emit('mechanism:toggle', { id: this.id, on, targets: this.targets, by: 'catspot' });
        this.syncFromTargets();
    }

    /** Debug (__sammy.commands.activate): drive its targets as if the ability had worked. */
    setActive(on)
    {
        emit('mechanism:toggle', { id: this.id, on: !!on, targets: this.targets, by: 'catspot' });
        this.syncFromTargets();
        return true;
    }

    update()
    {
        this.syncFromTargets();   // another trigger may have done its job for it
        this.pokeTimer = Math.max(0, this.pokeTimer - timeDelta);
        const goal = this.done ? 0 : 1;
        this.ready += Math.sign(goal - this.ready) * Math.min(Math.abs(goal - this.ready), timeDelta / CATSPOT.DONE_FADE);
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        const t = this.pokeTimer / CATSPOT.POKE_TIME;
        drawCatSpot(this.feet, {
            ready: this.ready,
            squash: CATSPOT.POKE_SQUASH * Math.sin(t * Math.PI) * t,
            palette: this.palette,
        }, time);
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    debugState()
    {
        return {
            type: 'catspot',
            id: this.id,
            role: this.mechanismRole,
            ability: this.ability,
            targets: [...this.targets],
            key: this.key,
            active: this.active,
            state: this.done ? 'done' : this.busy ? 'busy' : 'ready',
            uses: this.uses,
            pokes: this.pokes,
            pos: { x: this.feet.x, y: this.feet.y },
        };
    }
}
