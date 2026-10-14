// An indoor room's backdrop: the wall with everything on it (wallpaper, window frame, posters,
// furniture, toys) baked once into a few world-space chunks, and the live view through the
// window drawn first, behind them (the wall is opaque except for the glass).
// Drawn in world space, so the room scrolls with the camera like the terrain does.
import { EngineObject, vec2 } from 'littlejs';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { drawRoomBack } from '../art/room/roomArt.js';
import { bakeWorldRect, drawWorldSprites, destroySprites } from './worldBake.js';
import { WindowView } from './WindowView.js';

/** The wall bake starts this far under the floor's surface, so no gap shows at the seam. */
const UNDER_FLOOR = 1;

export class RoomBackdrop extends EngineObject
{
    /** @param {object} layout - systems/roomLayout.js  @param {object} palette  @param {DayCycle} cycle */
    constructor(layout, palette, cycle)
    {
        super(vec2(), vec2(), undefined, 0, undefined, RENDER_ORDER.backdrop);
        this.mass = 0;
        this.gravityScale = 0;
        this.cycle = cycle;
        this.sprites = [];
        this.view = null;
        const start = performance.now();
        try
        {
            this.sprites = bakeWorldRect(0, layout.floorY - UNDER_FLOOR, layout.width, layout.height,
                (ctx, bounds) => drawRoomBack(ctx, layout, palette, bounds));
            this.view = layout.window ? new WindowView(layout.window, palette.view) : null;
        }
        catch (error)
        {
            this.destroy();
            throw error;
        }
        this.bakeMs = Math.round(performance.now() - start);
    }

    destroy()
    {
        if (this.destroyed)
            return;
        destroySprites(this.sprites);
        this.view?.destroy();
        super.destroy();
    }

    render()
    {
        this.view?.render(this.cycle.look, { sun: this.cycle.body('sun'), moon: this.cycle.body('moon') });
        drawWorldSprites(this.sprites);
    }

    debugState()
    {
        return { chunks: this.sprites.length, bakeMs: this.bakeMs, window: this.view?.debugState() ?? null };
    }
}
