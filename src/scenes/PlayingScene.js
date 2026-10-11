// The in-level scene: loads a level by id, puts the player at the spawn, runs zones and the camera.
// enter({ levelId }) loads; re-entering (e.g. __sammy.commands.loadLevel) tears down and reloads.
// enter({ levelId, checkpointId }) starts at that checkpoint instead of the spawn (Continue).
// Hosts the narrator (see the wiring notes at the top of systems/Narrator.js).
import {
    vec2, rgb, setGravity, mainCanvasSize, drawTextScreen,
} from '../../lib/littlejs/littlejs.esm.js';
import { on, emit } from '../core/events.js';
import { fetchLevelData, buildLevel } from '../systems/LevelLoader.js';
import { Camera } from '../systems/Camera.js';
import { TempBox } from '../entities/TempBox.js';
import { WORLD_GRAVITY } from '../data/tuning.js';

export const DEFAULT_LEVEL_ID = 'test';
const ERROR_COLOR = rgb(1, .75, .75);

export class PlayingScene
{
    constructor(narrator)
    {
        this.narrator = narrator;
        this.level = null;
        this.player = null;
        this.camera = new Camera();
        this.levelId = null;
        this.loading = false;
        this.loadError = null;
        this.loadToken = 0;
        this.unsubscribers = [];
    }

    enter({ levelId = DEFAULT_LEVEL_ID, checkpointId = null } = {})
    {
        this.startCheckpointId = checkpointId;
        setGravity(vec2(0, WORLD_GRAVITY));
        // Before load(): the narrator must be listening when the level emits level:start.
        this.narrator.loadScript(levelId);
        this.narrator.setPlayerPositionProvider(() => this.player?.pos ?? null);
        // The narrator runs the rewrite effect; it asks for the move while the page is covered.
        this.unsubscribers.push(on('correction:reset', () => this.resetPlayer()));
        this.load(levelId);
    }

    exit()
    {
        this.loadToken++;          // a load still in flight must not build into a scene we left
        this.narrator.dispose();   // completes a running correction (its reset still lands)
        this.narrator.setPlayerPositionProvider(null);
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        this.unload();
    }

    async load(levelId)
    {
        const token = ++this.loadToken;
        this.levelId = levelId;
        this.loading = true;
        this.loadError = null;
        try
        {
            const data = await fetchLevelData(levelId);
            if (token !== this.loadToken)
                return;
            this.unload();
            this.level = buildLevel(data);
            this.player = new TempBox(this.startPoint());
            this.camera.attach(this.player, this.level.size);
        }
        catch (error)
        {
            if (token !== this.loadToken)
                return;
            this.unload();            // never leave a half-loaded level behind
            this.loadError = error.message;
            console.error(error.message);
            return;
        }
        finally
        {
            if (token === this.loadToken)
                this.loading = false;
        }
        const { id, name, timeOfDay, size } = this.level;
        emit('level:start', { levelId: id, name, timeOfDay, size: { x: size.x, y: size.y } });
    }

    /** The spawn, or the saved checkpoint when continuing a story. */
    startPoint()
    {
        const zones = this.level.zones;
        if (this.startCheckpointId && !zones.restoreCheckpoint(this.startCheckpointId))
            console.warn(`level "${this.level.id}" has no checkpoint "${this.startCheckpointId}"; starting at the spawn`);
        return zones.respawnPoint;
    }

    unload()
    {
        this.camera.detach();
        this.player?.destroy();
        this.player = null;
        this.level?.destroy();
        this.level = null;
    }

    resetPlayer()
    {
        if (!this.player || !this.level)
            return;
        this.player.resetTo(this.level.zones.respawnPoint);
        this.camera.snap();   // under the page, so the world is already settled when it lifts
    }

    // Runs before engine objects update, so the narrator claims its E/Enter press before the
    // player (and later the interaction system) read input.
    update()
    {
        this.narrator.update();
    }

    // Zones and camera run after physics so they see this step's final positions.
    updatePost()
    {
        if (!this.level || !this.player)
            return;
        this.level.zones.update(this.player.pos, this.player.size);
        this.camera.update();
    }

    renderPost()
    {
        if (this.loadError)
            drawTextScreen(this.loadError, mainCanvasSize.scale(.5), 40, ERROR_COLOR);
        this.narrator.renderPost();
    }

    // --- debug hook ---------------------------------------------------------------------------

    levelDebugState()
    {
        if (!this.level)
            return { id: this.levelId, loading: this.loading, error: this.loadError };
        return { ...this.level.debugState(), loading: false };
    }

    /** Add level/camera/player state and level commands to window.__sammy. */
    installDebug(hook, sceneManager)
    {
        hook.register('level', () => this.levelDebugState());
        hook.register('camera', () => this.camera.debugState());
        hook.register('player', () => this.player?.debugState() ?? null);
        hook.commands.loadLevel = (levelId, checkpointId = null) => sceneManager.change('playing', { levelId, checkpointId });
        hook.commands.teleport = (x, y) =>
        {
            // World coordinates (y up) of the player's center, the same as __sammy.player.pos.
            if (!this.player)
                return;
            this.player.resetTo(vec2(x, y - this.player.size.y / 2));
            this.camera.snap();
        };
    }
}
