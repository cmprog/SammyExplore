// CatSpots (T-016): what happens when Sammy presses E at a cat spot (entities/CatSpot.js).
// One instance for the game, hosted by the playing scene, attached to each level it builds.
// The host hands it the Companion (like the Companion gets the Interaction system); it uses only
// currentCat(), errandState() and goTo(). The host also reads abilityFocus() each step to ease
// the camera in on an ability while it plays (Camera.setAbilityFocus).
//
// On interact:catspot {id, ability}:
//   - nobody along:              catspot:noCat {spotId, ability}            (the cushion gets a pat)
//   - a cat without that ability: catspot:wrongCat {spotId, ability, cat}   (likewise; nothing
//                                  says which cat it wants)
//   - the right cat:             she walks over (Companion.goTo(spot)) and, once there, performs
//                                 it: ability:start {ability, cat, spotId}. At the ability's
//                                 effectAt (data/abilities.js): ability:used {ability, cat, spotId},
//                                 then the spot drives its targets (mechanism:toggle, by: 'catspot').
//                                 At its duration she's done and follows Sammy again.
//   If she can't get to the spot, she waits where the way stops and this sends
//   catspot:unreachable {spotId, ability, cat, reason} once, for the narrator's hint (the
//   Companion doesn't send companion:waiting while she's on an errand, so only one line comes).
//   If the way opens she carries on. If Sammy wanders off (CATSPOT.GIVE_UP_DISTANCE) before she
//   starts, the errand is called off and she follows him again.
//   A `key` on the spot rides along in all of these (narration keys).
// While an ability with `soothes` plays, every target that can be soothed (Upset.soothe) is told
// how far along it is, so the frazzle settles visibly before the moment it works.
//
// Called off before it works (a correction, the Companion bringing her back to Sammy at a
// checkpoint, companion:caughtUp, Sammy wandering off, her no longer being the companion): the
// spot is ready again, its targets are unsoothed, and if she had started, ability:cancel stops
// the start sound. Nothing happened. (The Companion never moves her while she performs.)
// One errand at a time: while one is under way the spot is busy (no E prompt).
import { on, emit } from '../core/events.js';
import { abilityDef, catHasAbility } from '../data/abilities.js';
import { CATSPOT } from '../data/tuning.js';

export class CatSpots
{
    constructor()
    {
        this.level = null;
        this.companion = null;
        this.playerPos = () => null;
        this.spots = [];
        this.errand = null;   // {spot, cat, catId, phase: 'approach'|'perform', time, toldUnreachable}
        this.unsubscribers = [];
    }

    /** @param {{level:Level, companion:Companion, playerPos:() => Vector2|null}} host */
    attach({ level, companion, playerPos })
    {
        this.detach();
        this.level = level;
        this.companion = companion;
        this.playerPos = playerPos;
        this.spots = level.entities.filter(entity => entity?.interactType === 'catspot');
        if (!this.spots.length)
            return;
        this.unsubscribers.push(on('interact:catspot', payload => this.onInteract(payload)));
        this.unsubscribers.push(on('correction:reset', () => this.callOff()));
        this.unsubscribers.push(on('companion:caughtUp', () => this.callOff()));
    }

    detach()
    {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        this.errand = null;
        this.spots = [];
        this.level = this.companion = null;
    }

    onInteract({ id } = {})
    {
        const spot = this.spots.find(other => other.id === id);
        if (!spot || this.errand || !spot.canInteract())
            return;
        const cat = this.companion?.currentCat();
        if (!cat)
        {
            spot.poke();
            return void emit('catspot:noCat', spot.eventPayload());
        }
        if (!catHasAbility(cat.catId, spot.ability))
        {
            spot.poke();
            return void emit('catspot:wrongCat', spot.eventPayload({ cat: cat.catId }));
        }
        const facing = this.facingFor(spot);
        this.errand = { spot, cat, catId: cat.catId, facing, phase: 'approach', time: 0, toldUnreachable: false };
        spot.busy = true;
        this.companion.goTo(spot.catPosFor(facing));
    }

    /** Once per step, after the companion's (the playing scene's updatePost). */
    update()
    {
        const errand = this.errand;
        if (!errand)
            return;
        if (errand.cat.destroyed || this.companion.currentCat() !== errand.cat)
            return this.callOff();   // she isn't the companion any more
        if (errand.phase === 'approach')
            this.approach(errand);
        else
            this.perform(errand);
    }

    approach(errand)
    {
        const { spot } = errand;
        const player = this.playerPos();
        if (player && player.distance(spot.interactPos) > CATSPOT.GIVE_UP_DISTANCE)
            return this.callOff();
        const state = this.companion.errandState();
        if (!state?.hasGoal)
            return this.callOff();   // the Companion brought her back to Sammy (a checkpoint fetch)
        if (state.arrived)
            return this.start(errand);
        if (state.waiting && !errand.toldUnreachable)
        {
            errand.toldUnreachable = true;
            emit('catspot:unreachable', spot.eventPayload({ cat: errand.catId, reason: state.reason }));
        }
    }

    start(errand)
    {
        const { spot, cat } = errand;
        cat.performAbility(spot.def.animation, errand.facing);
        const target = this.targetEntities(spot).find(entity => entity.pos);
        errand.focus = (target ?? spot).pos.copy();   // where whoever she's helping was when she began
        errand.phase = 'perform';
        errand.time = 0;
        errand.effected = false;
        emit('ability:start', { ability: spot.ability, cat: errand.catId, spotId: spot.id });
    }

    perform(errand)
    {
        const { spot, cat } = errand;
        const def = spot.def;
        // Her animation's own clock, so the moment it works always matches what she's doing, and
        // it stops with her whenever the world is frozen.
        errand.time = cat.abilityTime;
        if (!errand.effected)
        {
            const progress = Math.min(1, errand.time / def.effectAt);
            if (def.soothes)
                for (const target of this.targetEntities(spot))
                    target.soothe?.(progress);
            if (errand.time >= def.effectAt)
            {
                errand.effected = true;
                cat.abilityEffect();
                emit('ability:used', spot.eventPayload({ cat: errand.catId }));
                spot.applyEffect();
            }
        }
        if (errand.time >= def.duration)
            this.finish();
    }

    finish()
    {
        const { spot, cat } = this.errand;
        cat.endAbility();
        spot.busy = false;
        this.errand = null;
        this.companion.goTo(null);
    }

    /** Called off before (or during) the ability: nothing happened, the spot is ready again. */
    callOff()
    {
        const errand = this.errand;
        if (!errand)
            return;
        if (errand.effected)
            return this.finish();   // it already worked; just let her go
        if (!errand.cat.destroyed)
            errand.cat.endAbility();
        for (const target of this.targetEntities(errand.spot))
            target.unsoothe?.();
        if (errand.phase === 'perform')
            emit('ability:cancel', { ability: errand.spot.ability, cat: errand.catId, spotId: errand.spot.id });
        errand.spot.busy = false;
        this.errand = null;
        if (this.companion?.currentCat() === errand.cat)
            this.companion.goTo(null);
    }

    /** The ability's `face`: toward the spot's first target beside it, or a fixed side. */
    facingFor(spot)
    {
        const face = spot.def.face ?? 'target';
        if (face !== 'target')
            return face === 'left' ? -1 : 1;
        const target = this.targetEntities(spot).find(entity => entity.pos);
        return target ? Math.sign(target.pos.x - spot.feet.x) || 1 : 1;
    }

    /** While an ability plays: {a: the cat, b: whoever she's helping} for the camera, else null. */
    abilityFocus()
    {
        const errand = this.errand;
        if (errand?.phase !== 'perform' || errand.cat.destroyed)
            return null;
        return { a: errand.cat.pos, b: errand.focus };
    }

    targetEntities(spot)
    {
        return spot.targets.map(id => this.level.entities.find(entity => entity?.id === id)).filter(Boolean);
    }

    /** Plain data for window.__sammy.catSpots. */
    debugState()
    {
        const errand = this.errand;
        return this.spots.filter(spot => !spot.destroyed).map(spot => ({
            ...spot.debugState(),
            errand: errand?.spot === spot ? {
                cat: errand.catId, phase: errand.phase, time: Math.round(errand.time * 1000) / 1000,
                effected: !!errand.effected, toldUnreachable: errand.toldUnreachable,
                duration: abilityDef(spot.ability).duration,
            } : null,
        }));
    }
}
