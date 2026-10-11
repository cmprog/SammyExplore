// The loaded narration lines and the rules for choosing one: key match, once, cooldown,
// condition, priority, and which `texts` variant to use. Knows nothing about display.
import { randInt } from '../../../lib/littlejs/littlejs.esm.js';
import { NARRATOR } from '../../data/tuning.js';

const BUILT_IN_PREFIXES = ['idle:', 'spam:', 'ignored:', 'followed:'];

export class LineBook
{
    constructor()
    {
        this.lines = [];
        this.byId = new Map();
        this.instructions = new Map();
        this.spamRules = new Map();
        this.spamSources = new Set();    // events some 'spam:<event>' line listens for
        // Session memory survives loadScripts(), so `once` lines stay said across levels.
        this.seenIds = new Set();
        this.seenVariants = new Map();   // line id -> Set of variant indexes shown
        this.lastVariant = new Map();
        this.lastPlayedAt = new Map();
    }

    /** scripts in precedence order: level script first, then common. */
    loadScripts(scripts)
    {
        this.lines = [];
        this.byId.clear();
        this.instructions.clear();
        this.spamRules.clear();
        this.spamSources.clear();
        // Reverse so earlier (level) scripts overwrite later (common) spam/instruction entries.
        for (const script of [...scripts].reverse())
        {
            for (const [event, rule] of Object.entries(script.spam ?? {}))
                this.spamRules.set(event, rule);
            for (const instruction of script.instructions ?? [])
                this.instructions.set(instruction.id, instruction);
        }
        for (const script of scripts)
            for (const line of script.lines ?? [])
                this.addLine(line, script.id);
    }

    addLine(line, scriptId)
    {
        if (this.byId.has(line.id))
        {
            console.warn(`narration: duplicate line id "${line.id}" in ${scriptId}; keeping the first`);
            return;
        }
        if (!line.text && !line.texts?.length)
        {
            console.warn(`narration: line "${line.id}" has no text`);
            return;
        }
        this.lines.push(line);
        this.byId.set(line.id, line);
        if (line.trigger?.startsWith('spam:'))
            this.spamSources.add(line.trigger.slice('spam:'.length));
    }

    /** Bus events the narrator must subscribe to (line triggers plus spam sources). */
    eventNames()
    {
        const names = new Set(this.spamSources);
        for (const { trigger } of this.lines)
            if (trigger && !BUILT_IN_PREFIXES.some(prefix => trigger.startsWith(prefix)))
                names.add(trigger);
        return names;
    }

    /** Seconds values used by 'idle:N' triggers, ascending. */
    idleThresholds()
    {
        return this.lines
            .filter(line => line.trigger?.startsWith('idle:'))
            .map(line => Number(line.trigger.slice('idle:'.length)))
            .filter(seconds => seconds > 0)
            .sort((a, b) => a - b);
    }

    spamRule(event)
    {
        return this.spamRules.get(event) ?? NARRATOR.DEFAULT_SPAM;
    }

    /** Best line for a trigger right now, or null. Key-specific lines beat generic ones.
     *  busy: a line is showing, so `skipIfBusy` lines are out. */
    pick(trigger, payload, ctx, now, busy = false)
    {
        const payloadKey = payload?.key ?? payload?.id;
        let best = null;
        for (const line of this.lines)
        {
            if (line.trigger !== trigger)
                continue;
            if (line.key !== undefined && line.key !== payloadKey)
                continue;
            if (busy && line.skipIfBusy)
                continue;
            if (!this.isAvailable(line, ctx, now))
                continue;
            if (!best || this.outranks(line, best))
                best = line;
        }
        return best;
    }

    outranks(line, other)
    {
        const specific = Number(line.key !== undefined), otherSpecific = Number(other.key !== undefined);
        if (specific !== otherSpecific)
            return specific > otherSpecific;
        return priorityOf(line) > priorityOf(other);   // ties keep the earlier (level-first) line
    }

    isAvailable(line, ctx, now)
    {
        if (line.once && this.seenIds.has(line.id))
            return false;
        const last = this.lastPlayedAt.get(line.id);
        if (line.cooldown && last !== undefined && now - last < line.cooldown)
            return false;
        if (!line.condition)
            return true;
        try { return !!line.condition(ctx); }
        catch (error)
        {
            console.error(`narration: condition for "${line.id}" threw`, error);
            return false;
        }
    }

    /** A playable instance of a line: its chosen text plus what we need to record it later. */
    instance(line, now)
    {
        const variant = line.texts ? this.chooseVariant(line) : -1;
        return {
            id: line.id,
            text: variant >= 0 ? line.texts[variant] : line.text,
            variant,
            trigger: line.trigger ?? null,
            priority: priorityOf(line),
            once: !!line.once,
            instruction: line.instruction ?? null,
            queuedAt: now,
            requeued: false,
        };
    }

    chooseVariant(line)
    {
        const seen = this.seenVariants.get(line.id) ?? new Set();
        const all = line.texts.map((_, index) => index);
        let pool = all.filter(index => !seen.has(index));
        if (!pool.length)   // all seen: anything but the one we just said
            pool = all.length > 1 ? all.filter(index => index !== this.lastVariant.get(line.id)) : all;
        return pool[randInt(pool.length)];
    }

    /** The line started showing: its cooldown starts now. */
    markStarted(instance, now)
    {
        this.lastPlayedAt.set(instance.id, now);
    }

    /** The line was fully revealed, so the player has actually read it. */
    markSeen(instance)
    {
        this.seenIds.add(instance.id);
        if (instance.variant < 0)
            return;
        if (!this.seenVariants.has(instance.id))
            this.seenVariants.set(instance.id, new Set());
        this.seenVariants.get(instance.id).add(instance.variant);
        this.lastVariant.set(instance.id, instance.variant);
    }
}

function priorityOf(line)
{
    return line.priority ?? NARRATOR.DEFAULT_PRIORITY;
}
