// A list of menu items driven by input actions (menuUp/menuDown/menuLeft/menuRight/confirm) and
// the mouse (hover selects, click activates). Shared by every menu screen; knows nothing about drawing.
//
// items: [{ id, label, enabled?: () => boolean, slider?: () => number }]
//   slider items are adjusted with left/right (or a click on their left/right half) instead of confirmed.
// The owning scene sets `rects` (one {x, y, w, h} per item, center-based canvas pixels) for mouse hits.
//
// Events emitted: menu:move (selection changed), menu:select (item activated or adjusted).
import { emit } from '../core/events.js';
import { wasPressed, mouse } from '../core/input.js';
import { SCREENS } from '../data/tuning.js';

export class Menu
{
    constructor(items, { horizontal = false } = {})
    {
        this.items = items;
        this.horizontal = horizontal;
        this.rects = [];
        this.highlight = items.map(() => 0);
        this.selected = 0;
        this.lastMousePos = null;
        this.reset();
    }

    /** Select `id` (or the first enabled item) and forget the mouse, so a still pointer doesn't steal it. */
    reset(id = null)
    {
        const index = this.items.findIndex(item => item.id === id);
        this.selected = index >= 0 && this.isEnabled(index) ? index : this.items.findIndex((_, i) => this.isEnabled(i));
        this.lastMousePos = null;
    }

    isEnabled(index)
    {
        return this.items[index]?.enabled?.() ?? true;
    }

    get selectedId()
    {
        return this.items[this.selected]?.id ?? null;
    }

    /**
     * Read input for this frame. Returns {type: 'select', id}, {type: 'adjust', id, delta}, or null.
     * Call from updatePost (it also runs while the engine is paused).
     */
    update(dt)
    {
        if (!this.isEnabled(this.selected))
            this.reset();
        const action = this.updateKeys() ?? this.updateMouse();
        const ease = Math.min(1, dt * SCREENS.MENU_HIGHLIGHT_SPEED);
        this.highlight = this.highlight.map((h, i) => h + ((i === this.selected) - h) * ease);
        return action;
    }

    updateKeys()
    {
        const back = wasPressed(this.horizontal ? 'menuLeft' : 'menuUp') || (this.horizontal && wasPressed('menuUp'));
        const forward = wasPressed(this.horizontal ? 'menuRight' : 'menuDown') || (this.horizontal && wasPressed('menuDown'));
        if (back !== forward)
            this.step(forward ? 1 : -1);

        const item = this.items[this.selected];
        if (item?.slider && !this.horizontal)
        {
            const delta = wasPressed('menuRight') - wasPressed('menuLeft');
            if (delta)
                return this.adjust(delta);
        }
        if (wasPressed('confirm') && item && !item.slider)
            return this.activate();
        return null;
    }

    updateMouse()
    {
        if (!mouse.inWindow)
            return null;
        const pos = mouse.pos;
        const moved = this.lastMousePos && (pos.x !== this.lastMousePos.x || pos.y !== this.lastMousePos.y);
        this.lastMousePos = pos;
        const hit = this.hitTest(pos);
        if (hit < 0 || !this.isEnabled(hit))
            return null;
        if (moved || mouse.wasPressed(0))
            this.choose(hit);
        if (!mouse.wasPressed(0))
            return null;
        if (this.items[hit].slider)
            return this.adjust(pos.x < this.rects[hit].x ? -1 : 1);
        return this.activate();
    }

    hitTest(pos)
    {
        return this.rects.findIndex(r => r && Math.abs(pos.x - r.x) * 2 < r.w && Math.abs(pos.y - r.y) * 2 < r.h);
    }

    step(direction)
    {
        const count = this.items.length;
        for (let i = 1; i <= count; i++)
        {
            const index = (this.selected + direction * i + count * i) % count;
            if (this.isEnabled(index))
                return this.choose(index);
        }
    }

    choose(index)
    {
        if (index === this.selected)
            return;
        this.selected = index;
        emit('menu:move');
    }

    activate()
    {
        emit('menu:select');
        return { type: 'select', id: this.selectedId };
    }

    adjust(delta)
    {
        emit('menu:select');
        return { type: 'adjust', id: this.selectedId, delta };
    }

    /** Plain data for the test hook. */
    debugState()
    {
        return {
            selected: this.selectedId,
            items: this.items.map((item, i) => ({
                id: item.id,
                enabled: this.isEnabled(i),
                rect: this.rects[i] ? { ...this.rects[i] } : null,
            })),
        };
    }
}
