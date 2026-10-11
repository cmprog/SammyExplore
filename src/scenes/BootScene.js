// Placeholder startup scene: proves the engine, scene manager, and input mapping are wired up.
// T-008 replaces it with the title scene.
//
// TEMPORARY (T-006): also hosts the narrator so it can be tested before the playing scene
// exists. Once the playing scene hosts it (see the wiring notes in Narrator.js), remove the
// narrator from here.
import { drawTextScreen, mainCanvasSize, vec2, rgb } from '../../lib/littlejs/littlejs.esm.js';
import { actionsDown } from '../core/input.js';

const TITLE_COLOR = rgb(1, .9, .6);
const HINT_COLOR = rgb(.6, .65, .8);

export class BootScene
{
    constructor(narrator)
    {
        this.narrator = narrator;
    }

    enter()
    {
        this.narrator.loadScript(null);
    }

    exit()
    {
        this.narrator.dispose();
    }

    update()
    {
        this.narrator.update();
    }

    renderPost()
    {
        const center = mainCanvasSize.scale(.5);
        drawTextScreen('Sammy Explore', center, 120, TITLE_COLOR);

        const held = actionsDown();
        const hint = held.length ? held.join('  ') : 'press a key';
        drawTextScreen(hint, center.add(vec2(0, 120)), 36, HINT_COLOR);

        this.narrator.renderPost();
    }
}
