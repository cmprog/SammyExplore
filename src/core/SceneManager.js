// One place that owns which scene is active. Scenes are plain objects (or class instances)
// with optional lifecycle methods: enter(params), exit(), update(), updatePost(), render(), renderPost().
//
// change() only queues the switch; it is applied at a frame boundary (top of update, and in
// updatePost because the engine skips gameUpdate while paused). That way a scene never gets
// exit() called halfway through its own update.
import { emit } from './events.js';
import { suppressUntilReleased } from './input.js';

// A scene whose enter() keeps requesting another change would otherwise loop forever.
const MAX_TRANSITIONS_PER_STEP = 8;

export class SceneManager
{
    constructor()
    {
        this.scenes = new Map();
        this.current = null;
        this.currentName = null;
        this.pending = null;
        this.applying = false;
    }

    register(name, scene)
    {
        this.scenes.set(name, scene);
    }

    /** Request a scene change. The last request before the next frame boundary wins. */
    change(name, params = {})
    {
        if (!this.scenes.has(name))
            throw new Error(`unknown scene "${name}"`);
        this.pending = { name, params };
    }

    update()
    {
        this.applyPending();
        this.current?.update?.();
    }

    updatePost()
    {
        this.applyPending();
        this.current?.updatePost?.();
    }

    render()     { this.current?.render?.(); }
    renderPost() { this.current?.renderPost?.(); }

    applyPending()
    {
        // change() called from exit()/enter() just sets pending; the loop below picks it up.
        if (this.applying)
            return;
        this.applying = true;
        try
        {
            for (let i = 0; this.pending && i < MAX_TRANSITIONS_PER_STEP; i++)
                this.transition(this.pending);
            if (this.pending)
                console.warn(`scene changes did not settle; deferring "${this.pending.name}"`);
        }
        finally
        {
            this.applying = false;
        }
    }

    transition({ name, params })
    {
        this.pending = null;
        const previousName = this.currentName;
        this.current?.exit?.();
        this.current = this.scenes.get(name);
        this.currentName = name;
        // The key that triggered the change (e.g. Space on a menu) must not carry into the new scene.
        suppressUntilReleased();
        this.current.enter?.(params);
        emit('scene:change', { from: previousName, to: name });
    }
}
