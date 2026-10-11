// Fires 'idle:N' once per idle stretch when no input has been held for N seconds.
export class IdleWatcher
{
    constructor(onTrigger)
    {
        this.onTrigger = onTrigger;
        this.thresholds = [];
        this.seconds = 0;
        this.nextIndex = 0;
    }

    setThresholds(thresholds)
    {
        this.thresholds = thresholds;
        this.reset();
    }

    reset()
    {
        this.seconds = 0;
        this.nextIndex = 0;
    }

    /** active: the player is pressing something. suspended: don't count (e.g. mid-correction). */
    update(dt, active, suspended)
    {
        if (active)
            return this.reset();
        if (suspended)
            return;
        this.seconds += dt;
        while (this.nextIndex < this.thresholds.length && this.seconds >= this.thresholds[this.nextIndex])
            this.onTrigger(`idle:${this.thresholds[this.nextIndex++]}`);
    }
}
