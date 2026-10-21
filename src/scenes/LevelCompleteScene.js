// Level complete overlay, pushed over the playing scene when level:complete fires.
// The level keeps running underneath (updatesBelow) so the narrator can make its remark
// (any narration line triggered by level:complete) while confetti falls; gameplay input is locked.
// The continue prompt waits until that remark is fully shown (or SCREENS.LEVEL_COMPLETE_LINE_WAIT
// passes), so the last line of the chapter is never cut off; a press while it is still typing
// finishes it instead (narrator:skip).
// Then: on to the level data's `nextLevel`, or (the end of a chapter) home to the bedroom through
// the portal swirl (systems/SwirlTransition.js), where the narrator welcomes Sammy back.
import { mainCanvasSize, timeReal, rand, randInt, smoothStep, clamp } from 'littlejs';
import { on, emit } from '../core/events.js';
import { wasPressed, mouse, lockGameplay, unlockGameplay } from '../core/input.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawConfetti, drawBanner, drawPrompt, CONFETTI_COLORS } from '../art/drawCelebration.js';
import { LEVEL_COMPLETE_TEXT } from '../data/screens.js';
import { SCREENS } from '../data/tuning.js';
import { HOME_LEVEL_ID } from '../data/progression.js';
import { chapterEndingAt, HOME_SWIRL_COLOR } from '../data/chapters.js';

const LOCK_REASON = 'levelComplete';
const BANNER_POS = { x: 960, y: 230 };
const PROMPT_POS = { x: 960, y: 410 };
const SHAPES = ['star', 'star', 'dot', 'dot', 'feather'];

export class LevelCompleteScene
{
    /** @param {SceneManager} scenes  @param {SwirlTransition} transition */
    constructor(scenes, transition)
    {
        this.scenes = scenes;
        this.transition = transition;
        this.levelId = null;
        this.updatesBelow = true;
        this.phase = 'celebrate';
        this.phaseTime = 0;
        this.nextLevel = null;
        this.confetti = [];
        this.lastTime = 0;
        // The narrator's latest line, tracked all the time rather than only while this scene is
        // up: the narrator can start its level complete line in the same step as level:complete,
        // before this scene's enter() runs. For the whole game, so never unsubscribed.
        this.lastLine = null;   // { id, revealed, startedAt (timeReal) }
        on('narrator:line', ({ id }) => { this.lastLine = { id, revealed: false, startedAt: timeReal }; });
        on('narrator:revealed', ({ id }) =>
        {
            if (this.lastLine?.id === id)
                this.lastLine.revealed = true;
        });
    }

    /** The narrator's line is still typing out. Gives up after LEVEL_COMPLETE_LINE_WAIT, so a
     *  line that never finishes (cleared, or a stale one) can't strand the player. */
    get waitingForLine()
    {
        const line = this.lastLine;
        return !!line && !line.revealed && timeReal - line.startedAt < SCREENS.LEVEL_COMPLETE_LINE_WAIT;
    }

    /** params: the level:complete payload ({id, levelId, nextLevel?, ...}). */
    enter({ levelId = null, nextLevel = null } = {})
    {
        lockGameplay(LOCK_REASON);
        this.levelId = levelId;
        this.nextLevel = nextLevel;
        this.phase = 'celebrate';
        this.phaseTime = 0;
        this.lastTime = timeReal;
        this.confetti = Array.from({ length: SCREENS.CONFETTI_COUNT }, (_, i) => makePiece(i % 2 ? 1 : -1));
    }

    exit()
    {
        unlockGameplay(LOCK_REASON);
        this.confetti = [];
    }

    updatePost()
    {
        const dt = clamp(timeReal - this.lastTime, 0, .1);
        this.lastTime = timeReal;
        this.phaseTime += dt;
        this.confetti.forEach(piece => movePiece(piece, dt));

        const pressed = wasPressed('confirm') || mouse.wasPressed(0);
        if (this.phase === 'celebrate' && pressed && this.waitingForLine)
            emit('narrator:skip');   // finish the line first; the next press continues
        else if (this.phase === 'celebrate' && pressed && this.canContinue())
        {
            emit('menu:select');
            if (this.nextLevel)
                return this.scenes.change('playing', { levelId: this.nextLevel });
            this.goHome();
        }
    }

    /** The end of a chapter: swirl home to the bedroom in the chapter's color. */
    goHome()
    {
        const color = chapterEndingAt(this.levelId)?.portalColor ?? HOME_SWIRL_COLOR;
        if (this.transition.start({ levelId: HOME_LEVEL_ID, color }))
            this.phase = 'goingHome';
    }

    canContinue()
    {
        return this.phaseTime >= SCREENS.LEVEL_COMPLETE_MIN_TIME && !this.waitingForLine;
    }

    renderPost()
    {
        const time = timeReal;
        drawScreenCanvas(ctx =>
        {
            drawConfetti(ctx, this.confetti);
            drawBanner(ctx, LEVEL_COMPLETE_TEXT.banner, BANNER_POS, smoothStep(clamp(this.phaseTime / .6, 0, 1)), time);
            if (this.phase === 'celebrate' && this.canContinue())
                drawPrompt(ctx, LEVEL_COMPLETE_TEXT.prompt, PROMPT_POS, time);
        });
    }

    /** For window.__sammy.menu. */
    menuDebugState()
    {
        return {
            screen: this.phase,
            levelId: this.levelId,
            nextLevel: this.nextLevel,
            seconds: Math.round(this.phaseTime * 10) / 10,
            waitingForLine: this.waitingForLine,
            canContinue: this.phase === 'celebrate' && this.canContinue(),
        };
    }
}

/** Confetti bursts up from a bottom corner and tumbles down. Screen pixels per second. */
function makePiece(side)
{
    return {
        x: side < 0 ? rand(-40, 200) : mainCanvasSize.x - rand(-40, 200),
        y: mainCanvasSize.y + rand(10, 120),
        vx: -side * rand(150, 650),
        vy: -rand(800, 1400),
        angle: rand(0, 6.28),
        spin: rand(-6, 6),
        size: rand(14, 28),
        color: CONFETTI_COLORS[randInt(CONFETTI_COLORS.length)],
        shape: SHAPES[randInt(SHAPES.length)],
    };
}

function movePiece(piece, dt)
{
    piece.vy += SCREENS.CONFETTI_GRAVITY * dt;
    // Air drag once falling, plus a sideways flutter, so it drifts instead of dropping like rocks.
    if (piece.vy > 0)
        piece.vy = Math.min(piece.vy, 180);
    piece.vx *= Math.pow(.6, dt);
    piece.x += (piece.vx + Math.sin(piece.angle) * 40) * dt;
    piece.y += piece.vy * dt;
    piece.angle += piece.spin * dt;
}
