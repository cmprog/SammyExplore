"""T-004 Sammy controller scenario (test level), driven by real key presses.

Covers: jump height, variable jump (tap vs hold), coyote time, jump buffering, flap charges
(decrement, flapEmpty, refill on landing and in the air), glide capping fall speed, glide ratio,
player:glideEnd on every exit (release, flap, land, teleport/reset, correction), and the
player:land impact range. Prints the measured movement numbers for tuning.js.

Measurement: a test-side listener on the game's event bus logs player events with the player
state at that moment, and a requestAnimationFrame sampler records __sammy.player every frame.
Inputs are real Playwright key presses (teleport only sets up tests), except one frame-exact
Space press in test_jump_buffer_thin_platform, dispatched in-page because it must hit one step.

Test level geometry (world units, y up): ground top y=4 for x<18; the hill x 7..13 has its top
at y=6; ceiling at y=18. Sammy's hitbox is 0.8 x 0.9, so pos.y = feet + 0.45.
"""
import sys
import time

import harness

GROUND_Y = 4.0
HALF_H = 0.45
HEIGHT_CEILING = 5.95   # jump + 3 flaps at the best possible timing (tuning.js says ~5.9)
fails = []
numbers = {}


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


RECORDER = """async () => {
    const bus = await import('/src/core/events.js');
    const t = window.__t = { log: [], samples: [] };
    const names = ['player:jump', 'player:flap', 'player:flapEmpty', 'player:glideStart',
                   'player:glideEnd', 'player:land', 'correction:triggered', 'correction:reset'];
    for (const n of names)
        bus.on(n, d => t.log.push({ n, d, p: window.__sammy.player, i: t.samples.length }));
    const loop = () => {
        const p = window.__sammy.player;
        if (p) t.samples.push(p);
        requestAnimationFrame(loop);
    };
    loop();
}"""


def clear(pg):
    pg.evaluate("window.__t.log = []; window.__t.samples = []")


def log(pg):
    return pg.evaluate("window.__t.log")


def samples(pg):
    return pg.evaluate("window.__t.samples")


def names(entries):
    return [e["n"] for e in entries]


def player(pg):
    return harness.state(pg)["player"]


def feet(p):
    return p["pos"]["y"] - HALF_H


def wait_js(pg, expr, timeout=5):
    pg.wait_for_function(expr, timeout=timeout * 1000, polling="raf")


def stand_at(pg, x, feet_y=GROUND_Y):
    """Teleport onto the ground and wait until Sammy is grounded and still."""
    pg.evaluate(f"__sammy.commands.teleport({x}, {feet_y + HALF_H})")
    wait_js(pg, "__sammy.player.grounded && __sammy.player.state === 'idle'")
    time.sleep(0.15)


def wait_grounded(pg, timeout=6):
    time.sleep(0.05)
    wait_js(pg, "__sammy.player.grounded", timeout)


def apex(pg, base_feet):
    return max(feet(s) for s in samples(pg)) - base_feet


def test_jump_heights(pg):
    stand_at(pg, 3)
    clear(pg)
    harness.hold(pg, "Space", 0.6)
    wait_grounded(pg)
    full = apex(pg, GROUND_Y)
    numbers["jump apex (held)"] = full
    check(2.3 <= full <= 2.9, f"held jump apex ~2.5 tiles ({full:.2f})")
    check("player:jump" in names(log(pg)), "player:jump emitted")
    full_impact = next(e["d"]["impact"] for e in log(pg) if e["n"] == "player:land")
    numbers["full jump landing impact"] = full_impact
    run = [s for s in samples(pg) if s["state"] == "jump"]
    check(len(run) > 0, "state 'jump' seen while rising")

    stand_at(pg, 3)
    clear(pg)
    harness.tap(pg, "Space")
    wait_grounded(pg)
    short = apex(pg, GROUND_Y)
    numbers["jump apex (tapped)"] = short
    check(short < full * 0.7, f"variable jump: a tap is clearly lower ({short:.2f} vs {full:.2f})")
    lands = [e for e in log(pg) if e["n"] == "player:land"]
    hop_impact = lands[0]["d"]["impact"] if lands else None
    numbers["hop landing impact"] = hop_impact
    check(len(lands) == 1 and hop_impact < full_impact,
          f"a hop lands softer than a full jump (impact {hop_impact} < {full_impact})")


def test_run(pg):
    stand_at(pg, 2)
    clear(pg)
    harness.hold(pg, "KeyD", 0.5)
    s = samples(pg)
    top = max(x["vel"]["x"] for x in s)
    numbers["run speed (tiles/s)"] = top * 60
    check(abs(top - 0.14) < 0.005, f"run reaches RUN_SPEED ({top:.3f}/step)")
    check(any(x["state"] == "run" for x in s), "state 'run' while moving")
    time.sleep(0.3)
    p = player(pg)
    check(abs(p["vel"]["x"]) < 0.001 and p["state"] == "idle", f"friction stops Sammy, back to idle ({p['state']})")
    check(p["facing"] == 1, "facing right after moving right")
    harness.hold(pg, "KeyA", 0.15)
    check(player(pg)["facing"] == -1, "facing left after pressing A")


def test_coyote(pg):
    # Walk right off the hill (top y=6, right edge x=13) and press Space just after leaving it.
    stand_at(pg, 12, 6)
    clear(pg)
    pg.keyboard.down("KeyD")
    wait_js(pg, "!__sammy.player.grounded")
    pg.keyboard.down("Space")
    time.sleep(0.3)
    pg.keyboard.up("Space")
    pg.keyboard.up("KeyD")
    wait_grounded(pg)
    ev = log(pg)
    jumps = [e for e in ev if e["n"] == "player:jump"]
    check(len(jumps) == 1 and "player:flap" not in names(ev),
          f"coyote: Space just after walking off a ledge jumps, not flaps ({names(ev)})")
    if jumps:
        s = samples(pg)
        left_at = next(i for i, x in enumerate(s) if not x["grounded"])
        frames = jumps[0]["i"] - left_at
        numbers["coyote jump, frames after leaving ledge"] = frames
        check(0 <= frames <= 6, f"coyote jump came {frames} frames after leaving the ledge")
        check(apex(pg, 6) > 2.0, f"coyote jump is a full jump ({apex(pg, 6):.2f} above the ledge)")

    # Too late: past the coyote window the press is a flap. Walk off the floating island
    # (top y=11, right edge x=31) so there's a long drop below.
    stand_at(pg, 30, 11)
    clear(pg)
    pg.keyboard.down("KeyD")
    wait_js(pg, "!__sammy.player.grounded")
    time.sleep(0.2)
    harness.tap(pg, "Space")
    pg.keyboard.up("KeyD")
    wait_grounded(pg)
    ev = names(log(pg))
    check("player:flap" in ev and "player:jump" not in ev, f"after the coyote window, Space flaps ({ev})")


def test_jump_buffer(pg):
    stand_at(pg, 3)
    pg.evaluate(f"__sammy.commands.teleport(3, {GROUND_Y + 6})")
    clear(pg)
    # Press while still falling, just above the ground.
    wait_js(pg, f"!__sammy.player.grounded && __sammy.player.vel.y < 0 && __sammy.player.pos.y - {HALF_H} < {GROUND_Y + 1.0}")
    pressed_at = player(pg)
    pg.keyboard.down("Space")
    time.sleep(0.5)
    pg.keyboard.up("Space")
    wait_grounded(pg)
    ev = log(pg)
    seq = names(ev)
    print("   buffer press at feet", round(feet(pressed_at), 2), "grounded", pressed_at["grounded"], seq)
    check(not pressed_at["grounded"], "buffer press happened in the air")
    check("player:flap" not in seq and "player:jump" in seq and seq.index("player:land") < seq.index("player:jump"),
          f"jump buffer: press just before landing jumps on touchdown ({seq})")
    if "player:jump" in seq:
        land_i = next(e["i"] for e in ev if e["n"] == "player:land")
        jump_i = next(e["i"] for e in ev if e["n"] == "player:jump")
        check(jump_i - land_i <= 1, f"buffered jump fires on the landing frame ({jump_i - land_i} frames later)")


FRAME_EXACT_PRESS = """([top, half]) => new Promise(resolve => {
    // Watch every frame; when the NEXT physics step leaves Sammy airborne but under one step
    // above the platform, press Space so the update that reads it is the last one before
    // touchdown. Dispatched on document, where LittleJS listens, between engine steps.
    const watch = () => {
        const p = window.__sammy.player;
        const gap = p.pos.y - half - top;
        const step = -p.vel.y;
        if (!p.grounded && step > 0.3 && gap >= step && gap < 2 * step) {
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), 300);
            resolve({ gap, step });
            return;
        }
        if (p.grounded && gap < 0.01) { resolve(null); return; }
        requestAnimationFrame(watch);
    };
    watch();
})"""


def test_jump_buffer_thin_platform(pg):
    # Fall at full speed onto the one-way "=" platform over the gap (x 18..22, top y=7, nothing
    # below it) with Space pressed on the last step before touchdown. That press must wait for
    # the landing and jump, not flap. (Over solid ground the old probe was rescued by the ground.)
    # The one synthetic key event in this file: Playwright's key latency can't hit one frame.
    platform_top = 7.0
    stand_at(pg, 20, platform_top)
    pg.evaluate("__sammy.commands.teleport(20, 16)")
    clear(pg)
    pressed = pg.evaluate(FRAME_EXACT_PRESS, [platform_top, HALF_H])
    time.sleep(0.5)
    wait_grounded(pg)
    ev = log(pg)
    seq = names(ev)
    print(f"   frame-exact press: {pressed} {seq}")
    check(pressed is not None, "pressed Space on the last frame before touchdown")
    check("player:flap" not in seq and "player:jump" in seq and seq.index("player:land") < seq.index("player:jump"),
          f"thin platform at full fall speed: last-frame press jumps, not flaps ({seq})")
    lands = [e for e in ev if e["n"] == "player:land"]
    check(bool(lands) and abs(lands[0]["p"]["pos"]["y"] - HALF_H - platform_top) < 0.01,
          "landed on the platform, not the ground below")
    ring = harness.state(pg)["events"]
    jump_frame = next((e["frame"] for e in reversed(ring) if e["name"] == "player:jump"), None)
    land_frame = next((e["frame"] for e in reversed(ring)
                       if e["name"] == "player:land" and jump_frame is not None and e["frame"] <= jump_frame), None)
    check(land_frame is not None and jump_frame == land_frame,
          f"the jump fires on the touchdown frame (land {land_frame}, jump {jump_frame})")


def test_flaps(pg):
    stand_at(pg, 3)
    clear(pg)
    pg.keyboard.down("Space")
    time.sleep(0.4)          # held: a full jump, not cut short
    pg.keyboard.up("Space")
    charges = []
    for _ in range(3):
        wait_js(pg, "__sammy.player.vel.y <= 0")   # flap at the top of each rise: best timing
        harness.tap(pg, "Space")
        time.sleep(0.05)
        charges.append(player(pg)["flapCharges"])
    best = apex(pg, GROUND_Y)
    harness.tap(pg, "Space")
    time.sleep(0.05)
    ev = log(pg)
    flaps = [e["d"]["chargesLeft"] for e in ev if e["n"] == "player:flap"]
    check(flaps == [2, 1, 0] and charges == [2, 1, 0], f"flap charges count down 2,1,0 (events {flaps}, state {charges})")
    check(names(ev).count("player:flapEmpty") == 1, "4th press with no charges emits player:flapEmpty once")
    check(any(s["state"] == "flap" for s in samples(pg)), "state 'flap' seen")
    numbers["jump + 3 flaps at apex (height)"] = best
    numbers["flap gain total (best timing)"] = best - numbers["jump apex (held)"]
    # By-eye timing through Playwright lands a few steps past each apex, so allow down to 4.6.
    check(4.6 <= best <= HEIGHT_CEILING, f"jump + 3 flaps near the apex reaches 4.6-5.9 tiles ({best:.2f})")
    wait_grounded(pg)
    check(player(pg)["flapCharges"] == 3, "landing refills flap charges to 3")

    # Mashing: tap every 0.12 s from the ground. Must not rocket past the best-timing height.
    stand_at(pg, 3)
    clear(pg)
    for _ in range(6):
        harness.tap(pg, "Space")
        time.sleep(0.04)
    wait_grounded(pg)
    mash = apex(pg, GROUND_Y)
    numbers["mashing Space (height)"] = mash
    check(mash <= HEIGHT_CEILING, f"mashing stays under the height ceiling ({mash:.2f} <= {HEIGHT_CEILING})")


def test_air_refill_and_glide(pg):
    # Use all flaps high up, then glide. One charge comes back after 3 s in the air.
    stand_at(pg, 3)
    pg.evaluate("__sammy.commands.teleport(3, 13)")
    clear(pg)
    for _ in range(3):
        harness.tap(pg, "Space")
        time.sleep(0.17)
    check(player(pg)["flapCharges"] == 0, "all flaps used")
    pg.keyboard.down("Space")   # glide straight down: ~12 tiles at 3.3 tiles/s
    t0 = time.time()
    refilled = False
    while time.time() - t0 < 4.0 and not player(pg)["grounded"]:
        if player(pg)["flapCharges"] == 1:
            refilled = True
            break
        time.sleep(0.05)
    check(refilled, "a flap charge refills while airborne")
    ev = names(log(pg))
    check(ev.count("player:glideStart") == 1, f"glideStart once ({ev.count('player:glideStart')})")
    glide_steady = [x["vel"]["y"] for x in samples(pg) if x["state"] == "glide"][30:]
    check(bool(glide_steady) and all(-0.0555 <= v <= -0.0545 for v in glide_steady),
          f"glide holds fall speed at 0.055/step ({min(glide_steady, default=0):.4f})")

    # glideEnd on release
    clear(pg)
    pg.keyboard.up("Space")
    time.sleep(0.1)
    ev = names(log(pg))
    check(ev[:1] == ["player:glideEnd"] and player(pg)["state"] == "fall", f"releasing Space ends the glide ({ev})")
    time.sleep(0.4)
    falls = [x["vel"]["y"] for x in samples(pg)]
    numbers["fall speed without glide, after 0.5 s (tiles/s)"] = -min(falls) * 60
    check(min(falls) < -0.2, f"without gliding, Sammy falls fast ({min(falls):.3f}/step)")
    wait_grounded(pg)


def test_glide_ratio(pg):
    stand_at(pg, 3)
    pg.evaluate("__sammy.commands.teleport(3, 16)")
    clear(pg)
    pg.keyboard.down("Space")   # flap, then glide
    pg.keyboard.down("KeyD")
    time.sleep(1.4)
    pg.keyboard.up("KeyD")
    pg.keyboard.up("Space")
    wait_grounded(pg)
    glide = [x for x in samples(pg) if x["state"] == "glide"]
    # Skip the first third (the glide brake settling). Samples are per rendered frame, so their
    # count depends on the headless frame rate (~27 fps here); fixed indices were too tight.
    steady = glide[len(glide) // 3:]
    if len(steady) < 5:
        check(False, f"enough steady glide samples to measure ({len(steady)} of {len(glide)} glide samples; need 5)")
    else:
        vy = sum(x["vel"]["y"] for x in steady) / len(steady)
        vx = sum(x["vel"]["x"] for x in steady) / len(steady)
        dy = steady[0]["pos"]["y"] - steady[-1]["pos"]["y"]
        dx = steady[-1]["pos"]["x"] - steady[0]["pos"]["x"]
        numbers["glide fall speed (tiles/s)"] = -vy * 60
        numbers["glide sideways speed (tiles/s)"] = vx * 60
        numbers["glide tiles across per tile dropped"] = dx / dy if dy else None
        check(-0.06 <= vy <= -0.05, f"glide caps fall speed at ~0.055/step ({vy:.4f})")
        check(dx / dy > 2.2 if dy else False, f"glide covers distance ({dx:.2f} across, {dy:.2f} down)")


def test_glide_exits(pg):
    def glide_from_jump():
        stand_at(pg, 3)
        clear(pg)
        pg.keyboard.down("Space")
        wait_js(pg, "__sammy.player.gliding")

    # Land while gliding.
    glide_from_jump()
    wait_grounded(pg)
    pg.keyboard.up("Space")
    ev = log(pg)
    seq = names(ev)
    check(seq.count("player:glideEnd") == 1 and seq.index("player:glideEnd") < seq.index("player:land"),
          f"landing while gliding: glideEnd then land ({seq})")
    lands = [e for e in ev if e["n"] == "player:land"]
    numbers["glide landing impact"] = lands[0]["d"]["impact"] if lands else None

    # Flap while gliding (release and re-press quickly).
    glide_from_jump()
    pg.keyboard.up("Space")
    pg.keyboard.down("Space")
    time.sleep(0.1)
    pg.keyboard.up("Space")
    seq = names(log(pg))
    check("player:glideEnd" in seq and "player:flap" in seq and seq.index("player:glideEnd") < seq.index("player:flap"),
          f"re-pressing Space while gliding: glideEnd before flap ({seq})")
    wait_grounded(pg)

    # Teleport (Sammy.resetTo) while gliding: glideEnd must come from the reset itself, in the
    # same call. Space stays held, so a fresh glide after the teleport is legitimate.
    glide_from_jump()
    during = pg.evaluate("""() => {
        const n = __t.log.length;
        __sammy.commands.teleport(5, 10);
        return __t.log.slice(n).map(e => e.n);
    }""")
    check(during == ["player:glideEnd"], f"teleport/reset while gliding emits glideEnd immediately ({during})")
    time.sleep(0.05)
    pg.keyboard.up("Space")
    wait_grounded(pg)
    seq = names(log(pg))
    check(seq.count("player:glideStart") == seq.count("player:glideEnd"),
          f"glide starts and ends balance after a teleport ({seq})")

    # Glide off the world: the correction locks input and resets; glideEnd must fire once.
    pg.evaluate("__sammy.commands.teleport(16.5, 6)")
    wait_grounded(pg)
    clear(pg)
    pg.keyboard.down("KeyD")
    pg.keyboard.down("Space")
    time.sleep(0.25)
    pg.keyboard.up("KeyD")
    wait_js(pg, "__sammy.player.gliding")
    pg.evaluate("__sammy.commands.teleport(20, 2)")   # over the gap, below the ground: falls off the world
    wait_js(pg, "__sammy.narrator.correction !== null", 5)
    pg.keyboard.up("Space")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    seq = names(log(pg))
    check(seq.count("player:glideStart") == seq.count("player:glideEnd"),
          f"glide starts and ends balance through a correction ({seq})")


def test_glide_into_correction(pg):
    # Glide down into the gap (x 18..22) and off the world; input locks mid-glide.
    stand_at(pg, 3)
    pg.evaluate("__sammy.commands.teleport(18.5, 6)")   # clear of the one-way platforms either side
    clear(pg)
    pg.keyboard.down("Space")   # flap, then glide straight down
    wait_js(pg, "__sammy.narrator.correction !== null", 15)
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    pg.keyboard.up("Space")
    seq = names(log(pg))
    starts, ends = seq.count("player:glideStart"), seq.count("player:glideEnd")
    check(starts >= 1 and starts == ends, f"gliding into a correction: glideEnd fires ({starts} starts, {ends} ends)")
    p = player(pg)
    check(p["pos"]["x"] < 10 and not p["gliding"], f"reset to spawn, not gliding ({p['pos']})")


def test_impacts(pg):
    stand_at(pg, 3)
    pg.evaluate("__sammy.commands.teleport(3, 17)")
    clear(pg)
    wait_grounded(pg)
    lands = [e["d"]["impact"] for e in log(pg) if e["n"] == "player:land"]
    numbers["impact after a 12.5-tile fall"] = lands[0] if lands else None
    check(len(lands) == 1 and lands[0] >= 0.95, f"a long fall lands hard (impact {lands})")
    check(any(s["state"] == "land" for s in samples(pg)), "state 'land' seen after landing")


def main():
    with harness.session() as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate(RECORDER)
        time.sleep(0.5)
        check(player(pg)["state"] == "idle" and player(pg)["flapCharges"] == 3, "starts idle with 3 flaps")
        all_impacts = []
        seen_states = set()
        for test in (test_run, test_jump_heights, test_coyote, test_jump_buffer,
                     test_jump_buffer_thin_platform, test_flaps,
                     test_air_refill_and_glide, test_glide_ratio, test_glide_exits, test_glide_into_correction, test_impacts):
            print(f"-- {test.__name__}")
            try:
                test(pg)
            except Exception as error:   # keep going so one timeout doesn't hide the rest
                check(False, f"{test.__name__} raised {type(error).__name__}: {str(error).splitlines()[0]}")
            for key in ("Space", "KeyD", "KeyA"):   # never leak a held key into the next test
                pg.keyboard.up(key)
            all_impacts += [e["d"]["impact"] for e in log(pg) if e["n"] == "player:land"]
            seen_states |= {x["state"] for x in samples(pg)}
        harness.shot(pg, "sammy_end")
        check(all(0 <= i <= 1 for i in all_impacts) and len(all_impacts) > 0,
              f"every player:land impact is within 0..1 ({min(all_impacts):.2f}..{max(all_impacts):.2f})")
        expected = {"idle", "run", "jump", "fall", "glide", "flap", "land"}
        check(expected <= seen_states, f"all states seen ({sorted(seen_states)})")

    print("\nMeasured movement:")
    for key, value in numbers.items():
        print(f"  {key}: {value:.3f}" if isinstance(value, float) else f"  {key}: {value}")
    print("console errors:", s.errors)
    all_fails = fails + s.errors
    print("FAIL" if all_fails else "PASS", all_fails)
    return 1 if all_fails else 0


if __name__ == "__main__":
    sys.exit(main())
