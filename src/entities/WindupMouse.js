// The wind-up toy mouse (T-016, draft content for M2's practice course): too frazzled to
// budge, it blocks a narrow tunnel. Comforted (a cat spot with Comfort targets it), it calms
// down, sighs with relief, and scoots off along its row to `restX`, clearing the way, then sits
// there content. An Upset (entities/Upset.js), so a mechanism target: active = calm.
// Placed in level data on the tile it stands on:
//   { type: 'windupMouse', x, y, id, restX, facing?, targets? }
//   restX   - the column it scoots to once calm (same row; every cell on the way must be empty)
//   facing  - 'left' (default) or 'right': the way it looks while it frets
//   targets - optional mechanism ids it activates once calm (Upset's own targets)
// Solid while it's upset or calming (Sammy and cats bump into it); once calm it's out of
// everyone's way, even while it is still scooting off.
import { vec2, rand, time, timeDelta, isOnScreen, smoothStep } from 'littlejs';
import { Upset } from './Upset.js';
import { ParticleField } from './ParticleField.js';
import { drawWindupMouse, drawSweatDrop, drawSighPuff } from '../art/drawWindupMouse.js';
import { drawHeart } from '../art/drawTwyxFx.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { WINDUP_MOUSE as W, TWYX } from '../data/tuning.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import { TWYX_PALETTE } from '../data/palettes.js';
import {
    requireId, allowOnlyProps, requireEmptyColumn, requireEmptyRect, requireTargetList, optionalOneOf,
    integerInRange, entityLabel,
} from './entityValidation.js';

const PROPS = ['id', 'restX', 'facing', 'targets'];
const DRAW_EXTENT = vec2(2, 2);
const BLINK_EVERY = 3.2;

export class WindupMouse extends Upset
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        optionalOneOf(entity, 'facing', ['left', 'right'], fail);
        if (entity.targets !== undefined)
            requireTargetList(entity, fail);
        requireEmptyColumn(entity, 1, fail, level);
        const restX = integerInRange(entity, 'restX', 0, level.tileMap[0].length - 1, fail);
        if (restX === entity.x)
            fail(`${entityLabel(entity)}: "restX" must be somewhere else along its row (it scoots out of the way)`);
        const [x0, x1] = [Math.min(entity.x, restX), Math.max(entity.x, restX)];
        requireEmptyRect(entity, { x0, y0: entity.y, x1, y1: entity.y }, 'the way to restX', fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the tile it stands on
     * @param {{id:string, restX:number, facing?:string, targets?:string[]}} props
     * @param {{timeOfDay?:string}} context
     */
    constructor(cellCenter, { id, restX, facing = 'left', targets = [] }, { timeOfDay } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, W.SIZE.y / 2)), vec2(W.SIZE.x, W.SIZE.y), { id, targets });
        this.feet = feet;
        this.restX = restX + .5;   // column -> its center
        this.facing = facing === 'right' ? 1 : -1;
        this.homeFacing = this.facing;
        this.renderOrder = RENDER_ORDER.props;
        this.setCollision(true, true, false);   // blocks while upset (see collideWithObject)
        this.palette = mechanismPalette(timeOfDay);
        this.fx = new ParticleField();
        this.keyAngle = 0;
        this.wheel = 0;
        this.hop = 0;
        this.hopIn = rand(.2, W.HOP_EVERY);
        this.sweatIn = rand(0, W.SWEAT_EVERY);
        this.blinkIn = BLINK_EVERY;
        this.calmAge = 0;           // seconds since it calmed
        this.scootFrom = null;      // x it set off from
        this.arrived = false;
        this.squash = 0;
    }

    get blocking() { return this.state !== 'calm'; }

    collideWithObject()
    {
        return this.blocking;
    }

    onCalmed(instant)
    {
        if (instant)
        {
            this.moveTo(this.restX);
            this.arrived = true;
            this.facing = this.homeFacing;
            return;
        }
        this.squash = -.18;   // a big relieved slump
        this.fx.add({
            draw: drawSighPuff, pos: this.feet.add(vec2(-this.facing * .1, .8)),
            vel: vec2(-this.facing * .2, .5), life: 1.1, drag: 1.2, size: .2, color: this.palette.mouseBelly,
        });
        this.fx.add({
            draw: drawHeart, pos: this.feet.add(vec2(0, .85)), vel: vec2(0, TWYX.HEART_RISE * .7),
            life: TWYX.HEART_LIFE, drag: .6, sway: .3, size: .2,
        });
    }

    update()
    {
        super.update();
        const dt = timeDelta;
        const upset = this.upsetAmount();
        this.keyAngle += (W.KEY_SPIN_CALM + (W.KEY_SPIN_UPSET - W.KEY_SPIN_CALM) * upset) * dt;
        this.squash += (0 - this.squash) * .12;
        this.updateFrets(dt, upset);
        if (this.state === 'calm')
            this.updateCalm(dt);
        if ((this.blinkIn -= dt) <= 0)
            this.blinkIn = BLINK_EVERY + rand(-1, 1);
    }

    /** Frazzled: little hops in place and sweat drops flying off. */
    updateFrets(dt, upset)
    {
        this.hop = Math.max(0, this.hop - dt * .5);
        if (upset < .3)
            return;
        if ((this.hopIn -= dt) <= 0)
        {
            this.hopIn = W.HOP_EVERY * rand(.6, 1.3);
            this.hop = W.HOP_HEIGHT * upset;
        }
        if ((this.sweatIn -= dt) <= 0)
        {
            this.sweatIn = W.SWEAT_EVERY * rand(.7, 1.3) / upset;
            const side = rand() < .5 ? -1 : 1;
            this.fx.add({
                draw: drawSweatDrop, pos: this.feet.add(vec2(side * .2 + this.facing * .12, .72)),
                vel: vec2(side * rand(.8, 1.4), rand(1.2, 1.8)), life: .7, gravity: 5, drag: .5,
                angle: -side * .5, size: .1, color: this.palette.sweat, outline: this.palette.outline,
                shine: TWYX_PALETTE.shine,
            });
        }
    }

    /** Calm: a sigh, a pause, then it scoots along to restX, eased at both ends. */
    updateCalm(dt)
    {
        this.calmAge += dt;
        if (this.arrived || this.calmAge < W.SCOOT_DELAY)
            return;
        this.scootFrom ??= this.feet.x;
        const dir = Math.sign(this.restX - this.feet.x);
        const total = Math.abs(this.restX - this.scootFrom), done = Math.abs(this.feet.x - this.scootFrom);
        const ease = Math.max(.2, Math.min(1, done / .5, (total - done) / .7));
        const step = Math.min(Math.abs(this.restX - this.feet.x), W.SCOOT_SPEED * ease * dt);
        this.facing = dir || this.facing;
        this.moveTo(this.feet.x + dir * step);
        this.wheel -= step / .07;
        if (Math.abs(this.restX - this.feet.x) < 1e-3)
        {
            this.arrived = true;
            this.facing = -dir || this.homeFacing;   // turns round to look back the way it came
            this.squash = -.12;
        }
    }

    moveTo(x)
    {
        this.feet = vec2(x, this.feet.y);
        this.pos = this.feet.add(vec2(0, this.size.y / 2));
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        const calm = this.state === 'calm' ? 1 : this.calmAmount;
        drawWindupMouse(this.feet, {
            facing: this.facing,
            upset: smoothStep(this.upsetAmount()),
            calm,
            keyAngle: this.keyAngle,
            wheel: this.wheel,
            hop: this.hop,
            blink: this.blinkIn < .15 ? 1 : 0,
            squash: this.squash,
            palette: this.palette,
        }, time);
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    debugState()
    {
        return {
            type: 'windupMouse',
            ...this.upsetDebugState(),
            blocking: this.blocking,
            upset: Math.round(this.upsetAmount() * 1000) / 1000,
            restX: this.restX,
            arrived: this.arrived,
            facing: this.facing,
            sweat: this.fx.count,
        };
    }

    /** Debug and pose captures (__sammy.commands.entityAction): 'calm' calms it now. */
    debugAction(what)
    {
        if (what === 'calm')
            this.setActive(true);
        else if (what === 'soothe')
            this.soothe(1);
    }
}
