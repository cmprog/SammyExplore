// A find (T-018): a little something to pick up, as a reward. A placeholder for the hat collectibles
// that come later, so it is deliberately simple: walk into it and it's found, with a small
// celebration (it hops, spins and pops into sparkles, a ring of light and confetti).
// Placed in level data on the cell it floats in:
//   { type: 'collectible', x, y, id, kind? }
//   kind - its look: 'toyStar' (default, the only one so far)
// Events: collectible:found {id, kind, levelId} once, when Sammy touches it (Audio chimes, the
// narrator remarks; a line can use the id as its key). Not saved: like the course's mechanisms it is
// back on the next visit (see the T-018 report's open questions).
// Not solid; glows a little in a room's light map.
import { EngineObject, vec2, rand, randInt, time, timeDelta, isOnScreen, smoothStep } from 'littlejs';
import { emit } from '../core/events.js';
import { drawToyStar, drawToyStarLight, drawStarSparkle, drawFoundRing, drawConfettiBit } from '../art/drawToyStar.js';
import { ParticleField } from './ParticleField.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { COLLECTIBLE as C } from '../data/tuning.js';
import { mechanismPalette } from '../data/mechanismPalettes.js';
import { requireId, allowOnlyProps, optionalOneOf, requireEmptyColumn } from './entityValidation.js';

const PROPS = ['id', 'kind'];
const KINDS = ['toyStar'];
const DRAW_EXTENT = vec2(3, 3);

export class Collectible extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        optionalOneOf(entity, 'kind', KINDS, fail);
        requireEmptyColumn(entity, 1, fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the cell it floats in
     * @param {{id:string, kind?:string}} props
     * @param {{levelId:string, timeOfDay?:string, playerPos?:() => Vector2|null}} context
     */
    constructor(cellCenter, { id, kind = 'toyStar' }, { levelId, timeOfDay, playerPos = () => null } = {})
    {
        const home = cellCenter.add(vec2(0, C.FLOAT - .5));
        super(home.copy(), vec2(.8, .8));
        this.home = home;
        this.id = id;
        this.kind = kind;
        this.levelId = levelId;
        this.playerPos = playerPos;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.gravityScale = 0;
        this.setCollision(false, false, false);
        this.palette = mechanismPalette(timeOfDay);
        this.fx = new ParticleField();
        this.state = 'waiting';    // waiting | found (celebrating) | gone
        this.foundAge = 0;
        this.phase = rand(0, 6);   // so two finds never bob in step
        this.twinkleIn = rand(0, C.TWINKLE_EVERY);
        this.blinkIn = C.BLINK_EVERY;
    }

    update()
    {
        const dt = timeDelta;
        if ((this.blinkIn -= dt) <= -.15)
            this.blinkIn = C.BLINK_EVERY + rand(-1, 1);
        if (this.state === 'waiting')
        {
            this.pos = this.home.add(vec2(0, Math.sin(time * C.BOB_SPEED + this.phase) * C.BOB));
            this.twinkle(dt);
            const player = this.playerPos();
            if (player && player.distance(this.pos) < C.RADIUS)
                this.collect();
        }
        else if (this.state === 'found')
        {
            this.foundAge += dt;
            const t = Math.min(1, this.foundAge / C.FOUND_TIME);
            this.pos = this.home.add(vec2(0, C.FOUND_RISE * smoothStep(t)));
            if (t >= 1)
                this.pop();
        }
    }

    twinkle(dt)
    {
        if ((this.twinkleIn -= dt) > 0)
            return;
        this.twinkleIn = C.TWINKLE_EVERY * rand(.7, 1.3);
        const a = rand(0, Math.PI * 2);
        this.fx.add({
            draw: drawStarSparkle, pos: this.pos.add(vec2(Math.cos(a), Math.sin(a)).scale(rand(.3, .45))),
            vel: vec2(rand(-.15, .15), rand(.2, .45)), life: rand(.6, 1), drag: 1, spin: rand(-2, 2),
            size: rand(.05, .08), color: this.palette.toyStarLight,
        });
    }

    /** Sammy touched it: found. Once. */
    collect()
    {
        if (this.state !== 'waiting')
            return false;
        this.state = 'found';
        this.foundAge = 0;
        emit('collectible:found', { id: this.id, kind: this.kind, levelId: this.levelId });
        return true;
    }

    /** The end of the celebration: it pops into sparkles, a ring and confetti, and is gone. */
    pop()
    {
        this.state = 'gone';
        const P = this.palette;
        this.fx.add({ draw: drawFoundRing, pos: this.pos.copy(), vel: vec2(), life: .6, size: 3, color: P.toyStarLight });
        for (let i = 0; i < C.BURST_SPARKS; i++)
        {
            const a = i / C.BURST_SPARKS * Math.PI * 2 + rand(-.2, .2);
            this.fx.add({
                draw: drawStarSparkle, pos: this.pos.copy(), vel: vec2(Math.cos(a), Math.sin(a)).scale(rand(2.8, 4.8)),
                life: rand(.55, .9), drag: 2.6, spin: rand(-6, 6), size: rand(.12, .2), color: i % 2 ? P.toyStar : P.toyStarLight,
            });
        }
        for (let i = 0; i < C.BURST_CONFETTI; i++)
        {
            const a = Math.PI / 2 + rand(-1.2, 1.2);
            this.fx.add({
                draw: drawConfettiBit, pos: this.pos.copy(), vel: vec2(Math.cos(a), Math.sin(a)).scale(rand(2, 4.2)),
                life: rand(1, 1.6), gravity: 5, drag: 1.6, sway: .6, swayPhase: rand(0, 6), spin: rand(-5, 5),
                size: rand(.1, .16), color: P.confetti[randInt(P.confetti.length)],
            });
        }
    }

    /** How it looks right now: a hop-and-swell while found, a gentle sway while waiting. */
    look()
    {
        const t = this.state === 'found' ? Math.min(1, this.foundAge / C.FOUND_TIME) : 0;
        return {
            scale: 1 + C.FOUND_SWELL * smoothStep(t),
            spin: this.state === 'found' ? C.FOUND_SPIN * smoothStep(t) : Math.sin(time * C.SWAY_SPEED + this.phase) * C.SWAY,
            squash: this.state === 'found' ? Math.sin(t * Math.PI * 3) * .12 * (1 - t) : Math.sin(time * C.BOB_SPEED * 2 + this.phase) * .03,
            glow: this.state === 'found' ? 1 + t : 1,
            blink: this.blinkIn < 0 || this.state === 'found' ? 1 : 0,
            palette: this.palette,
        };
    }

    render()
    {
        if (this.state === 'gone' || !isOnScreen(this.pos, DRAW_EXTENT))
            return;
        drawToyStar(this.pos, this.look(), time);
    }

    /** Its glow in the room's light map (the LightSystem calls this while room lighting is on). */
    renderLight()
    {
        if (this.state === 'gone' || !isOnScreen(this.pos, DRAW_EXTENT))
            return;
        const look = this.look();
        drawToyStarLight(this.pos, look, { radius: C.LIGHT_RADIUS, strength: C.LIGHT_STRENGTH }, time);
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        super.destroy(immediate);
    }

    debugState()
    {
        return {
            type: 'collectible',
            id: this.id,
            kind: this.kind,
            state: this.state,
            pos: { x: this.pos.x, y: this.pos.y },
            home: { x: this.home.x, y: this.home.y },
            particles: this.fx.count,
        };
    }

    /** Debug (__sammy.commands.entityAction): 'collect' finds it now. */
    debugAction(what)
    {
        if (what === 'collect')
            this.collect();
    }
}
