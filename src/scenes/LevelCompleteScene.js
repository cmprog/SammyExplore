// Level complete overlay, pushed over the playing scene when level:complete fires.
// The level keeps running underneath (updatesBelow) so the narrator can make its remark
// (any narration line triggered by level:complete) while confetti falls; gameplay input is locked.
// Then: on to the level data's `nextLevel`, or a "To be continued..." card and back to the title.
import { mainCanvasSize, timeReal, rand, randInt, smoothStep, clamp } from '../../lib/littlejs/littlejs.esm.js';
import { emit } from '../core/events.js';
import { wasPressed, mouse, lockGameplay, unlockGameplay } from '../core/input.js';
import { drawScreenCanvas } from '../art/screenCanvas.js';
import { drawConfetti, drawBanner, drawPrompt, drawToBeContinued, CONFETTI_COLORS } from '../art/drawCelebration.js';
import { LEVEL_COMPLETE_TEXT } from '../data/screens.js';
import { SCREENS } from '../data/tuning.js';

const LOCK_REASON = 'levelComplete';
const BANNER_POS = { x: 960, y: 230 };
const PROMPT_POS = { x: 960, y: 410 };
const SHAPES = ['star', 'star', 'dot', 'dot', 'feather'];

export class LevelCompleteScene
{
    constructor(scenes)
    {
        this.scenes = scenes;
        this.updatesBelow = true;
        this.phase = 'celebrate';
        this.phaseTime = 0;
        this.nextLevel = null;
        this.confetti = [];
        this.lastTime = 0;
    }

    /** params: the level:complete payload ({id, levelId, nextLevel?, ...}). */
    enter({ nextLevel = null } = {})
    {
        lockGameplay(LOCK_REASON);
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
        if (this.phase === 'celebrate' && pressed && this.phaseTime >= SCREENS.LEVEL_COMPLETE_MIN_TIME)
        {
            emit('menu:select');
            if (this.nextLevel)
                return this.scenes.change('playing', { levelId: this.nextLevel });
            this.phase = 'toBeContinued';
            this.phaseTime = 0;
        }
        else if (this.phase === 'toBeContinued')
        {
            const skip = pressed && this.phaseTime >= SCREENS.TO_BE_CONTINUED_MIN_TIME;
            if (skip || this.phaseTime >= SCREENS.TO_BE_CONTINUED_AUTO_TIME)
                this.scenes.change('title');
        }
    }

    renderPost()
    {
        const time = timeReal;
        drawScreenCanvas(ctx =>
        {
            drawConfetti(ctx, this.confetti);
            if (this.phase === 'celebrate')
            {
                drawBanner(ctx, LEVEL_COMPLETE_TEXT.banner, BANNER_POS, smoothStep(clamp(this.phaseTime / .6, 0, 1)), time);
                if (this.phaseTime >= SCREENS.LEVEL_COMPLETE_MIN_TIME)
                    drawPrompt(ctx, LEVEL_COMPLETE_TEXT.prompt, PROMPT_POS, time);
            }
            else
                drawToBeContinued(ctx, mainCanvasSize, LEVEL_COMPLETE_TEXT.toBeContinued, clamp(this.phaseTime / 1.2, 0, 1), time);
        });
    }

    /** For window.__sammy.menu. */
    menuDebugState()
    {
        return { screen: this.phase, nextLevel: this.nextLevel, seconds: Math.round(this.phaseTime * 10) / 10 };
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
