// The swirl transition (T-017): how Sammy travels between the bedroom and a chapter. The swirl
// closes in over the view (on the portal, when he steps into it), the new level is loaded behind
// it, and once it's built (level:start) the swirl opens out on the new place. Gameplay input is
// locked from the first swirl until the view is clear again; the pause key waits too (main.js).
// One instance for the game (main.js), so it survives the scene change it asks for. The level
// is entered fresh (its spawn, no checkpoint); the companion comes along as on any level change.
//
// Started by main.js on portal:enter, and by the level complete overlay going home.
// Events consumed: level:start, level:loadFailed (the swirl opens either way; main.js has
// already sent a failed load back to the title)
import { vec2, timeReal, clamp, smoothStep, worldToScreen, mainCanvasSize } from 'littlejs';
import { on } from '../core/events.js';
import { lockGameplay, unlockGameplay } from '../core/input.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawSwirlTransition } from '../art/drawSwirlTransition.js';
import { SWIRL_TRANSITION as T } from '../data/tuning.js';

const LOCK_REASON = 'swirl';

export class SwirlTransition
{
    /**
     * @param {SceneManager} scenes
     * @param {() => Vector2|null} [arrivalPos] - where Sammy is in the new level (world), so the
     *        swirl opens out around him; the middle of the view if null
     */
    constructor(scenes, arrivalPos = () => null)
    {
        this.scenes = scenes;
        this.arrivalPos = arrivalPos;
        this.phase = 'idle';   // idle | closing | covered | opening
        this.age = 0;
        this.spin = 0;
        this.levelId = null;
        this.color = null;
        this.center = { x: 0, y: 0 };
        this.levelReady = false;
        this.lastTime = timeReal;
        this.trips = 0;
        // For the whole game, so never unsubscribed.
        on('level:start', () => { this.levelReady = true; });
        on('level:loadFailed', () => { this.levelReady = true; });
    }

    get active()
    {
        return this.phase !== 'idle';
    }

    /**
     * Swirl away to `levelId`. False if a trip is already under way.
     * @param {{levelId:string, color:Color, focus?:{x:number, y:number}|null}} trip - focus: the
     *        world point the swirl closes in on (the portal); the middle of the view if left out
     */
    start({ levelId, color, focus = null })
    {
        if (this.active)
            return false;
        lockGameplay(LOCK_REASON);
        this.phase = 'closing';
        this.age = 0;
        this.levelId = levelId;
        this.color = color.copy();
        this.center = this.screenPoint(focus);
        this.trips++;
        return true;
    }

    /** Every update step (main.js), on real time so a slow frame can't skip the cover. */
    updatePost()
    {
        const dt = clamp(timeReal - this.lastTime, 0, .1);
        this.lastTime = timeReal;
        if (!this.active)
            return;
        this.age += dt;
        this.spin += dt * (this.phase === 'opening' ? 3 : 5);
        if (this.phase === 'closing' && this.age >= T.CLOSE_TIME)
        {
            this.levelReady = false;
            this.setPhase('covered');
            this.scenes.change('playing', { levelId: this.levelId, checkpointId: null, reachedCheckpoints: [] });
        }
        else if (this.phase === 'covered' && ((this.levelReady && this.age >= T.HOLD_MIN) || this.age >= T.HOLD_MAX))
        {
            this.center = this.screenPoint(this.arrivalPos());
            this.setPhase('opening');
        }
        else if (this.phase === 'opening' && this.age >= T.OPEN_TIME)
        {
            this.setPhase('idle');
            unlockGameplay(LOCK_REASON);
        }
    }

    /** A world point on screen (kept on the canvas), or the middle of the view. */
    screenPoint(world)
    {
        if (!world)
            return { x: mainCanvasSize.x / 2, y: mainCanvasSize.y / 2 };
        const screen = worldToScreen(vec2(world.x, world.y));
        return { x: clamp(screen.x, 0, mainCanvasSize.x), y: clamp(screen.y, 0, mainCanvasSize.y) };
    }

    setPhase(phase)
    {
        this.phase = phase;
        this.age = 0;
    }

    cover()
    {
        switch (this.phase)
        {
            case 'closing': return smoothStep(clamp(this.age / T.CLOSE_TIME, 0, 1));
            case 'covered': return 1;
            case 'opening': return 1 - smoothStep(clamp(this.age / T.OPEN_TIME, 0, 1));
            default: return 0;
        }
    }

    /** Screen space, above every scene (main.js calls it after the scenes' renderPost). */
    renderPost()
    {
        if (!this.active)
            return;
        const state = { cover: this.cover(), center: this.center, color: this.color, spin: this.spin };
        drawScreenCanvas(ctx => drawSwirlTransition(ctx, state, timeReal));
    }

    /** For window.__sammy.transition. */
    debugState()
    {
        return {
            phase: this.phase,
            levelId: this.levelId,
            cover: Math.round(this.cover() * 100) / 100,
            trips: this.trips,
        };
    }
}
