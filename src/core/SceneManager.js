// One place that owns which scene is active. Scenes are plain objects (or class instances)
// with optional lifecycle methods: enter(params), exit(), pause(), resume(), update(),
// updatePost(), render(), renderPost().
//
// Scenes form a stack so overlays (pause menu, level complete) can sit on top of the playing
// scene without exiting it: exiting the playing scene unloads the level and disposes the narrator.
// Only the top scene updates, unless it sets `updatesBelow = true` (then the scene under it keeps
// updating too, e.g. the level keeps animating behind a celebration). Every scene renders, bottom first.
//   change(name)  exit the whole stack (top first), then enter `name` as the only scene
//   push(name)    pause() the top scene, enter `name` on top of it
//   pop()         exit the top scene, resume() the one underneath
//
// Requests are queued and applied at a frame boundary (top of update, and in updatePost because
// the engine skips gameUpdate while paused). That way a scene never gets exit() called halfway
// through its own update. The last request before the boundary wins.
import { emit } from './events.js';
import { suppressUntilReleased, suppressMenuKeysUntilReleased } from './input.js';

// A scene whose enter() keeps requesting another change would otherwise loop forever.
const MAX_TRANSITIONS_PER_STEP = 8;

export class SceneManager
{
    constructor()
    {
        this.scenes = new Map();
        this.stack = [];       // [{ name, scene }], bottom first
        this.pending = null;
        this.applying = false;
    }

    /** The top scene (the one that gets input). */
    get current()     { return this.stack.at(-1)?.scene ?? null; }
    get currentName() { return this.stack.at(-1)?.name ?? null; }
    /** Scene names, bottom first, for the test hook. */
    get stackNames()  { return this.stack.map(entry => entry.name); }

    register(name, scene)
    {
        this.scenes.set(name, scene);
    }

    /** Replace the whole stack with `name`. */
    change(name, params = {})
    {
        this.request('change', name, params);
    }

    /** Put `name` on top; the scenes below keep their state. */
    push(name, params = {})
    {
        this.request('push', name, params);
    }

    /** Remove the top scene and resume the one below. Ignored when only one scene is left. */
    pop()
    {
        this.pending = { kind: 'pop' };
    }

    request(kind, name, params)
    {
        if (!this.scenes.has(name))
            throw new Error(`unknown scene "${name}"`);
        this.pending = { kind, name, params };
    }

    update()
    {
        this.applyPending();
        this.updatingEntries().forEach(entry => entry.scene.update?.());
    }

    updatePost()
    {
        this.applyPending();
        this.updatingEntries().forEach(entry => entry.scene.updatePost?.());
    }

    render()     { this.stack.forEach(entry => entry.scene.render?.()); }
    renderPost() { this.stack.forEach(entry => entry.scene.renderPost?.()); }

    /** The top scene plus any scenes it lets keep running, bottom first. */
    updatingEntries()
    {
        let first = this.stack.length - 1;
        while (first > 0 && this.stack[first].scene.updatesBelow)
            first--;
        return this.stack.slice(Math.max(first, 0));
    }

    applyPending()
    {
        // Requests from exit()/enter() just set pending; the loop below picks them up.
        if (this.applying)
            return;
        this.applying = true;
        try
        {
            for (let i = 0; this.pending && i < MAX_TRANSITIONS_PER_STEP; i++)
                this.transition(this.pending);
            if (this.pending)
                console.warn(`scene changes did not settle; deferring "${this.pending.name ?? this.pending.kind}"`);
        }
        finally
        {
            this.applying = false;
        }
    }

    transition(request)
    {
        this.pending = null;
        const from = this.currentName;
        if (request.kind === 'pop')
        {
            if (this.stack.length < 2)
                return;
            this.stack.pop().scene.exit?.();
            // Only Esc/Enter: a held Space or direction (e.g. a glide) carries back into the level.
            // Their press edges were already used by the overlay, so nothing re-triggers.
            suppressMenuKeysUntilReleased();
            this.current.resume?.();
        }
        else
        {
            if (request.kind === 'change')
                while (this.stack.length)
                    this.stack.pop().scene.exit?.();
            else
                this.current?.pause?.();
            this.stack.push({ name: request.name, scene: this.scenes.get(request.name) });
            // The key that triggered the change (e.g. Space on a menu) must not carry into the new
            // scene. Overlays mask only menu keys, so held gameplay keys survive a pause round trip.
            if (request.kind === 'change')
                suppressUntilReleased();
            else
                suppressMenuKeysUntilReleased();
            this.current.enter?.(request.params);
        }
        emit('scene:change', { from, to: this.currentName, kind: request.kind });
    }
}
