// Tracks instructions the narrator has given ("the Eagle flew RIGHT") and fires
// 'followed:<id>' or 'ignored:<id>' when the data-defined condition comes true.
export class InstructionWatcher
{
    constructor(onTrigger)
    {
        this.onTrigger = onTrigger;
        this.armed = [];
    }

    clear()
    {
        this.armed = [];
    }

    arm(instruction, playerPos, now)
    {
        this.armed = this.armed.filter(entry => entry.instruction.id !== instruction.id);
        this.armed.push({ instruction, armedAt: now, armedPos: playerPos });
    }

    armedIds()
    {
        return this.armed.map(entry => entry.instruction.id);
    }

    /** baseCtx: { playerPos, events }. Conditions get armedPos/armedFor added. */
    update(baseCtx, now)
    {
        for (const entry of [...this.armed])
        {
            const result = this.evaluate(entry, { ...baseCtx, armedPos: entry.armedPos, armedFor: now - entry.armedAt });
            if (!result)
                continue;
            this.armed.splice(this.armed.indexOf(entry), 1);
            if (result !== 'timeout')
                this.onTrigger(`${result}:${entry.instruction.id}`);
        }
    }

    evaluate({ instruction }, ctx)
    {
        try
        {
            if (instruction.success?.(ctx))
                return 'followed';
            if (instruction.failure?.(ctx))
                return 'ignored';
        }
        catch (error)
        {
            console.error(`narration: instruction "${instruction.id}" condition threw`, error);
            return 'timeout';   // disarm a broken instruction rather than throwing every frame
        }
        if (instruction.timeout && ctx.armedFor >= instruction.timeout)
            return 'timeout';
        return null;
    }
}
