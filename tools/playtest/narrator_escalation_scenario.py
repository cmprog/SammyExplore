"""T-019 narrator escalation tiers.

Part 1, on a private Narrator in the page (the game's own narrator is left alone): a tiered line
moves up its tiers as its play count grows (including a one-play payoff tier), `countPer: 'key'`
keeps one count per payload key, an interrupted line that is replayed counts once, loading
another script keeps the counts, and forgetSeen() resets them. Every tiered line in the real
narration data loads without warnings.

Part 2, on the game's narrator: repeated corrections climb correction.common's tiers (visible in
__sammy.narrator.lineCounts and current.tier), locked-door rattles count per door, a level change
without a new story keeps the counts, and a New Game resets them.

    .venv/Scripts/python tools/playtest/narrator_escalation_scenario.py
"""
import sys
import time

import harness

fails = []

PROBE = """async () => {
    const { Narrator } = await import('/src/systems/Narrator.js');
    const { COMMON_SCRIPT, LEVEL_SCRIPTS } = await import('/src/data/narration/index.js');
    const n = new Narrator();
    const book = n.book;
    const script = { id: 'probe', lines: [
        { id: 'e.line', trigger: 'probe:a', tiers: [
            { min: 1, texts: ['a1', 'a2'] }, { min: 3, texts: ['b1', 'b2'] }, { min: 5, text: 'payoff' }, { min: 6, texts: ['c1', 'c2'] },
        ] },
        { id: 'e.keyed', trigger: 'probe:k', countPer: 'key', tiers: [{ min: 1, text: 'first' }, { min: 2, text: 'again' }] },
        { id: 'e.once', trigger: 'probe:o', once: true, tiers: [{ min: 1, text: 'only' }] },
    ] };
    book.loadScripts([script]);
    const play = (id, payload = null) => {
        const inst = book.instance(book.byId.get(id), n.clock, payload);
        book.markStarted(inst, n.clock);
        book.markSeen(inst);
        return inst;
    };
    const out = {};
    out.sequence = [];
    for (let i = 0; i < 8; i++)
    {
        const inst = play('e.line');
        out.sequence.push({ tier: inst.tier, count: inst.count, text: inst.text });
    }
    out.keyedA = [play('e.keyed', { key: 'a' }).text, play('e.keyed', { key: 'a' }).text];
    out.keyedB = play('e.keyed', { id: 'b' }).text;
    // An interrupted (requeued) instance started again only counts once.
    const twice = book.instance(book.byId.get('e.once'), 0);
    book.markStarted(twice, 0);
    book.markStarted(twice, 1);
    out.onceCount = book.playCounts.get('e.once');
    out.counts = Object.fromEntries(book.playCounts);
    book.loadScripts([script]);
    out.afterReload = play('e.line').tier;
    n.forgetSeen();
    out.afterForget = Object.fromEntries(book.playCounts);
    out.afterForgetTier = play('e.line').tier;

    // The real narration data: every tiered line loads (no warnings) and has its tier ranges.
    const warnings = [];
    const warn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    const real = { tiered: 0, ranged: 0 };
    try
    {
        for (const level of Object.values(LEVEL_SCRIPTS))
        {
            book.loadScripts([level, COMMON_SCRIPT]);
            for (const line of book.lines)
                if (line.tiers)
                {
                    real.tiered++;
                    if (book.tierRanges.has(line.id))
                        real.ranged++;
                }
        }
    }
    finally { console.warn = warn; }
    out.real = real;
    out.warnings = warnings;
    n.dispose();
    return out;
}"""


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def nar(pg):
    return harness.state(pg)["narrator"]


def wait_until(fn, timeout=10, step=0.05):
    t = time.time()
    while time.time() - t < timeout:
        v = fn()
        if v:
            return v
        time.sleep(step)
    return None


def settle(pg, timeout=30):
    """Dismiss narration with Enter until nothing is showing or queued."""
    t = time.time()
    while time.time() - t < timeout:
        n = nar(pg)
        if n["current"] is None and n["queueLength"] == 0 and n["correction"] is None:
            time.sleep(0.4)
            n = nar(pg)
            if n["current"] is None and n["queueLength"] == 0:
                return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(0.25)
    return False


def correction(pg):
    """Trigger one correction; return (tier, count, text) of the line it showed."""
    pg.evaluate("window.__sammy.commands.emit('correction:triggered', { id: 'escalation-probe' })")
    line = wait_until(lambda: (nar(pg)["current"] or {}).get("id") == "correction.common" and nar(pg)["current"], 5)
    wait_until(lambda: nar(pg)["correction"] is None, 6)
    settle(pg)
    return (line or {}).get("tier"), (line or {}).get("count"), (line or {}).get("text")


def load_story(pg, new_story):
    params = "{ levelId: 'test', newStory: true, companion: null, chapterProgress: {} }" if new_story else "{ levelId: 'test' }"
    pg.evaluate(f"window.__sammy.commands.changeScene('playing', {params})")
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
    time.sleep(0.3)
    settle(pg)


def in_game(pg):
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
    check(settle(pg), "arrival narration settles")

    results = [correction(pg) for _ in range(5)]
    for r in results:
        print("     correction:", r)
    tiers = [r[0] for r in results]
    check(tiers == [0, 0, 1, 1, 2], f"corrections climb the tiers 0,0,1,1,2 ({tiers})")
    check([r[1] for r in results] == [1, 2, 3, 4, 5], f"current.count is the play number ({[r[1] for r in results]})")
    counts = nar(pg)["lineCounts"]
    check(counts.get("correction.common") == 5, f"lineCounts has 5 corrections ({counts})")

    # Per-door counts (countPer: 'key'): two rattles of door A, one of door B.
    for door in ("door-a", "door-a", "door-b"):
        pg.evaluate(f"window.__sammy.commands.emit('interact:doorLocked', {{ id: '{door}' }})")
        wait_until(lambda: (nar(pg)["current"] or {}).get("id") == "door.locked", 3)
        settle(pg)
        time.sleep(3.1)   # door.locked's cooldown
    counts = nar(pg)["lineCounts"]
    check(counts.get("door.locked#door-a") == 2 and counts.get("door.locked#door-b") == 1,
          f"locked doors count per door ({counts})")

    load_story(pg, new_story=False)
    counts = nar(pg)["lineCounts"]
    check(counts.get("correction.common") == 5, f"a level change (no new story) keeps the counts ({counts})")

    load_story(pg, new_story=True)
    counts = nar(pg)["lineCounts"]
    check(not any(k.startswith("correction.") or k.startswith("door.") for k in counts),
          f"New Game resets the counts ({counts})")
    tier, count, text = correction(pg)
    check(tier == 0 and count == 1, f"after New Game the first correction is tier 0 again ({tier}, {count}, {text})")


def main():
    with harness.session() as s:
        r = s.page.evaluate(PROBE)
        print("     probe:", r)
        seq = r["sequence"]
        check([e["tier"] for e in seq] == [0, 0, 1, 1, 2, 3, 3, 3], f"tiers by play count ({[e['tier'] for e in seq]})")
        check([e["count"] for e in seq] == list(range(1, 9)), "instance.count is the play number")
        check(seq[4]["text"] == "payoff", "the one-play payoff tier plays exactly at its min")
        check(set(e["text"] for e in seq[:2]) == {"a1", "a2"}, "a tier's variants are used before repeating")
        check(r["keyedA"] == ["first", "again"] and r["keyedB"] == "first", f"countPer 'key' counts each key apart ({r['keyedA']}, {r['keyedB']})")
        check(r["onceCount"] == 1, "a replayed (interrupted) instance counts once")
        check(r["afterReload"] == 3, "loadScripts() keeps the counts")
        check(r["afterForget"] == {} and r["afterForgetTier"] == 0, "forgetSeen() resets the counts")
        check(r["real"]["tiered"] > 0 and r["real"]["tiered"] == r["real"]["ranged"], f"real tiered lines all load ({r['real']})")
        check(not r["warnings"], f"no narration warnings for the real scripts ({r['warnings']})")
        in_game(s.page)
    check(not s.errors, f"no console errors ({s.errors})")
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
