// Autosave: one save slot in localStorage, written at gameplay milestones (checkpoints, level
// complete, choosing a companion; later cat rescues). The in-memory copy is the source of truth,
// so if storage is blocked (private mode, quota) the game still works and Continue still works
// this session.
//
// Shape (SAVE_SCHEMA_VERSION 2):
//   { schemaVersion, levelId, checkpointId, reachedCheckpoints: [], flags: {}, catsRescued: [],
//     companion, updatedAt }
//   checkpointId null = start of the level. reachedCheckpoints = every checkpoint id reached in
//   levelId so far (they stay used up on Continue). companion = the cat id along with Sammy
//   (data/cats.js), or null. updatedAt is an ISO timestamp.
// History: v1 (M1, live on the deployed site) had no companion; v1 -> v2 adds companion: null.
// Audio settings are NOT here: Audio owns sammyexplore.settings.
//
// Two separate questions: is there a usable save (Continue), and is there anything stored at
// all (New Game must ask before replacing it, even if it's corrupt or from a newer version).
// `status` says what was found at startup: none | ok | corrupt (not JSON) | invalid (wrong shape)
// | newer (from a later game version) | blocked (storage could not be read).
//
// Events consumed: checkpoint:reached {id, levelId}, level:complete {id, levelId, nextLevel?},
//   companion:join {cat}, companion:leave {cat}
import { timeReal } from 'littlejs';
import { on } from '../core/events.js';
import { SAVE_SCHEMA_VERSION } from '../data/version.js';
import { SCREENS } from '../data/tuning.js';
import { SAVE_TEXT } from '../data/screens.js';
import { CATS } from '../data/cats.js';
import { drawSaveIcon } from '../art/drawSaveIcon.js';

export const SAVE_KEY = 'sammyexplore.save';

// MIGRATIONS[n] turns a version-n save into a version-(n + 1) save. Add one per schema bump.
const MIGRATIONS = {
    // T-015: the companion. A v1 story had nobody along (Twyx stays where Chapter One puts her).
    1: save => ({ ...save, companion: null }),
};

export class SaveSystem
{
    constructor()
    {
        this.storageOk = true;
        this.status = 'none';
        this.rawExists = false;     // something is stored under SAVE_KEY, usable or not
        this.data = this.read();
        this.savedAt = -Infinity;   // timeReal of the last save, for the icon
        this.unsubscribers = [
            on('checkpoint:reached', payload => this.onCheckpoint(payload)),
            on('level:complete', payload => this.onLevelComplete(payload)),
            on('companion:join', ({ cat } = {}) => this.onCompanion(cat)),
            on('companion:leave', ({ cat } = {}) =>
            {
                if (this.data?.companion === cat)
                    this.onCompanion(null);
            }),
        ];
    }

    /** A save Continue can use. */
    hasSave()
    {
        return !!this.data;
    }

    /** Anything New Game would replace: a usable save, or stored data we couldn't use. */
    hasStoredData()
    {
        return this.hasSave() || this.rawExists;
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
        try
        {
            localStorage.removeItem(SAVE_KEY);
            this.rawExists = false;
            this.status = 'none';
        }
        catch (error) { this.storageFailed('clear', error); }
    }

    onCheckpoint({ id, levelId })
    {
        const earlier = this.data?.levelId === levelId ? this.data.reachedCheckpoints : [];
        const reachedCheckpoints = earlier.includes(id) ? earlier : [...earlier, id];
        this.write({ levelId, checkpointId: id, reachedCheckpoints });
    }

    onLevelComplete({ levelId, nextLevel })
    {
        // Continue picks up at the start of the next level. After the last level there is nowhere
        // further yet, so Continue replays the finished level from its start.
        const flags = { ...this.data?.flags, [`levelComplete.${levelId}`]: true };
        this.write({ levelId: nextLevel ?? levelId, checkpointId: null, reachedCheckpoints: [], flags });
    }

    /** Choosing (or letting go of) a companion is a milestone. Only into a story in progress:
     *  with no save (a debug level load) there is nothing to attach it to. */
    onCompanion(cat)
    {
        if (cat && !CATS[cat])
            return;   // a debug test cat is never saved
        if (this.data && this.data.companion !== cat)
            this.write({ companion: cat ?? null });
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
            this.rawExists = true;
            this.status = 'ok';
        }
        catch (error) { this.storageFailed('write', error); }
    }

    read()
    {
        let text;
        try { text = localStorage.getItem(SAVE_KEY); }
        catch (error)
        {
            this.storageFailed('read', error);
            this.status = 'blocked';
            return null;
        }
        if (text === null)
            return null;
        this.rawExists = true;
        let parsed;
        try { parsed = JSON.parse(text); }
        catch
        {
            this.status = 'corrupt';
            console.warn(`save: ${SAVE_KEY} is not valid JSON; ignoring it (New Game will ask before replacing it)`);
            return null;
        }
        const save = migrate(parsed);
        this.status = save ? 'ok' : parsed?.schemaVersion > SAVE_SCHEMA_VERSION ? 'newer' : 'invalid';
        if (!save)
            console.warn(`save: ${SAVE_KEY} is ${this.status}; ignoring it (New Game will ask before replacing it)`);
        return save;
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
        return {
            hasSave: this.hasSave(),
            hasStoredData: this.hasStoredData(),
            status: this.status,
            storageOk: this.storageOk,
            iconShowing: timeReal - this.savedAt < SCREENS.SAVE_ICON_TIME,
        };
    }
}

function emptySave()
{
    return {
        schemaVersion: SAVE_SCHEMA_VERSION, levelId: null, checkpointId: null, reachedCheckpoints: [],
        flags: {}, catsRescued: [], companion: null, updatedAt: null,
    };
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
    const merged = { ...emptySave(), ...save };
    if (!Array.isArray(merged.reachedCheckpoints))
        merged.reachedCheckpoints = [];
    if (!CATS[merged.companion])
        merged.companion = null;   // a cat this version doesn't know (or junk): nobody along
    return merged;
}
