// The Narrator: listens to the event bus and input, picks lines from narration data, shows
// them in a storybook text box, and runs the "rewrite" visual for corrections.
//
// Depends only on the event bus, the input module, and its own data. It never touches
// the player or level directly; it talks through events.
//
// HOW A HOST SCENE WIRES IT (one Narrator instance for the whole game, created in main.js):
//   enter(params)   narrator.forgetSeen()             // only for a New Game: every line is new again
//                   narrator.loadScript(levelId)      // common.js + narration/<levelId>.js
//                   narrator.setPlayerPositionProvider(() => player ? { x, y } : null)
//   update()        narrator.update()                 // once per engine update step, BEFORE the
//                                                     // player and interaction systems: the
//                                                     // narrator consumes the E/Enter press it
//                                                     // uses, so it isn't also an `interact`
//   renderPost()    narrator.renderPost()             // screen space, draws over the world
//   exit()          narrator.dispose()                // drop lines, cancel a correction, unlock input, unsubscribe
// While the host is paused, keep calling renderPost() but not update(): the text box freezes.
// Careful: if pausing switches scenes (so the host's exit() runs), don't dispose there, or the
// current line and any correction in progress are lost; dispose only when leaving the level.
// To restart narration (new level, or retry), just call loadScript() again.
//
// Events consumed: any event a line's trigger names (level:start, player:*, interact:*,
//   narration:zone, checkpoint:reached, ...), plus correction:triggered and narrator:skip (always).
// Events emitted:
//   narrator:line  {id, text}     a line started showing
//   narrator:revealed {id}        the showing line is fully revealed (typed out or skipped)
//   narrator:blip  {lineId}       typewriter blip, once per word (for the audio system); quiet,
//                                 so it is not recorded in the recent-events buffer
//   correction:reset {zoneId}     page is fully scribbled: move Sammy to the last checkpoint now
//   correction:done  {zoneId}     the rewrite finished; gameplay input is unlocked again
// During a correction, gameplay actions are locked via input.lockGameplay('correction').
import { timeDelta } from 'littlejs';
import { on, emit, recentEvents } from '../core/events.js';
import { wasPressed, consumePress, actionsDown } from '../core/input.js';
import { NARRATOR } from '../data/tuning.js';
import { COMMON_SCRIPT, LEVEL_SCRIPTS } from '../data/narration/index.js';
import { drawStoryBox, layoutStoryText } from '../art/drawStoryBox.js';
import { drawPageScribble } from '../art/drawPageScribble.js';
import { LineBook } from './narration/LineBook.js';
import { TextBox } from './narration/TextBox.js';
import { IdleWatcher } from './narration/IdleWatcher.js';
import { SpamWatcher } from './narration/SpamWatcher.js';
import { InstructionWatcher } from './narration/InstructionWatcher.js';
import { CorrectionSequence } from './narration/CorrectionSequence.js';

const CORRECTION_EVENT = 'correction:triggered';
const SKIP_EVENT = 'narrator:skip';

export class Narrator
{
    constructor()
    {
        const fire = trigger => this.trigger(trigger);
        this.book = new LineBook();
        this.textBox = new TextBox({
            onBlip: line => emit('narrator:blip', { lineId: line.id }, { quiet: true }),
            onRevealed: line => this.onRevealed(line),
        });
        this.idle = new IdleWatcher(fire);
        this.spam = new SpamWatcher(fire);
        this.instructions = new InstructionWatcher(fire);
        this.correction = new CorrectionSequence();
        this.queue = [];
        this.clock = 0;          // narrator-local seconds; only advances in update()
        this.gap = 0;
        this.scriptId = null;
        this.unsubscribers = [];
        this.playerPosProvider = null;
    }

    /** Load common lines plus the level's script (if it has one) and subscribe to their events. */
    loadScript(levelId = null)
    {
        const levelScript = levelId ? LEVEL_SCRIPTS[levelId] : null;
        if (levelId && !levelScript)
            console.warn(`narrator: no narration script for level "${levelId}"; using common lines only`);
        this.stop();
        this.book.loadScripts([levelScript, COMMON_SCRIPT].filter(Boolean));
        this.idle.setThresholds(this.book.idleThresholds());
        this.scriptId = levelScript ? levelId : null;
        this.subscribe();
    }

    /** Forget which lines were said (New Game), so `once` lines and unseen variants play again. */
    forgetSeen()
    {
        this.book.forgetSeen();
    }

    /** provider() returns {x, y} (world units) or null. Called only when a condition needs it. */
    setPlayerPositionProvider(provider)
    {
        this.playerPosProvider = provider;
    }

    /** Clear lines, watchers, and any running correction. Keeps subscriptions and seen lines. */
    stop()
    {
        this.queue = [];
        this.textBox.clear();
        this.instructions.clear();
        this.spam.clear();
        this.idle.reset();
        this.correction.cancel();
    }

    /** stop() plus unsubscribe from the bus. */
    dispose()
    {
        this.stop();
        this.unsubscribe();
    }

    subscribe()
    {
        this.unsubscribe();
        for (const name of this.book.eventNames())
            if (name !== CORRECTION_EVENT && name !== SKIP_EVENT)
                this.unsubscribers.push(on(name, payload => this.onEvent(name, payload)));
        this.unsubscribers.push(on(CORRECTION_EVENT, payload => this.startCorrection(payload)));
        this.unsubscribers.push(on(SKIP_EVENT, () => this.textBox.finishReveal()));
    }

    unsubscribe()
    {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }

    onEvent(name, payload)
    {
        if (this.book.spamSources.has(name))
            this.spam.record(name, this.book.spamRule(name), this.clock);
        this.trigger(name, payload);
    }

    /** Fire a trigger (bus event name or built-in like 'idle:12'). Plays the best matching line, if any. */
    trigger(name, payload)
    {
        const line = this.book.pick(name, payload, this.conditionContext(payload), this.clock, this.textBox.busy);
        if (line)
            this.enqueue(this.book.instance(line, this.clock, payload));
    }

    /** Say a specific line by id. now: interrupt whatever is showing. */
    say(lineId, { now = false } = {})
    {
        const line = this.book.byId.get(lineId);
        if (!line)
        {
            console.warn(`narrator: unknown line "${lineId}"`);
            return false;
        }
        const instance = this.book.instance(line, this.clock);
        if (now)
            this.play(instance);
        else
            this.enqueue(instance);
        return true;
    }

    startCorrection(payload)
    {
        const zoneId = payload?.id ?? payload?.zoneId ?? null;
        if (!this.correction.start(zoneId))
            return;
        this.idle.reset();
        const lineId = payload?.lineId;
        if (lineId && this.book.byId.has(lineId))
            return void this.say(lineId, { now: true });
        if (lineId)
            console.warn(`narrator: correction zone "${zoneId}" names unknown line "${lineId}"; using the common pool`);
        this.trigger(CORRECTION_EVENT, payload);
    }

    enqueue(instance)
    {
        const current = this.textBox.line;
        if (current?.id === instance.id || this.queue.some(queued => queued.id === instance.id))
            return;
        if (current && instance.priority > current.priority)
            return this.play(instance);
        this.queue.push(instance);
        // Stable sort: interrupted lines waiting to resume first, then lines that must not be lost
        // (noStale: they teach a move), then highest priority, then oldest. Truncation never
        // drops those first two kinds.
        this.queue.sort((a, b) => (b.requeued - a.requeued) || (b.noStale - a.noStale) || (b.priority - a.priority));
        const keep = Math.max(NARRATOR.QUEUE_MAX, this.queue.filter(isPinned).length);
        this.queue.length = Math.min(this.queue.length, keep);
    }

    play(instance)
    {
        this.requeueIfInterrupted(this.textBox.line);
        instance.layout = null;   // laid out lazily at render time, when the canvas font is available
        this.book.markStarted(instance, this.clock);
        this.textBox.show(instance);
        emit('narrator:line', { id: instance.id, text: instance.text });
    }

    /** A `once` line or an instruction cut off before the player read it would otherwise be
     *  lost for good, so it goes back to the front of the queue. */
    requeueIfInterrupted(line)
    {
        if (!line || this.textBox.revealed || !(line.once || line.instruction))
            return;
        line.requeued = true;
        this.queue.unshift(line);
    }

    playNextQueued()
    {
        // Interrupted and noStale lines don't go stale: they matter more than a passing reaction.
        this.queue = this.queue.filter(queued => isPinned(queued) || this.clock - queued.queuedAt <= NARRATOR.QUEUE_STALE);
        // The world may have moved on while a line waited: its condition must still hold now.
        while (this.queue.length)
        {
            const next = this.queue.shift();
            if (this.book.stillWanted(next, this.conditionContext(next.payload)))
                return this.play(next);
        }
    }

    onRevealed(line)
    {
        this.book.markSeen(line);
        this.armInstruction(line);
        emit('narrator:revealed', { id: line.id });
    }

    armInstruction(line)
    {
        if (!line.instruction)
            return;
        const instruction = this.book.instructions.get(line.instruction);
        if (instruction)
            this.instructions.arm(instruction, this.playerPos(), this.clock);
        else
            console.warn(`narrator: line "${line.id}" gives unknown instruction "${line.instruction}"`);
    }

    update()
    {
        const dt = timeDelta;
        this.clock += dt;
        // Idle time only counts while nobody is talking, so a long line isn't "idling".
        this.idle.update(dt, actionsDown().length > 0, this.correction.running || this.textBox.busy);
        this.correction.update(dt);
        if (this.instructions.armed.length)
            this.instructions.update({ playerPos: this.playerPos(), events: recentEvents() }, this.clock);

        if (wasPressed('advance') && this.textBox.tryAdvance())
            consumePress('advance');
        const showing = this.textBox.line;
        if (this.textBox.update(dt))
            this.lineEnded(showing);
        if (!this.textBox.busy && (this.gap -= dt) <= 0)
            this.playNextQueued();
    }

    lineEnded(line)
    {
        this.gap = NARRATOR.GAP_BETWEEN_LINES;
        // After a regular line, idle counting starts over. After an idle line, keep the count
        // (paused while it showed) so the idle remarks still escalate 12s -> 30s -> 60s.
        if (!line.trigger?.startsWith('idle:'))
            this.idle.reset();
    }

    renderPost()
    {
        const correction = this.correction.visualState();
        if (correction)
            drawPageScribble(correction, this.clock);
        const line = this.textBox.line;
        if (!line)
            return;
        line.layout ??= layoutStoryText(line.text);
        drawStoryBox({
            rows: line.layout,
            visibleChars: this.textBox.visibleChars(),
            appear: this.textBox.appear,
            revealed: this.textBox.revealed,
            time: this.clock,
        });
    }

    conditionContext(payload)
    {
        // Getters: most lines have no condition, so don't copy the event log for nothing.
        const narrator = this;
        return {
            payload,
            get playerPos() { return narrator.playerPos(); },
            get events() { return recentEvents(); },
        };
    }

    playerPos()
    {
        try
        {
            const pos = this.playerPosProvider?.();
            return pos ? { x: pos.x, y: pos.y } : null;
        }
        catch (error)
        {
            console.error('narrator: player position provider threw', error);
            return null;
        }
    }

    /** A line is on screen (the host frames the camera around the text box). */
    get showing()
    {
        return !!this.textBox.line;
    }

    /** Plain data for window.__sammy.narrator. */
    debugState()
    {
        const line = this.textBox.line;
        return {
            current: line ? {
                id: line.id,
                text: line.text,
                priority: line.priority,
                revealed: this.textBox.revealed,
                visibleChars: this.textBox.visibleChars(),
            } : null,
            queueLength: this.queue.length,
            seenIds: [...this.book.seenIds],
            script: this.scriptId,
            correction: this.correction.debugState(),
            armedInstructions: this.instructions.armedIds(),
            idleSeconds: Math.round(this.idle.seconds * 10) / 10,
        };
    }
}

function isPinned(instance)
{
    return instance.requeued || instance.noStale;
}
