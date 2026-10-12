"""Release build smoke (T-012): index.html WITHOUT ?debug loads littlejs.esm.min.js (debug off).

Checks: the game boots to the title and into a level with no console/page errors; the import map
picked the min build (and never fetched the debug build); holding '=' or '-' doesn't change the game
speed; the backtick debug-overlay key does nothing. A short control run on the ?debug build proves
the speed and overlay measurements can tell the difference.

    .venv/Scripts/python tools/playtest/release_smoke.py
"""
import sys
import time

import harness

fails = []

ENGINE = "async () => { const m = await import('littlejs'); return { debug: m.debug, version: m.engineVersion, overlay: m.debugOverlay }; }"
FRAME = "async () => { const m = await import('littlejs'); return [m.frame, performance.now()]; }"
OVERLAY = "async () => (await import('littlejs')).debugOverlay"
ENGINE_FILES = ("() => performance.getEntriesByType('resource').map(e => e.name)"
                ".filter(n => n.includes('/lib/littlejs/')).map(n => n.split('/').pop())")


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def steps_per_second(pg, key=None, seconds=1.5):
    """Engine update steps per real second, optionally while holding a key."""
    if key:
        pg.keyboard.down(key)
    try:
        f0, t0 = pg.evaluate(FRAME)
        time.sleep(seconds)
        f1, t1 = pg.evaluate(FRAME)
    finally:
        if key:
            pg.keyboard.up(key)
    return (f1 - f0) / ((t1 - t0) / 1000)


def measure(pg):
    base = steps_per_second(pg)
    fast = steps_per_second(pg, "Equal")
    slow = steps_per_second(pg, "Minus")
    harness.tap(pg, "Backquote")
    time.sleep(0.2)
    overlay = pg.evaluate(OVERLAY)
    if overlay:
        harness.tap(pg, "Backquote")   # put it back for anything after
    return base, fast, slow, overlay


def release_run():
    with harness.session(debug=False, start_level="test", timeout=15) as s:
        pg = s.page
        engine = pg.evaluate(ENGINE)
        files = pg.evaluate(ENGINE_FILES)
        check(not engine["debug"], f"release build: LittleJS debug is off (the min build uses 0 for false) ({engine})")
        check("littlejs.esm.min.js" in files and "littlejs.esm.js" not in files, f"only the min build was fetched ({files})")
        check(harness.state(pg)["level"]["id"] == "test", "the title came up and a level loads in the release build")
        time.sleep(1.0)
        base, fast, slow, overlay = measure(pg)
        print(f"     release: {base:.0f} steps/s normally, {fast:.0f} holding '=', {slow:.0f} holding '-'")
        check(fast < base * 1.5 and slow > base * 0.6, "'=' and '-' don't change the game speed")
        check(not overlay, "the backtick key doesn't open the debug overlay")
        player = harness.state(pg)["player"]
        check(player is not None, "the player exists after the key presses")
    check(not s.errors, f"no console or page errors in the release build ({s.errors})")


def debug_control_run():
    with harness.session(debug=True, start_level="test", timeout=15) as s:
        pg = s.page
        engine = pg.evaluate(ENGINE)
        check(bool(engine["debug"]), "control: ?debug loads the debug build")
        time.sleep(1.0)
        base, fast, slow, overlay = measure(pg)
        print(f"     debug:   {base:.0f} steps/s normally, {fast:.0f} holding '=', {slow:.0f} holding '-'")
        check(fast > base * 2.5 and slow < base * 0.5, "control: the debug build's speed keys do change the speed")
        check(bool(overlay), "control: the debug build's backtick opens the overlay")
    check(not s.errors, f"control: no console errors ({s.errors})")


def main():
    print("-- release (no ?debug)")
    release_run()
    print("-- control (?debug)")
    debug_control_run()
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
