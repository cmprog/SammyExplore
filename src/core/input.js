// Action mapping. Gameplay code asks about actions, never raw keys,
// so controls can be rebound or extended (gamepad) in one place.
//
// wasPressed/wasReleased are only valid during update/updatePost: the engine clears the
// pressed/released flags right after gameUpdatePost, before render. isDown works anywhere.
import {
    keyIsDown, keyWasPressed, keyWasReleased,
    mouseIsDown, mouseWasPressed, mouseWasReleased, mousePosScreen, mouseInWindow,
} from '../../lib/littlejs/littlejs.esm.js';
import { ACTION_KEYS, GAMEPLAY_ACTIONS, MENU_ACTIONS } from '../data/controls.js';

// Keys masked until physically released, so a press that belonged to the previous
// scene (e.g. Space to confirm a menu) doesn't leak into the next one as a held jump.
const suppressedKeys = new Set();

// Reasons gameplay input is currently locked (e.g. 'correction'). A set, so independent
// systems can lock and unlock without stepping on each other.
const gameplayLocks = new Set();
const gameplayActions = new Set(GAMEPLAY_ACTIONS);

// Gameplay actions still held when a lock ended. Masked per action (not per key) until
// released, so a direction held through a correction doesn't snap Sammy into motion, while
// a shared key's other actions (E is also `advance`) keep working.
const heldThroughLock = new Set();

// Keys whose press this frame was already used by someone (see consumePress).
const consumedKeys = new Set();

function keysFor(action)
{
    const keys = ACTION_KEYS[action];
    if (!keys)
        throw new Error(`unknown input action "${action}"`);
    return keys;
}

function liveKeys(action)
{
    const keys = keysFor(action);
    if (gameplayActions.has(action) && (gameplayLocks.size || heldThroughLock.has(action)))
        return [];
    return keys.filter(key => !suppressedKeys.has(key));
}

export function isDown(action)
{
    return liveKeys(action).some(key => keyIsDown(key));
}

export function wasPressed(action)
{
    return liveKeys(action).some(key => keyWasPressed(key) && !consumedKeys.has(key));
}

/** Claim this frame's press of `action`: wasPressed() is false for the rest of the frame for
 *  every action sharing those keys (e.g. the narrator using E means it isn't also `interact`).
 *  Whoever reads first wins, so the update order of systems matters. */
export function consumePress(action)
{
    for (const key of keysFor(action))
        if (keyWasPressed(key))
            consumedKeys.add(key);
}

export function wasReleased(action)
{
    // Releasing a suppressed key is masked too: its press was never seen.
    return liveKeys(action).some(key => keyWasReleased(key));
}

/** Names of all actions currently held (after suppression), for debug display and the test hook. */
export function actionsDown()
{
    return Object.keys(ACTION_KEYS).filter(isDown);
}

/** Mask every mapped key that is down right now until it is released. */
export function suppressUntilReleased()
{
    for (const keys of Object.values(ACTION_KEYS))
        for (const key of keys)
            if (keyIsDown(key))
                suppressedKeys.add(key);
}

/** Like suppressUntilReleased, but only for menu keys that gameplay doesn't share (Esc, Enter).
 *  Used when an overlay opens or closes over a level, so held movement/jump keys keep working. */
export function suppressMenuKeysUntilReleased()
{
    const gameplayKeys = new Set(GAMEPLAY_ACTIONS.flatMap(action => keysFor(action)));
    for (const action of MENU_ACTIONS)
        for (const key of keysFor(action))
            if (!gameplayKeys.has(key) && keyIsDown(key))
                suppressedKeys.add(key);
}

/** Mask the gameplay actions (movement, jump, interact) until unlockGameplay(reason). */
export function lockGameplay(reason)
{
    gameplayLocks.add(reason);
}

export function unlockGameplay(reason)
{
    if (!gameplayLocks.delete(reason) || gameplayLocks.size)
        return;
    for (const action of gameplayActions)
        if (rawIsDown(action))
            heldThroughLock.add(action);
}

function rawIsDown(action)
{
    return keysFor(action).some(key => keyIsDown(key) && !suppressedKeys.has(key));
}

/** Current lock reasons, for the test hook. Empty when gameplay input is live. */
export function gameplayLockReasons()
{
    return [...gameplayLocks];
}

/** Call once per update step, after gameplay has read input (main.js does this in updatePost). */
export function endInputFrame()
{
    // Keep the key masked through its release step, then let it go.
    for (const key of suppressedKeys)
        if (!keyIsDown(key))
            suppressedKeys.delete(key);
    for (const action of heldThroughLock)
        if (!keysFor(action).some(key => keyIsDown(key)))
            heldThroughLock.delete(action);
    consumedKeys.clear();
}

// Mouse is for UI only. Positions are screen space (canvas pixels, 1920x1080).
export const mouse = {
    isDown:      (button = 0) => mouseIsDown(button),
    wasPressed:  (button = 0) => mouseWasPressed(button),
    wasReleased: (button = 0) => mouseWasReleased(button),
    get pos()    { return mousePosScreen.copy(); },
    get inWindow() { return mouseInWindow; },
};
