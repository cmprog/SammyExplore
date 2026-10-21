// A few baked world-space sprites drawn at one render order (e.g. a room's rugs, in front of
// the floorboards). Owns the sprites' textures.
import { EngineObject, vec2 } from 'littlejs';
import { drawWorldSprites, destroySprites } from './worldBake.js';

export class BakedLayer extends EngineObject
{
    constructor(sprites, renderOrder)
    {
        super(vec2(), vec2(), undefined, 0, undefined, renderOrder);
        this.mass = 0;
        this.gravityScale = 0;
        this.sprites = sprites;
    }

    destroy()
    {
        if (this.destroyed)
            return;
        destroySprites(this.sprites);
        super.destroy();
    }

    render()
    {
        drawWorldSprites(this.sprites);
    }
}
