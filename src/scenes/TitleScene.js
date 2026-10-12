// Title screen: New Game / Continue over the game's night backdrop, with Sammy perched on a branch.
// New Game over any stored save data (even unusable data) asks first; only Yes replaces it.
// enter({ notice }) shows a short message, e.g. when a level failed to load.
import {
    mainCanvasSize, timeReal, setCursor, smoothStep, clamp, setCameraPos, setCameraScale, getCameraSize,
} from '../../lib/littlejs/littlejs.esm.js';
import { wasPressed, mouse } from '../core/input.js';
import { Menu } from '../systems/Menu.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawTitleSammy } from '../art/titleArt.js';
import { Backdrop } from '../systems/Backdrop.js';
import { TITLE_BACKDROP_LAYOUT } from '../data/backdrop.js';
import {
    drawTitleText, drawMenuButton, drawPanel, drawLabel, drawDim, drawCursorFeather, drawMarkerFeather,
} from '../art/drawMenu.js';
import { TITLE_TEXT } from '../data/screens.js';
import { FIRST_LEVEL_ID } from '../data/progression.js';
import { SCREENS, CAMERA_SCALE } from '../data/tuning.js';

const LAYOUT = {
    title: { x: 960, y: 215, size: 170 },
    sammy: { x: 560, y: 860, size: 330 },   // size: screen pixels per Sammy art unit (body ~0.9)
    menu: { x: 1300, y: 590, gap: 150, w: 540, h: 112 },
    notice: { x: 960, y: 975, w: 1240, h: 150 },
    confirm: { x: 960, y: 540, w: 1120, h: 540, textY: 430, buttonsY: 665, buttonGap: 400, w2: 300, h2: 104 },
};

export class TitleScene
{
    /** @param {SceneManager} scenes  @param {SaveSystem} save */
    constructor(scenes, save)
    {
        this.scenes = scenes;
        this.save = save;
        this.menu = new Menu([
            { id: 'newGame', label: TITLE_TEXT.newGame },
            { id: 'continue', label: TITLE_TEXT.continue, enabled: () => this.save.hasSave() },
        ]);
        this.menu.rects = this.menu.items.map((_, i) => ({ x: LAYOUT.menu.x, y: LAYOUT.menu.y + i * LAYOUT.menu.gap, w: LAYOUT.menu.w, h: LAYOUT.menu.h }));
        const c = LAYOUT.confirm;
        this.confirmMenu = new Menu([{ id: 'yes', label: TITLE_TEXT.yes }, { id: 'no', label: TITLE_TEXT.no }], { horizontal: true });
        this.confirmMenu.rects = [-1, 1].map(side => ({ x: c.x + side * c.buttonGap / 2, y: c.buttonsY, w: c.w2, h: c.h2 }));
        this.confirming = false;
        this.confirmAppear = 0;
        this.enteredAt = 0;
        this.lastTime = 0;
        this.notice = null;
        this.backdrop = null;
    }

    enter({ notice = null } = {})
    {
        this.notice = notice;
        this.enteredAt = this.lastTime = timeReal;
        this.confirming = false;
        this.confirmAppear = 0;
        this.menu.reset(this.save.hasSave() ? 'continue' : 'newGame');
        setCursor('none');   // we draw a feather instead
        // The same night sky as the levels. Camera at the bottom-left view, like a level start,
        // so the backdrop sits exactly as it does when play begins.
        setCameraScale(CAMERA_SCALE);
        setCameraPos(getCameraSize().scale(.5));
        this.backdrop?.destroy();
        this.backdrop = null;
        try { this.backdrop = new Backdrop('night', { layout: TITLE_BACKDROP_LAYOUT }); }
        catch (error)
        {
            // The title must still work: the canvas clear color (deep night blue) stands in.
            console.warn(`title: backdrop failed (${error.message}); showing a plain sky`);
        }
    }

    exit()
    {
        setCursor('auto');
        this.backdrop?.destroy();
        this.backdrop = null;
    }

    updatePost()
    {
        const dt = clamp(timeReal - this.lastTime, 0, .1);
        this.lastTime = timeReal;
        this.confirmAppear = clamp(this.confirmAppear + (this.confirming ? dt : -dt) / SCREENS.SCREEN_FADE_IN, 0, 1);
        if (this.confirming)
            this.updateConfirm(dt);
        else
            this.updateMain(dt);
    }

    updateMain(dt)
    {
        const action = this.menu.update(dt);
        if (action?.id === 'newGame')
        {
            if (!this.save.hasStoredData())
                return this.startNewGame();
            this.confirming = true;
            this.confirmMenu.reset('no');   // the safe answer is the default
        }
        else if (action?.id === 'continue')
        {
            const { levelId, checkpointId, reachedCheckpoints } = this.save.current();
            this.scenes.change('playing', { levelId, checkpointId, reachedCheckpoints });
        }
    }

    updateConfirm(dt)
    {
        const action = this.confirmMenu.update(dt);
        if (action?.id === 'yes')
            this.startNewGame();
        else if (action?.id === 'no' || wasPressed('pause'))
        {
            this.confirming = false;
            this.menu.reset('newGame');
        }
    }

    startNewGame()
    {
        this.save.newGame(FIRST_LEVEL_ID);
        this.scenes.change('playing', { levelId: FIRST_LEVEL_ID });
    }

    renderPost()
    {
        const time = timeReal;
        const appear = smoothStep(clamp((time - this.enteredAt) / SCREENS.SCREEN_FADE_IN, 0, 1));
        // WebGL, so under the 2D canvas the text and menus draw on (and under the fade-in dim).
        drawTitleSammy(LAYOUT.sammy, { size: LAYOUT.sammy.size, idleTime: time - this.enteredAt }, time);
        drawScreenCanvas(ctx =>
        {
            drawTitleText(ctx, TITLE_TEXT.title, LAYOUT.title, { size: LAYOUT.title.size, appear: clamp((time - this.enteredAt) / 1.2, 0, 1) }, time);
            this.drawMenu(ctx, this.menu, time);
            this.drawNotice(ctx, time);
            if (this.confirmAppear > 0)
                this.drawConfirm(ctx, smoothStep(this.confirmAppear), time);
            if (mouse.inWindow)
                drawCursorFeather(ctx, mouse.pos, time);
            if (appear < 1)
                drawDim(ctx, mainCanvasSize, 1 - appear);
        });
    }

    drawMenu(ctx, menu, time)
    {
        menu.items.forEach((item, i) =>
        {
            const rect = menu.rects[i];
            drawMenuButton(ctx, { ...rect, label: item.label, highlight: menu.highlight[i], enabled: menu.isEnabled(i) }, time);
        });
        const rect = menu.rects[menu.selected];
        if (rect)
            drawMarkerFeather(ctx, { x: rect.x - rect.w / 2 - 60, y: rect.y }, time);
    }

    drawConfirm(ctx, appear, time)
    {
        const c = LAYOUT.confirm;
        drawDim(ctx, mainCanvasSize, .55 * appear);
        ctx.save();
        ctx.globalAlpha = appear;
        // Pop up from slightly small, so it feels like the book opened a note.
        ctx.translate(c.x, c.y);
        ctx.scale(.9 + .1 * appear, .9 + .1 * appear);
        ctx.translate(-c.x, -c.y);
        drawPanel(ctx, c);
        drawLabel(ctx, TITLE_TEXT.confirmOverwrite, { x: c.x, y: c.textY }, { size: 54, maxWidth: c.w - 180 });
        this.drawMenu(ctx, this.confirmMenu, time);
        ctx.restore();
    }

    drawNotice(ctx, time)
    {
        const age = time - this.enteredAt;
        if (!this.notice || age > SCREENS.TITLE_NOTICE_TIME)
            return;
        const fade = clamp(Math.min(age / .4, (SCREENS.TITLE_NOTICE_TIME - age) / .6), 0, 1);
        ctx.save();
        ctx.globalAlpha = fade;
        drawPanel(ctx, LAYOUT.notice);
        drawLabel(ctx, this.notice, LAYOUT.notice, { size: 40, maxWidth: LAYOUT.notice.w - 100 });
        ctx.restore();
    }

    /** For window.__sammy.menu. */
    menuDebugState()
    {
        const notice = this.notice && timeReal - this.enteredAt <= SCREENS.TITLE_NOTICE_TIME ? this.notice : null;
        return {
            screen: this.confirming ? 'confirmOverwrite' : 'title',
            notice,
            ...(this.confirming ? this.confirmMenu : this.menu).debugState(),
        };
    }
}
