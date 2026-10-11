// Fires 'spam:<event>' when <event> happens `count` times within `seconds`.
// The window is cleared after firing so one burst gives one remark.
export class SpamWatcher
{
    constructor(onTrigger)
    {
        this.onTrigger = onTrigger;
        this.stamps = new Map();   // event -> recent timestamps
    }

    clear()
    {
        this.stamps.clear();
    }

    record(event, rule, now)
    {
        const recent = (this.stamps.get(event) ?? []).filter(stamp => now - stamp <= rule.seconds);
        recent.push(now);
        if (recent.length >= rule.count)
        {
            this.stamps.set(event, []);
            this.onTrigger(`spam:${event}`);
            return;
        }
        this.stamps.set(event, recent);
    }
}
