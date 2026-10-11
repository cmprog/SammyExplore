// Temporary stand-in player for T-003: walks with A/D, hops with W or Space, rides one-way
// platforms. T-004 replaces it with Sammy (same resetTo() name so correction handling carries over).
import { EngineObject, vec2, lerp, time } from '../../lib/littlejs/littlejs.esm.js';
import { isDown, wasPressed } from '../core/input.js';
import { collidesWithTerrain } from '../systems/terrainCollision.js';
import { drawTempBox } from '../art/drawTempBox.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { TEMP_BOX_SIZE, TEMP_BOX_SPEED, TEMP_BOX_ACCEL, TEMP_BOX_JUMP } from '../data/tuning.js';

export class TempBox extends EngineObject
{
    /** @param {Vector2} feetPos - where the bottom-center of the box should stand */
    constructor(feetPos)
    {
        super(feetPos.add(vec2(0, TEMP_BOX_SIZE / 2)), vec2(TEMP_BOX_SIZE));
        this.renderOrder = RENDER_ORDER.characters;
        this.setCollision(false, false, true);
        this.facing = 1;
    }

    collideWithTile(tileData, tilePos)
    {
        return collidesWithTerrain(this, tileData, tilePos);
    }

    update()
    {
        const direction = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
        if (direction)
            this.facing = direction;
        this.velocity.x = lerp(this.velocity.x, direction * TEMP_BOX_SPEED, TEMP_BOX_ACCEL);
        if (this.groundObject && (wasPressed('jump') || wasPressed('up')))
            this.velocity.y = TEMP_BOX_JUMP;
    }

    /** Put the box's feet at `feetPos` and stop it. */
    resetTo(feetPos)
    {
        this.pos = feetPos.add(vec2(0, this.size.y / 2));
        this.velocity = vec2();
        this.groundObject = undefined;
    }

    render()
    {
        drawTempBox(this.pos, { size: this.size.x, facing: this.facing }, time);
    }

    debugState()
    {
        return {
            temp: true,
            pos: { x: this.pos.x, y: this.pos.y },
            vel: { x: this.velocity.x, y: this.velocity.y },
            size: { x: this.size.x, y: this.size.y },
            grounded: !!this.groundObject,
            facing: this.facing,
        };
    }
}
