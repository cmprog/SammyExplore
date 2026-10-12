"""T-007 interaction scenario (test level), with real E presses.

Covers: the E prompt shows and hides with range (and while input is locked), the sign line plays
(and its second read), a locked door rattles (interact:doorLocked + its line) and stays shut, an
ordinary door blocks Sammy, opens (door:open) and becomes passable, E on nothing emits
interact:nothing, an E press used to skip/dismiss narration does NOT also interact, and an exit
door completes the level through the exit path (level:complete + autosave).
Screenshots go to out/interact_*.png.

Test level layout (world units, ground top y = 4, island top y = 11):
  sign "meadow-sign" x 33.5 | door "meadow-door" x 40.5 | island: locked door x 26.5, exit door x 29.5
"""
import sys
import time

import harness

GROUND = 4.45   # Sammy's center standing on the ground
ISLAND = 11.45  # ... on the floating island
WATCHED = ["interact:sign", "interact:door", "interact:doorLocked", "interact:nothing",
           "door:open", "level:complete", "narrator:line"]

fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def inter(pg):
    return st(pg)["interaction"]


def nearest_id(pg):
    n = inter(pg)["nearest"]
    return n["id"] if n else None


def player(pg):
    return st(pg)["player"]


def door(pg, door_id):
    return next(t for t in inter(pg)["targets"] if t["id"] == door_id)


def install_recorder(pg):
    # The bus's ring buffer drops old events; record the ones we care about from the start.
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        const fresh = !window.__rec;
        window.__rec = [];
        if (fresh)   // subscribe once; a later call just starts a new recording
            for (const n of names) bus.on(n, d => window.__rec.push({n, d}));
    }""", WATCHED)


def rec(pg, name=None):
    events = pg.evaluate("window.__rec")
    return [e for e in events if name is None or e["n"] == name]


def mark(pg):
    return len(rec(pg))


def since(pg, start, name=None):
    return [e for e in rec(pg)[start:] if name is None or e["n"] == name]


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


def stand(pg, x, y=GROUND, wait=0.6):
    pg.evaluate(f"__sammy.commands.teleport({x}, {y})")
    time.sleep(wait)


def wait_until(pg, fn, timeout=3.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if fn():
            return True
        time.sleep(step)
    return False


def press_e(pg):
    """Real E press with nothing being said (so the narrator can't claim it)."""
    settle(pg)
    start = mark(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.15)
    return start


def test_prompt_range(pg):
    stand(pg, 36.5)   # 3 tiles from the sign, 4 from the door
    settle(pg)
    check(nearest_id(pg) is None and not inter(pg)["prompt"]["visible"], "no prompt out of range")
    pg.keyboard.down("KeyA")
    found = wait_until(pg, lambda: nearest_id(pg) == "meadow-sign", timeout=1.0, step=0.02)
    pg.keyboard.up("KeyA")
    x = player(pg)["pos"]["x"]
    check(found, f"walking toward the sign brings it in range (x {x:.2f})")
    check(wait_until(pg, lambda: inter(pg)["prompt"]["appear"] >= 1), "prompt fades in fully over the sign")
    p = inter(pg)["prompt"]
    check(p["visible"] and p["target"] == {"type": "sign", "id": "meadow-sign"}, f"prompt is over the sign: {p}")
    harness.shot(pg, "interact_prompt_sign")

    harness.hold(pg, "KeyD", 0.35)   # back out of range (still short of the door)
    x = player(pg)["pos"]["x"]
    check(nearest_id(pg) is None, f"walking away puts the sign out of range (x {x:.2f})")
    check(wait_until(pg, lambda: not inter(pg)["prompt"]["visible"], timeout=1.0), "prompt fades out")


def test_sign(pg):
    stand(pg, 34.4)
    start = press_e(pg)
    signs = since(pg, start, "interact:sign")
    check(len(signs) == 1 and signs[0]["d"] == {"id": "meadow-sign", "key": "test.sign"},
          f"E at the sign emits interact:sign {{id, key}}: {signs}")
    check(wait_until(pg, lambda: (st(pg)["narrator"]["current"] or {}).get("id") == "test.sign.read"),
          "the narrator reads the sign (test.sign.read)")
    time.sleep(0.8)
    harness.shot(pg, "interact_sign_read")
    start = press_e(pg)   # settles (dismisses) the first read, then presses again
    check(len(since(pg, start, "interact:sign")) == 1, "second E at the sign emits interact:sign again")
    check(wait_until(pg, lambda: (st(pg)["narrator"]["current"] or {}).get("id") == "test.sign.again"),
          "second read: the narrator refuses (test.sign.again)")


def test_skip_does_not_interact(pg):
    stand(pg, 34.4)
    settle(pg)
    check(nearest_id(pg) == "meadow-sign", "standing at the sign")
    pg.evaluate("__sammy.commands.say('idle.4')")
    time.sleep(0.5)   # past the narrator's minimum show time, mid-reveal
    start = mark(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.2)
    cur = st(pg)["narrator"]["current"]
    check(cur and cur["id"] == "idle.4" and cur["revealed"], "E finished the narrator's reveal")
    harness.tap(pg, "KeyE")
    time.sleep(0.3)
    cur = st(pg)["narrator"]["current"]
    check(cur is None or cur["id"] != "idle.4", "second E dismissed the line")
    interactions = [e for e in since(pg, start) if e["n"].startswith("interact:")]
    check(not interactions, f"E presses used by the narrator did not interact: {interactions}")


def test_locked_door(pg):
    stand(pg, 27.4, ISLAND)
    settle(pg)
    check(nearest_id(pg) == "island-locked", f"locked door in range (nearest {nearest_id(pg)})")
    start = press_e(pg)
    names = [e["n"] for e in since(pg, start) if e["n"] != "narrator:line"]
    check(names[:2] == ["interact:door", "interact:doorLocked"], f"interact:door then interact:doorLocked: {names}")
    check(since(pg, start, "interact:doorLocked")[0]["d"] == {"id": "island-locked"} if names else False,
          "doorLocked payload is {id}")
    check(not since(pg, start, "door:open"), "a locked door does not open")
    check(wait_until(pg, lambda: (st(pg)["narrator"]["current"] or {}).get("id") == "door.locked"),
          "the narrator remarks on the locked door (door.locked)")
    time.sleep(0.1)
    harness.shot(pg, "interact_locked")
    d = door(pg, "island-locked")
    check(d["open"] == 0 and not d["passable"], f"locked door stays shut: {d}")
    check(nearest_id(pg) == "island-locked", "a locked door can be rattled again (still interactable)")


def test_unlocked_door(pg):
    stand(pg, 38.5)
    settle(pg)
    harness.hold(pg, "KeyD", 0.6)
    x = player(pg)["pos"]["x"]
    check(x < 40.5 - 0.4 - 0.35, f"closed door blocks Sammy (x {x:.2f})")
    check(nearest_id(pg) == "meadow-door", "door in range")
    harness.shot(pg, "interact_door_closed")
    start = press_e(pg)
    names = [e["n"] for e in since(pg, start) if e["n"] != "narrator:line"]
    check(names[:2] == ["interact:door", "door:open"], f"interact:door then door:open: {names}")
    check(since(pg, start, "door:open")[0]["d"] == {"id": "meadow-door"} if "door:open" in names else False,
          "door:open payload is {id}")
    check(not inter(pg)["prompt"]["visible"] or inter(pg)["prompt"]["appear"] < 1, "prompt leaves an opening door")
    check(wait_until(pg, lambda: door(pg, "meadow-door")["open"] == 1, timeout=2), "door swings fully open")
    check(door(pg, "meadow-door")["passable"], "open door is passable")
    harness.shot(pg, "interact_door_open")
    harness.hold(pg, "KeyD", 0.5)
    x = player(pg)["pos"]["x"]
    check(x > 41.3, f"Sammy walks through the open door (x {x:.2f})")
    harness.shot(pg, "interact_door_through")
    stand(pg, 39.6)
    start = press_e(pg)
    check(not since(pg, start, "interact:door"), "an open door has nothing more to offer")


def test_nothing(pg):
    stand(pg, 36.5)
    start = press_e(pg)
    names = [e["n"] for e in since(pg, start) if e["n"].startswith("interact:")]
    check(names == ["interact:nothing"], f"E with nothing in range emits interact:nothing: {names}")


def test_prompt_hidden_when_locked(pg):
    stand(pg, 34.4)
    settle(pg)
    wait_until(pg, lambda: inter(pg)["prompt"]["appear"] >= 1)
    pg.evaluate("__sammy.commands.emit('correction:triggered', {id: 'interaction-test'})")
    time.sleep(0.3)
    locks = st(pg)["inputLocks"]
    check(locks and not inter(pg)["prompt"]["visible"], f"prompt hides while input is locked ({locks})")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=6000)
    settle(pg)


def test_exit_door(pg):
    stand(pg, 28.6, ISLAND)
    settle(pg)
    check(nearest_id(pg) == "island-exit", f"exit door in range (nearest {nearest_id(pg)})")
    harness.shot(pg, "interact_exit_closed")
    start = press_e(pg)
    check([e["n"] for e in since(pg, start, "door:open")] == ["door:open"], "exit door opens")
    check(wait_until(pg, lambda: since(pg, start, "level:complete"), timeout=3), "exit door completes the level")
    done = since(pg, start, "level:complete")
    check(done and done[0]["d"].get("id") == "island-door" and done[0]["d"].get("door") == "island-exit",
          f"level:complete carries the exit id and door: {done}")
    harness.wait_scene(pg, "levelComplete")
    time.sleep(0.6)
    harness.shot(pg, "interact_exit_complete")
    save = st(pg)["save"]
    check(save is not None and save["levelId"] == "test", f"exit door autosaved: {save}")
    check(st(pg)["level"]["completed"], "zones report the level completed")


def test_sign_fallback(pg):
    settle(pg)
    pg.evaluate("__sammy.commands.emit('interact:sign', {id: 'nameless', key: 'no.such.sign'})")
    check(wait_until(pg, lambda: (st(pg)["narrator"]["current"] or {}).get("id") == "sign.fallback"),
          "a sign without its own line gets the common fallback (sign.fallback)")
    settle(pg)


def test_door_top_counts_as_ground(pg):
    # Sammy 0.3 above the locked door's top (island top 11 + door 1.9), nothing but the door
    # below: the landing probe must see it, so a press now is a buffered jump, not a flap.
    found = pg.evaluate("""async () => {
        const e = await import('/lib/littlejs/littlejs.esm.js');
        const t = await import('/src/systems/terrainCollision.js');
        window.__sammy.commands.teleport(26.5, 12.9 + 0.45 + 0.3);
        const sammy = e.engineObjects.find(o => o.resetTo);
        sammy.velocity = e.vec2(0, -0.1);
        return [t.hasGroundWithin(sammy, 0.5), t.hasGroundWithin(sammy, 0.1)];
    }""")
    check(found == [True, False], f"closed door top is ground for the landing probe, within reach only: {found}")
    time.sleep(0.8)
    p = player(pg)
    check(p["grounded"] and abs(p["pos"]["y"] - 13.35) < 0.05, f"Sammy can stand on a closed door: {p['pos']}")


def test_single_completion(pg):
    """Exit door opening, then Sammy walks into the 'end' exit zone first: the zone completes the
    level, and the door finishing under the overlay must not complete it a second time."""
    pg.evaluate("__sammy.commands.loadLevel('test')")
    time.sleep(0.5)
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.loading === false")
    install_recorder(pg)
    settle(pg)
    stand(pg, 28.6, ISLAND)
    settle(pg)
    start = press_e(pg)   # door swing + exit delay is 0.75 s
    pg.evaluate("__sammy.commands.teleport(47, 5.5)")
    harness.wait_scene(pg, "levelComplete")
    time.sleep(1.5)
    done = since(pg, start, "level:complete")
    check(len(done) == 1 and done[0]["d"]["id"] == "end", f"exactly one level:complete per load: {done}")


def main():
    with harness.session() as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("window.__sammy.commands.clearSave()")
        install_recorder(pg)
        settle(pg)
        targets = {t["id"] for t in inter(pg)["targets"]}
        check(targets == {"meadow-sign", "meadow-door", "island-locked", "island-exit", "twyx"}, f"interactables registered: {targets}")

        test_prompt_range(pg)
        test_sign(pg)
        test_skip_does_not_interact(pg)
        test_nothing(pg)
        test_locked_door(pg)
        test_prompt_hidden_when_locked(pg)
        test_unlocked_door(pg)
        test_sign_fallback(pg)
        test_door_top_counts_as_ground(pg)
        test_exit_door(pg)
        test_single_completion(pg)

    print("console errors:", s.errors)
    fails.extend(s.errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
