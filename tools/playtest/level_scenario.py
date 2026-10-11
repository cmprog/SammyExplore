"""T-003 level system scenario (test level), real key presses where possible.

Covers: walking, one-way platforms, falling off the world (reset), checkpoint/exit events,
implicit level bounds (invisible side walls and ceiling), camera clamping at both level edges. Screenshots go to out/level_*.png for visual review.
"""
import sys
import time

import harness


def wait_loaded(pg):
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
    time.sleep(0.5)


def wait_correction_done(pg, timeout=6):
    """Corrections run the narrator's rewrite effect (~1.9s) with gameplay input locked."""
    pg.wait_for_function("window.__sammy.narrator && window.__sammy.narrator.correction === null", timeout=timeout * 1000)


def settle(pg, secs=1.0):
    time.sleep(secs)


def ev(pg, name):
    return [e for e in harness.state(pg)["events"] if name in str(e)]


def main():
    fails = []

    def check(ok, msg):
        print(("ok   " if ok else "FAIL ") + msg)
        if not ok:
            fails.append(msg)

    with harness.session() as s:
        pg = s.page
        wait_loaded(pg)
        st = harness.state(pg)
        print("level:", st["level"])
        check(st["scene"] == "playing", "scene is playing")
        check(st["level"]["id"] == "test" and st["level"]["size"] == {"x": 48, "y": 18}, "level id/size reported")
        settle(pg)
        harness.shot(pg, "level_spawn")

        # Walking
        p0 = harness.state(pg)["player"]["pos"]
        harness.hold(pg, "KeyD", 0.6)
        p1 = harness.state(pg)["player"]["pos"]
        check(p1["x"] > p0["x"] + 1, f"D walks right ({p0['x']:.2f} -> {p1['x']:.2f})")
        harness.hold(pg, "KeyA", 0.4)
        p2 = harness.state(pg)["player"]["pos"]
        check(p2["x"] < p1["x"], f"A walks left ({p1['x']:.2f} -> {p2['x']:.2f})")
        check(harness.state(pg)["player"]["grounded"], "grounded on ground")

        # Hop
        harness.tap(pg, "Space")
        time.sleep(0.15)
        check(not harness.state(pg)["player"]["grounded"], "Space leaves the ground")
        settle(pg, 1)

        # One-way platform: '=' at row 12, cols 35-37 (top at world y 6) is within one jump of the
        # ground (apex ~2.5 tiles). Jump from underneath: must pass through, then land on top.
        pg.evaluate("__sammy.commands.teleport(36.5, 5.5)")
        settle(pg, 0.8)
        y_ground = harness.state(pg)["player"]["pos"]["y"]
        reached = y_ground
        for _ in range(6):
            harness.tap(pg, "Space")
            time.sleep(0.9)
            reached = max(reached, harness.state(pg)["player"]["pos"]["y"])
            if harness.state(pg)["player"]["pos"]["y"] > 6.2:
                break
        yv = harness.state(pg)["player"]["pos"]["y"]
        check(yv > 6.2, f"jumped up through platform from below and landed on top (y {y_ground:.2f} -> {yv:.2f})")
        harness.shot(pg, "level_platform_top")
        # Stand on it, then drop: no down-through (S not required); just verify it supports.
        check(harness.state(pg)["player"]["grounded"], "standing on one-way platform")
        # Walk off the platform side and fall back to ground
        harness.hold(pg, "KeyA", 0.8)
        settle(pg, 1.2)
        # Walking into a platform's side from the ground must not be blocked (one-way).
        pg.evaluate("__sammy.commands.teleport(33, 5)")
        settle(pg, 0.6)
        x0 = harness.state(pg)["player"]["pos"]["x"]
        harness.hold(pg, "KeyD", 0.7)
        x1 = harness.state(pg)["player"]["pos"]["x"]
        check(x1 > x0 + 1.5, f"walks under platform unblocked ({x0:.2f} -> {x1:.2f})")

        # Falling off the world: gap at cols 18-21 (x 18..22). Place above gap.
        pg.evaluate("__sammy.commands.teleport(20, 6)")
        n_before = len(ev(pg, "correction"))
        low = 99
        t0 = time.time()
        while time.time() - t0 < 4:
            y = harness.state(pg)["player"]["pos"]["y"]
            low = min(low, y)
            if y > 3.5 and time.time() - t0 > 0.5:
                break
            time.sleep(0.05)
        st = harness.state(pg)
        print("fell: lowest y", low, "now", st["player"]["pos"])
        corr = ev(pg, "correction:triggered")
        check(low < 0, f"fell below world bottom (lowest y {low:.2f})")
        check(len(corr) > n_before and "world-bottom" in str(corr[-1]), f"correction world-bottom emitted: {corr[-1:] }")
        sp = st["player"]["pos"]
        check(sp["y"] > 3 and sp["x"] < 10, f"box reset near spawn: {sp}")
        wait_correction_done(pg)

        # Checkpoint (x24-26, y 4-7) and exit (x46-48)
        pg.evaluate("__sammy.commands.teleport(20.5, 4.5)")  # not on gap? col 20 is gap; use ground col 25 instead
        pg.evaluate("__sammy.commands.teleport(22.5, 5)")
        settle(pg, 0.5)
        harness.hold(pg, "KeyD", 1.2)
        cp = ev(pg, "checkpoint:reached")
        check(len(cp) == 1 and "middle" in str(cp[0]), f"checkpoint:reached once: {cp}")
        harness.hold(pg, "KeyA", 0.6)
        harness.hold(pg, "KeyD", 0.8)
        check(len(ev(pg, "checkpoint:reached")) == 1, "checkpoint does not re-fire")
        harness.shot(pg, "level_checkpoint")
        # fall again: respawn should be at checkpoint now
        pg.evaluate("__sammy.commands.teleport(20, 6)")
        time.sleep(1)
        wait_correction_done(pg)
        rp = harness.state(pg)["player"]["pos"]
        print("respawn after checkpoint:", rp)
        check(rp["x"] > 20, f"respawn moved to checkpoint after reaching it (x={rp['x']:.1f})")

        pg.evaluate("__sammy.commands.teleport(44.5, 6)")
        settle(pg, 0.5)
        harness.hold(pg, "KeyD", 1.5)  # into the exit zone and on into the invisible right wall
        settle(pg, 3)
        pr = harness.state(pg)["player"]
        check(pr["pos"]["x"] <= 48 - pr["size"]["x"] / 2 + 0.01 and pr["grounded"],
              f"right wall keeps the box inside the level ({pr['pos']['x']:.2f})")
        harness.shot(pg, "level_right_edge")
        cam = harness.state(pg)["camera"]
        print("camera right:", cam)
        check(len(ev(pg, "level:complete")) >= 1, "level:complete emitted at exit")
        check(len(ev(pg, "narration:zone")) >= 0, "(narration events checked below)")

        # Camera clamping. view half-width in tiles = 1920/64/2 = 15; half-height = 1080/64/2 = 8.4375
        hw, hh = 1920 / cam["scale"] / 2, 1080 / cam["scale"] / 2
        check(cam["pos"]["x"] <= 48 - hw + 0.05 and cam['pos']['x'] >= 48 - hw - 0.5, f"camera x clamped at right edge (x={cam['pos']['x']:.2f} <= {48 - hw:.2f})")
        pg.evaluate("__sammy.commands.teleport(2.5, 5.5)")
        settle(pg, 3)
        harness.hold(pg, "KeyA", 1.5)   # walk into the invisible left wall
        settle(pg, 3)
        pl = harness.state(pg)["player"]
        check(pl["pos"]["x"] >= pl["size"]["x"] / 2 - 0.01 and pl["grounded"],
              f"left wall keeps the box inside the level ({pl['pos']['x']:.2f})")
        cam = harness.state(pg)["camera"]
        harness.shot(pg, "level_left_edge")
        check(cam["pos"]["x"] <= hw + 0.5 and cam['pos']['x'] >= hw - 0.05, f"camera x clamped at left edge (x={cam['pos']['x']:.2f} >= {hw:.2f})")
        check(cam["pos"]["y"] >= hh - 0.05 and cam["pos"]["y"] <= 18 - hh + 0.05 or 18 < 2 * hh,
              f"camera y within bounds (y={cam['pos']['y']:.2f})")

        # Ceiling: jump from just under the top of the map; the head must stop at y = 18.
        pg.evaluate("__sammy.commands.teleport(6, 16.5)")
        # Launch it upward hard (no debug command for velocity, so reach the object directly).
        pg.evaluate("""async () => {
            const e = await import('/lib/littlejs/littlejs.esm.js');
            e.engineObjects.find(o => o.resetTo).velocity.y = 0.6;
        }""")
        top = 0
        t0 = time.time()
        while time.time() - t0 < 0.6:
            p = harness.state(pg)["player"]
            top = max(top, p["pos"]["y"] + p["size"]["y"] / 2)
            time.sleep(0.03)
        check(top <= 18.01, f"ceiling keeps the box below the top of the map (top {top:.2f})")

        # Narration zone
        pg.evaluate("__sammy.commands.teleport(5.5, 5)")
        time.sleep(0.8)
        check(len(ev(pg, "narration:zone")) >= 1, "narration:zone emitted")

        # loadLevel command
        pg.evaluate("__sammy.commands.loadLevel('test')")
        time.sleep(1)
        wait_loaded(pg)
        check(harness.state(pg)["level"]["id"] == "test", "loadLevel reloads")
        pg.evaluate("__sammy.commands.loadLevel('nope')")
        time.sleep(1)
        print("bad level:", harness.state(pg)["level"])

    errs = [e for e in s.errors]
    print("console errors:", errs)
    fails += [e for e in errs if "nope" not in e and "404" not in e]
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
