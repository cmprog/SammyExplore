// The loaded narration lines and the rules for choosing one: key match, once, cooldown,
// condition, priority, and which `texts` variant (or escalation tier) to use. Knows nothing
// about display.
import { randInt } from 'littlejs';
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
        this.playCounts = new Map();     // count key (see countKey) -> times started, for `tiers`
        this.tierRanges = new Map();     // line id -> [{min, start, end}] into its flattened texts
    }

    /** New Game: forget every line said this session, so the story's lines play again. */
    forgetSeen()
    {
        this.seenIds.clear();
        this.seenVariants.clear();
        this.lastVariant.clear();
        this.lastPlayedAt.clear();
        this.playCounts.clear();
    }

    /** scripts in precedence order: level script first, then common. */
    loadScripts(scripts)
    {
        this.lines = [];
        this.byId.clear();
        this.tierRanges.clear();
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
        if (line.tiers && !this.addTiers(line))
            return;
        if (!line.tiers && !line.text && !line.texts?.length)
        {
            console.warn(`narration: line "${line.id}" has no text`);
            return;
        }
        this.lines.push(line);
        this.byId.set(line.id, line);
        if (line.trigger?.startsWith('spam:'))
            this.spamSources.add(line.trigger.slice('spam:'.length));
    }

    /** Index a line's escalation tiers into one flat list of texts, so variant memory
     *  (seenVariants, lastVariant) works the same as for `texts`. False if they're unusable. */
    addTiers(line)
    {
        const tiers = line.tiers.filter(tier => tier.text || tier.texts?.length);
        if (!tiers.length || tiers.length !== line.tiers.length)
            console.warn(`narration: line "${line.id}" has a tier with no text`);
        if (!tiers.length)
            return false;
        const ranges = [];
        let start = 0;
        for (const tier of [...tiers].sort((a, b) => (a.min ?? 1) - (b.min ?? 1)))
        {
            const count = tier.texts ? tier.texts.length : 1;
            ranges.push({ min: tier.min ?? 1, start, end: start + count, texts: tier.texts ?? [tier.text] });
            start += count;
        }
        this.tierRanges.set(line.id, ranges);
        return true;
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
        return this.conditionHolds(line, ctx);
    }

    conditionHolds(line, ctx)
    {
        if (!line.condition)
            return true;
        try { return !!line.condition(ctx); }
        catch (error)
        {
            console.error(`narration: condition for "${line.id}" threw`, error);
            return false;
        }
    }

    /** Is a queued instance still worth playing? Its line's `once` and `condition` are checked
     *  again, since the world may have moved on while it waited (cooldown is not: it was queued
     *  already). The condition sees the payload of the event that queued it. */
    stillWanted(instance, ctx)
    {
        const line = this.byId.get(instance.id);
        if (!line)
            return false;
        if (line.once && this.seenIds.has(line.id))
            return false;
        return this.conditionHolds(line, ctx);
    }

    /** A playable instance of a line: its chosen text plus what we need to record it later. */
    instance(line, now, payload = null)
    {
        const { text, variant, tier, countKey, count } = this.chooseText(line, payload);
        return {
            id: line.id,
            text,
            variant,
            tier,          // index into the line's tiers sorted by min (lowest = 0), or -1
            countKey,      // where its play count is kept (null without tiers)
            count,         // which play of this line (per countKey) this would be
            trigger: line.trigger ?? null,
            priority: priorityOf(line),
            once: !!line.once,
            noStale: !!line.noStale,
            instruction: line.instruction ?? null,
            queuedAt: now,
            payload,   // the event that queued it, for re-checking `condition` at play time
            requeued: false,
        };
    }

    chooseText(line, payload)
    {
        const ranges = this.tierRanges.get(line.id);
        if (ranges)
        {
            const countKey = this.countKey(line, payload);
            const count = (this.playCounts.get(countKey) ?? 0) + 1;
            // The highest tier this count has reached; counts below the first tier's min use it.
            let tier = 0;
            ranges.forEach((range, index) => { if (count >= range.min) tier = index; });
            const { start, end, texts } = ranges[tier];
            const variant = this.chooseVariant(line.id, start, end);
            return { text: texts[variant - start], variant, tier, countKey, count };
        }
        if (line.texts)
        {
            const variant = this.chooseVariant(line.id, 0, line.texts.length);
            return { text: line.texts[variant], variant, tier: -1, countKey: null, count: null };
        }
        return { text: line.text, variant: -1, tier: -1, countKey: null, count: null };
    }

    /** Tiers count per line, or per line and payload key (countPer: 'key', e.g. one count for
     *  each sign or door, so rereading sign A doesn't escalate sign B). */
    countKey(line, payload)
    {
        if (line.countPer !== 'key')
            return line.id;
        return `${line.id}#${payload?.key ?? payload?.id ?? ''}`;
    }

    /** Pick a variant index in [start, end): unseen ones first, else anything but the last one. */
    chooseVariant(lineId, start, end)
    {
        const seen = this.seenVariants.get(lineId) ?? new Set();
        const all = [];
        for (let index = start; index < end; index++)
            all.push(index);
        let pool = all.filter(index => !seen.has(index));
        if (!pool.length)   // all seen: anything but the one we just said
            pool = all.length > 1 ? all.filter(index => index !== this.lastVariant.get(lineId)) : all;
        return pool[randInt(pool.length)];
    }

    /** The line started showing: its cooldown starts now. */
    markStarted(instance, now)
    {
        this.lastPlayedAt.set(instance.id, now);
        // A started line counts toward its tiers even if it is cut off: the player did the
        // thing again either way. An interrupted line that is replayed only counts once.
        if (instance.countKey && !instance.counted)
        {
            instance.counted = true;
            this.playCounts.set(instance.countKey, (this.playCounts.get(instance.countKey) ?? 0) + 1);
        }
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
