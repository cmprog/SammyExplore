"""T-016 cat spots: the `catspot` dev level (src/data/levels/catspot.js), real E presses.

Checks:
  - the spot is registered (__sammy.catSpots, an interactable, a mechanism trigger) and the
    wind-up mouse blocks the tunnel (Sammy can't get past it).
  - no cat: E -> interact:catspot, catspot:noCat {spotId, ability}, a placeholder narrator line;
    nothing calms, the spot stays ready.
  - wrong cat: a test-only cat (addTestCat) as the companion. With her right beside Sammy, E still
    goes to the spot (non-cat first). -> catspot:wrongCat {spotId, ability, cat}; nothing calms.
  - Twyx's Comfort: E -> she walks to the cushion, ability:start, the mouse is soothed, then
    ability:used {ability, cat, spotId} and mechanism:toggle {by: 'catspot'}; the mouse calms
    (upset:calmed), scoots through the tunnel and out of the way; the spot is done (no prompt);
    she follows Sammy again, and both get through the tunnel.
  - can't get there: Twyx left behind the closed gate; E at the spot -> catspot:unreachable
    {reason: 'gate'}; the gate opens and she carries on and does it.
  - a correction during her walk, or mid-ability, calls the errand off (the spot is ready again,
    the mouse unsoothed, ability:cancel); a checkpoint fetch while she waits on an errand calls it
    off too; while she's on an errand, E on her does nothing and companion:waiting isn't sent.
  - camera: eases in (~1.15x) on the comfort and back out after; a level change mid-ability
    resets the zoom. A startsOn lever snaps an Upset's own targets (Mechanisms, in-page).
Pose sheet: the comfort animation step by step, and the mouse frazzled / soothed / calm.
Output: tools/playtest/out/catspot/<name>.png and out/catspot_sheet.png.

    .venv/Scripts/python tools/playtest/catspot_scenario.py
"""
import base64
import sys
import time

import harness

GROUND = 4
HALF_H = 0.45
SPOT_X = 17.5
MOUSE_X = 18.5
VIEW = {"width": 1920, "height": 1080}
ZOOM = 4
WATCHED = ["interact:catspot", "catspot:noCat", "catspot:wrongCat", "catspot:unreachable",
           "ability:start", "ability:used", "ability:cancel", "mechanism:toggle", "upset:calmed", "narrator:line",
           "companion:waiting", "interact:twyx", "interact:nothing", "correction:reset"]

fails = []
shots = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def ev(pg, expr):
    return pg.evaluate(expr)


def spot(pg):
    return ev(pg, "__sammy.catSpots")[0]


def entity(pg, eid):
    return ev(pg, f"__sammy.entities.find(e => e && e.id === '{eid}')")


def mouse(pg):
    return entity(pg, "tunnel-mouse")


def comp(pg):
    return ev(pg, "__sammy.companion")


def player(pg):
    return ev(pg, "__sammy.player")


def install(pg):
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({ n, d }));
    }""", WATCHED)


def mark(pg):
    return ev(pg, "window.__rec.length")


def since(pg, start, name=None):
    return [e for e in ev(pg, "window.__rec")[start:] if name is None or e["n"] == name]


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


def teleport(pg, x, wait=0.5):
    pg.evaluate(f"__sammy.commands.teleport({x}, {GROUND + HALF_H + .01})")
    time.sleep(wait)


def press_e(pg):
    settle(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.2)


def load(pg):
    pg.evaluate("__sammy.commands.loadLevel('catspot')")
    pg.wait_for_function("__sammy.scene === 'playing' && __sammy.level && __sammy.level.id === 'catspot' && __sammy.level.loading === false",
                         timeout=10000)
    time.sleep(0.4)
    settle(pg)


def face_right(pg):
    harness.hold(pg, "KeyD", 0.05)
    time.sleep(0.3)


def line_ids(events):
    return [e["d"]["id"] for e in events if e["n"] == "narrator:line"]


# --- tests --------------------------------------------------------------------------------------

def test_setup(pg):
    load(pg)
    spots = ev(pg, "__sammy.catSpots")
    check(len(spots) == 1 and spots[0]["id"] == "tunnel-spot" and spots[0]["state"] == "ready"
          and spots[0]["ability"] == "comfort" and spots[0]["targets"] == ["tunnel-mouse"], f"__sammy.catSpots: {spots}")
    check(spots[0]["role"] == "trigger", "the spot is a mechanism trigger")
    m = mouse(pg)
    check(m["state"] == "upset" and m["blocking"] and m["role"] == "target", f"the mouse is upset and in the way: {m}")
    targets = ev(pg, "__sammy.interaction.targets")
    check(any(t.get("id") == "tunnel-spot" for t in targets), "the spot is an interactable")
    # The mouse blocks the tunnel: walk into it.
    teleport(pg, 15)
    harness.hold(pg, "KeyD", 1.2)
    x = player(pg)["pos"]["x"]
    check(x < MOUSE_X - .6, f"Sammy can't get past the frazzled mouse (x {x:.2f})")
    harness.shot(pg, "catspot_blocked")


def test_no_cat(pg):
    pg.evaluate("__sammy.commands.setCompanion(null)")
    teleport(pg, 16.4)
    face_right(pg)
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "catspot", "id": "tunnel-spot"},
          f"E prompt is on the spot: {ev(pg, '__sammy.interaction.nearest')}")
    m0 = mark(pg)
    press_e(pg)
    time.sleep(0.6)
    evs = since(pg, m0)
    check(any(e["n"] == "interact:catspot" and e["d"] == {"id": "tunnel-spot", "ability": "comfort"} for e in evs),
          f"interact:catspot {{id, ability}}: {[e for e in evs if e['n'] == 'interact:catspot']}")
    check(any(e["n"] == "catspot:noCat" and e["d"] == {"spotId": "tunnel-spot", "ability": "comfort"} for e in evs),
          f"catspot:noCat {{spotId, ability}}: {[e['n'] for e in evs]}")
    check("catspot.noCat" in line_ids(evs), f"narrator answers with a noCat hint ({line_ids(evs)})")
    check(not any(e["n"] in ("ability:start", "catspot:wrongCat") for e in evs), "no ability, no wrong-cat")
    check(spot(pg)["state"] == "ready" and spot(pg)["pokes"] == 1, f"spot still ready, patted once: {spot(pg)}")
    check(mouse(pg)["state"] == "upset", "the mouse is still frazzled")
    harness.shot(pg, "catspot_no_cat")
    settle(pg)


def test_wrong_cat(pg):
    check(ev(pg, "__sammy.commands.addTestCat('testcat')"), "addTestCat('testcat')")
    check(ev(pg, "__sammy.commands.setCompanion('testcat')"), "setCompanion('testcat')")
    check(wait_until(lambda: comp(pg)["cat"] == "testcat" and comp(pg)["state"] == "idle", 8), f"the test cat comes over ({comp(pg)})")
    c = comp(pg)
    near = abs(c["pos"]["x"] - player(pg)["pos"]["x"])
    face_right(pg)
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "catspot", "id": "tunnel-spot"},
          f"with the cat {near:.1f} away, E still goes to the spot (non-cat first): {ev(pg, '__sammy.interaction.nearest')}")
    m0 = mark(pg)
    press_e(pg)
    time.sleep(2.0)
    evs = since(pg, m0)
    wrong = [e for e in evs if e["n"] == "catspot:wrongCat"]
    check(wrong and wrong[0]["d"] == {"spotId": "tunnel-spot", "ability": "comfort", "cat": "testcat"},
          f"catspot:wrongCat {{spotId, ability, cat}}: {wrong}")
    check("catspot.wrongCat" in line_ids(evs), f"narrator answers with a wrong-cat hint ({line_ids(evs)})")
    check(not any(e["n"] in ("ability:start", "ability:used", "interact:twyx") for e in evs), "no ability, and E was not a pet")
    check(mouse(pg)["state"] == "upset" and spot(pg)["state"] == "ready", "nothing calmed; the spot is still ready")
    check(comp(pg)["goal"] is None, "the wrong cat wasn't sent to the spot")
    settle(pg)


def test_comfort(pg):
    check(ev(pg, "__sammy.commands.setCompanion('twyx')"), "setCompanion('twyx')")
    teleport(pg, 16.4)
    check(wait_until(lambda: comp(pg)["cat"] == "twyx" and comp(pg)["state"] == "idle", 10), f"Twyx comes over ({comp(pg)})")
    face_right(pg)
    settle(pg)
    m0 = mark(pg)
    press_e(pg)
    check(wait_until(lambda: spot(pg)["state"] == "busy", 2), f"the spot is busy ({spot(pg)})")
    check(not ev(pg, "__sammy.interaction.nearest") or ev(pg, "__sammy.interaction.nearest")["id"] != "tunnel-spot",
          "no E prompt on a busy spot")
    check_no_pet_on_errand(pg)
    check(wait_until(lambda: any(e["n"] == "ability:start" for e in since(pg, m0)), 8), "she reaches the cushion and starts")
    tw = entity(pg, "twyx")
    check(abs(tw["pos"]["x"] - (SPOT_X - .25)) < .12, f"she stands on the cushion, just back from the mouse (x {tw['pos']['x']:.2f})")
    check(tw["ability"] == "comfort" and tw["facing"] == 1, f"comforting, facing the mouse: {tw['ability']}, {tw['facing']}")
    start = [e for e in since(pg, m0) if e["n"] == "ability:start"][0]["d"]
    check(start == {"ability": "comfort", "cat": "twyx", "spotId": "tunnel-spot"}, f"ability:start payload {start}")
    time.sleep(1.6)
    m = mouse(pg)
    check(m["state"] == "upset" and 0.3 < m["soothing"] < 1 and m["upset"] < 1, f"the mouse is being soothed: {m}")
    cam = ev(pg, "__sammy.camera")
    check(1.1 < cam["zoom"] <= 1.2 and abs(cam["scale"] - 64 * cam["zoom"]) < .05 and cam["abilityFocus"],
          f"the camera has eased in on the comfort: {cam}")
    harness.shot(pg, "catspot_game_zoom_zoomed")
    check(entity(pg, "twyx")["hearts"] > 0, "hearts and purr ripples rise")
    check(wait_until(lambda: any(e["n"] == "ability:used" for e in since(pg, m0)), 4), "Comfort works")
    evs = since(pg, m0)
    used = [e for e in evs if e["n"] == "ability:used"][0]
    check(used["d"] == {"ability": "comfort", "cat": "twyx", "spotId": "tunnel-spot"}, f"ability:used payload {used['d']}")
    toggles = [e for e in evs if e["n"] == "mechanism:toggle"]
    check(toggles and toggles[0]["d"] == {"id": "tunnel-spot", "on": True, "targets": ["tunnel-mouse"], "by": "catspot"},
          f"activation API: {toggles}")
    names = [e["n"] for e in evs]
    check(names.index("ability:used") < names.index("mechanism:toggle"), "ability:used comes before the toggle")
    check(wait_until(lambda: any(e["n"] == "upset:calmed" for e in since(pg, m0)), 3), "the mouse calms (upset:calmed)")
    check(not mouse(pg)["blocking"], "and is out of everyone's way")
    check(wait_until(lambda: mouse(pg)["arrived"], 6), f"it scoots off through the tunnel ({mouse(pg)})")
    check(abs(mouse(pg)["pos"]["x"] - 24.5) < .05, f"to its rest spot ({mouse(pg)['pos']['x']:.2f})")
    check(spot(pg)["state"] == "done" and spot(pg)["active"], f"the spot is done: {spot(pg)}")
    check(wait_until(lambda: comp(pg)["goal"] is None and entity(pg, "twyx")["ability"] is None, 4), "she's finished and follows again")
    check(wait_until(lambda: ev(pg, "__sammy.camera.zoom") == 1 and ev(pg, "__sammy.camera.scale") == 64, 4),
          f"the camera eases back out ({ev(pg, '__sammy.camera')})")
    check("ability.comfort" in line_ids(since(pg, m0)), f"narrator remarks ({line_ids(since(pg, m0))})")
    check(ev(pg, "__sammy.audio.lastSound") is not None, "sounds played")
    settle(pg)
    check(not ev(pg, "__sammy.interaction.nearest") or ev(pg, "__sammy.interaction.nearest")["id"] != "tunnel-spot",
          "a done spot offers nothing")
    # Through the tunnel, Twyx following.
    harness.hold(pg, "KeyD", 1.6)
    p = player(pg)["pos"]["x"]
    check(p > 23.5, f"Sammy gets through the tunnel (x {p:.2f})")
    check(wait_until(lambda: comp(pg)["pos"]["x"] > 23 and comp(pg)["state"] == "idle", 8), f"Twyx follows him through ({comp(pg)})")
    harness.shot(pg, "catspot_through")


def test_unreachable(pg):
    load(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    teleport(pg, 9)
    check(wait_until(lambda: comp(pg)["state"] == "idle", 8), f"Twyx with Sammy, before the gate ({comp(pg)})")
    teleport(pg, 16.4)
    check(wait_until(lambda: comp(pg)["state"] == "waiting" and comp(pg)["reason"] == "gate", 8), f"she waits at the closed gate ({comp(pg)})")
    face_right(pg)
    m0 = mark(pg)
    press_e(pg)
    check(wait_until(lambda: any(e["n"] == "catspot:unreachable" for e in since(pg, m0)), 3), "catspot:unreachable")
    un = [e for e in since(pg, m0) if e["n"] == "catspot:unreachable"]
    check(un and un[0]["d"] == {"spotId": "tunnel-spot", "ability": "comfort", "cat": "twyx", "reason": "gate"}, f"payload {un}")
    check("catspot.unreachable" in line_ids(since(pg, m0)), "narrator hints at clearing the way")
    check(spot(pg)["errand"] and spot(pg)["errand"]["phase"] == "approach", f"the errand waits ({spot(pg)})")
    time.sleep(1)
    check(len([e for e in since(pg, m0) if e["n"] == "catspot:unreachable"]) == 1, "only once")
    check(not since(pg, m0, "companion:waiting"), "no companion:waiting on an errand (one narrator cue)")
    ev(pg, "__sammy.commands.activate('gate-lever', true)")
    check(wait_until(lambda: any(e["n"] == "ability:used" for e in since(pg, m0)), 12), "the gate opens, she carries on and comforts the mouse")
    check(wait_until(lambda: mouse(pg)["arrived"], 6), "the way clears")
    settle(pg)


def check_no_pet_on_errand(pg):
    tw = entity(pg, "twyx")
    targets = ev(pg, "__sammy.interaction.targets")
    check(tw["onErrand"], "Twyx is on an errand")
    nearest = ev(pg, "__sammy.interaction.nearest")
    check(not nearest or nearest.get("id") != "twyx", f"E can't pick her while she's on an errand ({nearest})")


def start_comfort(pg, wait_for=1.2):
    load(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    pg.evaluate("__sammy.commands.activate('gate-lever', true)")
    teleport(pg, 16.4)
    check(wait_until(lambda: comp(pg)["state"] == "idle", 8), "Twyx with Sammy")
    face_right(pg)
    settle(pg)
    press_e(pg)
    check(wait_until(lambda: (entity(pg, "twyx")["abilityTime"] or 0) > wait_for and entity(pg, "twyx")["ability"], 10), "comfort under way")


def test_cancel_mid_ability(pg):
    start_comfort(pg)
    check(mouse(pg)["soothing"] > .2, "the mouse is being soothed")
    m0 = mark(pg)
    pg.evaluate("__sammy.commands.emit('correction:triggered', {id: 'test'})")
    check(wait_until(lambda: any(e["n"] == "ability:cancel" for e in since(pg, m0)), 6), "ability:cancel")
    cancel = [e for e in since(pg, m0) if e["n"] == "ability:cancel"][0]["d"]
    check(cancel == {"ability": "comfort", "cat": "twyx", "spotId": "tunnel-spot"}, f"payload {cancel}")
    m = mouse(pg)
    check(m["state"] == "upset" and m["soothing"] == 0, f"the mouse is unsoothed: {m}")
    check(spot(pg)["state"] == "ready" and entity(pg, "twyx")["ability"] is None, "the spot is ready, she stopped")
    check(not any(e["n"] == "ability:used" for e in since(pg, m0)), "it never worked")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    check(wait_until(lambda: ev(pg, "__sammy.camera.zoom") == 1, 4), "the camera eases back out")
    settle(pg)


def test_zoom_reset_on_level_change(pg):
    start_comfort(pg, wait_for=2.0)
    check(ev(pg, "__sammy.camera.zoom") > 1.05, f"zoomed in mid-ability ({ev(pg, '__sammy.camera')})")
    pg.evaluate("__sammy.commands.loadLevel('companion')")
    pg.wait_for_function("__sammy.level && __sammy.level.id === 'companion' && __sammy.level.loading === false", timeout=10000)
    cam = ev(pg, "__sammy.camera")
    check(cam["zoom"] == 1 and cam["scale"] == 64 and cam["abilityFocus"] is None, f"zoom reset by the level change: {cam}")
    time.sleep(1)
    cam = ev(pg, "__sammy.camera")
    check(cam["zoom"] == 1 and cam["scale"] == 64, f"and stays reset: {cam}")
    check(ev(pg, "__sammy.catSpots") == [], "no cat spots there")
    tw = entity(pg, "twyx")
    check(tw["ability"] is None and not tw["onErrand"], f"Twyx isn't still comforting in the new level ({tw['ability']}, {tw['onErrand']})")


def test_fetch_calls_off(pg):
    load(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    teleport(pg, 9)
    check(wait_until(lambda: comp(pg)["state"] == "idle", 8), "Twyx with Sammy, before the gate")
    teleport(pg, 16.4)
    check(wait_until(lambda: comp(pg)["state"] == "waiting", 8), "she waits at the closed gate")
    face_right(pg)
    press_e(pg)
    check(wait_until(lambda: spot(pg)["errand"] is not None, 2), "the errand is on")
    # In this small level she's always in view (and Sammy can't go far without the errand being
    # called off anyway), so the fetch would wait forever: pretend nobody can see, just for this.
    pg.evaluate("""async () => {
        const { Camera } = await import('/src/systems/Camera.js');
        window.__canSee = Camera.prototype.canSee;
        Camera.prototype.canSee = () => false;
    }""")
    try:
        pg.evaluate("__sammy.commands.emit('checkpoint:reached', {id: 'test', levelId: 'catspot', pos: {x: 16.4, y: 4.45}})")
        check(wait_until(lambda: spot(pg)["state"] == "ready" and spot(pg)["errand"] is None, 10),
              f"a checkpoint fetch calls the errand off ({spot(pg)}, {comp(pg)})")
    finally:
        pg.evaluate("""async () => {
            const { Camera } = await import('/src/systems/Camera.js');
            Camera.prototype.canSee = window.__canSee;
        }""")
    check(wait_until(lambda: comp(pg)["goal"] is None and comp(pg)["pos"]["x"] > 12.6, 10), f"she's brought to Sammy and stays ({comp(pg)})")
    settle(pg)


def test_snap_recursion(pg):
    ok = pg.evaluate("""async () => {
        const { Mechanisms } = await import('/src/systems/Mechanisms.js');
        const made = id => ({ id, mechanismRole: 'target', active: false, setActive(on, o) { this.active = on; this.instant = o?.instant; return true; } });
        const gate = made('g');
        const upset = { ...made('u'), targets: ['g'] };
        const lever = { id: 'l', mechanismRole: 'trigger', startsOn: true, targets: ['u'] };
        const m = new Mechanisms('x', [lever, upset, gate]);
        m.start();
        m.destroy();
        return upset.active && upset.instant && gate.active && gate.instant;
    }""")
    check(ok, "a startsOn lever snaps an Upset and the Upset's own targets, silently")


def test_correction_calls_off(pg):
    load(pg)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    pg.evaluate("__sammy.commands.activate('gate-lever', true)")
    teleport(pg, 9)
    check(wait_until(lambda: comp(pg)["state"] == "idle", 8), "Twyx with Sammy")
    teleport(pg, 16.4)
    face_right(pg)
    press_e(pg)
    check(wait_until(lambda: spot(pg)["state"] == "busy", 2), "she sets off")
    m0 = mark(pg)
    pg.evaluate("__sammy.commands.emit('correction:triggered', {id: 'test'})")
    check(wait_until(lambda: any(e["n"] == "correction:reset" for e in since(pg, m0)), 6), "a correction")
    check(wait_until(lambda: spot(pg)["state"] == "ready" and comp(pg)["goal"] is None, 3), f"the errand is called off ({spot(pg)})")
    check(mouse(pg)["state"] == "upset", "nothing calmed")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    settle(pg)


# --- poses --------------------------------------------------------------------------------------

WAIT_AND_PAUSE = """async ([id, cond, timeoutMs]) => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const test = new Function('c', 'return ' + cond);
    const start = performance.now();
    return await new Promise(resolve => {
        const poll = () => {
            const c = window.__sammy.entities.find(e => e && e.id === id);
            if (c && test(c)) { m.setPaused(true); resolve(true); return; }
            if (performance.now() - start > timeoutMs) { resolve(false); return; }
            requestAnimationFrame(poll);
        };
        poll();
    });
}"""

POINT_ON_PAGE = """async ([x, y]) => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const p = m.worldToScreen(m.vec2(x, y));
    const rect = m.mainCanvas.getBoundingClientRect();
    const k = rect.width / m.mainCanvasSize.x;
    return { x: rect.left + p.x * k, y: rect.top + p.y * k, tile: m.cameraScale * k };
}"""


def engine(pg, code):
    pg.evaluate(f"async () => {{ const m = await import('/lib/littlejs/littlejs.esm.js'); {code} }}")


def capture(pg, name, eid, cond, at, tiles=(4.4, 2.6), timeout=8.0):
    """Freeze on the step entity `eid` matches `cond`, zoom on world point `at`, screenshot."""
    ok = pg.evaluate(WAIT_AND_PAUSE, [eid, cond, int(timeout * 1000)])
    if not ok:
        check(False, f"pose {name}: never saw {cond} ({entity(pg, eid)}, {ev(pg, '__sammy.catSpots')}, {player(pg)['pos']})")
        return
    engine(pg, f"m.setCameraScale(64 * {ZOOM}); window.__sammy.commands.cameraFocus({at[0]}, {at[1]});")
    time.sleep(1.5)
    c = pg.evaluate(POINT_ON_PAGE, list(at))
    w, h = tiles[0] * c["tile"], tiles[1] * c["tile"]
    clip = {"x": min(max(0, c["x"] - w / 2), VIEW["width"] - w), "y": min(max(0, c["y"] - h / 2), VIEW["height"] - h),
            "width": w, "height": h}
    path = harness.OUT / "catspot" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    engine(pg, "m.mainCanvas.style.opacity = '0';")
    pg.screenshot(path=str(path), clip=clip)
    engine(pg, "m.mainCanvas.style.opacity = '';")
    engine(pg, "m.setCameraScale(64); window.__sammy.commands.cameraFocus(); m.setPaused(false);")
    print(f"ok   pose {name:<18} -> {path}")
    shots.append((name, path))


def run_poses(pg):
    load(pg)
    pg.evaluate("__sammy.commands.activate('gate-lever', true)")
    teleport(pg, 14.2)
    face_right(pg)
    settle(pg)
    time.sleep(1.5)
    view = (SPOT_X + .5, GROUND + .8)
    capture(pg, "spot_ready", "tunnel-spot", "c.state === 'ready'", view)
    capture(pg, "mouse_frazzled", "tunnel-mouse", "c.sweat >= 2", view)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    if not wait_until(lambda: comp(pg)["state"] == "idle", 8):
        print("companion not idle:", comp(pg), player(pg)["pos"])
    teleport(pg, 16.4)
    face_right(pg)
    settle(pg)
    press_e(pg)
    teleport(pg, 13.5, wait=0)   # step back out of the close-ups (well inside the give-up distance)
    tw = "twyx"
    capture(pg, "comfort_1_lean_in", tw, "c.ability === 'comfort' && c.abilityTime > .45", view)
    capture(pg, "comfort_2_headbutt", tw, "c.ability === 'comfort' && c.abilityTime > .95", view)
    capture(pg, "comfort_3_groom", tw, "c.ability === 'comfort' && c.abilityTime > 2.05", view)
    capture(pg, "comfort_4_soothed", tw, "c.ability === 'comfort' && c.abilityTime > 2.9", view)
    capture(pg, "comfort_5_calm_hearts", tw, "c.ability === 'comfort' && c.abilityTime > 3.3", view)
    capture(pg, "comfort_6_curl", tw, "c.ability === 'comfort' && c.abilityTime > 4.1", view)
    capture(pg, "mouse_scooting", "tunnel-mouse", "c.state === 'calm' && c.pos.x > 20", (21.5, GROUND + .8))
    capture(pg, "mouse_relieved", "tunnel-mouse", "c.arrived", (24.5, GROUND + .8))
    capture(pg, "spot_done", "tunnel-spot", "c.state === 'done'", view, timeout=4)
    # Game zoom: does it all read at actual size?
    engine(pg, "m.setPaused(false);")


def game_zoom_shots(pg):
    load(pg)
    pg.evaluate("__sammy.commands.activate('gate-lever', true)")
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    teleport(pg, 16.2)
    time.sleep(2)
    face_right(pg)
    settle(pg)
    harness.shot(pg, "catspot_game_zoom_before")
    press_e(pg)
    if not wait_until(lambda: (entity(pg, "twyx")["abilityTime"] or 0) > 1.6, 10):
        check(False, f"game zoom: comfort never started ({spot(pg)}, {comp(pg)}, {player(pg)['pos']}, {ev(pg, '__sammy.interaction.nearest')})")
    harness.shot(pg, "catspot_game_zoom_comfort")


def contact_sheet(pg):
    tiles = "".join(
        f"<figure><img src='data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}'>"
        f"<figcaption>{name}</figcaption></figure>" for name, path in shots)
    pg.set_content("<html><body style='margin:0;background:#222;display:flex;flex-wrap:wrap'>"
                   "<style>figure{margin:6px;color:#eee;font:20px sans-serif;text-align:center}"
                   "img{width:600px;display:block}</style>" + tiles + "</body></html>")
    path = harness.OUT / "catspot_sheet.png"
    pg.screenshot(path=str(path), full_page=True)
    print("sheet:", path)


TESTS = [test_setup, test_no_cat, test_wrong_cat, test_comfort, test_unreachable, test_correction_calls_off,
         test_cancel_mid_ability, test_fetch_calls_off, test_zoom_reset_on_level_change, test_snap_recursion]


def main():
    only = sys.argv[1:]
    with harness.session(start_level="catspot") as s:
        pg = s.page
        pg.set_viewport_size(VIEW)
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("window.__sammy.commands.clearSave()")
        install(pg)
        for test in TESTS:
            if not only or test.__name__ in only:
                print(f"--- {test.__name__}")
                test(pg)
        if not only or "poses" in only:
            print("--- poses")
            game_zoom_shots(pg)
            run_poses(pg)
            contact_sheet(pg)
        errors = list(s.errors)
    for e in errors:
        print("ERROR", e)
    fails.extend(errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
