// Entry point: engine settings, system wiring, and routing engine callbacks into the scene manager.
import {
    engineInit, vec2, rgb,
    setCanvasFixedSize, setCanvasClearColor, setShowSplashScreen,
    setInputWASDEmulateDirection, setDebugKey, setDebugWatermark,
} from '../lib/littlejs/littlejs.esm.js';
import { SceneManager } from './core/SceneManager.js';
import { installDebugHook } from './core/debugHook.js';
import { endInputFrame } from './core/input.js';
import { tickFrame } from './core/clock.js';
import { BootScene } from './scenes/BootScene.js';
import { PlayingScene } from './scenes/PlayingScene.js';
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

const scenes = new SceneManager();
scenes.register('boot', new BootScene());
const playingScene = new PlayingScene(narrator);
scenes.register('playing', playingScene);
const debugHook = installDebugHook(scenes);
playingScene.installDebug(debugHook, scenes);
debugHook.register('narrator', () => narrator.debugState());
debugHook.commands.say = lineId => narrator.say(lineId, { now: true });

function gameInit()
{
    initAudio();   // after engineInit has created the master gain
    // Until the title screen exists (T-008), start straight in the test level.
    scenes.change('playing', { levelId: 'test' });
}

// gameUpdatePost runs every update step, even while the engine is paused,
// so per-step bookkeeping (input suppression, our frame counter) lives there.
function gameUpdatePost()
{
    scenes.updatePost();
    endInputFrame();
    tickFrame();
}

engineInit(
    gameInit,
    () => scenes.update(),
    gameUpdatePost,
    () => scenes.render(),
    () => scenes.renderPost(),
);
