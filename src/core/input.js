// Action mapping. Gameplay code asks about actions, never raw keys,
// so controls can be rebound or extended (gamepad) in one place.
//
// wasPressed/wasReleased are only valid during update/updatePost: the engine clears the
// pressed/released flags right after gameUpdatePost, before render. isDown works anywhere.
import {
    keyIsDown, keyWasPressed, keyWasReleased,
    mouseIsDown, mouseWasPressed, mouseWasReleased, mousePosScreen,
} from '../../lib/littlejs/littlejs.esm.js';
import { ACTION_KEYS } from '../data/controls.js';

// Keys masked until physically released, so a press that belonged to the previous
// scene (e.g. Space to confirm a menu) doesn't leak into the next one as a held jump.
const suppressedKeys = new Set();

function keysFor(action)
{
    const keys = ACTION_KEYS[action];
    if (!keys)
        throw new Error(`unknown input action "${action}"`);
    return keys;
}

function liveKeys(action)
{
    return keysFor(action).filter(key => !suppressedKeys.has(key));
}

export function isDown(action)
{
    return liveKeys(action).some(key => keyIsDown(key));
}

export function wasPressed(action)
{
    return liveKeys(action).some(key => keyWasPressed(key));
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

/** Call once per update step, after gameplay has read input (main.js does this in updatePost). */
export function endInputFrame()
{
    // Keep the key masked through its release step, then let it go.
    for (const key of suppressedKeys)
        if (!keyIsDown(key))
            suppressedKeys.delete(key);
}

// Mouse is for UI only. Positions are screen space (canvas pixels, 1920x1080).
export const mouse = {
    isDown:      (button = 0) => mouseIsDown(button),
    wasPressed:  (button = 0) => mouseWasPressed(button),
    wasReleased: (button = 0) => mouseWasReleased(button),
    get pos()    { return mousePosScreen.copy(); },
};
