"""Exploratory 'kid' play: scripted key sequences with screenshots and state traces.

Not a pass/fail test: it prints traces for a human (or the playtester) to read, and fails only
on console errors. Each section runs in its own fresh session.

    .venv/Scripts/python tools/playtest/kid_play.py              # every section
    .venv/Scripts/python tools/playtest/kid_play.py flaps bursts # just these

Sections: explore (run, hop, mash, glide, fall off the world), flaps (one flap sequence and
5 flaps in 6 s of real play), bursts (two flap bursts, then flapEmpty), mash_high (2.5 s of
mashing from high up, after the intro narration has finished).
"""
import sys
import time

import harness
from harness import tap, state, shot

# In-page recorder: bus events (from the debug ring), narrator line changes, and a per-frame
# player trace [ms, state, y, vy (tiles/s), flapCharges].
REC = """
window.__r = { ev: [], seen: new Set(), lines: [], s: [] };
const lastLine = { id: null };
(function loop() {
    for (const e of __sammy.events) {
        const k = e.frame + e.name;
        if (!__r.seen.has(k)) { __r.seen.add(k); __r.ev.push([+e.time.toFixed(2), e.name]); }
    }
    const c = __sammy.narrator.current;
    if (c && c.id !== lastLine.id) { lastLine.id = c.id; __r.lines.push([+performance.now().toFixed(0), c.id]); }
    const p = __sammy.player;
    if (p) __r.s.push([+performance.now().toFixed(0), p.state, +p.pos.y.toFixed(2), +(p.vel.y * 60).toFixed(1), p.flapCharges]);
    requestAnimationFrame(loop);
})();
"""


def player(pg):
    return state(pg)["player"]


def recorded_events(pg):
    return [e[1] for e in pg.evaluate("__r.ev")]


def reset_recording(pg):
    pg.evaluate("__r.ev = []; __r.lines = []")


def wait_loaded(pg):
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)


# --- sections ---------------------------------------------------------------------------------

def explore(pg):
    time.sleep(1.5)
    pg.keyboard.down("KeyD"); time.sleep(0.5); shot(pg, "kid_run_r"); time.sleep(0.4); pg.keyboard.up("KeyD")
    print("after release vel", player(pg)["vel"], player(pg)["state"])
    time.sleep(0.05)
    print("   +50ms", player(pg)["vel"])
    pg.keyboard.down("KeyA"); time.sleep(0.4); shot(pg, "kid_run_l"); pg.keyboard.up("KeyA")
    print("run L facing", player(pg)["facing"])
    for _ in range(4):   # hop around
        pg.keyboard.down("KeyD"); tap(pg, "Space"); time.sleep(0.35); pg.keyboard.up("KeyD"); time.sleep(0.3)
    print("hop pos", player(pg))

    # Mash toward the stair platforms around x=13..20.
    pg.evaluate("__sammy.commands.teleport(12, 5)"); time.sleep(0.6)
    pg.keyboard.down("KeyD")
    top = 0
    for i in range(30):
        tap(pg, "Space"); time.sleep(0.07)
        top = max(top, player(pg)["pos"]["y"])
        if i in (2, 6, 10):
            shot(pg, f"kid_mash_{i}")
    pg.keyboard.up("KeyD")
    print("mash max y", top, "charges", player(pg)["flapCharges"], player(pg)["state"])
    time.sleep(1.2)

    # Glide across the gap at x 18..22 from x=15.
    pg.evaluate("__sammy.commands.teleport(15, 5)"); time.sleep(0.8)
    pg.keyboard.down("KeyD"); time.sleep(0.5); pg.keyboard.down("Space")
    for i in range(8):
        time.sleep(0.15)
        if i % 2 == 0:
            shot(pg, f"kid_glide_{i}")
    print("glide", player(pg))
    pg.keyboard.up("Space"); pg.keyboard.up("KeyD"); time.sleep(1)

    # Fall off the world holding D; keep holding through the correction.
    pg.evaluate("__sammy.commands.teleport(19, 5)"); time.sleep(0.3)
    pg.keyboard.down("KeyD")
    st = state(pg)
    for _ in range(60):
        time.sleep(0.1)
        st = state(pg)
        if st["narrator"].get("correction"):
            break
    print("correction started", st["narrator"]["correction"], player(pg)["pos"])
    shot(pg, "kid_correction_a"); time.sleep(1.2); shot(pg, "kid_correction_b")
    for _ in range(30):
        time.sleep(0.1)
        if not state(pg)["narrator"].get("correction"):
            break
    x0 = player(pg)["pos"]["x"]; time.sleep(0.5); x1 = player(pg)["pos"]["x"]
    print("post-correction while holding D:", x0, "->", x1, "(held through the lock, so masked)")
    pg.keyboard.up("KeyD")
    time.sleep(1); shot(pg, "kid_idle")
    print("narrator", state(pg)["narrator"]["current"])


def flaps(pg):
    time.sleep(1.5)
    pg.evaluate(REC)
    pg.evaluate("__sammy.commands.teleport(4, 6)"); time.sleep(0.8)
    t0 = pg.evaluate("performance.now()")
    # One real flap sequence: hold the jump 0.2 s, then three flaps, with screenshots.
    pg.keyboard.down("Space"); time.sleep(0.2); pg.keyboard.up("Space")
    for i in range(3):
        time.sleep(0.12); tap(pg, "Space"); shot(pg, f"kid_flapseq_{i}")
    time.sleep(1.2)
    for x in [x for x in pg.evaluate("__r.s") if x[0] >= t0][::3]:
        print(round((x[0] - t0) / 1000, 2), x[1:])
    print("events", pg.evaluate("__r.ev")[-14:])

    # Spam: 5 flaps in 6 s of real play (jump, flap, land, repeat).
    reset_recording(pg)
    t1 = pg.evaluate("performance.now()")
    for _ in range(5):
        tap(pg, "Space"); time.sleep(0.28); tap(pg, "Space"); time.sleep(0.6)
    time.sleep(0.5)
    t2 = pg.evaluate("performance.now()")
    flap_count = recorded_events(pg).count("player:flap")
    print("flaps", flap_count, "in", round((t2 - t1) / 1000, 1), "s; lines", pg.evaluate("__r.lines"))

    # flapEmpty: mash in the air from high up.
    time.sleep(4)
    reset_recording(pg)
    pg.evaluate("__sammy.commands.teleport(4, 12)"); time.sleep(0.3)
    for _ in range(8):
        tap(pg, "Space"); time.sleep(0.2)
    ev = recorded_events(pg)
    print("mash high: flaps", ev.count("player:flap"), "empty", ev.count("player:flapEmpty"), "lines", pg.evaluate("__r.lines"))


def bursts(pg):
    def burst():
        pg.keyboard.down("Space"); time.sleep(0.2); pg.keyboard.up("Space")
        for _ in range(3):
            time.sleep(0.14); tap(pg, "Space")
        pg.wait_for_function("__sammy.player.grounded", polling="raf"); time.sleep(0.1)

    time.sleep(1.5)
    pg.evaluate(REC)
    pg.evaluate("__sammy.commands.teleport(4, 6)"); time.sleep(1)
    reset_recording(pg)
    t0 = time.time()
    burst(); burst()
    print("two bursts: flaps", recorded_events(pg).count("player:flap"), "in %.1fs" % (time.time() - t0),
          "lines", pg.evaluate("__r.lines"))
    n = state(pg)["narrator"]
    print("after bursts: current", n["current"] and n["current"]["id"], "queue", n["queueLength"])
    time.sleep(9)
    print("9s later lines", pg.evaluate("__r.lines"))

    # flapEmpty: jump, 3 flaps, then keep pressing.
    reset_recording(pg)
    pg.keyboard.down("Space"); time.sleep(0.2); pg.keyboard.up("Space")
    for _ in range(10):
        time.sleep(0.16); tap(pg, "Space")
    ev = recorded_events(pg)
    print("empty test: flaps", ev.count("player:flap"), "empty", ev.count("player:flapEmpty"), "lines", pg.evaluate("__r.lines"))


def mash_high(pg):
    time.sleep(12)   # let the intro narration finish so a spam line isn't blocked by it
    pg.evaluate(REC)
    pg.evaluate("__sammy.commands.teleport(4, 16)"); time.sleep(0.2)
    reset_recording(pg)
    t0 = time.time()
    while time.time() - t0 < 2.5:
        tap(pg, "Space"); time.sleep(0.05)
    ev = recorded_events(pg)
    print("flaps", ev.count("player:flap"), "empty", ev.count("player:flapEmpty"),
          "lines", pg.evaluate("__r.lines"), "state", player(pg)["state"])


SECTIONS = {"explore": explore, "flaps": flaps, "bursts": bursts, "mash_high": mash_high}


def main(names):
    unknown = [n for n in names if n not in SECTIONS]
    if unknown:
        print("unknown sections:", unknown, "choose from", list(SECTIONS))
        return 2
    errors = []
    for name in names or list(SECTIONS):
        print(f"=== {name}")
        with harness.session() as s:
            wait_loaded(s.page)
            SECTIONS[name](s.page)
        errors += s.errors
    print("errors", errors)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
