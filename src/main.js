// Entry point: engine settings, system wiring, and routing engine callbacks into the scene manager.
import {
    engineInit, vec2, rgb,
    setCanvasFixedSize, setCanvasClearColor, setShowSplashScreen,
    setInputWASDEmulateDirection, setDebugKey, setDebugWatermark,
} from '../lib/littlejs/littlejs.esm.js';
import { SceneManager } from './core/SceneManager.js';
import { installDebugHook } from './core/debugHook.js';
import { endInputFrame, wasPressed } from './core/input.js';
import { on } from './core/events.js';
import { tickFrame } from './core/clock.js';
import { TitleScene } from './scenes/TitleScene.js';
import { PlayingScene } from './scenes/PlayingScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { LevelCompleteScene } from './scenes/LevelCompleteScene.js';
import { SaveSystem } from './systems/SaveSystem.js';
import { initAudio } from './systems/Audio.js';
import { Narrator } from './systems/Narrator.js';

const GAME_RESOLUTION = vec2(1920, 1080);
const BACKGROUND_COLOR = rgb(.07, .07, .14);   // deep night blue

setCanvasFixedSize(GAME_RESOLUTION);           // engine letterboxes it to fit the window
setCanvasClearColor(BACKGROUND_COLOR);
setShowSplashScreen(false);
// Our input module maps WASD itself; engine remapping would make W also report ArrowUp.
setInputWASDEmulateDirection(false);
// Engine debug overlay defaults to Esc, which is our pause key.
setDebugKey('Backquote');
setDebugWatermark(false);

// One narrator for the whole game; whichever scene hosts gameplay drives it (see Narrator.js).
const narrator = new Narrator();

const saveSystem = new SaveSystem();

const scenes = new SceneManager();
scenes.register('title', new TitleScene(scenes, saveSystem));
const playingScene = new PlayingScene(narrator);
scenes.register('playing', playingScene);
// Overlays: pushed over 'playing' so the level keeps its state (see SceneManager.js).
scenes.register('pause', new PauseScene(scenes));
scenes.register('levelComplete', new LevelCompleteScene(scenes));
on('level:complete', payload =>
{
    if (scenes.currentName === 'playing')
        scenes.push('levelComplete', payload);
});

const debugHook = installDebugHook(scenes);
playingScene.installDebug(debugHook, scenes);
debugHook.register('narrator', () => narrator.debugState());
debugHook.commands.say = lineId => narrator.say(lineId, { now: true });
debugHook.register('sceneStack', () => scenes.stackNames);
debugHook.register('menu', () => scenes.current?.menuDebugState?.() ?? null);
debugHook.register('save', () => saveSystem.current());
debugHook.register('saveStatus', () => saveSystem.debugState());
debugHook.commands.clearSave = () => saveSystem.clear();

function gameInit()
{
    initAudio();   // after engineInit has created the master gain
    scenes.change('title');
}

// gameUpdatePost runs every update step, even while the engine is paused,
// so per-step bookkeeping (input suppression, our frame counter) lives there.
function gameUpdatePost()
{
    // Esc during gameplay opens the pause overlay; the pause scene itself handles closing it.
    if (scenes.currentName === 'playing' && wasPressed('pause'))
        scenes.push('pause');
    scenes.updatePost();
    endInputFrame();
    tickFrame();
}

engineInit(
    gameInit,
    () => scenes.update(),
    gameUpdatePost,
    () => scenes.render(),
    () =>
    {
        scenes.renderPost();
        saveSystem.renderPost();   // the "saved" feather sits above every scene
    },
);
