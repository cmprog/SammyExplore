// window.__sammy: read-only game state for playtests and the console, plus debug commands.
// Systems add their own state with register() so this file never needs to know about them.
// Getters should return plain data: the playtest harness reads the hook via JSON.stringify.
import { engineVersion } from '../../lib/littlejs/littlejs.esm.js';
import { recentEvents, emit } from './events.js';
import { actionsDown, gameplayLockReasons } from './input.js';
import { GAME_VERSION } from '../data/version.js';

const RESERVED_KEYS = new Set(['commands', 'register']);

export function installDebugHook(sceneManager)
{
    const hook = {
        commands: {},
        register(key, getter)
        {
            if (RESERVED_KEYS.has(key) || Object.hasOwn(hook, key))
            {
                console.warn(`__sammy.register: "${key}" is reserved or already registered`);
                return;
            }
            // Getter-only and enumerable: read-only from outside, and JSON.stringify includes it.
            Object.defineProperty(hook, key, { get: safeGetter(key, getter), enumerable: true });
        },
    };

    hook.register('version', () => ({ game: GAME_VERSION, engine: engineVersion }));
    hook.register('scene', () => sceneManager.currentName);
    hook.register('events', recentEvents);
    hook.register('input', actionsDown);
    hook.register('inputLocks', gameplayLockReasons);

    // Queued like any scene change: it takes effect on the next update step.
    hook.commands.changeScene = (name, params) => sceneManager.change(name, params);
    // Fire any bus event, e.g. emit('correction:triggered', {id: 'pond'}) to test reactions.
    hook.commands.emit = (name, data) => emit(name, data);

    window.__sammy = hook;
    return hook;
}

// A broken getter must not make the whole hook unserializable for the playtester.
function safeGetter(key, getter)
{
    return () =>
    {
        try { return getter(); }
        catch (error) { return { error: `${key}: ${error.message}` }; }
    };
}
