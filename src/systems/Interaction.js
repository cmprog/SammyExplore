// Interaction: finds the nearest interactable in range of Sammy, floats an "E" bubble over it,
// and on E calls its interact() and emits interact:<type> with its payload ({id}, plus e.g. a
// sign's narration key). E with nothing in range emits interact:nothing.
//
// Interactables are entities spawned from level data (see entities/registry.js) that carry:
//   interactType       'door', 'sign', ... (the event is interact:<interactType>)
//   interactRadius     tiles, measured from interactPos to Sammy's center
//   interactPos        Vector2
//   promptPos          Vector2, where the bubble's tail points (just above the object)
//   canInteract()      false while it has nothing to offer (e.g. a door already opening)
//   interactPayload()  plain data for the event, at least {id}
//   interact()
//
// Wiring (PlayingScene): update() runs AFTER narrator.update() in the same step, because the
// narrator consumes the E press it uses to skip or dismiss a line; a consumed press is never an
// interaction. The prompt hides while gameplay input is locked (corrections, level complete).
import { vec2, timeDelta, time, cameraScale, worldToScreen } from 'littlejs';
import { emit } from '../core/events.js';
import { wasPressed, gameplayLockReasons } from '../core/input.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawInteractPrompt } from '../art/drawInteractPrompt.js';
import { INTERACTION, CAMERA_SCALE } from '../data/tuning.js';

export class Interaction
{
    constructor()
    {
        this.targets = [];
        this.nearest = null;   // in range right now (and allowed to show)
        this.shown = null;     // what the bubble is over; lags `nearest` while it fades out
        this.appear = 0;
    }

    /** Use the interactables among a level's entities. */
    setTargets(entities)
    {
        this.targets = entities.filter(entity => entity?.interactType);
    }

    /** Make something interactable that arrived after the level loaded (e.g. a rescued cat). */
    add(target)
    {
        if (target?.interactType && !this.targets.includes(target))
            this.targets.push(target);
    }

    remove(target)
    {
        this.targets = this.targets.filter(other => other !== target);
        if (this.nearest === target)
            this.nearest = null;
        if (this.shown === target)
        {
            this.shown = null;
            this.appear = 0;
        }
    }

    clear()
    {
        this.targets = [];
        this.nearest = this.shown = null;
        this.appear = 0;
    }

    /** @param {Vector2|null} playerPos - Sammy's center, or null when there is no player or the level is frozen */
    update(playerPos)
    {
        const live = !!playerPos && gameplayLockReasons().length === 0;
        this.nearest = live ? this.findNearest(playerPos) : null;
        if (live && wasPressed('interact'))
            this.press();
        this.updatePrompt();
    }

    findNearest(playerPos)
    {
        let best = null, bestDistance = Infinity;
        for (const target of this.targets)
        {
            if (target.destroyed || !target.canInteract())
                continue;
            const distance = target.interactPos.distance(playerPos);
            if (distance <= target.interactRadius && distance < bestDistance)
            {
                best = target;
                bestDistance = distance;
            }
        }
        return best;
    }

    press()
    {
        const target = this.nearest;
        if (!target)
            return void emit('interact:nothing');
        emit(`interact:${target.interactType}`, target.interactPayload());
        target.interact();
        // e.g. a door that started opening has nothing more to offer: let the bubble go now.
        if (!target.canInteract())
            this.nearest = null;
    }

    /** Fade out the old bubble before fading in over a new target, so it never jumps across. */
    updatePrompt()
    {
        if (this.shown && this.shown !== this.nearest)
        {
            this.appear = Math.max(0, this.appear - timeDelta / INTERACTION.PROMPT_FADE_OUT);
            if (this.appear === 0)
                this.shown = null;
        }
        if (!this.shown && this.nearest)
            this.shown = this.nearest;
        if (this.shown && this.shown === this.nearest)
            this.appear = Math.min(1, this.appear + timeDelta / INTERACTION.PROMPT_FADE_IN);
    }

    renderPost()
    {
        if (!this.shown || this.appear <= 0 || this.shown.destroyed)
            return;
        const bob = Math.sin(time * INTERACTION.PROMPT_BOB_SPEED) * INTERACTION.PROMPT_BOB;
        const pos = worldToScreen(this.shown.promptPos.add(vec2(0, INTERACTION.PROMPT_LIFT + bob)));
        // Bubble art is sized in screen pixels for the default zoom; keep it in step with the camera.
        const zoom = cameraScale / CAMERA_SCALE;
        drawScreenCanvas(ctx =>
        {
            ctx.translate(pos.x, pos.y);
            ctx.scale(zoom, zoom);
            drawInteractPrompt(ctx, { x: 0, y: 0 }, this.appear, time);
        });
    }

    /** Plain data for window.__sammy.interaction. */
    debugState()
    {
        return {
            nearest: this.nearest ? describe(this.nearest) : null,
            prompt: {
                visible: !!this.shown && this.appear > 0,
                target: this.shown ? describe(this.shown) : null,
                appear: Math.round(this.appear * 1000) / 1000,
            },
            targets: this.targets.filter(target => !target.destroyed).map(target => target.debugState?.() ?? describe(target)),
        };
    }
}

function describe(target)
{
    return { type: target.interactType, id: target.interactPayload().id };
}
