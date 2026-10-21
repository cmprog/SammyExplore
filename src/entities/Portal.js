// The chapter portal (T-017). Placed in level data on the floor cell under the middle of its
// opening:
//   { type: 'portal', x, y, id }
// It fills 5 columns (x - 2 .. x + 2) and the 5 rows above the floor, with its sign over that.
// It shows the chapter that is selected (systems/Chapters.js, through context.chapters) and
// walking into the swirl steps through to it.
//
// A mechanism target (entities/registry.js): a lever in `cycle` mode targeting it calls cycle()
// on every throw, which turns the portal to the next unlocked chapter (the swirl blends to its
// color, the sign flips to its title) and emits portal:select {chapterId, changed}. With only one
// chapter unlocked it stays put (changed: false), so the narrator can say something about it.
// Not solid, not interactable: the lever beside it is what you press.
//
// Stepping in (Sammy's center inside the opening, after he has been outside it since the level
// loaded): a sparkle burst and portal:enter {chapterId, levelId, pos}; main.js runs the swirl
// transition into the chapter (and SaveSystem saves the chapter's start). If that step went
// unanswered (no trip started, e.g. a pause opened on the same step), the portal re-arms once
// Sammy steps out of the opening, or after PORTAL.REARM_AFTER seconds (then he steps out and back
// in). A real trip locks input with him inside, so it never fires twice.
import { EngineObject, vec2, rgb, rand, time, timeDelta, isOnScreen, smoothStep, clamp, WHITE } from 'littlejs';
import { emit } from '../core/events.js';
import { drawPortal, drawPortalLight, drawPortalMote, drawPortalSpark, PORTAL_OPENING, PORTAL_TOP } from '../art/drawPortal.js';
import { bakeSignText } from '../art/bakeSignText.js';
import { ParticleField } from './ParticleField.js';
import { RENDER_ORDER } from '../data/renderOrder.js';
import { PORTAL } from '../data/tuning.js';
import { requireId, allowOnlyProps, requireEmptyRect } from './entityValidation.js';

const PROPS = ['id'];
const HALF_COLUMNS = 2;
const ROWS_UP = 5;           // the opening (4) and the top row of blocks
const SIGN_ROWS = 3;         // the sign stands on the frame
const DRAW_EXTENT = vec2(9, 12);
const FALLBACK_COLOR = rgb(.62, .6, .82);   // no chapter to show (a level placing a portal with none unlocked)
const NO_CHAPTER = { id: null, title: '', levelId: null, portalColor: FALLBACK_COLOR };

export class Portal extends EngineObject
{
    static validateEntry(entity, fail, level)
    {
        requireId(entity, fail);
        allowOnlyProps(entity, PROPS, fail);
        const { x, y } = entity;
        requireEmptyRect(entity, { x0: x - HALF_COLUMNS, y0: y - ROWS_UP - SIGN_ROWS + 1, x1: x + HALF_COLUMNS, y1: y },
            'its frame and sign', fail, level);
    }

    /**
     * @param {Vector2} cellCenter - center of the floor-level cell in the middle of the opening
     * @param {{id:string}} props
     * @param {{chapters?:{list:() => object[], selected:() => string|null}, playerPos?:() => Vector2|null}} context
     */
    constructor(cellCenter, { id }, { chapters = null, playerPos = () => null } = {})
    {
        const feet = cellCenter.add(vec2(0, -.5));
        super(feet.add(vec2(0, PORTAL_OPENING.height / 2)), vec2(PORTAL_OPENING.halfWidth * 2, PORTAL_OPENING.height));
        this.feet = feet;
        this.id = id;
        this.chapters = chapters;
        this.playerPos = playerPos;
        this.renderOrder = RENDER_ORDER.props;
        this.mass = 0;
        this.gravityScale = 0;
        this.setCollision(false, false, false);
        this.fx = new ParticleField();
        this.fx.renderOrder = RENDER_ORDER.props + 1;   // in front of the frame, behind Sammy

        const chapter = this.findChapter(chapters?.selected()) ?? this.list()[0] ?? NO_CHAPTER;
        this.chapter = chapter;
        this.color = chapter.portalColor.copy();
        this.fromColor = this.color.copy();
        this.switchAge = Infinity;   // seconds since the lever turned it
        this.flipAge = Infinity;
        this.signChapter = chapter;  // what the sign shows (swaps halfway through the flip)
        this.signTexts = new Map();  // chapter id -> baked title
        this.spin = 0;
        this.moteIn = 0;
        this.cycles = 0;
        this.armed = false;          // Sammy has been outside the opening since the level loaded
        this.entered = false;
        this.enteredAge = 0;

        // Mechanism target contract (systems/Mechanisms.js): it is always "on".
        this.active = true;
    }

    list()
    {
        return this.chapters?.list() ?? [];
    }

    findChapter(id)
    {
        return this.list().find(chapter => chapter.id === id) ?? null;
    }

    /** The lever: on to the next unlocked chapter (or nowhere new, with only one). */
    cycle()
    {
        const list = this.list();
        const index = list.findIndex(chapter => chapter.id === this.chapter.id);
        const next = list.length ? list[(index + 1) % list.length] : this.chapter;
        const changed = next.id !== this.chapter.id;
        this.cycles++;
        if (changed)
        {
            this.fromColor = this.color.copy();
            this.chapter = next;
            this.switchAge = 0;
            this.flipAge = 0;
        }
        this.burst(changed ? PORTAL.BURST : Math.round(PORTAL.BURST / 3));
        emit('portal:select', { chapterId: this.chapter.id, changed });
        return changed;
    }

    /** The target API's other half: nothing to switch on or off (the lever cycles it). */
    setActive()
    {
        return false;
    }

    update()
    {
        const dt = timeDelta;
        this.switchAge += dt;
        this.flipAge += dt;
        const blend = smoothStep(clamp(this.switchAge / PORTAL.SWITCH_TIME, 0, 1));
        this.color = this.fromColor.lerp(this.chapter.portalColor, blend);
        if (this.flipAge >= PORTAL.FLIP_TIME / 2)
            this.signChapter = this.chapter;
        this.spin += dt * (PORTAL.SPIN + PORTAL.SPIN_BOOST * Math.max(0, 1 - this.switchAge / PORTAL.SWITCH_TIME));
        this.emitMotes(dt);
        this.checkEntry(dt);
    }

    checkEntry(dt)
    {
        const pos = this.playerPos();
        if (!pos)
            return;
        const inside = Math.abs(pos.x - this.feet.x) < PORTAL.ENTER_HALF_WIDTH
            && pos.y > this.feet.y && pos.y < this.feet.y + PORTAL_OPENING.height;
        if (this.entered)
            return this.maybeRearm(inside, dt);
        if (!inside)
            this.armed = true;
        else if (this.armed && this.chapter.levelId)
            this.enter();
    }

    /** After a step in: out of the opening re-arms at once; staying in, after REARM_AFTER (and he
     *  must step out first). */
    maybeRearm(inside, dt)
    {
        this.enteredAge += dt;
        if (!inside || this.enteredAge >= PORTAL.REARM_AFTER)
        {
            this.entered = false;
            this.armed = !inside;
        }
    }

    enter()
    {
        this.entered = true;
        this.enteredAge = 0;
        this.burst(PORTAL.ENTER_BURST);
        const center = this.feet.add(vec2(0, PORTAL_OPENING.height / 2));
        emit('portal:enter', { chapterId: this.chapter.id, levelId: this.chapter.levelId, pos: { x: center.x, y: center.y } });
    }

    emitMotes(dt)
    {
        if ((this.moteIn -= dt) > 0 || !isOnScreen(this.pos, DRAW_EXTENT))
            return;
        this.moteIn = PORTAL.MOTE_EVERY * rand(.6, 1.4);
        const { halfWidth, height } = PORTAL_OPENING;
        this.fx.add({
            draw: drawPortalMote,
            pos: this.feet.add(vec2(rand(-halfWidth, halfWidth) * .8, rand(.4, height - .4))),
            vel: vec2(rand(-.5, .5), rand(.15, .45)),
            life: PORTAL.MOTE_LIFE * rand(.7, 1.2),
            drag: .3,
            sway: .25,
            swayPhase: rand(0, 6.28),
            size: rand(.06, .11),
            color: this.color.copy(),
        });
    }

    burst(count)
    {
        const center = this.feet.add(vec2(0, PORTAL_OPENING.height / 2));
        for (let i = 0; i < count; i++)
        {
            const a = rand(0, Math.PI * 2);
            this.fx.add({
                draw: drawPortalSpark,
                pos: center.add(vec2(Math.cos(a) * .6, Math.sin(a) * .9)),
                vel: vec2(Math.cos(a), Math.sin(a)).scale(rand(1.5, 3.5)),
                life: rand(.5, .9),
                drag: 2.5,
                spin: rand(-5, 5),
                angle: rand(0, 6.28),
                size: rand(.12, .22),
                color: i % 3 ? this.chapter.portalColor.lerp(WHITE, .5) : WHITE,
            });
        }
    }

    signText(chapter)
    {
        if (!chapter.id)
            return null;
        if (!this.signTexts.has(chapter.id))
            this.signTexts.set(chapter.id, bakeSignText(chapter.title));
        return this.signTexts.get(chapter.id);
    }

    render()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        const sign = this.signText(this.signChapter);
        sign?.smoother.apply();
        drawPortal(this.feet, {
            color: this.color,
            spin: this.spin,
            pop: PORTAL.POP * Math.sin(Math.min(1, this.switchAge / PORTAL.SWITCH_TIME) * Math.PI),
            flip: clamp(this.flipAge / PORTAL.FLIP_TIME, 0, 1),
            sign,
            flash: Math.max(0, 1 - this.switchAge / PORTAL.SWITCH_TIME),
        }, time);
    }

    /** Its glow in the room's light map (the LightSystem calls this while room lighting is on). */
    renderLight()
    {
        if (!isOnScreen(this.pos, DRAW_EXTENT))
            return;
        drawPortalLight(this.feet, { color: this.color, flash: Math.max(0, 1 - this.switchAge / PORTAL.SWITCH_TIME) }, {
            radius: PORTAL.LIGHT_RADIUS, strength: PORTAL.LIGHT_STRENGTH, pulse: PORTAL.LIGHT_PULSE,
        }, time);
    }

    destroy(immediate)
    {
        this.fx.destroy(immediate);
        this.signTexts.forEach(text => text?.destroy());
        this.signTexts.clear();
        super.destroy(immediate);
    }

    debugState()
    {
        return {
            type: 'portal',
            id: this.id,
            role: this.mechanismRole,
            chapterId: this.chapter.id,
            signChapterId: this.signChapter.id,
            title: this.chapter.title,
            levelId: this.chapter.levelId,
            color: { r: round(this.color.r), g: round(this.color.g), b: round(this.color.b) },
            switching: this.switchAge < PORTAL.SWITCH_TIME,
            cycles: this.cycles,
            armed: this.armed,
            entered: this.entered,
            promptTop: this.feet.y + PORTAL_TOP,
            pos: { x: this.pos.x, y: this.pos.y },
            feet: { x: this.feet.x, y: this.feet.y },
        };
    }
}

function round(v)
{
    return Math.round(v * 100) / 100;
}
