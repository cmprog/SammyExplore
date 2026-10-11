// Autosave: one save slot in localStorage, written at gameplay milestones (checkpoints, level
// complete; later cat rescues). The in-memory copy is the source of truth, so if storage is
// blocked (private mode, quota) the game still works and Continue still works this session.
//
// Shape (SAVE_SCHEMA_VERSION 1):
//   { schemaVersion, levelId, checkpointId, flags: {}, catsRescued: [], updatedAt }
//   checkpointId null = start of the level. updatedAt is an ISO timestamp.
// Audio settings are NOT here: Audio owns sammyexplore.settings.
//
// Events consumed: checkpoint:reached {id, levelId}, level:complete {id, levelId, nextLevel?}
import { timeReal } from '../../lib/littlejs/littlejs.esm.js';
import { on } from '../core/events.js';
import { SAVE_SCHEMA_VERSION } from '../data/version.js';
import { SCREENS } from '../data/tuning.js';
import { SAVE_TEXT } from '../data/screens.js';
import { drawSaveIcon } from '../art/drawSaveIcon.js';

export const SAVE_KEY = 'sammyexplore.save';

// MIGRATIONS[n] turns a version-n save into a version-(n + 1) save. Add one per schema bump.
const MIGRATIONS = {};

export class SaveSystem
{
    constructor()
    {
        this.storageOk = true;
        this.data = this.read();
        this.savedAt = -Infinity;    // timeReal of the last save, for the icon
        this.unsubscribers = [
            on('checkpoint:reached', ({ id, levelId }) => this.write({ levelId, checkpointId: id })),
            on('level:complete', payload => this.onLevelComplete(payload)),
        ];
    }

    hasSave()
    {
        return !!this.data;
    }

    /** Plain copy of the current save, or null. */
    current()
    {
        return this.data ? structuredClone(this.data) : null;
    }

    /** Start a fresh story at the beginning of `levelId`, replacing any old save. */
    newGame(levelId)
    {
        this.data = null;
        this.write({ levelId, checkpointId: null });
    }

    clear()
    {
        this.data = null;
        try { localStorage.removeItem(SAVE_KEY); }
        catch (error) { this.storageFailed('clear', error); }
    }

    onLevelComplete({ levelId, nextLevel })
    {
        // Continue picks up at the start of the next level. After the last level there is nowhere
        // further yet, so Continue replays the finished level from its start.
        const flags = { ...this.data?.flags, [`levelComplete.${levelId}`]: true };
        this.write({ levelId: nextLevel ?? levelId, checkpointId: null, flags });
    }

    write(changes)
    {
        this.data = {
            ...emptySave(),
            ...this.data,
            ...changes,
            schemaVersion: SAVE_SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
        };
        this.savedAt = timeReal;
        try
        {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
            this.storageOk = true;
        }
        catch (error) { this.storageFailed('write', error); }
    }

    read()
    {
        try
        {
            const text = localStorage.getItem(SAVE_KEY);
            return text ? migrate(JSON.parse(text)) : null;
        }
        catch (error)
        {
            this.storageFailed('read', error);
            return null;
        }
    }

    storageFailed(action, error)
    {
        this.storageOk = false;
        console.warn(`save: could not ${action} ${SAVE_KEY}; keeping the save in memory only`, error);
    }

    /** Small "saved" feather in the corner after each save. Screen space; call from renderPost. */
    renderPost()
    {
        const age = timeReal - this.savedAt;
        if (age >= 0 && age < SCREENS.SAVE_ICON_TIME)
            drawSaveIcon({ age, duration: SCREENS.SAVE_ICON_TIME, label: SAVE_TEXT.saved }, timeReal);
    }

    /** For window.__sammy.saveStatus. */
    debugState()
    {
        return { hasSave: this.hasSave(), storageOk: this.storageOk, iconShowing: timeReal - this.savedAt < SCREENS.SAVE_ICON_TIME };
    }
}

function emptySave()
{
    return { schemaVersion: SAVE_SCHEMA_VERSION, levelId: null, checkpointId: null, flags: {}, catsRescued: [], updatedAt: null };
}

/** Bring an old save up to the current schema. Returns null for anything unusable. */
function migrate(data)
{
    if (!data || typeof data !== 'object' || !Number.isInteger(data.schemaVersion))
        return null;
    let save = data;
    while (save.schemaVersion < SAVE_SCHEMA_VERSION)
    {
        const step = MIGRATIONS[save.schemaVersion];
        if (!step)
            return null;
        save = { ...step(save), schemaVersion: save.schemaVersion + 1 };
    }
    // A save from a newer game version: don't guess at its shape.
    if (save.schemaVersion !== SAVE_SCHEMA_VERSION || typeof save.levelId !== 'string')
        return null;
    return { ...emptySave(), ...save };
}
