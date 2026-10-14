// The in-level scene: loads a level by id, puts the player at the spawn, runs zones and the camera.
// enter({ levelId }) loads; re-entering (e.g. __sammy.commands.loadLevel) tears down and reloads.
// enter({ levelId, checkpointId, reachedCheckpoints }) starts at that checkpoint instead of the
// spawn (Continue); reachedCheckpoints are already used up. newStory: true (New Game) makes the
// narrator forget every line it has said this session, so the story is told fresh. A level that fails to load emits
// level:loadFailed (main.js falls back to the title).
// Hosts the narrator (see the wiring notes at the top of systems/Narrator.js) and the
// interaction system, which reads E only after the narrator has had its chance to use it.
import {
    vec2, rgb, setGravity, mainCanvasSize, drawTextScreen, timeDelta,
} from 'littlejs';
import { on, emit } from '../core/events.js';
import { fetchLevelData, buildLevel } from '../systems/LevelLoader.js';
import { Camera } from '../systems/Camera.js';
import { Sammy } from '../entities/Sammy.js';
import { createEnvironment } from '../systems/createEnvironment.js';
import { Interaction } from '../systems/Interaction.js';
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
        this.interaction = new Interaction();
        this.environment = null;   // the sky backdrop outdoors, or a room (systems/createEnvironment.js)
        this.levelId = null;
        this.loading = false;
        this.loadError = null;
        this.loadToken = 0;
        this.unsubscribers = [];
        this.startCheckpointId = null;
        this.reachedCheckpoints = [];
        this.overlaid = false;   // an overlay scene is on top (see pause())
    }

    enter({ levelId = DEFAULT_LEVEL_ID, checkpointId = null, reachedCheckpoints = [], newStory = false } = {})
    {
        this.startCheckpointId = checkpointId;
        this.reachedCheckpoints = reachedCheckpoints;
        this.overlaid = false;
        setGravity(vec2(0, WORLD_GRAVITY));
        if (newStory)
            this.narrator.forgetSeen();
        // Before load(): the narrator must be listening when the level emits level:start.
        this.narrator.loadScript(levelId);
        this.narrator.setPlayerPositionProvider(() => this.playerPos());
        // The narrator runs the rewrite effect; it asks for the move while the page is covered.
        this.unsubscribers.push(on('correction:reset', () => this.resetPlayer()));
        this.unsubscribers.push(on('correction:done', () => this.level?.zones.rearmCorrections()));
        this.unsubscribers.push(on('level:start', () => this.showEnvironment()));
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
            this.level = buildLevel(data, { playerPos: () => this.playerPos() });
            this.player = new Sammy(this.startPoint());
            this.interaction.setTargets(this.level.entities);
            this.camera.attach(this.player, this.level.size);
        }
        catch (error)
        {
            if (token !== this.loadToken)
                return;
            this.unload();            // never leave a half-loaded level behind
            this.loadError = error.message;
            console.error(error.message);
            emit('level:loadFailed', { levelId, message: error.message });
            return;
        }
        finally
        {
            if (token === this.loadToken)
                this.loading = false;
        }
        const { id, name, environment, timeOfDay, size } = this.level;
        // checkpointId: where a Continue picked the story up (null on a fresh start).
        const checkpointId = this.level.zones.checkpointId ?? null;
        emit('level:start', { levelId: id, name, environment, timeOfDay, size: { x: size.x, y: size.y }, checkpointId });
    }

    /** A copy of the player's position (or null), so no other system can move Sammy by accident. */
    playerPos()
    {
        return this.player?.pos.copy() ?? null;
    }

    /** The spawn, or the saved checkpoint when continuing a story. */
    startPoint()
    {
        const zones = this.level.zones;
        if (this.startCheckpointId && !zones.restoreCheckpoint(this.startCheckpointId, this.reachedCheckpoints))
            console.warn(`level "${this.level.id}" has no checkpoint "${this.startCheckpointId}"; starting at the spawn`);
        return zones.respawnPoint;
    }

    unload()
    {
        this.environment?.destroy();
        this.environment = null;
        this.camera.detach();
        this.interaction.clear();
        this.player?.destroy();
        this.player = null;
        this.level?.destroy();
        this.level = null;
    }

    showEnvironment()
    {
        this.environment?.destroy();
        this.environment = null;
        if (this.level)
            this.environment = createEnvironment(this.level);
    }

    resetPlayer()
    {
        if (!this.player || !this.level)
            return;
        this.player.resetTo(this.level.zones.respawnPoint);
        this.camera.snap();   // under the page, so the world is already settled when it lifts
    }

    // Runs before engine objects update. The narrator goes first so it claims its E/Enter press
    // before the interaction system (and the player) read input.
    update()
    {
        this.narrator.update();
        this.environment?.tick?.(timeDelta);   // the day goes by (rooms with a day cycle)
        // Under an overlay nothing can be started (and the bubble fades away).
        this.interaction.update(this.overlaid ? null : this.player?.pos ?? null);
    }

    // An overlay is on top (pause, level complete). The level may keep running underneath
    // (level complete), but zones stay frozen so nothing fires under the confetti.
    pause()  { this.overlaid = true; }
    resume() { this.overlaid = false; }

    // Zones and camera run after physics so they see this step's final positions.
    updatePost()
    {
        if (!this.level || !this.player)
            return;
        if (!this.overlaid)
            this.level.zones.update(this.player.pos, this.player.size);
        this.camera.setNarrating(this.narrator.showing);
        this.camera.update();
    }

    renderPost()
    {
        if (this.loadError)
            drawTextScreen(this.loadError, mainCanvasSize.scale(.5), 40, ERROR_COLOR);
        if (!this.overlaid)
            this.interaction.renderPost();   // under the narrator's text box; not under pause
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
        hook.register('backdrop', () => this.environment?.debugState() ?? null);
        hook.register('dayCycle', () => this.environment?.dayCycleState?.() ?? null);
        hook.register('interaction', () => this.interaction.debugState());
        hook.register('entities', () => this.level?.entities.map(entity => entity.debugState?.() ?? null) ?? []);
        hook.commands.loadLevel = (levelId, checkpointId = null, reachedCheckpoints = []) =>
            sceneManager.change('playing', { levelId, checkpointId, reachedCheckpoints });
        // Poke an entity's debug action by id, e.g. entityAction('twyx', 'sit', true) to hold a pose.
        hook.commands.entityAction = (id, action, ...args) =>
        {
            const entity = this.level?.entities.find(other => other.id === id);
            if (!entity?.debugAction)
                return false;
            entity.debugAction(action, ...args);
            return true;
        };
        // Jump an indoor level's clock: 0 = midnight, .25 = sunrise, .5 = noon, .75 = sunset.
        hook.commands.setTimeOfDay = t =>
        {
            if (!this.environment?.setTimeOfDay || !Number.isFinite(t))
                return false;
            this.environment.setTimeOfDay(t);
            return true;
        };
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
