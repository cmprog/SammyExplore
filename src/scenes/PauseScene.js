// Pause overlay, pushed on top of the playing scene (never replaces it, so the level, narrator,
// and any correction in progress keep their state). Freezes the engine with setPaused, so all
// logic here runs in updatePost, which the engine still calls while paused.
//
// Sound settings change only through the audio:* bus events; Audio owns sammyexplore.settings.
import { mainCanvasSize, timeReal, setPaused, setCursor, smoothStep, clamp } from 'littlejs';
import { on, emit } from '../core/events.js';
import { wasPressed, mouse } from '../core/input.js';
import { Menu } from '../systems/Menu.js';
import { getAudioSettings } from '../systems/Audio.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawMenuButton, drawPanel, drawLabel, drawDim, drawCursorFeather, drawMarkerFeather } from '../art/drawMenu.js';
import { PAUSE_TEXT } from '../data/screens.js';
import { SCREENS } from '../data/tuning.js';

const LAYOUT = {
    panel: { x: 960, y: 540, w: 820, h: 820 },
    heading: { x: 960, y: 225, size: 92 },
    items: { x: 960, y: 385, gap: 145, w: 600, h: 108 },
};

export class PauseScene
{
    constructor(scenes)
    {
        this.scenes = scenes;
        this.audio = getAudioSettings();
        this.menu = new Menu([
            { id: 'resume', label: PAUSE_TEXT.resume },
            { id: 'sound', label: () => this.audio.muted ? PAUSE_TEXT.soundOff : PAUSE_TEXT.soundOn },
            { id: 'volume', label: PAUSE_TEXT.volume, slider: () => this.audio.volume },
            { id: 'quit', label: PAUSE_TEXT.quit },
        ]);
        const { x, y, gap, w, h } = LAYOUT.items;
        this.menu.rects = this.menu.items.map((_, i) => ({ x, y: y + i * gap, w, h }));
        this.enteredAt = 0;
        this.lastTime = 0;
        this.unsubscribe = null;
    }

    enter()
    {
        setPaused(true);
        setCursor('none');
        this.enteredAt = this.lastTime = timeReal;
        this.audio = getAudioSettings();
        this.unsubscribe = on('audio:changed', settings => { this.audio = { ...settings }; });
        this.menu.reset('resume');
    }

    exit()
    {
        this.unsubscribe?.();
        this.unsubscribe = null;
        setCursor('auto');
        setPaused(false);
    }

    updatePost()
    {
        const dt = clamp(timeReal - this.lastTime, 0, .1);
        this.lastTime = timeReal;
        if (wasPressed('pause'))
            return this.scenes.pop();
        const action = this.menu.update(dt);
        if (!action)
            return;
        switch (action.id)
        {
            case 'resume': return this.scenes.pop();
            case 'sound':  return emit('audio:toggleMute');
            case 'volume': return emit('audio:setVolume', roundVolume(this.audio.volume + action.delta * SCREENS.VOLUME_STEP));
            case 'quit':   return this.scenes.change('title');
        }
    }

    renderPost()
    {
        const time = timeReal;
        const appear = smoothStep(clamp((time - this.enteredAt) / SCREENS.SCREEN_FADE_IN, 0, 1));
        drawScreenCanvas(ctx =>
        {
            drawDim(ctx, mainCanvasSize, SCREENS.PAUSE_DIM * appear);
            ctx.save();
            ctx.globalAlpha = appear;
            ctx.translate(0, (1 - appear) * 40);
            drawPanel(ctx, LAYOUT.panel);
            drawLabel(ctx, PAUSE_TEXT.heading, LAYOUT.heading, { size: LAYOUT.heading.size, color: '#ffd36e' });
            this.menu.items.forEach((item, i) => drawMenuButton(ctx, {
                ...this.menu.rects[i],
                label: typeof item.label === 'function' ? item.label() : item.label,
                highlight: this.menu.highlight[i],
                slider: item.slider ? { value: item.slider() } : null,
            }, time));
            const rect = this.menu.rects[this.menu.selected];
            drawMarkerFeather(ctx, { x: rect.x - rect.w / 2 - 60, y: rect.y }, time);
            ctx.restore();
            if (mouse.inWindow)
                drawCursorFeather(ctx, mouse.pos, time);
        });
    }

    /** For window.__sammy.menu. */
    menuDebugState()
    {
        return { screen: 'pause', ...this.menu.debugState(), audio: { ...this.audio } };
    }
}

/** Snap to the step grid so ten presses always land exactly on 0 or 1. */
function roundVolume(value)
{
    return clamp(Math.round(value / SCREENS.VOLUME_STEP) * SCREENS.VOLUME_STEP, 0, 1);
}
