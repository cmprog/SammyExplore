// Placeholder startup scene: proves the engine, scene manager, and input mapping are wired up.
// T-008 replaces it with the title scene.
import { drawTextScreen, mainCanvasSize, vec2, rgb } from '../../lib/littlejs/littlejs.esm.js';
import { actionsDown } from '../core/input.js';

const TITLE_COLOR = rgb(1, .9, .6);
const HINT_COLOR = rgb(.6, .65, .8);

export class BootScene
{
    renderPost()
    {
        const center = mainCanvasSize.scale(.5);
        drawTextScreen('Sammy Explore', center, 120, TITLE_COLOR);

        const held = actionsDown();
        const hint = held.length ? held.join('  ') : 'press a key';
        drawTextScreen(hint, center.add(vec2(0, 120)), 36, HINT_COLOR);
    }
}
