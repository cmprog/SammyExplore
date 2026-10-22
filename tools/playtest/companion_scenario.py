"""T-015 companion scenario: Twyx following Sammy, driven by real key presses.

Course: the `companion` dev level (src/data/levels/companion.js), plus the test and sandbox levels
for choosing her with E and for the save. Checks:
  - choosing: E on Twyx (test level, where she lives) -> companion:join, again -> companion:leave
    (she stays and roams), again -> join. __sammy.companion reports {cat, state, pos, reason}.
  - following: she trots after Sammy across the meadow, hops up a 1-tile and a 2-tile step,
    drops 3 tiles, and leaps a 2-wide gap; never falls, never far behind on walkable ground,
    and settles about 1.5-3 tiles from him.
  - waiting: Sammy hops over a closed gate: she waits at it (companion:waiting {reason: 'gate'}),
    sitting and looking at him; he throws the lever on the far side and she comes through on her
    own (companion:caughtUp). Same at the 4-wide gap: she waits ('gap') until he lowers the bridge.
  - never stranded: a correction (falling into the gap) brings her in beside him at the respawn,
    held under the page, then trotting in (not popping in next to him); left waiting below a
    ledge she can't climb, she catches up at the next checkpoint, trotting in from off screen.
  - lifts: she waits beside the lift shaft (never in it, so the lift is never held for her) and
    rides up when the shuttling lift comes back down for her.
  - level change: through the exit she arrives with Sammy in the next level (the test level's own
    Twyx becomes the companion, no second Twyx).
  - save: a real v1 save blob migrates to v2 (companion: null), Continue works; choosing her is
    saved, and Continue after a reload brings her along.
Timing is sampled once per engine step (a wrapped Sammy.update, as in sammy_scenario.py).
Screenshots: out/companion_*.png and zoomed poses out/companion/<name>.png, out/companion_sheet.png.

    .venv/Scripts/python tools/playtest/companion_scenario.py [test_name ...]
"""
import base64
import json
import sys
import time

import harness

GROUND = 4.45          # Sammy's center on the course ground (feet at 4)
HALF_H = 0.45
CAT_HALF = 0.4
ZOOM = 3
VIEW = {"width": 1920, "height": 1080}
WATCHED = ["companion:join", "companion:leave", "companion:waiting", "companion:caughtUp",
           "correction:triggered", "correction:reset", "correction:done", "checkpoint:reached",
           "level:start", "level:complete", "lift:held", "lift:arrive", "gate:move", "bridge:move",
           "interact:twyx", "interact:lever", "narrator:line"]

fails = []
shots = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def comp(pg):
    return pg.evaluate("window.__sammy.companion")


def player(pg):
    return pg.evaluate("window.__sammy.player")


def cats(pg):
    return [e for e in st(pg)["entities"] if e and e.get("type") == "twyx"]


RECORDER = """async names => {
    const bus = await import('/src/core/events.js');
    const m = await import('/lib/littlejs/littlejs.esm.js');
    if (!window.__rec)
    {
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({ n, d, f: window.__steps ?? 0 }));
    }
    // One sample per ENGINE STEP (not per rendered frame): wrap Sammy.update, which runs once per
    // step while playing. Survives level reloads (it patches the class).
    window.__steps ??= 0;
    window.__samples ??= [];
    const sammy = m.engineObjects.find(o => o.constructor.name === 'Sammy');
    if (!sammy)
        return;   // on the title: install again once a level is playing
    const proto = Object.getPrototypeOf(sammy);
    if (!proto.__wrapped)
    {
        const orig = proto.update;
        proto.update = function (...a) {
            const r = orig.apply(this, a);
            window.__steps++;
            const cat = m.engineObjects.find(o => o.catId && o.companion && !o.destroyed);
            const lift = m.engineObjects.find(o => o.mechanismType === 'lift' && !o.destroyed);
            window.__samples.push({
                f: window.__steps, px: this.pos.x, py: this.pos.y - .45, pg: this.grounded,
                cx: cat ? cat.pos.x : null, cy: cat ? cat.pos.y - cat.size.y / 2 : null,
                cg: cat ? cat.grounded : null, st: cat?.mover?.state ?? null, r: cat?.mover?.reason ?? null,
                held: cat?.mover?.held ?? null, walk: cat ? cat.animator.walk : null, air: cat ? cat.animator.air : null,
                sit: cat ? cat.animator.sit : null, onLift: !!(cat && cat.groundObject === lift && lift),
                liftT: lift ? lift.t : null, camX: m.cameraPos.x, camY: m.cameraPos.y,
                halfW: m.getCameraSize().x / 2, halfH: m.getCameraSize().y / 2,
            });
            if (window.__samples.length > 20000) window.__samples.shift();
            return r;
        };
        proto.__wrapped = true;
    }
}"""


def install(pg):
    pg.evaluate(RECORDER, WATCHED)


def rec(pg):
    return pg.evaluate("window.__rec")


def mark(pg):
    return len(rec(pg))


def since(pg, start, name=None):
    return [e for e in rec(pg)[start:] if name is None or e["n"] == name]


def samples_since(pg, frame):
    return pg.evaluate("f => window.__samples.filter(s => s.f > f)", frame)


def frame(pg):
    return pg.evaluate("window.__steps")


def wait_until(fn, timeout=5.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(step)
    return False


def settle(pg, timeout=30):
    """Dismiss narration with Enter (never E) until nothing is showing or queued."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        n = st(pg)["narrator"]
        if n["current"] is None and n["queueLength"] == 0 and n.get("correction") is None:
            time.sleep(0.3)
            n = st(pg)["narrator"]
            if n["current"] is None and n["queueLength"] == 0:
                return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(0.25)
    return False


def teleport(pg, x, feet_y, wait=0.4):
    pg.evaluate(f"__sammy.commands.teleport({x}, {feet_y + HALF_H + .01})")   # a hair up: 8.45 - .45 rounds into the tile
    time.sleep(wait)


def walk_to(pg, x, timeout=8.0, jump_when_stuck=True):
    """Hold D/A until Sammy's x passes x. Taps Space when he's stuck against a step."""
    p = player(pg)
    key = "KeyD" if x > p["pos"]["x"] else "KeyA"
    sign = 1 if key == "KeyD" else -1
    pg.keyboard.down(key)
    t0 = time.time()
    last, stuck = p["pos"]["x"], 0
    try:
        while time.time() - t0 < timeout:
            p = player(pg)
            px = p["pos"]["x"]
            if (px - x) * sign >= 0:
                return True
            stuck = stuck + 1 if abs(px - last) < 0.01 and p["grounded"] else 0
            last = px
            if jump_when_stuck and stuck >= 3:
                harness.hold(pg, "Space", 0.35)
                stuck = 0
            elif stuck >= 12:
                # Not moving at all: right after a scene change a held key can go unseen. Press it again.
                pg.keyboard.up(key)
                time.sleep(0.05)
                pg.keyboard.down(key)
                stuck = 0
            time.sleep(0.03)
        return False
    finally:
        pg.keyboard.up(key)


def running_jump(pg, key="KeyD", run=0.25, hold=0.45):
    """Run, then a held jump while still running, and keep running until landed."""
    pg.keyboard.down(key)
    time.sleep(run)
    pg.keyboard.down("Space")
    time.sleep(hold)
    pg.keyboard.up("Space")
    wait_until(lambda: player(pg)["grounded"], timeout=3, step=0.02)
    pg.keyboard.up(key)


def press_e(pg):
    settle(pg)   # E also advances the narrator: a line on screen would swallow it
    harness.tap(pg, "KeyE")
    time.sleep(0.15)


def cat_feet(c):
    return c["pos"]["y"] - CAT_HALF


def wait_state(pg, state, timeout=8.0, reason=None):
    return wait_until(lambda: (comp(pg) or {}).get("state") == state
                      and (reason is None or comp(pg).get("reason") == reason), timeout=timeout)


def load(pg, level, checkpoint=None):
    pg.evaluate("([l, c]) => __sammy.commands.loadLevel(l, c)", [level, checkpoint])
    pg.wait_for_function("l => __sammy.scene === 'playing' && __sammy.level && __sammy.level.id === l && __sammy.level.loading === false",
                         arg=level, timeout=10000)
    time.sleep(0.3)


# --- following ---------------------------------------------------------------------------------

def test_follow_hops_and_drops(pg):
    load(pg, "companion")
    settle(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    check(wait_state(pg, "idle", 6), f"Twyx trots in and settles beside Sammy ({comp(pg)})")
    c = comp(pg)
    check(set(["cat", "state", "pos", "reason"]) <= set(c) and c["cat"] == "twyx", f"__sammy.companion shape: {c}")
    f0 = frame(pg)
    m0 = mark(pg)
    leaps0 = cats(pg)[0]["leaps"]
    # Up the 1-tile step and the 2-tile step, along the top, and down the 3-tile drop.
    walk_to(pg, 21.0, timeout=10)
    time.sleep(2.5)
    s = samples_since(pg, f0)
    c = comp(pg)
    cat = cats(pg)[0]
    check(cat["leaps"] - leaps0 >= 2, f"she hopped up the steps ({cat['leaps'] - leaps0} hops/drops)")
    check(max(x["cy"] for x in s) > 6.9, f"she got up onto the 2-tile step (highest feet {max(x['cy'] for x in s):.2f})")
    check(min(x["cy"] for x in s) > 3.9, f"she never fell below the ground (lowest feet {min(x['cy'] for x in s):.2f})")
    check(abs(cat_feet(cat) - 4) < .05 and cat["grounded"], f"she dropped down the far side with him ({cat['pos']})")
    check(c["state"] == "idle" and 1.0 <= c["distance"] <= 3.0, f"settled near him: {c['state']} at {c['distance']}")
    check(not since(pg, m0, "companion:waiting"), "no waiting on ground she can manage")
    trot = [x for x in s if x["walk"] and x["walk"] > .9]
    check(len(trot) > 30, f"trot pose shown while moving ({len(trot)} steps)")

    # The 2-wide gap: Sammy jumps it, she leaps it.
    f0 = frame(pg)
    leaps0 = cat["leaps"]
    running_jump(pg)
    walk_to(pg, 26.0)
    time.sleep(2.5)
    s = samples_since(pg, f0)
    cat = cats(pg)[0]
    # Past the gap (x 22..24) and standing on its far ground; where she settles depends on where
    # Sammy's real-key jump put him, so her center may sit a hair short of the edge (T-020).
    check(cat["pos"]["x"] > 23.6 and abs(cat_feet(cat) - 4) < .05, f"she leapt the 2-wide gap ({cat['pos']})")
    check(min(x["cy"] for x in s) > 3.9, f"...without dropping into it (lowest {min(x['cy'] for x in s):.2f})")
    gap_air = [x for x in s if x["air"] and x["air"] > .9]
    check(len(gap_air) > 5, f"leap pose shown in the air ({len(gap_air)} steps)")
    # The farthest she trailed on the walkable stretch (Sammy runs faster than she trots).
    lag = max(abs(x["px"] - x["cx"]) for x in s)
    check(lag < 9, f"she keeps up (most behind: {lag:.1f} tiles)")


def test_wait_at_gate(pg):
    m0 = mark(pg)
    # Hop over the closed gate (x 27.5) and walk on to its lever on the far side.
    teleport(pg, 26.2, 4)
    time.sleep(1.5)
    # Straight up (held jump), then drift right over the top of the 2-tall gate.
    pg.keyboard.down("Space")
    time.sleep(0.2)
    pg.keyboard.down("KeyD")
    time.sleep(0.3)
    pg.keyboard.up("Space")
    pg.keyboard.up("KeyD")
    wait_until(lambda: player(pg)["grounded"], timeout=3, step=0.02)
    walk_to(pg, 29.4)
    check(player(pg)["pos"]["x"] > 28.5, f"Sammy is past the gate ({player(pg)['pos']})")
    check(wait_state(pg, "waiting", 6, "gate"), f"she waits at the closed gate ({comp(pg)})")
    waits = since(pg, m0, "companion:waiting")
    check(any(e["d"] == {"cat": "twyx", "reason": "gate"} for e in waits), f"companion:waiting {{cat, reason: 'gate'}}: {waits}")
    time.sleep(1.2)
    cat = cats(pg)[0]
    check(cat["sit"] > .9 and cat["facing"] == 1, f"she sits and looks toward Sammy (sit {cat['sit']}, facing {cat['facing']})")
    check(cat["pos"]["x"] < 27.5 - .4, f"...on her side of the gate ({cat['pos']['x']:.2f})")
    harness.shot(pg, "companion_wait_gate")
    capture(pg, "wait_gate", "c.sit > .95 && c.curious > .9 && !c.blinking", center_dx=0.2)
    m1 = mark(pg)
    press_e(pg)
    check(any(e["d"].get("id") == "gate-lever" for e in since(pg, m1, "interact:lever")), "E throws the gate lever")
    check(wait_until(lambda: comp(pg)["state"] in ("catchingUp", "idle"), 4), f"the gate opens and she comes on by herself ({comp(pg)})")
    check(wait_state(pg, "idle", 6), "she reaches him")
    ups = since(pg, m1, "companion:caughtUp")
    check(any(e["d"] == {"cat": "twyx", "via": "walked"} for e in ups), f"companion:caughtUp {{cat, via: 'walked'}}: {ups}")
    time.sleep(1.0)
    cat = cats(pg)[0]
    check(abs(cat["pos"]["x"] - 27.5) > .8, f"she settled clear of the gateway ({cat['pos']['x']:.2f}, Sammy {player(pg)['pos']['x']:.2f}, {cat['mover']['state']}, sit {cat['sit']})")


def test_correction(pg):
    settle(pg)
    m0 = mark(pg)
    f0 = frame(pg)
    # Walk off the edge into the 4-wide gap (bridge up): the world-bottom correction.
    walk_to(pg, 34.5, jump_when_stuck=False)
    check(wait_until(lambda: any(e["n"] == "correction:reset" for e in since(pg, m0)), 8), "falling in triggers a correction")
    reset_frame = next(e["f"] for e in since(pg, m0) if e["n"] == "correction:reset")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    done_frame = next(e["f"] for e in since(pg, m0) if e["n"] == "correction:done")
    s = samples_since(pg, f0)
    at_reset = [x for x in s if x["f"] > reset_frame]
    first = at_reset[0]
    check(abs(first["cy"] - first["py"]) < .05 and 1.2 <= abs(first["cx"] - first["px"]) <= 3.5,
          f"under the page she is put down on his ground, a few tiles away (cat {first['cx']:.2f},{first['cy']:.2f} Sammy {first['px']:.2f})")
    held = [x for x in at_reset if x["f"] < done_frame]
    check(all(x["held"] for x in held) and max(abs(x["cx"] - first["cx"]) for x in held) < .05,
          "...and holds still until the page lifts")
    check(wait_state(pg, "idle", 6), f"then trots in beside him ({comp(pg)})")
    s = samples_since(pg, done_frame)
    moving = [x for x in s if x["walk"] and x["walk"] > .5]
    check(len(moving) > 5, f"she trots in (not a pop): {len(moving)} trotting steps")
    ups = since(pg, m0, "companion:caughtUp")
    check(any(e["d"]["via"] == "correction" for e in ups), f"companion:caughtUp via correction: {ups}")
    harness.shot(pg, "companion_after_correction")


def test_wait_at_gap(pg):
    settle(pg)
    teleport(pg, 31.0, 4)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(wait_state(pg, "idle", 6), "regrouped by the gap")
    m0 = mark(pg)
    teleport(pg, 30.0, 4, wait=1.0)
    running_jump(pg, run=0.3, hold=0.5)
    p = player(pg)
    check(p["pos"]["x"] > 37 and abs(p["pos"]["y"] - GROUND) < .05, f"Sammy jumps the 4-wide gap ({p['pos']})")
    check(wait_state(pg, "waiting", 6, "gap"), f"she waits at the edge of the gap ({comp(pg)})")
    cat = cats(pg)[0]
    check(32 < cat["pos"]["x"] < 33.2 and abs(cat_feet(cat) - 4) < .05, f"...right at the edge ({cat['pos']})")
    # On to the after-bridge checkpoint while she waits in plain view: no catching up by magic,
    # she'd visibly vanish. The fetch stays pending instead.
    m_cp = mark(pg)
    walk_to(pg, 40.2, jump_when_stuck=False)
    check(wait_until(lambda: any(e["d"].get("id") == "after-bridge" for e in since(pg, m0, "checkpoint:reached")), 3),
          "Sammy reaches the after-bridge checkpoint")
    time.sleep(1.5)
    c, cat = comp(pg), cats(pg)[0]
    check(c["state"] == "waiting" and c["fetchPending"] and 32 < cat["pos"]["x"] < 33.2,
          f"in view, she stays waiting where he can see her (fetch pending): {c['state']}, {c['fetchPending']}, x {cat['pos']['x']:.2f}")
    check(not any(e["d"].get("via") == "checkpoint" for e in since(pg, m_cp, "companion:caughtUp")), "...and isn't fetched")
    harness.shot(pg, "companion_wait_gap")
    walk_to(pg, 38.6, jump_when_stuck=False)
    m1 = mark(pg)
    press_e(pg)
    check(any(e["d"].get("id") == "bridge-lever" for e in since(pg, m1, "interact:lever")), "E throws the bridge lever")
    check(wait_until(lambda: comp(pg)["state"] in ("catchingUp", "idle"), 4), f"the bridge lowers and she sets off ({comp(pg)})")
    check(wait_state(pg, "idle", 8), "she crosses the bridge to him")
    wait_until(lambda: cats(pg)[0]["grounded"], 2)   # after her happy hop
    cat = cats(pg)[0]
    check(cat["pos"]["x"] > 35.5 and cat["grounded"], f"she's over (on the bridge or past it) ({cat['pos']})")
    ups = since(pg, m1, "companion:caughtUp")
    check(any(e["d"]["via"] == "walked" for e in ups), f"companion:caughtUp after the bridge: {ups}")
    check(not comp(pg)["fetchPending"], "the pending fetch is dropped: she made her own way")


def test_checkpoint_catch_up(pg):
    settle(pg)
    teleport(pg, 41.5, 4)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(wait_state(pg, "idle", 6), "regrouped past the bridge")
    m0 = mark(pg)
    # Sammy goes up the 4-tall ledge (a debug hop: he'd need flaps, she can't follow at all).
    teleport(pg, 50.0, 8)
    check(wait_state(pg, "waiting", 8, "ledge"), f"she waits below the ledge she can't climb ({comp(pg)})")
    cat = cats(pg)[0]
    check(cat["pos"]["x"] + CAT_HALF < 44 - .04, f"...beside the lift shaft, not in it ({cat['pos']['x']:.2f})")
    check(any(e["d"] == {"cat": "twyx", "reason": "ledge"} for e in since(pg, m0, "companion:waiting")), "companion:waiting reason ledge")
    m1 = mark(pg)
    f1 = frame(pg)
    walk_to(pg, 85.2, timeout=12)
    check(wait_until(lambda: any(e["d"].get("id") == "finish" for e in since(pg, m1, "checkpoint:reached")), 3),
          "Sammy reaches the finish checkpoint")
    check(wait_state(pg, "idle", 8), f"she catches up with him there ({comp(pg)})")
    ups = since(pg, m1, "companion:caughtUp")
    check(any(e["d"] == {"cat": "twyx", "via": "checkpoint"} for e in ups), f"companion:caughtUp via checkpoint: {ups}")
    entry = comp(pg)["lastEntry"]
    check(entry and entry["via"] == "checkpoint" and entry["visible"] is False, f"she was put down out of sight ({entry})")
    s = samples_since(pg, f1)
    # The step she was moved: both where she was and where she appeared were off the screen.
    jump = next((a, b) for a, b in zip(s, s[1:]) if a["cx"] is not None and b["cx"] is not None and abs(b["cx"] - a["cx"]) > 3)
    before, after = jump
    off = lambda x, smp: abs(x - smp["camX"]) > smp["halfW"] + .5
    check(off(before["cx"], before) and off(after["cx"], after),
          f"never seen to vanish or pop in (from {before['cx']:.1f} to {after['cx']:.1f}, camera {after['camX']:.1f} +- {after['halfW']:.1f})")
    trot = [x for x in s if x["walk"] and x["walk"] > .5 and x["f"] > after["f"]]
    check(len(trot) > 5, f"she trots in to him ({len(trot)} trotting steps)")
    harness.shot(pg, "companion_checkpoint_catch_up")


def test_reconnect(pg):
    """Sammy goes up where she can't follow, then comes back down onto her ground far ahead: she
    doesn't wait for a trail she can't take, she just walks on to him."""
    settle(pg)
    teleport(pg, 64.0, 4)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(wait_state(pg, "idle", 6), "regrouped before the high plank")
    m0 = mark(pg)
    teleport(pg, 70.0, 9)   # up on the plank (he'd flap up there)
    check(wait_state(pg, "waiting", 8, "ledge"), f"she waits below the plank ({comp(pg)})")
    walk_to(pg, 80.0, jump_when_stuck=False)   # off the end of the plank and on along the ground
    p = player(pg)
    check(abs(p["pos"]["y"] - GROUND) < .05 and p["pos"]["x"] > 79, f"Sammy is back on the ground far ahead ({p['pos']})")
    check(wait_state(pg, "idle", 8), f"she walks straight on to him ({comp(pg)})")
    wait_until(lambda: cats(pg)[0]["grounded"], 2)   # after her happy hop
    cat = cats(pg)[0]
    check(cat["pos"]["x"] > 76 and abs(cat_feet(cat) - 4) < .05, f"...along the ground ({cat['pos']})")
    ups = since(pg, m0, "companion:caughtUp")
    check(any(e["d"]["via"] == "walked" for e in ups), f"companion:caughtUp via walked: {ups}")


def lift_state(pg):
    return next(m for m in st(pg)["mechanisms"] if m["id"] == "course-lift")


def test_lift(pg):
    settle(pg)
    teleport(pg, 42.6, 4)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(wait_state(pg, "idle", 6), "regrouped by the lift lever")
    m0 = mark(pg)
    f0 = frame(pg)
    press_e(pg)
    check(any(e["d"].get("id") == "lift-lever" for e in since(pg, m0, "interact:lever")), "E switches the shuttling lift on")
    # Ride it: wait for it to come back down, step on, ride up, and step off just onto the ledge,
    # stopping right by its edge (so the only room for her up there is next to him, or past him).
    check(wait_until(lambda: lift_state(pg)["at"] == "b", 8), "the lift goes up")
    check(wait_until(lambda: lift_state(pg)["at"] == "a", 8, step=0.02), "...and comes back down")
    walk_to(pg, 45.0, jump_when_stuck=False)
    check(wait_until(lambda: lift_state(pg)["at"] == "b", 8, step=0.02), "Sammy rides up")
    walk_to(pg, 46.4, jump_when_stuck=False)
    # Real keys get him there; a nudge puts his stop exactly by the edge (his overshoot varies).
    teleport(pg, 46.5, 8, wait=0.3)
    p = player(pg)
    check(abs(p["pos"]["y"] - (8 + HALF_H)) < .05 and p["pos"]["x"] - .4 - 46 <= .3,
          f"Sammy stops on the ledge within 0.3 of its edge ({p['pos']})")
    # Either she hopped on with him, or she was left below and waits for it to come back.
    waited = any(e["d"] == {"cat": "twyx", "reason": "lift"} for e in since(pg, m0, "companion:waiting"))
    s = samples_since(pg, f0)
    out = [x for x in s if x["st"] == "waiting" and not x["onLift"]]
    check(all(x["cx"] + CAT_HALF < 44 - .04 for x in out), f"any waiting is beside the shaft, never in it ({len(out)} steps)")
    check(wait_until(lambda: any(x["onLift"] for x in samples_since(pg, f0)), 12), "she gets on the lift")
    print(f"     ({'she waited for the lift' if waited else 'she rode up with Sammy'})")
    check(wait_until(lambda: (lambda c: c["grounded"] and abs(cat_feet(c) - 8) < .05 and c["pos"]["x"] > 46.2
                              and not any(x["onLift"] for x in samples_since(pg, frame(pg) - 3)))(cats(pg)[0]), 16),
          f"she gets off onto the ledge ({cats(pg)[0]['pos']})")
    # And she stays off: no settling on the plate, no riding it up and down.
    f1 = frame(pg)
    time.sleep(6)
    later = samples_since(pg, f1)
    boards = sum(1 for a, b in zip(later, later[1:]) if b["onLift"] and not a["onLift"])
    cat = cats(pg)[0]
    check(boards == 0 and abs(cat_feet(cat) - 8) < .05 and cat["pos"]["x"] > 46.2,
          f"she stays on the ledge with him, not on the lift ({boards} re-boardings, at {cat['pos']})")
    held = since(pg, m0, "lift:held")
    check(not held, f"the lift never had to wait for her ({held})")
    harness.shot(pg, "companion_after_lift")
    pg.evaluate("__sammy.commands.activate('lift-lever', false)")
    walk_to(pg, 49.0, jump_when_stuck=False)


def test_level_change(pg):
    settle(pg)
    m0 = mark(pg)
    walk_to(pg, 97.0, timeout=14, jump_when_stuck=False)   # Space would also continue the celebration
    check(wait_until(lambda: st(pg)["scene"] == "levelComplete", 4), "the exit completes the course")
    check(wait_until(lambda: st(pg)["menu"]["canContinue"] is True, 10), "continue prompt")
    harness.tap(pg, "Space")   # Enter would dismiss the narrator's remark first
    check(wait_until(lambda: st(pg)["scene"] == "playing" and st(pg)["level"]["id"] == "test"
                     and st(pg)["level"]["loading"] is False, 8), "on to the test level")
    time.sleep(0.3)
    c = comp(pg)
    twyxes = cats(pg)
    check(c and c["cat"] == "twyx" and c["entityId"] == "twyx" and c["home"] is False and c["hub"] is False,
          f"she came along: the test level's own Twyx is the companion (a visitor here) ({c})")
    check(len(twyxes) == 1 and twyxes[0]["companion"], f"one Twyx, not two ({len(twyxes)})")
    p = player(pg)
    check(abs(twyxes[0]["pos"]["x"] - p["pos"]["x"]) < 3.6, f"she arrives beside Sammy at the spawn ({twyxes[0]['pos']}, Sammy {p['pos']})")
    check(wait_state(pg, "idle", 6), "and trots up to him")
    check(any(e["d"] == {"cat": "twyx", "via": "arrived"} for e in since(pg, m0, "companion:caughtUp")), "companion:caughtUp via arrived")
    harness.shot(pg, "companion_level_change")
    # Not a hub: E on her is a pet. She stays along.
    walk_up_to(pg, cats(pg)[0])
    m1 = mark(pg)
    press_e(pg)
    check(any(e["n"] == "interact:twyx" for e in since(pg, m1)), "E reaches her")
    check(not since(pg, m1, "companion:leave") and not since(pg, m1, "companion:join") and (comp(pg) or {}).get("cat") == "twyx",
          "outside the hub E is a pet: she stays along")


def walk_up_to(pg, cat):
    side = 0.9 if player(pg)["pos"]["x"] > cat["pos"]["x"] else -0.9
    walk_to(pg, cat["pos"]["x"] + side, jump_when_stuck=False)
    time.sleep(0.3)
    ok = (st(pg)["interaction"]["nearest"] or {}).get("id") == cat["id"]
    check(ok, f"{cat['id']} is in E range")
    return ok


def test_choose_with_e(pg):
    """Choosing happens in the hub: the companion course stands in for the bedroom."""
    load(pg, "companion")
    settle(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    check(wait_state(pg, "idle", 6), "Twyx (who lives here) is along")
    c = comp(pg)
    check(c["hub"] is True and c["home"] is True and c["entityId"] == "twyx", f"in the hub, with her own Twyx ({c})")
    m0 = mark(pg)
    walk_up_to(pg, cats(pg)[0])
    press_e(pg)
    check(any(e["d"] == {"cat": "twyx"} for e in since(pg, m0, "companion:leave")), "E on the companion where she lives: companion:leave")
    check(comp(pg) is None and not cats(pg)[0]["companion"], f"nobody along now ({comp(pg)})")
    left_at = cats(pg)[0]["pos"]["x"]
    walk_to(pg, left_at + 6, jump_when_stuck=False)
    time.sleep(1.5)
    x = cats(pg)[0]["pos"]["x"]
    check(abs(x - left_at) <= 2.1 and cats(pg)[0]["mover"]["state"] == "roaming",
          f"she stays and roams near where he let her (left at {left_at:.2f}, now {x:.2f})")
    walk_up_to(pg, cats(pg)[0])
    m1 = mark(pg)
    press_e(pg)
    check(any(e["d"] == {"cat": "twyx"} for e in since(pg, m1, "companion:join")), "E again: companion:join")
    check((comp(pg) or {}).get("cat") == "twyx", "she's the companion again")
    # A visitor the hub doesn't place is never left behind: E is a pet.
    pg.evaluate("__sammy.commands.addTestCat('testcat')")
    pg.evaluate("__sammy.commands.setCompanion('testcat')")
    check(wait_state(pg, "idle", 6), "a test cat (a visitor here) is along")
    visitor = next(e for e in st(pg)["entities"] if e and e.get("cat") == "testcat")
    check(visitor["home"] is False, "...and she doesn't live here")
    m2 = mark(pg)
    walk_up_to(pg, visitor)
    press_e(pg)
    check(not since(pg, m2, "companion:leave") and (comp(pg) or {}).get("cat") == "testcat", "E on a visitor: no leave, she stays along")
    twyx = next(e for e in cats(pg) if e["id"] == "twyx")
    walk_up_to(pg, twyx)
    m3 = mark(pg)
    press_e(pg)
    check(not since(pg, m3, "companion:join") and (comp(pg) or {}).get("cat") == "testcat",
          "E on Twyx while a visitor is along: no swap (the visitor would be left behind)")
    twyx_now = next(e for e in cats(pg) if e["id"] == "twyx")
    check(twyx_now["shaking"] and not [e for e in since(pg, m3) if e["n"].startswith("companion:")],
          "she gives a little head shake instead, and no new event")
    pg.evaluate("__sammy.commands.setCompanion('twyx')")


def test_narrow_fallback(pg):
    """No out-of-sight spot anywhere near Sammy (a room narrower than the view): after a few
    seconds she still rejoins him, brought in under the quick page flip, never seen to pop, and
    without locking his controls."""
    load(pg, "companion_narrow")
    settle(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    check(wait_state(pg, "idle", 6), "Twyx is along in the narrow room")
    teleport(pg, 10.0, 24)   # up on the high floor (a debug lift; she can't follow)
    check(wait_state(pg, "waiting", 8, "ledge"), f"she waits below, out of sight ({comp(pg)})")
    m0 = mark(pg)
    f0 = frame(pg)
    walk_to(pg, 18.6, jump_when_stuck=False)
    check(wait_until(lambda: any(e["d"].get("id") == "upstairs" for e in since(pg, m0, "checkpoint:reached")), 3),
          "Sammy reaches the checkpoint upstairs")
    t0 = time.time()
    covering = wait_until(lambda: comp(pg)["covering"], 6, step=0.02)
    check(covering, "with nowhere unseen to come in from, a page flip brings her in")
    check(st(pg)["inputLocks"] == [], "the page flip doesn't lock Sammy's controls")
    check(wait_until(lambda: any(e["d"] == {"cat": "twyx", "via": "checkpoint"} for e in since(pg, m0, "companion:caughtUp")), 6),
          f"she rejoins him ({time.time() - t0 + 0:.1f}s after the checkpoint)")
    entry = comp(pg)["lastEntry"]
    check(entry["covered"] is True and abs(entry["y"] - 24) < .05, f"she was put down upstairs while the page covered the view ({entry})")
    s = samples_since(pg, f0)
    jump = next((a, b) for a, b in zip(s, s[1:]) if abs(b["cy"] - a["cy"]) > 5)
    before = jump[0]
    check(abs(before["cy"] - before["camY"]) > before["halfH"] + .5, "where she left from was out of sight")
    rejoined = [x for x in samples_since(pg, f0) if x["cy"] > 23]
    check(rejoined and (rejoined[0]["f"] - f0) / 60 < 8, f"back with him within a few seconds ({(rejoined[0]['f'] - f0) / 60:.1f}s)")
    check(wait_state(pg, "idle", 6), "and settles beside him")
    harness.shot(pg, "companion_narrow_fallback")


V1_SAVE = {"schemaVersion": 1, "levelId": "sandbox", "checkpointId": "meadow", "reachedCheckpoints": ["meadow"],
           "flags": {}, "catsRescued": [], "updatedAt": "2026-10-12T19:04:11.512Z"}


def stored(pg):
    raw = pg.evaluate("localStorage.getItem('sammyexplore.save')")
    return json.loads(raw) if raw else None


def reload_and_continue(pg):
    pg.reload()
    pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
    time.sleep(1.0)
    menu = st(pg)["menu"]
    harness.tap(pg, "Enter")   # Continue is selected by default when there's a save
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.loading === false",
                         timeout=10000)
    time.sleep(0.4)
    install(pg)
    return menu


def test_save(pg):
    # A real v1 save (as written by the live M1 build): Continue must still work, with nobody along.
    pg.evaluate("s => localStorage.setItem('sammyexplore.save', JSON.stringify(s))", V1_SAVE)
    pg.reload()
    pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
    save, status = st(pg)["save"], st(pg)["saveStatus"]
    check(status["status"] == "ok" and save["schemaVersion"] == 2 and save["companion"] is None
          and save["checkpointId"] == "meadow" and save["reachedCheckpoints"] == ["meadow"],
          f"v1 save migrates to v2 with companion null ({status}, {save})")
    menu = reload_and_continue(pg)
    check(menu["selected"] == "continue", "Continue offered for the migrated save")
    lvl = st(pg)["level"]
    check(lvl["id"] == "sandbox" and lvl["checkpointId"] == "meadow", f"Continue resumes the v1 story ({lvl['id']} @ {lvl['checkpointId']})")
    check(comp(pg) is None, "nobody along in a story saved before companions")
    settle(pg)
    # Chapter One isn't a hub: E on Twyx is a pet, nothing changes in the save.
    walk_up_to(pg, cats(pg)[0])
    m0 = mark(pg)
    press_e(pg)
    check(not since(pg, m0, "companion:join") and comp(pg) is None, "in Chapter One E on Twyx is a pet (not a hub)")
    check(stored(pg).get("companion") is None, "save unchanged")
    # Choosing her in the hub is saved (the story's place in the save stays where it was).
    settle(pg)
    load(pg, "companion")
    settle(pg)
    walk_up_to(pg, cats(pg)[0])
    m1 = mark(pg)
    press_e(pg)
    check(any(e["n"] == "companion:join" for e in since(pg, m1)), "in the hub, E asks Twyx along")
    saved = stored(pg)
    check(saved and saved["schemaVersion"] == 2 and saved["companion"] == "twyx" and saved["levelId"] == "sandbox",
          f"the choice is saved ({saved})")
    settle(pg)
    reload_and_continue(pg)
    c = comp(pg)
    check(st(pg)["level"]["id"] == "sandbox" and c and c["cat"] == "twyx",
          f"Continue after a reload: back in Chapter One, and she comes along ({c})")
    check(len(cats(pg)) == 1, "still just one Twyx (Chapter One's own)")
    check(wait_state(pg, "idle", 6), "and trots up to Sammy at the checkpoint")
    pg.evaluate("window.__sammy.commands.clearSave()")


def test_poses(pg):
    """Zoomed captures of her moving, for art review (frozen on the exact step). Sammy is put
    in place with teleports; she gets there on her own, along his trail."""
    load(pg, "companion")
    settle(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    teleport(pg, 8.5, 4)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    wait_state(pg, "idle", 6)
    time.sleep(0.6)
    # Trotting: Sammy pops over to the far left; she trots after him.
    teleport(pg, 0.6, 4, wait=0.05)
    capture(pg, "trot", "c.grounded && c.walk > .95 && Math.abs(c.vel.x) > .07 && c.headTurn > .9 && Math.abs(c.turn) === 1")
    capture(pg, "trot_2", "c.grounded && c.walk > .95 && Math.abs(c.vel.x) > .07 && c.headTurn > .9 && Math.abs(c.turn) === 1", timeout=1.0)
    pg.evaluate("__sammy.commands.entityAction(__sammy.companion.entityId, 'glanceBack')")
    capture(pg, "trot_glance_back", "c.walk > .8 && c.headTurn < -.9", timeout=2)
    wait_state(pg, "idle", 6)
    time.sleep(0.6)
    # Hopping up the steps: Sammy is up on the 2-tile step; she hops 1, then 2.
    teleport(pg, 16.5, 7, wait=0.05)
    capture(pg, "hop_up", "c.air > .9 && c.vel.y > .06", timeout=6)
    capture(pg, "leap_top", "c.air > .9 && Math.abs(c.vel.y) < .03", timeout=3)
    capture(pg, "landing", "c.grounded && c.air < .6 && c.air > .1", timeout=3)
    wait_state(pg, "idle", 8)
    time.sleep(0.6)
    # Dropping down the far side, and the leap over the 2-wide gap.
    teleport(pg, 20.0, 4, wait=0.05)
    capture(pg, "drop", "c.air > .9 && c.vel.y < -.1", timeout=6)
    wait_state(pg, "idle", 8)
    teleport(pg, 26.0, 4, wait=0.05)
    capture(pg, "gap_leap", "c.air > .9 && c.pos.x > 22.3 && c.pos.x < 23.7", timeout=6)
    wait_state(pg, "idle", 8)
    harness.shot(pg, "companion_game_zoom")
    # Mrrp at the closed gate, the curious sit-and-look, then the happy hop back with Sammy.
    time.sleep(0.6)
    teleport(pg, 29.4, 4, wait=0.05)
    capture(pg, "mrrp", "c.mrrping && c.sit > .4 && c.curious > .3", timeout=6)
    wait_state(pg, "waiting", 4)
    time.sleep(1.5)
    capture(pg, "waiting", "c.sit > .95 && c.curious > .9 && !c.blinking")
    press_e(pg)
    capture(pg, "happy_hop", "c.happy && c.air > .6", timeout=6)
    time.sleep(1.0)
    capture(pg, "idle_beside", "c.grounded && c.walk < .05 && c.sit < .05 && !c.blinking && Math.abs(c.turn) === 1", timeout=6, tiles=(7, 3.4), center_dx=.8)

# --- pose capture ------------------------------------------------------------------------------

WAIT_AND_PAUSE = """async ([cond, timeoutMs]) => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const test = new Function('c', 'return ' + cond);
    const start = performance.now();
    return await new Promise(resolve => {
        const poll = () => {
            const c = window.__sammy.entities.find(e => e && e.type === 'twyx' && e.companion);
            if (c && test(c)) { m.setPaused(true); resolve(true); return; }
            if (performance.now() - start > timeoutMs) { resolve(false); return; }
            requestAnimationFrame(poll);
        };
        poll();
    });
}"""

CAT_ON_PAGE = """async () => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const c = window.__sammy.entities.find(e => e && e.type === 'twyx' && e.companion);
    const feet = m.worldToScreen(m.vec2(c.pos.x, c.pos.y - .4));
    const rect = m.mainCanvas.getBoundingClientRect();
    const k = rect.width / m.mainCanvasSize.x;
    return { x: rect.left + feet.x * k, y: rect.top + feet.y * k, tile: m.cameraScale * k };
}"""


def engine(pg, code):
    pg.evaluate(f"async () => {{ const m = await import('/lib/littlejs/littlejs.esm.js'); {code} }}")


def capture(pg, name, cond, timeout=4.0, center_dx=0.0, tiles=(5.5, 3.4), zoom=ZOOM):
    """Freeze the engine on the step Twyx matches `cond`, zoom the camera on her, screenshot."""
    vp = pg.viewport_size
    pg.set_viewport_size(VIEW)
    ok = pg.evaluate(WAIT_AND_PAUSE, [cond, int(timeout * 1000)])
    if not ok:
        check(False, f"pose {name}: never saw {cond} (companion {comp(pg)}, Sammy {player(pg)['pos']})")
        pg.set_viewport_size(vp)
        return
    engine(pg, f"""const c = window.__sammy.entities.find(e => e && e.type === 'twyx' && e.companion);
        m.setCameraScale(64 * {zoom}); window.__sammy.commands.cameraFocus(c.pos.x + {center_dx}, c.pos.y + .2);""")
    time.sleep(1.2)   # the camera still eases while the engine is paused; let it arrive
    feet = pg.evaluate(CAT_ON_PAGE)
    w, h = tiles[0] * feet["tile"], tiles[1] * feet["tile"]
    cx = feet["x"] + center_dx * feet["tile"]
    clip = {"x": min(max(0, cx - w / 2), VIEW["width"] - w), "y": min(max(0, feet["y"] - h * .72), VIEW["height"] - h),
            "width": w, "height": h}
    path = harness.OUT / "companion" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    engine(pg, "m.mainCanvas.style.opacity = '0';")
    pg.screenshot(path=str(path), clip=clip)
    engine(pg, "m.mainCanvas.style.opacity = '';")
    engine(pg, "m.setCameraScale(64); window.__sammy.commands.cameraFocus(); m.setPaused(false);")
    pg.set_viewport_size(vp)
    print(f"ok   pose {name:<14} -> {path}")
    shots.append((name, path))


def contact_sheet(pg):
    if not shots:
        return
    tiles = "".join(
        f"<figure><img src='data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}'>"
        f"<figcaption>{name}</figcaption></figure>" for name, path in shots)
    pg.set_content("<html><body style='margin:0;background:#222;display:flex;flex-wrap:wrap'>"
                   "<style>figure{margin:6px;color:#eee;font:20px sans-serif;text-align:center}"
                   "img{width:600px;display:block}</style>" + tiles + "</body></html>")
    path = harness.OUT / "companion_sheet.png"
    pg.screenshot(path=str(path), full_page=True)
    print("sheet:", path)


def main():
    with harness.session(start_level="companion") as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("window.__sammy.commands.clearSave()")
        install(pg)
        tests = (test_follow_hops_and_drops, test_wait_at_gate, test_correction, test_wait_at_gap,
                 test_checkpoint_catch_up, test_reconnect, test_lift, test_level_change, test_choose_with_e,
                 test_narrow_fallback, test_save, test_poses)
        only = sys.argv[1:]   # e.g. `companion_scenario.py test_poses` to run just those
        for test in (t for t in tests if not only or t.__name__ in only):
            try:
                test(pg)
            except Exception as error:   # keep going: report every failure in one run
                check(False, f"{test.__name__} crashed: {error!r}")
            finally:
                for key in ("KeyD", "KeyA", "Space"):
                    pg.keyboard.up(key)
        contact_sheet(pg)
        errors = list(s.errors)
    for e in errors:
        print("ERROR", e)
    fails.extend(errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
