"""T-012 narrator queue rules, checked on a private Narrator in the page (the game's own narrator
is left alone): noStale lines survive the stale pruning and the QUEUE_MAX truncation, a queued
line's `condition` is checked again when it plays, and forgetSeen() makes `once` lines playable again.

    .venv/Scripts/python tools/playtest/narrator_queue_scenario.py
"""
import sys

import harness

fails = []

PROBE = """async () => {
    const { Narrator } = await import('/src/systems/Narrator.js');
    const { NARRATOR } = await import('/src/data/tuning.js');
    const n = new Narrator();
    const flags = { ok: true };
    n.book.loadScripts([{ id: 'probe', lines: [
        { id: 'q.teach', text: 'teach', noStale: true, priority: 5 },
        { id: 'q.chatter', text: 'chatter', priority: 5 },
        { id: 'q.loud1', text: 'loud', priority: 50 },
        { id: 'q.loud2', text: 'loud', priority: 50 },
        { id: 'q.loud3', text: 'loud', priority: 50 },
        { id: 'q.loud4', text: 'loud', priority: 50 },
        { id: 'q.cond', text: 'cond', condition: ctx => flags.ok && ctx.payload?.tag === 'yes' },
        { id: 'q.once', text: 'once', once: true, trigger: 'probe:never' },
        { id: 'q.showing', text: 'a line that is up', priority: 99 },
    ] }]);
    const out = {};
    const book = n.book;
    const inst = (id, payload) => book.instance(book.byId.get(id), n.clock, payload);

    // 1. Stale pruning: both queued at t=0, played long after QUEUE_STALE.
    n.enqueue(inst('q.chatter'));
    n.enqueue(inst('q.teach'));
    n.clock = NARRATOR.QUEUE_STALE + 5;
    n.playNextQueued();
    out.staleQueuePlayed = n.textBox.line?.id ?? null;
    out.staleQueueLeft = n.queue.map(q => q.id);
    n.stop();

    // 2. QUEUE_MAX truncation: a low-priority noStale line among more loud lines than fit.
    n.clock = 0;
    n.play(inst('q.showing'));
    n.enqueue(inst('q.teach'));
    for (const id of ['q.loud1', 'q.loud2', 'q.loud3', 'q.loud4'])
        n.enqueue(inst(id));
    out.truncated = n.queue.map(q => q.id);
    out.queueMax = NARRATOR.QUEUE_MAX;
    n.stop();

    // 3. Condition re-checked at play time, with the payload that queued it.
    n.enqueue(inst('q.cond', { tag: 'yes' }));
    flags.ok = false;
    n.playNextQueued();
    out.condBlocked = n.textBox.line?.id ?? null;
    n.stop();
    flags.ok = true;
    n.enqueue(inst('q.cond', { tag: 'yes' }));
    n.playNextQueued();
    out.condAllowed = n.textBox.line?.id ?? null;
    n.stop();

    // 4. forgetSeen: a seen `once` line is available again.
    book.markSeen(inst('q.once'));
    out.onceBefore = !!book.pick('probe:never', null, {}, n.clock);
    n.forgetSeen();
    out.onceAfter = !!book.pick('probe:never', null, {}, n.clock);
    out.seenAfter = [...book.seenIds];
    n.dispose();
    return out;
}"""


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def main():
    with harness.session() as s:
        r = s.page.evaluate(PROBE)
        print("     probe:", r)
        check(r["staleQueuePlayed"] == "q.teach" and r["staleQueueLeft"] == [],
              "after QUEUE_STALE, the noStale line still plays and the plain reaction is dropped")
        check("q.teach" in r["truncated"] and len([i for i in r["truncated"] if i.startswith("q.loud")]) == r["queueMax"] - 1,
              f"QUEUE_MAX truncation keeps the noStale line ({r['truncated']})")
        check(r["condBlocked"] is None, "a queued line whose condition stopped holding doesn't play")
        check(r["condAllowed"] == "q.cond", "a queued line whose condition still holds plays (payload kept)")
        check(r["onceBefore"] is False and r["onceAfter"] is True and r["seenAfter"] == [],
              "forgetSeen() makes a seen once line available again")
    check(not s.errors, f"no console errors ({s.errors})")
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
