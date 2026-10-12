"""T-011a Twyx the cat (test level), with real key presses, plus a pose sheet for art review.

Gameplay checks: Twyx is registered as an interactable, turns to face Sammy when he's near,
walking up to Twyx and pressing E emits interact:twyx {id} and the narrator answers (first
meeting, then the "loyal hound" attempt, then a repeat-pet line), Twyx reacts (ears perk, happy
squint, hearts), spam-petting gets its own remark, and Sammy walks through Twyx (not solid).

Pose capture: the engine is frozen (setPaused) on the exact frame each pose shows, the camera
zoomed in from this script only, and the 2D overlay (narrator box) hidden for the shot. Poses
are forced through __sammy.commands.entityAction so they don't depend on the random idle timer.

Output (tools/playtest/out/): twyx/<name>.png close-ups and twyx_sheet.png (all on one page).

    .venv/Scripts/python tools/playtest/twyx_scenario.py
"""
import base64
import sys
import time

import harness

TWYX_ID = "twyx"
TWYX_X = 15.5          # cell center (level data x 15)
GROUND = 4.45          # Sammy's center standing on the first meadow (ground top y = 4)
LEFT_OF_TWYX = 13.75   # clear of the hill (columns 7-12), 1.75 tiles from Twyx: just out of E range
ZOOM = 4
CLIP_TILES = (4.6, 3.0)
VIEW = {"width": 1920, "height": 1080}
WATCHED = ["interact:twyx", "interact:nothing", "narrator:line"]

fails = []
shots = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def twyx(pg):
    return next(e for e in st(pg)["entities"] if e and e["id"] == TWYX_ID)


def player(pg):
    return st(pg)["player"]


def install_recorder(pg):
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({n, d}));
    }""", WATCHED)


def rec(pg):
    return pg.evaluate("window.__rec")


def since(pg, start, name):
    return [e for e in rec(pg)[start:] if e["n"] == name]


def settle(pg, timeout=30):
    """Dismiss narration with Enter (never E) until nothing is showing or queued."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        n = st(pg)["narrator"]
        if n["current"] is None and n["queueLength"] == 0:
            time.sleep(0.35)
            n = st(pg)["narrator"]
            if n["current"] is None and n["queueLength"] == 0:
                return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(0.25)
    return False


def wait_until(fn, timeout=3.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if fn():
            return True
        time.sleep(step)
    return False


def stand(pg, x, wait=0.6):
    pg.evaluate(f"__sammy.commands.teleport({x}, {GROUND})")
    time.sleep(wait)


def current_line(pg):
    return (st(pg)["narrator"]["current"] or {}).get("id")


def pet(pg):
    """A real E press with nothing being said. Returns the recorder mark from before it."""
    settle(pg)
    start = len(rec(pg))
    harness.tap(pg, "KeyE")
    time.sleep(0.15)
    return start


# --- gameplay ---------------------------------------------------------------------------------

def test_registered(pg):
    targets = st(pg)["interaction"]["targets"]
    check(any(t.get("type") == "twyx" and t.get("id") == TWYX_ID for t in targets),
          f"Twyx is an interactable: {[t.get('id') for t in targets]}")


def test_faces_sammy(pg):
    stand(pg, LEFT_OF_TWYX)
    check(wait_until(lambda: twyx(pg)["facing"] == -1 and twyx(pg)["turn"] == -1),
          f"Sammy on the left: Twyx turns left ({twyx(pg)['facing']}, turn {twyx(pg)['turn']})")
    stand(pg, TWYX_X + 2.5)
    check(wait_until(lambda: twyx(pg)["facing"] == 1 and twyx(pg)["turn"] == 1),
          f"Sammy on the right: Twyx turns right ({twyx(pg)['facing']})")
    stand(pg, LEFT_OF_TWYX)
    wait_until(lambda: twyx(pg)["turn"] == -1)
    stand(pg, 3)   # far away (12.5 tiles): Twyx keeps looking where Sammy was
    time.sleep(0.4)
    check(twyx(pg)["facing"] == -1, "Sammy far away: Twyx doesn't turn")


def test_walk_up_and_pet(pg):
    stand(pg, LEFT_OF_TWYX)
    settle(pg)
    check(st(pg)["interaction"]["nearest"] is None, f"out of range at {TWYX_X - LEFT_OF_TWYX} tiles")
    pg.keyboard.down("KeyD")
    found = wait_until(lambda: (st(pg)["interaction"]["nearest"] or {}).get("id") == TWYX_ID, timeout=1.5, step=0.02)
    pg.keyboard.up("KeyD")
    x = player(pg)["pos"]["x"]
    check(found, f"walking up to Twyx brings Twyx in range (x {x:.2f})")
    check(wait_until(lambda: st(pg)["interaction"]["prompt"]["appear"] >= 1), "E prompt shows over Twyx")
    check(twyx(pg)["facing"] == -1, "Twyx faces Sammy as he walks up")
    time.sleep(0.3)
    harness.shot(pg, "twyx_prompt")

    start = pet(pg)
    events = since(pg, start, "interact:twyx")
    check(len(events) == 1 and events[0]["d"] == {"id": TWYX_ID}, f"E emits interact:twyx {{id}}: {events}")
    check(not since(pg, start, "interact:nothing"), "the press was not interact:nothing")
    t = twyx(pg)
    check(t["reacting"] and t["hearts"] > 0 and t["pets"] == 1, f"Twyx reacts (squint, hearts): {t}")
    check(wait_until(lambda: current_line(pg) == "twyx.meet"), f"first meeting line (twyx.meet), got {current_line(pg)}")
    time.sleep(0.25)
    harness.shot(pg, "twyx_pet")
    time.sleep(0.4)
    check(twyx(pg)["perk"] > 0.9, f"ears perked: {twyx(pg)['perk']}")

    pet(pg)
    check(wait_until(lambda: current_line(pg) == "twyx.hound"), f"second pet: the loyal hound line, got {current_line(pg)}")
    harness.shot(pg, "twyx_hound")
    pet(pg)
    check(wait_until(lambda: current_line(pg) == "twyx.pet"), f"third pet: a repeat-pet line, got {current_line(pg)}")


def test_spam(pg):
    settle(pg)
    start = len(rec(pg))
    for _ in range(12):
        harness.tap(pg, "KeyE")
        time.sleep(0.1)
    pets = len(since(pg, start, "interact:twyx"))
    lines = [e["d"]["id"] for e in since(pg, start, "narrator:line")]
    check("twyx.spam" in lines or wait_until(lambda: current_line(pg) == "twyx.spam"),
          f"spam-petting gets its own remark ({pets} pets, lines {lines})")
    settle(pg)


def test_not_solid(pg):
    stand(pg, TWYX_X - 1.5)
    settle(pg)
    harness.hold(pg, "KeyD", 0.45)
    x = player(pg)["pos"]["x"]
    check(x > TWYX_X + 1, f"Sammy walks past Twyx (x {x:.2f})")


# --- pose capture -----------------------------------------------------------------------------

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

FEET_ON_PAGE = """async id => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const c = window.__sammy.entities.find(e => e && e.id === id);
    const feet = m.worldToScreen(m.vec2(c.pos.x, c.pos.y - .45));
    const rect = m.mainCanvas.getBoundingClientRect();
    const k = rect.width / m.mainCanvasSize.x;
    return { x: rect.left + feet.x * k, y: rect.top + feet.y * k, tile: m.cameraScale * k };
}"""


def engine(pg, code):
    pg.evaluate(f"async () => {{ const m = await import('/lib/littlejs/littlejs.esm.js'); {code} }}")


def act(pg, action, hold=False):
    ok = pg.evaluate(f"__sammy.commands.entityAction('{TWYX_ID}', '{action}', {str(hold).lower()})")
    check(ok, f"entityAction {action}")


def capture(pg, name, cond, timeout=4.0, center_dx=0.0, tiles=CLIP_TILES):
    ok = pg.evaluate(WAIT_AND_PAUSE, [TWYX_ID, cond, int(timeout * 1000)])
    if not ok:
        check(False, f"pose {name}: never saw {cond}")
        return
    time.sleep(2.5)   # the camera still eases while the engine is paused; let it arrive
    feet = pg.evaluate(FEET_ON_PAGE, TWYX_ID)
    w, h = tiles[0] * feet["tile"], tiles[1] * feet["tile"]
    view = pg.viewport_size
    cx = feet["x"] + center_dx * feet["tile"]
    clip = {"x": min(max(0, cx - w / 2), view["width"] - w),
            "y": min(max(0, feet["y"] - h * .78), view["height"] - h), "width": w, "height": h}
    path = harness.OUT / "twyx" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    engine(pg, "m.mainCanvas.style.opacity = '0';")
    pg.screenshot(path=str(path), clip=clip)
    engine(pg, "m.mainCanvas.style.opacity = '';")
    print(f"ok   pose {name:<14} {twyx(pg)} -> {path}")
    shots.append((name, path))
    engine(pg, "m.setPaused(false);")


def run_poses(pg):
    pg.set_viewport_size(VIEW)
    engine(pg, f"m.setCameraScale(64 * {ZOOM});")
    # Sammy just right of Twyx, facing left toward Twyx: is Twyx cute next to Sammy?
    stand(pg, TWYX_X + 1.35)
    harness.tap(pg, "KeyA")
    stand(pg, TWYX_X + 1.35, wait=0.4)
    settle(pg)
    time.sleep(1.5)   # Sammy's flap feathers fade once he has stood still with all of them
    near = .65   # clip center: between the two

    act(pg, "stand", True)
    capture(pg, "idle", "c.action === 'stand' && !c.blinking && c.swish < .05 && !c.reacting", center_dx=near)
    act(pg, "blink")
    capture(pg, "blink", "c.blinking", center_dx=near)
    act(pg, "swish")
    capture(pg, "tail_swish", "c.swish > .9 && !c.blinking", center_dx=near)
    act(pg, "sit", True)
    capture(pg, "sit", "c.sit === 1 && !c.blinking", center_dx=near)
    act(pg, "lick", True)
    capture(pg, "lick", "c.lick === 1", center_dx=near)
    act(pg, "stand", True)
    time.sleep(0.6)
    act(pg, "pet")
    capture(pg, "pet_reaction", "c.reacting && c.perk > .8", center_dx=near)
    act(pg, "sit", True)
    time.sleep(1.6)   # let the last hearts float away first
    act(pg, "pet")
    capture(pg, "pet_sitting", "c.reacting && c.perk > .8 && c.sit === 1", center_dx=near)

    # Facing left, toward Sammy on the other side.
    act(pg, "stand", True)
    stand(pg, LEFT_OF_TWYX)
    harness.tap(pg, "KeyD")
    stand(pg, LEFT_OF_TWYX, wait=1.8)
    capture(pg, "facing_left", "c.facing === -1 && c.turn === -1 && !c.blinking", center_dx=-.8)

    # Game zoom, night sky behind: does Twyx read at actual size?
    engine(pg, "m.setCameraScale(64);")
    stand(pg, TWYX_X + 2)
    capture(pg, "game_zoom", "c.turn === 1", center_dx=1, tiles=(10, 5.6))
    act(pg, "release")


def contact_sheet(pg):
    tiles = "".join(
        f"<figure><img src='data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}'>"
        f"<figcaption>{name}</figcaption></figure>" for name, path in shots)
    pg.set_content("<html><body style='margin:0;background:#222;display:flex;flex-wrap:wrap'>"
                   "<style>figure{margin:6px;color:#eee;font:20px sans-serif;text-align:center}"
                   "img{width:560px;display:block}</style>" + tiles + "</body></html>")
    path = harness.OUT / "twyx_sheet.png"
    pg.screenshot(path=str(path), full_page=True)
    print("sheet:", path)


def main():
    with harness.session() as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("window.__sammy.commands.clearSave()")
        install_recorder(pg)
        settle(pg)
        test_registered(pg)
        test_faces_sammy(pg)
        test_walk_up_and_pet(pg)
        test_spam(pg)
        test_not_solid(pg)
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
