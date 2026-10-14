"""T-013 the bedroom home base: indoor environment, day/night cycle, nightlight, furniture platforming.

Checks (real key presses for movement; teleport and setTimeOfDay only set up tests):
- The bedroom loads as an indoor level (environment, room backdrop, lighting, no outdoor sky), with
  Twyx idling, and its two reserved regions (portal alcove >= 6x8 at floor level, practice course).
- The day/night cycle: __sammy.dayCycle {t, phase}; setTimeOfDay steps through night, dawn, day,
  and dusk; daycycle:phase fires on each change; the room is darker at night than by day; the
  nightlight is on at night and off by day; the clock runs on its own.
- Walking and jumping onto furniture: toy chest, a brick stack, the desk, the window sill (one-way,
  with a flap), a bookshelf shelf (one-way), the bed top, and walking under the bed.
- Leaving the room switches the global lighting off (the title screen must not be dimmed).
- Performance: render frames per second in the bedroom against the outdoor sandbox, sampled
  alternately (headless swiftshader is slow and noisy, so it's a relative check).

Screenshots (tools/playtest/out/): bedroom_<phase>_<spot>.png for night, dawn, day, dusk at the
window and at the nightlight, and bedroom_overview_<phase>.png.

    .venv/Scripts/python tools/playtest/bedroom_scenario.py
"""
import statistics
import sys
import time

import harness

FLOOR_Y = 5.45          # Sammy's center standing on the floor (floor top at 5)
PHASES = [("night", .9), ("dawn", .235), ("day", .5), ("dusk", .74)]
NIGHTLIGHT = {"night": 1, "dawn": 1, "day": 0, "dusk": 0}   # it switches on at .765 and off at .245
SPOTS = {"window": (31, 13.5), "nightlight": (60, 5.5), "spawn": (12, 5.5)}
WATCHED = ["daycycle:phase", "level:start"]
FPS = """async ms => { let n = 0; const t0 = performance.now();
  await new Promise(r => { const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else r(); };
  requestAnimationFrame(tick); });
  return n / ((performance.now() - t0) / 1000); }"""

fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def player(pg):
    return st(pg)["player"]


def wait_until(fn, timeout=3.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if fn():
            return True
        time.sleep(step)
    return False


def settle(pg, timeout=20):
    """Dismiss narration with Enter until nothing is showing or queued."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        n = st(pg)["narrator"]
        if n["current"] is None and n["queueLength"] == 0:
            return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(.25)
    return False


def install_recorder(pg):
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({n, d}));
    }""", WATCHED)


def recorded(pg, name):
    return [e["d"] for e in pg.evaluate("window.__rec") if e["n"] == name]


def load_level(pg, level_id):
    pg.evaluate(f"__sammy.commands.loadLevel('{level_id}')")
    pg.wait_for_function(f"window.__sammy.level && window.__sammy.level.id === '{level_id}' && !window.__sammy.level.loading",
                         timeout=15000)
    time.sleep(.5)


def stand(pg, x, y=FLOOR_Y, wait=.6):
    pg.evaluate(f"__sammy.commands.teleport({x}, {y})")
    time.sleep(wait)


def landed(pg, timeout=3.0):
    """Wait until Sammy is standing still on something; returns his position."""
    wait_until(lambda: player(pg)["grounded"] and abs(player(pg)["vel"]["y"]) < 1e-3, timeout)
    time.sleep(.15)
    return player(pg)["pos"]


def jump(pg, direction=None, hold=.4, flaps=0, flap_after=.1, run_after=.5):
    """A real jump: Space held for `hold` seconds (a full jump), optionally while running, then a
    flap tap every `flap_after` seconds (right after letting go is right at the top of the jump).
    The run key stays down `run_after` more seconds."""
    if direction:
        pg.keyboard.down(direction)
        time.sleep(.05)
    harness.hold(pg, "Space", hold)
    for _ in range(flaps):
        time.sleep(flap_after - .08)
        harness.tap(pg, "Space")
    if direction:
        time.sleep(run_after)
        pg.keyboard.up(direction)


def top_check(pg, label, pos, top, x_range=None):
    y = pos["y"] - .45
    ok = abs(y - top) < .08 and player(pg)["grounded"]
    if x_range:
        ok = ok and x_range[0] <= pos["x"] <= x_range[1]
    check(ok, f"{label}: standing at x {pos['x']:.2f}, feet {y:.2f} (expected top {top}"
              + (f", x in {x_range}" if x_range else "") + ")")


# --- the room -----------------------------------------------------------------------------------

def test_loads(pg):
    s = st(pg)
    level, backdrop = s["level"], s["backdrop"]
    check(level["id"] == "bedroom" and level["environment"] == "bedroom", f"bedroom loads indoors: {level['id']}, {level['environment']}")
    check(level["size"]["x"] >= 60 and level["size"]["y"] >= 24, f"2-3 screens wide with vertical room: {level['size']}")
    check(backdrop and backdrop.get("kind") == "room" and backdrop.get("chunks", 0) > 0, f"room backdrop baked: {backdrop}")
    check(backdrop.get("window") is not None, "the room has a window")
    check(backdrop.get("lighting") is True, "room lighting is on")
    check("layers" not in backdrop, "no outdoor sky backdrop")
    starts = [e for e in recorded(pg, "level:start") if e["levelId"] == "bedroom"]
    check(starts and starts[-1].get("environment") == "bedroom", f"level:start carries the environment: {starts[-1:]}")
    regions = {r["id"]: r for r in level["reserved"]}
    alcove, course = regions.get("portal-alcove"), regions.get("practice-course")
    check(alcove is not None and alcove["y0"] == 5 and alcove["x1"] - alcove["x0"] >= 6 and alcove["y1"] - alcove["y0"] >= 8,
          f"portal alcove reserved, >= 6x8 at floor level: {alcove}")
    check(course is not None and 25 <= course["x1"] - course["x0"] <= 35, f"practice course reserved, about a screen: {course}")
    twyx = next((e for e in s["entities"] if e and e.get("type") == "twyx"), None)
    check(twyx is not None and twyx["action"] in ("stand", "sit", "lick"), f"Twyx is in the bedroom, idling: {twyx and twyx['action']}")
    check(any(t.get("type") == "twyx" for t in s["interaction"]["targets"]), "Twyx can be petted (interactable)")


def test_alcove_is_empty(pg):
    """Walk through the portal alcove at floor level and hop in it: nothing in the way."""
    alcove = next(r for r in st(pg)["level"]["reserved"] if r["id"] == "portal-alcove")
    settle(pg)
    stand(pg, alcove["x1"] - .6)
    pg.keyboard.down("KeyA")
    time.sleep(1.2)
    pg.keyboard.up("KeyA")
    x = landed(pg)["x"]
    check(x < alcove["x0"] + 1, f"walked across the alcove to its left wall (x {x:.2f})")
    jump(pg, hold=.4)
    p = landed(pg)
    check(abs(p["y"] - FLOOR_Y) < .05, "nothing to land on in the alcove (back on the floor)")


# --- the day/night cycle ------------------------------------------------------------------------

def ambient(pg):
    a = st(pg)["backdrop"]["ambient"]
    return (a["r"] + a["g"] + a["b"]) / 3


def test_cycle(pg):
    cycle = st(pg)["dayCycle"]
    check(cycle is not None and 0 <= cycle["t"] < 1 and cycle["phase"] in ("dawn", "day", "dusk", "night"),
          f"__sammy.dayCycle reports {{t, phase}}: {cycle}")
    check(cycle["period"] == 300, f"default period is 300 s: {cycle['period']}")
    first = recorded(pg, "daycycle:phase")
    check(first and first[-1]["phase"] == cycle["phase"], f"daycycle:phase announced the starting phase: {first}")
    t0 = st(pg)["dayCycle"]["t"]
    time.sleep(2.5)
    t1 = st(pg)["dayCycle"]["t"]
    check(.002 < (t1 - t0) % 1 < .02, f"the clock runs on its own ({t0:.4f} -> {t1:.4f} in 2.5 s; 300 s per day)")

    levels = {}
    previous = st(pg)["dayCycle"]["phase"]
    for phase, t in PHASES:
        before = len(recorded(pg, "daycycle:phase"))
        ok = pg.evaluate(f"__sammy.commands.setTimeOfDay({t})")
        cycle = st(pg)["dayCycle"]
        events = recorded(pg, "daycycle:phase")[before:]
        check(ok and cycle["phase"] == phase, f"setTimeOfDay({t}) -> phase {cycle['phase']} (expected {phase})")
        if phase != previous:
            check(events == [{"phase": phase}], f"daycycle:phase {{phase: {phase}}} fired once: {events}")
        else:
            check(not events, f"no daycycle:phase when the phase stays {phase}: {events}")
        previous = phase
        wait_until(lambda: st(pg)["backdrop"]["nightlight"] == NIGHTLIGHT[phase], timeout=2.5)
        levels[phase] = (ambient(pg), st(pg)["backdrop"]["nightlight"], st(pg)["backdrop"]["beam"])
    print("     ambient / nightlight / beam by phase:", levels)
    check(levels["night"][0] < levels["dusk"][0] < levels["day"][0] and levels["night"][0] < levels["dawn"][0] < levels["day"][0],
          "the room is darkest at night, lightest by day, in between at dawn and dusk")
    check(all(levels[phase][1] == on for phase, on in NIGHTLIGHT.items()),
          f"nightlight on through the night (until just after dawn), off by day: {[(p, v[1]) for p, v in levels.items()]}")
    check(levels["night"][2] and levels["night"][2]["from"] == "moon", f"moonlight shines in at night: {levels['night'][2]}")
    check(levels["day"][2] and levels["day"][2]["from"] == "sun", f"sunlight shines in by day: {levels['day'][2]}")
    check(pg.evaluate("__sammy.commands.setTimeOfDay('noon')") is False, "setTimeOfDay rejects a non-number")


def hide_narrator_box(pg, hidden):
    """Screenshots only: the narrator's box is on the overlay canvas, so hide that canvas."""
    pg.evaluate("""async hidden => { const m = await import('littlejs');
        m.mainCanvas.style.opacity = hidden ? '0' : ''; }""", hidden)


def screenshots(pg):
    settle(pg)
    hide_narrator_box(pg, True)
    for phase, t in PHASES:
        for spot, (x, y) in SPOTS.items():
            stand(pg, x, y, wait=.2)
            pg.evaluate(f"__sammy.commands.setTimeOfDay({t})")
            time.sleep(1.6)   # the camera settles and the nightlight finishes fading
            print("     shot:", harness.shot(pg, f"bedroom_{phase}_{spot}"))
    hide_narrator_box(pg, False)


# --- platforming on the furniture -----------------------------------------------------------------

def test_furniture(pg):
    settle(pg)
    pg.evaluate("__sammy.commands.setTimeOfDay(.5)")
    # Toy chest (top 7, x 15-21): a running jump from the floor.
    stand(pg, 13)
    jump(pg, "KeyD", run_after=.15)
    top_check(pg, "jump onto the toy chest", landed(pg), 7, (15, 21))
    # First brick stack (top 8, x 22-24): from the chest; the taller stack stops an overshoot.
    stand(pg, 20, 7.6)
    jump(pg, "KeyD", run_after=.3)
    top_check(pg, "jump onto the low brick stack", landed(pg), 8, (22, 24))
    # Desk (top 10, x 27-37) from the tall brick stack (top 10).
    stand(pg, 25, 10.6)
    jump(pg, "KeyD", run_after=.25)
    top_check(pg, "jump onto the desk", landed(pg), 10, (27, 37))
    # Window sill (one-way, top 13): from the desk, a jump and a flap carry Sammy up through it.
    stand(pg, 31, 10.6)
    jump(pg, hold=.32, flaps=1)
    top_check(pg, "jump and flap up through the window sill onto it", landed(pg), 13, (26, 38))
    # Bookshelf (one-way shelf, top 8) from the floor.
    stand(pg, 42.5)
    jump(pg, hold=.32, flaps=1)
    top_check(pg, "jump and flap up onto a bookshelf shelf", landed(pg), 8, (39, 46))
    # Dresser (top 11) from that shelf.
    jump(pg, "KeyD", hold=.32, flaps=1, run_after=.35)
    top_check(pg, "hop across onto the dresser", landed(pg), 11, (47, 55))
    # Walk under the bed, then stand on it.
    stand(pg, 56.5)
    pg.keyboard.down("KeyD")
    passed = wait_until(lambda: player(pg)["pos"]["x"] > 70, timeout=3)
    pg.keyboard.up("KeyD")
    p = player(pg)["pos"]
    check(passed and abs(p["y"] - FLOOR_Y) < .1, f"walks under the bed (x {p['x']:.2f}, y {p['y']:.2f})")
    stand(pg, 66, 9.8)
    top_check(pg, "the bed is a platform", landed(pg), 9, (59, 75))


# --- leaving the room, performance --------------------------------------------------------------

def lighting_enabled(pg):
    return pg.evaluate("async () => { const m = await import('littlejs'); return !!(m.lightSystem && m.lightSystem.enabled); }")


def test_leave(pg):
    pg.evaluate("__sammy.commands.changeScene('title')")
    harness.wait_scene(pg, "title")
    time.sleep(.5)
    check(not lighting_enabled(pg), "room lighting is off on the title screen")
    check(st(pg)["dayCycle"] is None, "no day cycle outside the room")
    load_level(pg, "sandbox")
    check(not lighting_enabled(pg) and st(pg)["backdrop"].get("layers"), "outdoor level: sky backdrop, no room lighting")
    load_level(pg, "bedroom")
    check(lighting_enabled(pg), "back in the bedroom: lighting on again")


def test_performance(pg):
    samples = {"sandbox": [], "bedroom": []}
    for _ in range(3):
        for level_id, x, y in (("sandbox", 20, 7.5), ("bedroom", 31, FLOOR_Y)):
            load_level(pg, level_id)
            settle(pg)
            stand(pg, x, y)
            samples[level_id].append(pg.evaluate(FPS, 2500))
    sandbox, bedroom = statistics.median(samples["sandbox"]), statistics.median(samples["bedroom"])
    print(f"     render fps (median of 3): sandbox {sandbox:.1f} {[round(v, 1) for v in samples['sandbox']]}, "
          f"bedroom {bedroom:.1f} {[round(v, 1) for v in samples['bedroom']]}")
    check(bedroom >= sandbox * .75, f"bedroom renders within 25% of the outdoor sandbox ({bedroom:.1f} vs {sandbox:.1f} fps)")


def main():
    with harness.session(start_level=None) as s:
        pg = s.page
        pg.set_viewport_size({"width": 1920, "height": 1080})
        pg.wait_for_function("window.__sammy.scene === 'title'", timeout=10000)
        install_recorder(pg)
        load_level(pg, "bedroom")
        test_loads(pg)
        test_cycle(pg)
        test_alcove_is_empty(pg)
        test_furniture(pg)
        screenshots(pg)
        for phase, t in PHASES:
            pg.evaluate(f"__sammy.commands.setTimeOfDay({t})")
            stand(pg, 42, 20.6, wait=1.6)
            harness.shot(pg, f"bedroom_overview_{phase}")
        test_leave(pg)
        test_performance(pg)
        errors = list(s.errors)
    for e in errors:
        print("ERROR", e)
    fails.extend(errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
