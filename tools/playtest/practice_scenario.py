"""T-018 the bedroom practice course (src/data/levels/bedroom.js, x 55-84), real key presses.

Run A, with Twyx (asked along with E at her home on the rug):
  - from the floor by the bookshelf (Sammy put there, she trots over: the room's furniture is
    bedroom_scenario's), up the dresser's new brick steps (7, 9) and over it (11); she follows
    (the dresser was a wall to her before T-018).
  - entry: practice.entry zone and line; down onto the toy shelves (9, 7), up the next (9), onto
    the bed and the headboard (11); she hops after him with no waiting.
  - the gap: Sammy flaps across to the cubby; she waits at the edge (companion:waiting, 'gap');
    the checkpoint past the bridge fires, and she is NOT fetched while he can see her.
  - help her through: E on the lever (practice.lever zone) lowers the bridge; she walks over
    (companion:caughtUp via 'walked').
  - the cat spot: E at the cushion -> she comforts the mouse (ability:start, ability:used,
    upset:calmed); it scoots into the fort; the tunnel is open.
  - the reward: walking in finds the toy star (collectible:found, a chime, a narrator line, the
    celebration particles; it is gone after).
  - the way back: over the bridge and the bed, up the toy shelf and the dresser, down its far side
    and through the bookshelf to the floor; she follows him all the way, never waiting.
Run B, without a companion (at night):
  - from the dresser, the same route with real keys: Sammy flies the gap, the checkpoint fires,
    E at the cushion gets the soft hint (catspot:noCat {key: 'practice.mouse'}, a keyed line) and
    the mouse stays put: he can't get into the fort.
  - out again by dropping into the gap: the floor there runs under the bed back to the entry.
Run C, Twyx, cushion before the lever: catspot:unreachable {reason: 'gap'} (the narrator's
  "clear the way" hint), then the lever: she carries on by herself and does it.
Run D, Twyx follows Sammy down into the gap and back out under the bed (no soft-lock).
Also: every course zone key has a line; the bedroom has no reserved region left.

Screenshots: tools/playtest/out/practice_*.png (overview, help-her-through, comfort, reward, ...).

    .venv/Scripts/python tools/playtest/practice_scenario.py
"""
import sys
import time

import harness

HALF_H = 0.45          # Sammy's center above his feet
CAT_HALF = 0.4
FLOOR = 5
GAP = (71, 76)         # the gap's columns (the bridge spans them)
CUBBY_TOP = 11
LEVER_X = 77.5
SPOT_X = 79.5
MOUSE_X = 80.5
STAR_X = 82.5
WATCHED = ["narration:zone", "narrator:line", "companion:waiting", "companion:caughtUp", "companion:join",
           "checkpoint:reached", "interact:lever", "mechanism:toggle", "bridge:move", "interact:catspot",
           "catspot:noCat", "catspot:unreachable", "ability:start", "ability:used", "ability:cancel",
           "upset:calmed", "collectible:found", "correction:triggered", "level:start"]

fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def ev(pg, expr):
    return pg.evaluate(expr)


def st(pg):
    return harness.state(pg)


def player(pg):
    return ev(pg, "__sammy.player")


def comp(pg):
    return ev(pg, "__sammy.companion")


def entity(pg, eid):
    return ev(pg, f"__sammy.entities.find(e => e && e.id === '{eid}')")


def twyx(pg):
    return ev(pg, "__sammy.entities.find(e => e && e.type === 'twyx')")


def feet(p):
    return p["pos"]["y"] - HALF_H


def cat_feet(c):
    return c["pos"]["y"] - CAT_HALF


def install(pg):
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        if (window.__rec) return;
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({ n, d }));
    }""", WATCHED)


def mark(pg):
    return ev(pg, "window.__rec.length")


def since(pg, start, name=None):
    return [e for e in ev(pg, "window.__rec")[start:] if name is None or e["n"] == name]


def line_ids(events):
    return [e["d"]["id"] for e in events if e["n"] == "narrator:line"]


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


def load(pg, level="bedroom"):
    pg.evaluate(f"__sammy.commands.loadLevel('{level}')")
    pg.wait_for_function(f"__sammy.scene === 'playing' && __sammy.level && __sammy.level.id === '{level}' && __sammy.level.loading === false",
                         timeout=15000)
    time.sleep(0.5)


def teleport(pg, x, feet_y, wait=0.5):
    pg.evaluate(f"__sammy.commands.teleport({x}, {feet_y + HALF_H + .01})")
    time.sleep(wait)


def landed(pg, timeout=4.0):
    wait_until(lambda: player(pg)["grounded"] and abs(player(pg)["vel"]["y"]) < 1e-3, timeout, 0.02)
    time.sleep(0.1)
    return player(pg)


def walk_to(pg, x, timeout=10.0, jump_when_stuck=True, hold=0.35):
    """Hold D/A until Sammy's x passes x. A held jump when he's stuck against a step."""
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
                harness.hold(pg, "Space", hold)
                stuck = 0
            elif stuck >= 12:
                pg.keyboard.up(key)
                time.sleep(0.05)
                pg.keyboard.down(key)
                stuck = 0
            time.sleep(0.03)
        return False
    finally:
        pg.keyboard.up(key)


def jump_to(pg, x, hold=0.42, flaps=0, flap_every=0.24, timeout=5.0):
    """A real jump (Space held `hold` s, then `flaps` taps near each apex), steered with A/D toward
    x the way a player would: run at it, ease off and counter-steer to stop over it."""
    down = None

    def steer(p):
        nonlocal down
        px, vx = p["pos"]["x"], p["vel"]["x"] * 60
        want = max(-8.0, min(8.0, (x - px) * 5))
        key = "KeyD" if vx < want - 1 else "KeyA" if vx > want + 1 else None
        if key != down:
            if down:
                pg.keyboard.up(down)
            if key:
                pg.keyboard.down(key)
            down = key

    steer(player(pg))
    time.sleep(0.04)
    pg.keyboard.down("Space")
    t0 = time.time()
    flap_at = [hold + flap_every * (i + 1) for i in range(flaps)]
    space_down, left_ground = True, False
    try:
        while time.time() - t0 < timeout:
            p = player(pg)
            steer(p)
            t = time.time() - t0
            if space_down and t >= hold:
                pg.keyboard.up("Space")
                space_down = False
            if flap_at and t >= flap_at[0]:
                flap_at.pop(0)
                harness.tap(pg, "Space")
            if not p["grounded"]:
                left_ground = True
            elif left_ground and t > 0.15 and not flap_at:
                break
            time.sleep(0.02)
    finally:
        if space_down:
            pg.keyboard.up("Space")
        if down:
            pg.keyboard.up(down)
    return landed(pg)


def move_to(pg, x, timeout=5.0, tolerance=0.15):
    """Walk (no jumping) to x, steering like a player, and wait until he stands still there. Walking
    off a ledge on the way is fine: he steers in the air and lands near x."""
    down = None
    t0 = time.time()
    try:
        while time.time() - t0 < timeout:
            p = player(pg)
            px, vx = p["pos"]["x"], p["vel"]["x"] * 60
            if abs(x - px) < tolerance and abs(vx) < .3 and p["grounded"]:
                break
            want = max(-8.0, min(8.0, (x - px) * 5))
            key = "KeyD" if vx < want - 1 else "KeyA" if vx > want + 1 else None
            if key != down:
                if down:
                    pg.keyboard.up(down)
                if key:
                    pg.keyboard.down(key)
                down = key
            time.sleep(0.02)
    finally:
        if down:
            pg.keyboard.up(down)
    return landed(pg)


def climb_course(pg, label="", shot_after=None):
    """From the dresser top: down its side onto the toy shelves (9, then 7), up the next shelf (9),
    onto the bed (9) and up the headboard (11), at the gap. Real keys; checks each landing."""
    route = ((56.0, 9, "the toy shelf by the dresser", "walk"), (58.0, 7, "the low toy shelf", "walk"),
             (60.0, 9, "the toy shelf before the bed", "jump"), (64.0, 9, "the bed", "jump"),
             (67.6, 9, "along the bed", "walk"), (69.7, 11, "the headboard, at the gap", "jump"))
    for i, (x, top, what, move) in enumerate(route):
        if move == "walk":
            p = move_to(pg, x)
        else:
            p = jump_to(pg, x)
        check(abs(feet(p) - top) < .1 and abs(p["pos"]["x"] - x) < .8,
              f"{label}{what}: feet {feet(p):.2f}, x {p['pos']['x']:.2f} (expected {top}, ~{x})")
        if i == shot_after:
            time.sleep(1.2)
            shot(pg, "01_entry", hide_box=False)
            settle(pg)


def face(pg, key):
    harness.hold(pg, key, 0.04)
    time.sleep(0.25)


def press_e(pg):
    settle(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.2)


def wait_state(pg, state, timeout=8.0, reason=None):
    return wait_until(lambda: (comp(pg) or {}).get("state") == state
                      and (reason is None or comp(pg).get("reason") == reason), timeout=timeout)


def shot(pg, name, hide_box=True):
    if hide_box:
        pg.evaluate("async () => { const m = await import('littlejs'); m.mainCanvas.style.opacity = '0'; }")
    path = harness.shot(pg, "practice_" + name)
    if hide_box:
        pg.evaluate("async () => { const m = await import('littlejs'); m.mainCanvas.style.opacity = ''; }")
    print("     shot:", path)
    return path


# --- static checks --------------------------------------------------------------------------------

def test_layout(pg):
    level = st(pg)["level"]
    check(level["id"] == "bedroom" and level["reserved"] == [], f"the course is built: no reserved region left ({level['reserved']})")
    ids = {e["id"] for e in st(pg)["entities"] if e and e.get("id")}
    for eid in ("practice-bridge", "practice-lever", "practice-spot", "practice-mouse", "practice-star"):
        check(eid in ids, f"entity {eid} is placed")
    spot = next(s for s in ev(pg, "__sammy.catSpots") if s["id"] == "practice-spot")
    check(spot["ability"] == "comfort" and spot["targets"] == ["practice-mouse"] and spot["key"] == "practice.mouse",
          f"the cat spot: comfort, targets the mouse, key practice.mouse ({spot})")
    star = entity(pg, "practice-star")
    check(star["type"] == "collectible" and star["kind"] == "toyStar" and star["state"] == "waiting", f"the toy star waits: {star}")
    mouse = entity(pg, "practice-mouse")
    check(mouse["state"] == "upset" and mouse["blocking"], f"the mouse is frazzled and in the way: {mouse['state']}")


def test_hooks(pg):
    """Narration hooks: a zone for each course key, each with a (placeholder) line; the spot's key
    and the star's id have lines too."""
    keys = ev(pg, "__sammy.level.zones.filter(z => z.type === 'narration').map(z => z.props.key)")
    want = ["practice.entry", "practice.gap", "practice.lever", "practice.tunnel"]
    check(all(k in keys for k in want), f"zones for {want}: {keys}")
    lines = pg.evaluate("""async () => (await import('/src/data/narration/bedroom.js')).default.lines
        .map(l => ({ id: l.id, trigger: l.trigger, key: l.key }))""")
    for key in want:
        check(any(l["trigger"] == "narration:zone" and l.get("key") == key for l in lines), f"a line for zone {key}")
    for trigger, key in (("catspot:noCat", "practice.mouse"), ("ability:used", "practice.mouse"), ("collectible:found", "practice-star")):
        check(any(l["trigger"] == trigger and l.get("key") == key for l in lines), f"a line for {trigger} {key}")


# --- run A: with Twyx ------------------------------------------------------------------------------

def run_with_twyx(pg):
    load(pg)
    settle(pg)
    pg.evaluate("__sammy.commands.setTimeOfDay(.5)")
    test_layout(pg)
    test_hooks(pg)
    # Ask her along: walk to her and press E.
    tw = twyx(pg)
    walk_to(pg, tw["pos"]["x"] - 1.0, jump_when_stuck=False)
    face(pg, "KeyD")
    m0 = mark(pg)
    press_e(pg)
    check(wait_until(lambda: any(e["n"] == "companion:join" for e in since(pg, m0)), 3), "E on Twyx asks her along (companion:join)")
    settle(pg)
    check(wait_until(lambda: (comp(pg) or {}).get("cat") == "twyx", 3), f"Twyx is the companion ({comp(pg)})")

    # Over to the dresser: the room's furniture platforming is bedroom_scenario's, so Sammy is put
    # down on the floor by the bookshelf and she trots over to him (regroup). From there it is all
    # real keys: the new brick steps (7, 9) and over the dresser (11), which she couldn't climb
    # before T-018.
    teleport(pg, 43.5, FLOOR)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(wait_state(pg, "idle", 8), f"she trots over to him by the bookshelf ({comp(pg)})")
    settle(pg)
    m_room = mark(pg)
    for x, top, what in ((46.5, 7, "the low brick step"), (47.5, 9, "the tall brick step"), (50.5, 11, "the dresser")):
        p = jump_to(pg, x)
        check(abs(feet(p) - top) < .1, f"up {what}: feet {feet(p):.2f}, x {p['pos']['x']:.2f} (expected {top})")
    ok = abs(feet(move_to(pg, 53.5)) - 11) < .1
    p = player(pg)
    check(ok and abs(feet(p) - 11) < .1, f"up the brick steps (7, 9) onto the dresser (feet {feet(p):.2f}, x {p['pos']['x']:.2f})")
    check(wait_until(lambda: abs(cat_feet(twyx(pg)) - 11) < .1 and twyx(pg)["pos"]["x"] > 48, 10),
          f"Twyx climbs the brick steps onto the dresser too ({twyx(pg)['pos']})")
    waits = since(pg, m_room, "companion:waiting")
    check(not waits, f"no waiting on the way over the room and the dresser: {waits}")
    settle(pg)

    # Into the course: down the dresser's side onto the shelves, up onto the bed and the headboard.
    m_course = mark(pg)
    climb_course(pg, shot_after=0)
    check(any(e["n"] == "narration:zone" and e["d"].get("key") == "practice.entry" for e in since(pg, m_course)),
          "entering the course: narration:zone practice.entry")
    check("practice.entry" in line_ids(since(pg, m_course)), f"...and its line ({line_ids(since(pg, m_course))})")
    check(wait_until(lambda: abs(cat_feet(twyx(pg)) - 11) < .1 and twyx(pg)["pos"]["x"] > 68, 10),
          f"Twyx hops up the shelves and the bed after him, onto the headboard ({twyx(pg)['pos']})")
    check(any(e["n"] == "narration:zone" and e["d"].get("key") == "practice.gap" for e in since(pg, m_course)),
          "narration:zone practice.gap")
    waits = since(pg, m_course, "companion:waiting")
    check(not waits, f"no waiting on the shelves and the bed: {waits}")
    settle(pg)
    shot(pg, "02_at_the_gap")

    # The gap: flap across.
    m_gap = mark(pg)
    p = jump_to(pg, LEVER_X - .9, flaps=2)
    check(p["pos"]["x"] > GAP[1] and abs(feet(p) - CUBBY_TOP) < .1, f"Sammy flaps across the gap to the cubby ({p['pos']})")
    check(wait_until(lambda: any(e["n"] == "companion:waiting" and e["d"] == {"cat": "twyx", "reason": "gap"} for e in since(pg, m_gap)), 6),
          f"she waits at the gap's edge: companion:waiting {{reason: 'gap'}} ({since(pg, m_gap, 'companion:waiting')})")
    time.sleep(0.4)
    cps = since(pg, m_gap, "checkpoint:reached")
    check(any(e["d"]["id"] == "practice-far-side" for e in cps), f"checkpoint past the bridge: {cps}")
    check(any(e["n"] == "narration:zone" and e["d"].get("key") == "practice.lever" for e in since(pg, m_gap)),
          "narration:zone practice.lever")
    tw = twyx(pg)
    check(tw["pos"]["x"] < GAP[0] + .2 and abs(cat_feet(tw) - 11) < .1, f"she is still on the headboard, waiting ({tw['pos']})")
    time.sleep(2.0)
    c = comp(pg)
    check(c["state"] == "waiting" and not c.get("fetchPending"), f"in view, she isn't fetched past the gap: {c['state']}, fetch {c.get('fetchPending')}")
    settle(pg)
    face(pg, "KeyD")
    shot(pg, "03_help_her_through_waiting")

    # Help her through: the lever lowers the bridge, and she walks over.
    m_lever = mark(pg)
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "lever", "id": "practice-lever"},
          f"the E prompt is on the lever: {ev(pg, '__sammy.interaction.nearest')}")
    press_e(pg)
    evs = since(pg, m_lever)
    check(any(e["n"] == "mechanism:toggle" and e["d"]["id"] == "practice-lever" and e["d"]["on"] for e in evs), "E throws the lever on")
    check(wait_until(lambda: any(e["n"] == "bridge:move" and e["d"] == {"id": "practice-bridge", "down": True} for e in since(pg, m_lever)), 2),
          "the bridge lowers (bridge:move down)")
    time.sleep(0.5)
    shot(pg, "04_help_her_through_bridge")
    check(wait_until(lambda: any(e["n"] == "companion:caughtUp" for e in since(pg, m_lever)), 8),
          f"she crosses the bridge to him ({since(pg, m_lever, 'companion:caughtUp')})")
    ups = since(pg, m_lever, "companion:caughtUp")
    check(ups and ups[0]["d"] == {"cat": "twyx", "via": "walked"}, f"companion:caughtUp via walked: {ups}")
    check(wait_until(lambda: twyx(pg)["pos"]["x"] > GAP[0] + 2 and twyx(pg)["grounded"] and abs(cat_feet(twyx(pg)) - 11) < .1, 3),
          f"she is across, beside him (bridge or cubby: {twyx(pg)['pos']})")
    check(entity(pg, "practice-lever").get("spent") or not ev(pg, "__sammy.interaction.nearest") or
          ev(pg, "__sammy.interaction.nearest").get("id") != "practice-lever", "the lever is one-way: nothing more to offer")
    settle(pg)

    # The cat spot: Comfort clears the tunnel.
    m_spot = mark(pg)
    walk_to(pg, SPOT_X - .8, jump_when_stuck=False, timeout=3)
    check(any(e["n"] == "narration:zone" and e["d"].get("key") == "practice.tunnel" for e in since(pg, m_spot)) or
          any(e["n"] == "narration:zone" and e["d"].get("key") == "practice.tunnel" for e in since(pg, m_gap)),
          "narration:zone practice.tunnel")
    settle(pg)
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "catspot", "id": "practice-spot"},
          f"the E prompt is on the cushion: {ev(pg, '__sammy.interaction.nearest')}")
    m_spot = mark(pg)
    press_e(pg)
    # Sammy steps back to watch (well within CATSPOT.GIVE_UP_DISTANCE).
    move_to(pg, LEVER_X)
    face(pg, "KeyD")
    check(wait_until(lambda: any(e["n"] == "ability:start" for e in since(pg, m_spot)), 8), "she walks to the cushion and starts comforting")
    time.sleep(1.6)
    shot(pg, "05_comfort")
    check(wait_until(lambda: any(e["n"] == "ability:used" for e in since(pg, m_spot)), 5), "Comfort works (ability:used)")
    used = [e for e in since(pg, m_spot) if e["n"] == "ability:used"][0]["d"]
    check(used == {"ability": "comfort", "cat": "twyx", "spotId": "practice-spot", "key": "practice.mouse"}, f"ability:used payload {used}")
    check(wait_until(lambda: any(e["n"] == "upset:calmed" and e["d"]["id"] == "practice-mouse" for e in since(pg, m_spot)), 4), "the mouse calms (upset:calmed)")
    check(wait_until(lambda: entity(pg, "practice-mouse")["arrived"], 5), f"...and scoots into the fort ({entity(pg, 'practice-mouse')['pos']})")
    check("practice.mouse.calmed" in line_ids(since(pg, m_spot)), f"the keyed Comfort line ({line_ids(since(pg, m_spot))})")
    check(wait_until(lambda: comp(pg)["state"] in ("idle", "following"), 6), f"she follows Sammy again ({comp(pg)['state']})")
    settle(pg)

    # The reward: into the fort.
    m_star = mark(pg)
    walk_to(pg, STAR_X - .3, jump_when_stuck=False, timeout=4)
    check(wait_until(lambda: any(e["n"] == "collectible:found" for e in since(pg, m_star)), 2), "walking in finds the toy star")
    found = since(pg, m_star, "collectible:found")
    check(found and found[0]["d"] == {"id": "practice-star", "kind": "toyStar", "levelId": "bedroom"}, f"collectible:found payload: {found}")
    time.sleep(0.6)
    shot(pg, "06_reward", hide_box=False)
    check(wait_until(lambda: entity(pg, "practice-star")["state"] == "gone", 3), "it celebrates and pops")
    check(entity(pg, "practice-star")["particles"] > 5, "...into sparkles and confetti")
    time.sleep(0.4)
    shot(pg, "07_reward_burst")
    sound = pg.evaluate("async () => (await import('/src/data/sounds.js')).SOUND_EVENTS['collectible:found']")
    check(sound == "collectibleFound" and ev(pg, "__sammy.commands.play('collectibleFound')"), f"collectible:found chimes ({sound})")
    check(wait_until(lambda: "practice.star" in line_ids(since(pg, m_star)), 3), f"the narrator remarks ({line_ids(since(pg, m_star))})")
    check(len(found) == 1, "found once")
    settle(pg)
    time.sleep(1.2)
    tw = twyx(pg)
    check(tw["pos"]["x"] > GAP[1] + 1 and comp(pg)["state"] in ("idle", "following"), f"Twyx came along toward the fort ({tw['pos']}, {comp(pg)['state']})")

    # The way back: over the bridge and the bed, down the shelves, over the dresser.
    m_back = mark(pg)
    walk_to(pg, 66, timeout=10)
    walk_to(pg, 58, timeout=10)
    p = landed(pg)
    check(p["pos"]["x"] < 59, f"Sammy is back at the entry ({p['pos']})")
    check(wait_until(lambda: twyx(pg)["pos"]["x"] < 62, 12), f"she comes back over the bridge and the bed with him ({twyx(pg)['pos']})")
    for x, top, what in ((56.0, 9, "the toy shelf by the dresser"), (53.0, 11, "the dresser")):
        p = jump_to(pg, x)
        check(abs(feet(p) - top) < .1, f"back up {what}: feet {feet(p):.2f}, x {p['pos']['x']:.2f} (expected {top})")
    check(wait_until(lambda: abs(cat_feet(twyx(pg)) - 11) < .1 and twyx(pg)["pos"]["x"] < 56, 10),
          f"she hops back up the toy shelf and onto the dresser ({twyx(pg)['pos']})")
    # Down the brick steps (or onto the bookshelf's low shelf beside them, as walking off does) and on
    # through the bookshelf to the floor by the desk.
    move_to(pg, 46.5, timeout=6)
    p = move_to(pg, 37.5, timeout=8)
    check(abs(feet(p) - FLOOR) < .1, f"down off the dresser's side and back into the room: feet {feet(p):.2f}, x {p['pos']['x']:.2f}")
    check(wait_until(lambda: twyx(pg)["pos"]["x"] < 41 and abs(cat_feet(twyx(pg)) - FLOOR) < .1, 15),
          f"...and she comes back over the dresser into the room with him ({twyx(pg)['pos']})")
    waits = [e for e in since(pg, m_back, "companion:waiting")]
    check(not waits, f"no waiting on the way back: {waits}")


# --- run B: no companion ---------------------------------------------------------------------------

def run_without_cat(pg):
    load(pg)
    pg.evaluate("__sammy.commands.setCompanion(null)")
    settle(pg)
    pg.evaluate("__sammy.commands.setTimeOfDay(.9)")
    check(comp(pg) is None or comp(pg).get("cat") is None, f"nobody along ({comp(pg)})")
    teleport(pg, 53.5, 11)
    settle(pg)
    m0 = mark(pg)
    climb_course(pg, "alone: ")
    settle(pg)
    p = jump_to(pg, LEVER_X - .9, flaps=2)
    check(p["pos"]["x"] > GAP[1] and abs(feet(p) - CUBBY_TOP) < .1, f"flaps the gap ({p['pos']})")
    settle(pg)
    check(any(e["d"]["id"] == "practice-far-side" for e in since(pg, m0, "checkpoint:reached")), "the checkpoint fires without her too")
    move_to(pg, SPOT_X - .8)
    face(pg, "KeyD")
    settle(pg)
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "catspot", "id": "practice-spot"},
          f"at the cushion: {ev(pg, '__sammy.interaction.nearest')}")
    m2 = mark(pg)
    press_e(pg)
    time.sleep(0.8)
    evs = since(pg, m2)
    nocat = [e for e in evs if e["n"] == "catspot:noCat"]
    check(nocat and nocat[0]["d"] == {"spotId": "practice-spot", "ability": "comfort", "key": "practice.mouse"}, f"catspot:noCat with the spot's key: {nocat}")
    check("practice.mouse.noCat" in line_ids(evs), f"the narrator hints (keyed line): {line_ids(evs)}")
    shot(pg, "08_no_cat_hint", hide_box=False)
    settle(pg)
    # The fort stays shut: walk into the mouse.
    walk_to(pg, STAR_X, jump_when_stuck=False, timeout=1.5)
    p = player(pg)
    check(p["pos"]["x"] < MOUSE_X - .6 and entity(pg, "practice-mouse")["state"] == "upset", f"he can't get past the frazzled mouse ({p['pos']['x']:.2f})")
    check(entity(pg, "practice-star")["state"] == "waiting", "the star is still in the fort")
    # Way out: drop into the gap and walk out under the bed.
    p = move_to(pg, GAP[1] - 1.5)
    check(abs(feet(p) - FLOOR) < .1, f"down into the gap (bridge up), onto the floor ({p['pos']})")
    walk_to(pg, 56, jump_when_stuck=False, timeout=8)
    p = player(pg)
    check(p["pos"]["x"] <= 56.1 and abs(feet(p) - FLOOR) < .1, f"...and out under the bed to the entry ({p['pos']})")
    check(not since(pg, m0, "correction:triggered"), "no corrections")


# --- run C: Twyx, the cushion before the lever -------------------------------------------------------

def run_unreachable(pg):
    load(pg)
    settle(pg)
    pg.evaluate("__sammy.commands.setTimeOfDay(.5)")
    teleport(pg, 68.5, 9)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    check(wait_state(pg, "idle", 8), f"Twyx is beside him on the bed ({comp(pg)})")
    settle(pg)
    jump_to(pg, 69.7)
    time.sleep(1.0)
    jump_to(pg, SPOT_X - .8, flaps=2)
    settle(pg)
    face(pg, "KeyD")
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "catspot", "id": "practice-spot"},
          f"at the cushion: {ev(pg, '__sammy.interaction.nearest')}")
    m0 = mark(pg)
    press_e(pg)
    check(wait_until(lambda: any(e["n"] == "catspot:unreachable" for e in since(pg, m0)), 6),
          f"she can't get there: catspot:unreachable ({[e['n'] for e in since(pg, m0)]})")
    un = since(pg, m0, "catspot:unreachable")
    check(un and un[0]["d"].get("reason") == "gap" and un[0]["d"].get("key") == "practice.mouse", f"...reason gap, with the key: {un}")
    check("catspot.unreachable" in line_ids(since(pg, m0)) or any(i.startswith("catspot.unreachable") for i in line_ids(since(pg, m0))),
          f"the narrator's 'clear the way' hint ({line_ids(since(pg, m0))})")
    settle(pg)
    move_to(pg, LEVER_X - .9)
    face(pg, "KeyD")
    check(ev(pg, "__sammy.interaction.nearest") == {"type": "lever", "id": "practice-lever"},
          f"at the lever: {ev(pg, '__sammy.interaction.nearest')} (Sammy {player(pg)['pos']}, targets {ev(pg, '__sammy.interaction.targets')})")
    m1 = mark(pg)
    press_e(pg)
    check(wait_until(lambda: any(e["n"] == "ability:used" for e in since(pg, m1)), 14),
          f"the bridge opens the way: she carries on to the cushion by herself and does it ({[e['n'] for e in since(pg, m1)]})")
    check(wait_until(lambda: entity(pg, "practice-mouse")["arrived"], 5), "the mouse is calm and out of the tunnel")


# --- run D: Twyx down into the gap and back out ----------------------------------------------------

def run_pit(pg):
    load(pg)
    settle(pg)
    teleport(pg, 68.5, 9)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    check(wait_state(pg, "idle", 8), f"Twyx is beside him on the bed ({comp(pg)})")
    settle(pg)
    m0 = mark(pg)
    jump_to(pg, 69.7)
    time.sleep(1.0)
    walk_to(pg, 73.5, jump_when_stuck=False, timeout=3)
    p = landed(pg)
    check(abs(feet(p) - FLOOR) < .1, f"Sammy drops into the gap ({p['pos']})")
    check(wait_until(lambda: abs(cat_feet(twyx(pg)) - FLOOR) < .1 and twyx(pg)["pos"]["x"] > 70.5, 8), f"she drops down after him ({twyx(pg)['pos']})")
    walk_to(pg, 56.5, jump_when_stuck=False, timeout=8)
    landed(pg)
    check(wait_until(lambda: twyx(pg)["pos"]["x"] < 60 and abs(cat_feet(twyx(pg)) - FLOOR) < .1, 10),
          f"she walks out under the bed with him ({twyx(pg)['pos']})")
    check(not since(pg, m0, "companion:waiting") and not since(pg, m0, "correction:triggered"), "no waiting, no corrections")


def overview(pg):
    """The whole course in one screen, at night and by day, with Twyx along."""
    load(pg)
    settle(pg)
    teleport(pg, 66.5, 9)
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    wait_state(pg, "idle", 8)
    for name, t in (("00_overview_day", .5), ("00_overview_night", .9)):
        pg.evaluate(f"__sammy.commands.setTimeOfDay({t})")
        pg.evaluate("__sammy.commands.cameraFocus(69.5, 12.5)")
        time.sleep(2.2)
        shot(pg, name)
    pg.evaluate("__sammy.commands.cameraFocus()")


def main():
    with harness.session(start_level=None) as s:
        pg = s.page
        pg.set_viewport_size({"width": 1920, "height": 1080})
        pg.wait_for_function("window.__sammy.scene === 'title'", timeout=10000)
        pg.evaluate("__sammy.commands.loadLevel('bedroom')")
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.id === 'bedroom' && !window.__sammy.level.loading", timeout=15000)
        install(pg)
        for name, run in (("A: with Twyx", run_with_twyx), ("B: without a companion", run_without_cat),
                          ("C: cushion before the lever", run_unreachable), ("D: down into the gap", run_pit),
                          ("overview", overview)):
            print(f"--- {name}")
            try:
                run(pg)
            except Exception as error:   # keep going: one broken run shouldn't hide the others
                check(False, f"{name} raised {type(error).__name__}: {error}")
        sounds = ev(pg, "__sammy.audio")
        print("     audio:", {k: sounds.get(k) for k in ("lastSound", "soundCount")})
    for e in s.errors:
        print("ERROR", e)
    print(f"\n{len(fails)} failed" if fails else "\nall checks passed")
    return 1 if fails or s.errors else 0


if __name__ == "__main__":
    sys.exit(main())
