// Companion (T-015): which cat is along with Sammy, and keeping her with him. One instance for
// the game, hosted by the playing scene, which attaches it to each level it builds.
//
// Choosing happens only in a companion hub (level data `companionHub: true`, the bedroom). The
// cats a hub places live there (`home`). There, E on a cat who isn't the companion asks her along
// (companion:join {cat}); the old companion stays home (companion:leave). E on the companion lets
// her stay and roam there again (companion:leave), but only if that hub is her home: a visitor
// (a cat the hub doesn't place) is never left behind. Everywhere else E on a cat is a pet.
//
// Keeping her with him (she is never lost, never left for good, never vanishes, never pops into
// view):
//   - level start (a new level, Continue, a level change): she arrives with Sammy and trots in
//     beside him. A level that places her uses that very cat; otherwise she is brought along.
//   - correction:reset: under the page, she is put down a few tiles behind him and trots in
//     once the page lifts (release(), on correction:done).
//   - checkpoint:reached while she is waiting, or far behind: once she's out of sight she
//     catches up, trotting in from a spot that is out of sight too (fetchPending; it keeps
//     trying as Sammy moves until both are true, or until she makes her own way back).
//     A fetch only ever starts at a checkpoint, so LEVEL DESIGN: put a checkpoint after every
//     gate, bridge or lift she might be left waiting at (see T-018's level-design notes).
//   - she somehow ends up below the world: held there, unseen, until the same kind of spot
//     comes up.
//   If no unseen spot turns up within FETCH_FALLBACK_AFTER seconds (a level narrower than the
//   view, the end of a room, ground cut short), she comes in from just past the edge of the
//   current screen; and if even that doesn't exist, under a quick page flip (drawPageFlip, under
//   a second, no input lock) she's put down beside him while the page covers the view. Either
//   way she is never seen to pop, and never held for long.
// Each of those ends in companion:caughtUp {cat, via} when she reaches him, `via` saying how:
//   'arrived' | 'correction' | 'checkpoint' | 'regroup' (brought in), 'walked' (made her own way
//   after waiting), 'met' (Sammy came back to her).
//
// Cats at home (every cat that isn't the companion) get a CatRoamer.
// The current companion's id is remembered across levels here, and saved by SaveSystem (which
// listens to companion:join / companion:leave). Continue and New Game set it with choose().
import { vec2, timeDelta, isOnScreen, getCameraSize } from 'littlejs';
import { on, emit } from '../core/events.js';
import { spawnEntity } from '../entities/registry.js';
import { CatFollower } from '../entities/CatFollower.js';
import { CatRoamer } from '../entities/CatRoamer.js';
import { Trail } from './Trail.js';
import { walkSpan, blockersFor, inTheWay, keepClearZones, boxAt } from './catNavigation.js';
import { catDef, catEntityTypes } from '../data/cats.js';
import { COMPANION as C, WORLD_FALL_MARGIN } from '../data/tuning.js';
import { drawPageFlip } from '../art/drawPageFlip.js';

// An entry spot should leave her a little trot before she settles beside him.
const MIN_ENTRY = C.FOLLOW_STOP + 1;
const UNSEEN_REACH = 40;      // tiles either side of Sammy to look for an out-of-sight entry spot
const UNSEEN_STEP = .5;
const RETRY_EVERY = .4;       // seconds between tries while a fetch is pending

export class Companion
{
    constructor()
    {
        this.catId = null;       // the chosen companion, kept across levels
        this.cat = null;         // her entity in the current level
        this.follower = null;
        this.trail = new Trail();
        this.level = null;
        this.player = null;
        this.interaction = null;
        this.context = null;
        this.canSee = () => false;   // host: is this box in view (now, or where the camera is heading)?
        this.zones = [];             // where she must never settle (catNavigation.keepClearZones)
        this.fetchPending = false;   // a checkpoint asked for her; she comes once nobody can see it happen
        this.regroupPending = false; // she's below the world; held there until she can come in unseen
        this.retryIn = 0;
        this.noSpotFor = 0;          // seconds a pending fetch/regroup has found nowhere unseen
        this.cover = null;           // the page flip bringing her in: {age, via, placed}
        this.lastEntry = null;       // debug: where she was last put down, and whether that was in view
        this.unsubscribers = [];
    }

    /** Who comes along next time a level is attached (Continue, New Game). null = nobody. */
    choose(catId)
    {
        this.catId = catDef(catId) ? catId : null;
    }

    /**
     * Take charge of a freshly built level's cats. Call after Sammy and the interaction targets exist.
     * @param {{level:Level, player:Sammy, interaction:Interaction, playerPos:() => Vector2|null,
     *          canSee?:(pos:Vector2, size:Vector2) => boolean}} host
     */
    attach({ level, player, interaction, playerPos, canSee = () => false })
    {
        this.detach();
        this.level = level;
        this.player = player;
        this.interaction = interaction;
        this.canSee = canSee;
        this.context = { levelId: level.id, levelSize: { x: level.size.x, y: level.size.y }, timeOfDay: level.timeOfDay, playerPos };
        this.zones = keepClearZones(level.entities);
        this.trail.clear();
        warnIfNarrow(level);
        for (const cat of this.cats())
        {
            cat.home = !!level.companionHub;   // a hub's own cats live there
            this.sendHome(cat);
        }
        for (const type of catEntityTypes())
            this.unsubscribers.push(on(`interact:${type}`, payload => this.onInteract(payload)));
        this.unsubscribers.push(on('checkpoint:reached', () => this.onCheckpoint()));
        if (!this.catId)
            return;
        const cat = this.findOrBring(this.catId);
        if (!cat)
            return;
        this.adopt(cat);
        this.placeBeside('arrived');
    }

    /** The level is going away (it destroys its own entities). The choice is kept. */
    detach()
    {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        this.cat = this.follower = null;
        this.fetchPending = this.regroupPending = false;
        this.cover = null;
        this.noSpotFor = 0;
        this.level = this.player = this.interaction = null;
        this.zones = [];
        this.trail.clear();
    }

    cats()
    {
        return this.level?.entities.filter(entity => entity?.catId && !entity.destroyed) ?? [];
    }

    // --- choosing (hub levels only) -----------------------------------------------------------

    onInteract({ id } = {})
    {
        if (!this.level?.companionHub)
            return;   // outside the hub, E on a cat is a pet (her own interact() does the hearts)
        const cat = this.cats().find(other => other.id === id);
        if (!cat)
            return;
        if (!cat.companion)
            return this.join(cat) || cat.refuse();   // refused: a little head shake, no new event
        if (cat.home)
            return this.leave(cat);
        // A visitor this hub doesn't place: she isn't left here. E is a pet.
    }

    /** One companion at a time: the old one stays home. Refused if the old one can't stay here. */
    join(cat)
    {
        if (this.cat === cat)
            return false;
        if (this.cat && !this.cat.home)
            return false;   // the current companion is a visitor here: she won't be left behind
        if (this.cat)
            this.leave(this.cat);
        this.catId = cat.catId;
        this.adopt(cat);
        emit('companion:join', { cat: cat.catId });
        return true;
    }

    leave(cat)
    {
        if (!cat.home)
            return false;   // never left behind somewhere that isn't her home
        this.sendHome(cat);
        if (this.cat === cat)
        {
            this.cat = this.follower = null;
            this.catId = null;
            this.trail.clear();
            this.fetchPending = this.regroupPending = false;
        }
        emit('companion:leave', { cat: cat.catId });
        return true;
    }

    adopt(cat)
    {
        cat.companion = true;
        this.cat = cat;
        this.trail.clear();
        this.follower = new CatFollower({
            trail: this.trail,
            player: () => this.player,
            keepClearZones: this.zones,
            onWaiting: reason => this.onWaiting(reason),
            onCaughtUp: via => this.onCaughtUp(via),
        });
        cat.setMover(this.follower);
    }

    /** At home: she roams around where she is now. */
    sendHome(cat)
    {
        cat.companion = false;
        cat.setMover(new CatRoamer(cat.feet, cat.roam, { player: () => this.player, keepClearZones: this.zones }));
    }

    /** The level's own cat with this id, or (a level that doesn't place her) she comes along. */
    findOrBring(catId)
    {
        const placed = this.cats().find(cat => cat.catId === catId);
        if (placed)
            return placed;
        const def = catDef(catId);
        const cat = def && spawnEntity(def.entityType, this.player.feetPos.add(vec2(0, .5)), { id: catId }, this.context);
        if (!cat)
            return null;
        cat.catId = catId;      // a test cat borrows a real cat's body
        cat.home = false;
        this.level.entities.push(cat);   // the level owns her lifetime, like its own entities
        this.interaction.add(cat);
        return cat;
    }

    // --- keeping her with him -----------------------------------------------------------------

    /** Put her down near Sammy and have her trot in. `hold`: stay put until release(). `spot`:
     *  exactly where (else a few tiles away on his ground). */
    placeBeside(via, { hold = false, distance = C.ENTRY_DISTANCE, spot = null } = {})
    {
        if (!this.cat || !this.player)
            return;
        const feet = spot ?? this.entrySpot(distance);
        this.cat.placeAt(feet);
        this.lastEntry = {
            x: feet.x, y: feet.y, via, covered: !!this.cover,
            visible: this.canSee(boxAt(this.cat, feet.x, feet.y), this.cat.size),
        };
        this.follower.enter(via, hold);
    }

    /** Somewhere on Sammy's own ground, behind him if it can be, she can walk straight to him from. */
    entrySpot(distance)
    {
        const cat = this.cat, player = this.player;
        const feet = player.feetPos, solids = blockersFor(cat);
        let best = feet.x;
        for (const side of [-player.facing, player.facing])
        {
            let x = walkSpan(cat, feet.x, feet.y, feet.x + side * distance, solids).x;
            while ((x - feet.x) * side > 0 && inTheWay(boxAt(cat, x, feet.y), cat.size, this.zones))
                x = Math.abs(x - feet.x) <= .2 ? feet.x : x - side * .2;
            if (Math.abs(x - feet.x) >= MIN_ENTRY)
                return vec2(x, feet.y);
            if (Math.abs(x - feet.x) > Math.abs(best - feet.x))
                best = x;   // a short trot is still better than none
        }
        return vec2(best, feet.y);
    }

    /** The nearest spot on Sammy's ground, walkable to him, that nobody can see (now or once the
     *  camera settles), out of every lift's way and gateway. null if there isn't one yet. */
    unseenEntrySpot()
    {
        const cat = this.cat, player = this.player;
        const feet = player.feetPos, solids = blockersFor(cat);
        let best = null;
        for (const side of [-player.facing, player.facing])
        {
            const reach = walkSpan(cat, feet.x, feet.y, feet.x + side * UNSEEN_REACH, solids).x;
            for (let d = MIN_ENTRY; d <= Math.abs(reach - feet.x) + 1e-6; d += UNSEEN_STEP)
            {
                const x = feet.x + side * d, box = boxAt(cat, x, feet.y);
                if (this.canSee(box, cat.size) || inTheWay(box, cat.size, this.zones))
                    continue;
                if (!best || d < Math.abs(best.x - feet.x))
                    best = vec2(x, feet.y);
                break;
            }
        }
        return best;
    }

    /** Fallback: the nearest spot on Sammy's ground just past the edge of the screen as it is
     *  right now (the camera may pan over it later, by which time she's already trotting in). */
    offscreenEntrySpot()
    {
        const cat = this.cat, player = this.player;
        const feet = player.feetPos, solids = blockersFor(cat);
        const margin = cat.size.add(vec2(1, 1));
        let best = null;
        for (const side of [-player.facing, player.facing])
        {
            const reach = walkSpan(cat, feet.x, feet.y, feet.x + side * UNSEEN_REACH, solids).x;
            for (let d = MIN_ENTRY; d <= Math.abs(reach - feet.x) + 1e-6; d += UNSEEN_STEP)
            {
                const x = feet.x + side * d, box = boxAt(cat, x, feet.y);
                if (isOnScreen(box, margin) || inTheWay(box, cat.size, this.zones))
                    continue;
                if (!best || d < Math.abs(best.x - feet.x))
                    best = vec2(x, feet.y);
                break;
            }
        }
        return best;
    }

    /** Bring her in now: from out of sight if possible; after FETCH_FALLBACK_AFTER without one,
     *  from just off the current screen, or else under a page flip. Returns whether she's coming. */
    bringIn(via)
    {
        if (this.cat.performing)
            return false;   // never moved mid-ability: she comes once it's over (still pending)
        const late = this.noSpotFor >= C.FETCH_FALLBACK_AFTER;
        const spot = this.unseenEntrySpot() ?? (late ? this.offscreenEntrySpot() : null);
        if (spot)
        {
            this.follower.goTo(null);   // brought back to Sammy: an errand (a cat spot) is off
            this.placeBeside(via, { spot });
            return true;
        }
        if (!late)
            return false;
        this.follower.goTo(null);
        this.cover = { age: 0, via, placed: false };
        return true;
    }

    /** The page flip: she's put down beside him at full cover (mid-flip), then trots in. */
    updateCover()
    {
        const cover = this.cover;
        cover.age += timeDelta;
        if (!cover.placed && cover.age >= C.COVER_TIME / 2)
        {
            this.placeBeside(cover.via);
            cover.placed = true;
        }
        else if (!cover.placed)
            this.follower.held = true;
        if (cover.age >= C.COVER_TIME)
            this.cover = null;
    }

    /** Screen space, under the narrator's text box: the page flip, while one is running. */
    renderPost()
    {
        if (this.cover)
            drawPageFlip({ progress: Math.min(1, this.cover.age / C.COVER_TIME) });
    }

    /** correction:reset (the playing scene calls this after moving Sammy, under the page). */
    onPlayerReset()
    {
        this.regroupPending = this.fetchPending = false;
        this.placeBeside('correction', { hold: true });
    }

    /** correction:done: the page has lifted, off she trots. */
    release()
    {
        if (!this.regroupPending)
            this.follower?.release();
    }

    /** Sammy reached a checkpoint: if she's stuck waiting, or far behind, she'll catch up with
     *  him once she's out of sight and there's an unseen spot for her to trot in from. */
    onCheckpoint()
    {
        if (this.cat && this.leftBehind())
            this.fetchPending = true;
    }

    leftBehind()
    {
        return this.follower.state === 'waiting' || this.cat.feet.distance(this.player.feetPos) > C.CATCHUP_FAR;
    }

    tryFetch()
    {
        if (!this.leftBehind())
            return void (this.fetchPending = false);   // she made her own way (or he came back)
        if (this.follower.held || this.canSee(this.cat.pos, this.cat.size))
        {
            this.noSpotFor = 0;
            return;   // she'd vanish in front of him: not while he can see her (he can go to her)
        }
        if (this.bringIn('checkpoint'))
            this.fetchPending = false;
    }

    /** Below the world (should never happen): hold her there, unseen, and bring her in the same way. */
    tryRegroup()
    {
        this.follower.held = true;
        this.cat.placeAt(vec2(this.cat.feet.x, Math.min(this.cat.feet.y, -WORLD_FALL_MARGIN - 1)));
        if (this.bringIn('regroup'))
            this.regroupPending = false;
    }

    onWaiting(reason)
    {
        this.cat.mrrp();
        // On an errand (a cat spot) CatSpots sends catspot:unreachable instead: one narrator cue, not two.
        if (!this.follower?.goal)
            emit('companion:waiting', { cat: this.cat.catId, reason });
    }

    onCaughtUp(via)
    {
        this.cat.happyHop();
        emit('companion:caughtUp', { cat: this.cat.catId, via });
    }

    /** Once per step, after physics and every object's update (the playing scene's updatePost). */
    update()
    {
        if (!this.cat || !this.player)
            return;
        this.trail.record(this.player);
        if (this.cover)
            return this.updateCover();
        if (this.cat.pos.y < -WORLD_FALL_MARGIN && !this.regroupPending)
        {
            this.regroupPending = true;
            this.fetchPending = false;
            this.retryIn = 0;
            this.noSpotFor = 0;
        }
        if (!this.fetchPending && !this.regroupPending)
            return void (this.noSpotFor = 0);
        this.noSpotFor += timeDelta;
        if ((this.retryIn -= timeDelta) > 0)
            return this.regroupPending && this.cat.placeAt(this.cat.feet);   // stay held where she is
        this.retryIn = RETRY_EVERY;
        if (this.regroupPending)
            this.tryRegroup();
        else
            this.tryFetch();
    }

    /** Debug and T-016: send her somewhere (a cat spot) instead of following; null to follow again. */
    goTo(pos)
    {
        this.follower?.goTo(pos);
        return !!this.follower;
    }

    /** T-016 (CatSpots): the companion's entity in this level, or null. */
    currentCat()
    {
        return this.follower ? this.cat : null;
    }

    /** T-016 (CatSpots): how her goTo() errand is going: {hasGoal, arrived, waiting, reason}, or
     *  null with nobody along. hasGoal turns false if she was brought back to Sammy (bringIn). */
    errandState()
    {
        const follower = this.follower;
        if (!follower)
            return null;
        return { hasGoal: !!follower.goal, arrived: follower.atGoal, waiting: follower.state === 'waiting', reason: follower.reason };
    }

    // --- debug --------------------------------------------------------------------------------

    /** Debug: make this cat the companion now (null: nobody), in any level. She trots in if she's far away. */
    debugChoose(catId)
    {
        if (!catId || !catDef(catId))
        {
            if (this.cat)
                this.debugLetGo();
            this.catId = null;
            return true;
        }
        if (!this.level)
        {
            this.choose(catId);
            return true;
        }
        const cat = this.findOrBring(catId);
        if (!cat)
            return false;
        if (this.cat !== cat)
        {
            if (this.cat)
                this.debugLetGo();
            this.catId = cat.catId;
            this.adopt(cat);
            emit('companion:join', { cat: cat.catId });
        }
        const distance = cat.feet.distance(this.player.feetPos);
        if (distance > C.CATCHUP_DISTANCE || distance < MIN_ENTRY)
            this.placeBeside('regroup');
        return true;
    }

    /** Debug only: let go even of a visitor (the home rule doesn't apply to test setups). */
    debugLetGo()
    {
        const cat = this.cat;
        this.sendHome(cat);
        this.cat = this.follower = null;
        this.catId = null;
        this.trail.clear();
        this.fetchPending = this.regroupPending = false;
        emit('companion:leave', { cat: cat.catId });
    }

    /** Plain data for window.__sammy.companion (null when nobody is along). */
    debugState()
    {
        if (!this.catId)
            return null;
        const cat = this.cat, follower = this.follower;
        return {
            cat: this.catId,
            state: follower?.state ?? 'idle',
            pos: cat ? { x: cat.pos.x, y: cat.pos.y } : null,
            reason: follower?.reason ?? null,
            entityId: cat?.id ?? null,
            home: cat?.home ?? null,
            hub: !!this.level?.companionHub,
            held: follower?.held ?? false,
            via: follower?.via ?? null,
            fetchPending: this.fetchPending,
            regroupPending: this.regroupPending,
            covering: !!this.cover,
            lastEntry: this.lastEntry,
            goal: follower?.goal ?? null,
            atGoal: follower?.atGoal ?? false,
            distance: cat && this.player ? Math.round(cat.feet.distance(this.player.feetPos) * 1000) / 1000 : null,
            trail: this.trail.debugState(),
        };
    }
}

/** A level much narrower than the view, with things she can be left waiting at, will often have
 *  nowhere out of sight to bring her in from: she'll come in under a page flip instead. Fine, but
 *  worth knowing when designing it. */
function warnIfNarrow(level)
{
    const hazards = level.entities.filter(entity => ['gate', 'bridge', 'lift'].includes(entity?.mechanismType));
    const screens = level.size.x / getCameraSize().x;
    if (hazards.length && screens < C.NARROW_LEVEL_SCREENS)
        console.warn(`level "${level.id}" is ${screens.toFixed(1)} screens wide with ${hazards.length} gate/bridge/lift: `
            + 'a left-behind companion may have to be brought in under a page flip');
}
