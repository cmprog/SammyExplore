// Tiny event bus. Systems talk through this instead of importing each other.
// Keeps a ring buffer of recent events so the debug hook / playtests can see what happened.
//
// Payloads must be plain data (numbers, strings, arrays, plain objects), not entities or
// vectors with methods: they are copied on emit and serialized to JSON by the test hook.
import { time } from '../../lib/littlejs/littlejs.esm.js';
import { currentFrame } from './clock.js';

const RECENT_EVENT_LIMIT = 50;

const listeners = new Map();   // event name -> Set of handlers
const recent = [];

/** Subscribe to an event. Returns an unsubscribe function for convenience. */
export function on(name, handler)
{
    if (!listeners.has(name))
        listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return () => off(name, handler);
}

export function off(name, handler)
{
    listeners.get(name)?.delete(handler);
}

export function emit(name, data)
{
    // Copy so a listener (or later mutation by the sender) can't rewrite history in the buffer.
    const payload = copyPayload(data);
    // `time` freezes while the engine is paused; `frame` keeps counting.
    recent.push({ name, data: payload, time, frame: currentFrame() });
    if (recent.length > RECENT_EVENT_LIMIT)
        recent.shift();

    // Copy so handlers can safely unsubscribe while we iterate.
    for (const handler of [...(listeners.get(name) ?? [])])
    {
        // One broken listener must not stop the others (or the game loop).
        try { handler(payload); }
        catch (error) { console.error(`event handler for "${name}" threw`, error); }
    }
}

/** Oldest-first copy of the most recent events. */
export function recentEvents()
{
    return recent.slice();
}

function copyPayload(data)
{
    if (data === null || typeof data !== 'object')
        return data;
    try { return structuredClone(data); }
    catch
    {
        // Non-cloneable payload (e.g. contains functions): fall back to a shallow copy.
        console.warn('event payload is not plain data; shallow-copying', data);
        return Array.isArray(data) ? [...data] : { ...data };
    }
}
