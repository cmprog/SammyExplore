"""T-011b full playthrough of the M1 sandbox ("Chapter One"), from the title screen home to the bedroom (T-017).

Every input is a real Playwright key press (keyboard.down/up); there are NO debug teleports. Timing:
the script waits on conditions checked once per engine step, in page (a wrapped Sammy.update), so a
jump goes off at the right spot no matter how fast headless Chrome renders. Narrator lines are
dismissed with Enter once fully shown (a fast reader), and E is only pressed with no line up, since
E on a showing line advances it instead of interacting.

Beats (each with a screenshot in tools/playtest/out/sandbox_NN_*.png):
  title -> New Game -> intro -> go LEFT (ignored-instruction gag) -> into the nook (correction)
  -> chapter sign -> Twyx (approach line, pet twice) -> meadow checkpoint (autosave) -> hops
  (hill, pit, planks) -> cliff (jump + flaps, twice) -> clifftop checkpoint -> perch sign ->
  Eagle's Perch (correction) -> Great Gap hint -> a flaps-only attempt that falls short (the gap
  correction and its glide hint) -> the glide across -> far-side checkpoint -> locked door (up on
  the ledge) -> tunnel door -> last pit -> exit door -> level complete (the continue prompt waits
  for the narrator's last line; Space while it types finishes it) -> Chapter One completed -> the swirl
  home -> the bedroom (arrival line, Chapter One saved as completed, the portal showing it) -> Quit to
  Title -> New Game again (the whole story is told fresh) -> a Continue-style load at a checkpoint (the
  resume line, not the intro).

    .venv/Scripts/python tools/playtest/sandbox_playthrough.py
"""
import json
import sys
import time

import harness

fails = []
lines_seen = []   # (id, text) in the order the narrator showed them
shots = []
beat_no = [0]

# Level geometry (world units, y up), from src/data/levels/sandbox.js.
HALF_H = 0.45
GROUND = 7.0
CLIFF_LEDGE = 11.0
CLIFF_TOP = 14.0
FAR_SIDE = 9.0
GAP_EDGE = 107.0      # last tile of the clifftop ends here
GAP_FAR = 126.0       # first tile of the far side starts here


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


PILOT = """async () => {
    // Per-step condition waits and an event log. Wraps Sammy.prototype.update (runs once per
    // engine step while playing; the same class survives level reloads).
    const { Sammy } = await import('/src/entities/Sammy.js');
    const bus = await import('/src/core/events.js');
    const log = window.__log = [];
    const names = ['level:start', 'level:complete', 'checkpoint:reached', 'correction:triggered',
        'correction:reset', 'correction:done', 'narration:zone', 'narrator:line', 'player:jump',
        'player:flap', 'player:flapEmpty', 'player:glideStart', 'player:glideEnd', 'player:land',
        'interact:sign', 'interact:twyx', 'interact:door', 'interact:doorLocked', 'interact:nothing',
        'door:open', 'scene:change', 'narrator:revealed', 'narrator:skip', 'chapter:complete'];
    for (const n of names)
        bus.on(n, d => {
            const p = window.__pilotSammy;
            log.push({ n, d, x: p ? p.pos.x : null, y: p ? p.pos.y : null });
        });
    window.__waiters = [];
    const orig = Sammy.prototype.update;
    Sammy.prototype.update = function (...a) {
        const r = orig.apply(this, a);
        window.__pilotSammy = this;
        for (const w of window.__waiters.slice()) {
            let ok = false;
            try { ok = w.f(this); } catch (e) { ok = false; }
            if (ok) {
                window.__waiters.splice(window.__waiters.indexOf(w), 1);
                w.res({ x: this.pos.x, y: this.pos.y, vy: this.velocity.y, grounded: this.grounded });
            }
        }
        return r;
    };
    window.__waitStep = (src, ms) => new Promise((res, rej) => {
        const w = { f: new Function('p', 'return (' + src + ')'), res };
        window.__waiters.push(w);
        setTimeout(() => {
            const i = window.__waiters.indexOf(w);
            if (i >= 0) { window.__waiters.splice(i, 1); rej(new Error('timed out waiting for: ' + src)); }
        }, ms);
    });
}"""


# --- helpers ----------------------------------------------------------------------------------

def st(pg):
    return harness.state(pg)


def until(pg, cond, timeout=10):
    """Wait for a JS condition on Sammy (`p`, the live Sammy object), checked every engine step."""
    return pg.evaluate("([c, ms]) => window.__waitStep(c, ms)", [cond, int(timeout * 1000)])


def log(pg):
    return pg.evaluate("window.__log")


def events(pg, name, since=0):
    return [e for e in log(pg)[since:] if e["n"] == name]


def mark(pg):
    return pg.evaluate("window.__log.length")


def shot(pg, name):
    beat_no[0] += 1
    path = harness.shot(pg, f"sandbox_{beat_no[0]:02d}_{name}")
    shots.append(str(path))
    return path


def narrator(pg):
    return st(pg)["narrator"]


def wait_line(pg, line_id, shot_name=None, timeout=12):
    """Wait until `line_id` is fully shown (screenshot it), then return its text."""
    pg.wait_for_function(
        "id => { const c = window.__sammy.narrator.current; return c && c.id === id && c.revealed; }",
        arg=line_id, timeout=timeout * 1000, polling="raf")
    current = narrator(pg)["current"]
    if shot_name:
        shot(pg, shot_name)
    return current["text"]


def settle(pg, timeout=40):
    """Read and dismiss every queued line (Enter once each is fully shown) and let any correction
    finish, so the next E press interacts instead of advancing a line."""
    end = time.time() + timeout
    while time.time() < end:
        n = narrator(pg)
        current = n["current"]
        if n["correction"] is None and current is None and n["queueLength"] == 0:
            time.sleep(0.4)   # the breath between lines: a queued line may still be about to start
            n = narrator(pg)
            if n["current"] is None and n["queueLength"] == 0 and n["correction"] is None:
                return
            continue
        if current and current["revealed"] and n["correction"] is None:
            harness.tap(pg, "Enter")
        time.sleep(0.15)
    check(False, "narration settled within the time limit")


def hold(pg, *keys):
    for key in keys:
        pg.keyboard.down(key)


def release(pg, *keys):
    for key in keys:
        pg.keyboard.up(key)


def release_all(pg):
    release(pg, "KeyA", "KeyD", "Space", "KeyE")


def walk_to(pg, x, timeout=15):
    """Walk (left or right) until Sammy's center passes x, then let go and wait to stop."""
    here = st(pg)["player"]["pos"]["x"]
    if abs(here - x) < 0.15:
        return
    key, cond = ("KeyD", f"p.pos.x >= {x} - 0.35") if x > here else ("KeyA", f"p.pos.x <= {x} + 0.35")
    hold(pg, key)
    try:
        until(pg, cond, timeout)
    finally:
        release(pg, key)
    until(pg, "p.grounded && Math.abs(p.velocity.x) < 0.001", 5)


def walk_into_wall(pg, key="KeyD"):
    """Walk until something (a wall, a closed door) stops Sammy."""
    hold(pg, key)
    try:
        # Pushing against a wall keeps a little velocity (the run acceleration), so watch for the
        # position to stop changing instead: grounded and still for 6 steps.
        until(pg, "(p.__stillSteps = Math.abs(p.pos.x - (p.__lastX ?? NaN)) < 1e-6 ? (p.__stillSteps || 0) + 1 : 0,"
                  " p.__lastX = p.pos.x, p.grounded && p.__stillSteps > 6)", 8)
    finally:
        release(pg, key)


def running_jump(pg, at_x, land_cond, timeout=8):
    """Hold right, jump (Space held through the rise) once Sammy passes at_x, keep running, and
    wait for land_cond. Space is released at the apex so no glide starts."""
    hold(pg, "KeyD")
    try:
        until(pg, f"p.pos.x >= {at_x}", timeout)
        hold(pg, "Space")
        until(pg, "!p.grounded && p.velocity.y <= 0.02", 3)
        release(pg, "Space")
        until(pg, land_cond, timeout)
    finally:
        release(pg, "KeyD", "Space")
    until(pg, "p.grounded && Math.abs(p.velocity.x) < 0.001", 5)


def climb(pg, top, key="KeyD"):
    """Pressed against a wall: jump, then flap at each apex until standing on `top`."""
    hold(pg, key)
    flaps = 0
    try:
        hold(pg, "Space")
        until(pg, "!p.grounded", 2)
        for _ in range(3):
            res = until(pg, f"(p.grounded && p.pos.y > {top}) || (!p.grounded && p.velocity.y <= 0)", 4)
            if res["grounded"]:
                break
            release(pg, "Space")
            time.sleep(0.02)
            hold(pg, "Space")        # a fresh press at the apex: a flap
            flaps += 1
        release(pg, "Space")
        until(pg, f"p.grounded && p.pos.y > {top}", 5)
    finally:
        release(pg, key, "Space")
    return flaps


def hop_up(pg, surface_y, stop_x=None, timeout=4):
    """Hold right and jump until standing on something at least as high as surface_y. With
    stop_x, let go of right once past it (so a short step isn't overshot)."""
    hold(pg, "KeyD", "Space")
    try:
        if stop_x is not None:
            until(pg, f"p.pos.x > {stop_x}", timeout)
            release(pg, "KeyD")
        until(pg, f"p.grounded && p.pos.y > {surface_y}", timeout)
    finally:
        release(pg, "KeyD", "Space")
    until(pg, "p.grounded && Math.abs(p.velocity.x) < 0.001", 5)


def press_e(pg):
    settle(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.2)


def surface(p):
    return round(p["pos"]["y"] - HALF_H, 2)


def player(pg):
    return st(pg)["player"]


def stored_save(pg):
    text = pg.evaluate("localStorage.getItem('sammyexplore.save')")
    return json.loads(text) if text else None


def line_ids(pg, since=0):
    return [e["d"]["id"] for e in events(pg, "narrator:line", since)]


# --- beats ----------------------------------------------------------------------------------

def beat_title(pg):
    pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
    time.sleep(1.2)
    shot(pg, "title")
    check(st(pg)["save"] is None, "fresh browser: no save, so New Game starts right away")
    harness.tap(pg, "Enter")   # New Game is the selected item
    harness.wait_scene(pg, "playing", 5)
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
    level = st(pg)["level"]
    check(level["id"] == "sandbox", f"New Game starts the sandbox ({level['id']})")
    check(stored_save(pg) is not None and stored_save(pg)["levelId"] == "sandbox", "New Game saved the start of the sandbox")


def beat_intro_and_nook(pg):
    wait_line(pg, "sandbox.intro", "intro")
    time.sleep(0.3)   # the goRight instruction arms once the line is fully shown
    check("goRight" in narrator(pg)["armedInstructions"], "the intro gives the go-RIGHT instruction")
    m = mark(pg)
    # Ignore it: go left.
    hold(pg, "KeyA")
    until(pg, "p.pos.x < 11.5", 5)
    release(pg, "KeyA")
    wait_line(pg, "sandbox.goRight.ignored", "ignored_gag")
    check("sandbox.goRight.ignored" in line_ids(pg, m), "going left plays the ignored-instruction gag")
    # Keep going left, down the dip and into the nook the narrator never wrote.
    hold(pg, "KeyA")
    try:
        pg.wait_for_function("window.__sammy.narrator.correction !== null", timeout=6000, polling="raf")
    finally:
        release(pg, "KeyA")
    time.sleep(0.5)
    shot(pg, "nook_correction")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    corr = events(pg, "correction:triggered", m)
    check(any(e["d"]["id"] == "nook" for e in corr), "walking into the nook triggers its correction")
    check("sandbox.nook" in line_ids(pg, m), "the nook correction says its own line")
    p = player(pg)
    check(abs(p["pos"]["x"] - 16.5) < 0.2 and surface(p) == GROUND, f"the correction puts Sammy back at the spawn ({p['pos']})")
    settle(pg)


def beat_sign_and_twyx(pg):
    m = mark(pg)
    walk_to(pg, 23.0)
    press_e(pg)
    wait_line(pg, "sandbox.sign.chapter.read", "chapter_sign")
    check(any(e["d"].get("id") == "chapter-sign" for e in events(pg, "interact:sign", m)), "E reads the chapter sign")
    settle(pg)

    walk_to(pg, 30.5)
    wait_line(pg, "sandbox.twyx.ahead", "twyx_ahead")
    settle(pg)
    walk_to(pg, 33.3)
    press_e(pg)
    time.sleep(0.4)
    shot(pg, "twyx_pet")
    wait_line(pg, "twyx.meet")
    settle(pg)
    press_e(pg)
    wait_line(pg, "twyx.hound", "twyx_hound")
    check(len(events(pg, "interact:twyx", m)) == 2, "Twyx petted twice")
    settle(pg)


def beat_meadow_checkpoint(pg):
    m = mark(pg)
    walk_to(pg, 41.5)
    wait_line(pg, "sandbox.checkpoint.meadow", "checkpoint_meadow")
    cps = events(pg, "checkpoint:reached", m)
    check([e["d"]["id"] for e in cps] == ["meadow"], f"meadow checkpoint reached ({[e['d']['id'] for e in cps]})")
    save = stored_save(pg)
    check(save and save["checkpointId"] == "meadow", f"autosaved at the meadow checkpoint ({save})")
    settle(pg)


def beat_hops(pg):
    m = mark(pg)
    walk_to(pg, 43.0)
    hold(pg, "KeyD")
    until(pg, "p.pos.x >= 44.2", 3)
    release(pg, "KeyD")
    wait_line(pg, "sandbox.hops", "hops")
    settle(pg)
    # Up onto the hill (surface 9), over pit 1, onto the planks, then the block.
    running_jump(pg, 44.6, "p.grounded && p.pos.x > 46")
    check(surface(player(pg)) == 9.0, f"onto the hill ({player(pg)['pos']})")
    walk_to(pg, 52.0)    # walks off the far side of the hill
    running_jump(pg, 53.3, "p.grounded && p.pos.x > 56")
    check(surface(player(pg)) == GROUND and player(pg)["pos"]["x"] > 57, f"over the first pit ({player(pg)['pos']})")
    walk_to(pg, 58.5)
    running_jump(pg, 60.2, "p.grounded && p.pos.x > 61")
    p = player(pg)
    check(surface(p) == 9.0 and 62 <= p["pos"]["x"] <= 65, f"onto the first plank ({p['pos']})")
    walk_to(pg, 62.4)
    running_jump(pg, 62.8, "p.grounded && p.pos.x > 65")
    p = player(pg)
    check(surface(p) == 10.0 and 66 <= p["pos"]["x"] <= 69, f"onto the second plank ({p['pos']})")
    shot(pg, "planks")
    walk_to(pg, 66.4)
    running_jump(pg, 66.8, "p.grounded && p.pos.x > 69")
    p = player(pg)
    check(surface(p) == 9.0 and 70 <= p["pos"]["x"] <= 75, f"onto the block past the planks ({p['pos']})")
    check(not events(pg, "correction:triggered", m), "no falls in the hops")


def beat_cliff(pg):
    m = mark(pg)
    walk_to(pg, 78.0)
    wait_line(pg, "sandbox.cliff", "cliff_hint")
    settle(pg)
    walk_into_wall(pg)
    flaps1 = climb(pg, CLIFF_LEDGE)
    shot(pg, "cliff_ledge")
    walk_into_wall(pg)
    flaps2 = climb(pg, CLIFF_TOP)
    flaps = events(pg, "player:flap", m)
    check(flaps1 >= 1 and flaps2 >= 1 and len(flaps) >= 2, f"the cliff needs flaps ({flaps1} + {flaps2}; {len(flaps)} player:flap)")
    check(surface(player(pg)) == CLIFF_TOP, f"on the clifftop ({player(pg)['pos']})")
    walk_to(pg, 91.5)
    wait_line(pg, "sandbox.checkpoint.clifftop", "clifftop")
    check(stored_save(pg)["checkpointId"] == "clifftop", "autosaved at the clifftop checkpoint")
    settle(pg)


def beat_perch(pg):
    m = mark(pg)
    walk_to(pg, 96.3)
    press_e(pg)
    wait_line(pg, "sandbox.sign.perch.read", "perch_sign")
    settle(pg)
    # Up through the one-way plank onto the Eagle's Perch.
    hold(pg, "Space")
    until(pg, "!p.grounded", 2)
    until(pg, "p.velocity.y <= 0", 3)
    release(pg, "Space")
    time.sleep(0.02)
    harness.tap(pg, "Space")
    pg.wait_for_function("window.__sammy.narrator.correction !== null", timeout=5000, polling="raf")
    shot(pg, "perch_reached")
    time.sleep(0.6)
    shot(pg, "perch_correction")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    corr = [e["d"]["id"] for e in events(pg, "correction:triggered", m)]
    check("eagles-perch" in corr, f"getting onto the Eagle's Perch is a correction ({corr})")
    check("sandbox.perch" in line_ids(pg, m), "the perch correction says its own line")
    p = player(pg)
    check(abs(p["pos"]["x"] - 91) < 0.2 and surface(p) == CLIFF_TOP, f"back at the clifftop checkpoint ({p['pos']})")
    settle(pg)


def beat_gap(pg):
    walk_to(pg, 102.0)
    wait_line(pg, "sandbox.leap", "gap_hint")
    settle(pg)

    # Attempt 1: flaps only (no glide), flapping each time Sammy sinks below the clifftop. Falls short.
    m = mark(pg)
    walk_to(pg, 100.0)
    hold(pg, "KeyD")
    try:
        until(pg, f"p.pos.x >= {GAP_EDGE - 0.6}", 4)
        hold(pg, "Space")
        until(pg, "!p.grounded && p.velocity.y <= 0.03", 3)
        release(pg, "Space")
        for _ in range(3):
            until(pg, f"p.velocity.y < 0 && p.pos.y < {CLIFF_TOP + HALF_H - 0.4}", 4)
            harness.tap(pg, "Space")
        shot(pg, "gap_flaps_only")
        sunk = until(pg, f"p.velocity.y < 0 && p.pos.y < {FAR_SIDE + HALF_H}", 6)
        pg.wait_for_function("window.__sammy.narrator.correction !== null", timeout=8000, polling="raf")
    finally:
        release(pg, "KeyD", "Space")
    time.sleep(0.3)
    shot(pg, "gap_fall_hint")
    pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=8000)
    reached = sunk["x"]   # where Sammy's feet dropped below the far side's ground
    flaps = events(pg, "player:flap", m)
    corr = [e["d"]["id"] for e in events(pg, "correction:triggered", m)]
    check(len(flaps) == 3 and not events(pg, "player:glideStart", m),
          f"attempt 1 used all 3 flaps and no glide ({len(flaps)} flaps)")
    # The gap's own correction zone sits above world-bottom, so it fires first (world-bottom may
    # follow while the page is being rewritten; the narrator ignores that one).
    check(corr[:1] == ["great-gap-fall"] and reached < GAP_FAR, f"flaps alone fall short: below the far side's ground at x={reached:.1f}, it starts at {GAP_FAR:.0f} ({corr})")
    check("sandbox.gap.fall" in line_ids(pg, m), "falling into the gap gets the glide hint")
    check(abs(player(pg)["pos"]["x"] - 91) < 0.2, "back at the clifftop checkpoint")
    settle(pg)

    # Attempt 2: a running jump and a glide (Space held the whole way).
    m = mark(pg)
    walk_to(pg, 100.0)
    hold(pg, "KeyD")
    try:
        until(pg, f"p.pos.x >= {GAP_EDGE - 0.6}", 4)
        hold(pg, "Space")
        until(pg, "p.gliding", 3)
        until(pg, f"p.pos.x > {GAP_EDGE + 6}", 4)
        # Assert state, not pixels: headless screenshots can show a stale E bubble (README).
        prompt = st(pg)["interaction"]["prompt"]
        check(prompt["visible"] is False, f"no E prompt while gliding over the gap ({prompt})")
        shot(pg, "gap_glide_1")
        until(pg, f"p.pos.x > {GAP_EDGE + 13}", 4)
        shot(pg, "gap_glide_2")
        until(pg, "p.grounded", 6)
    finally:
        release(pg, "KeyD", "Space")
    until(pg, "p.grounded && Math.abs(p.velocity.x) < 0.001", 5)
    shot(pg, "gap_landed")
    p = player(pg)
    glides = events(pg, "player:glideStart", m)
    check(bool(glides) and all(GAP_EDGE - 1 < e["x"] < GAP_FAR for e in glides[:1]), "the glide starts over the gap")
    check(not events(pg, "player:flap", m), "the glide alone made it (no flaps)")
    check(not events(pg, "correction:triggered", m) and surface(p) == FAR_SIDE and p["pos"]["x"] >= GAP_FAR,
          f"glided across the Great Gap ({p['pos']})")
    wait_line(pg, "sandbox.checkpoint.farSide", "far_side")
    check(stored_save(pg)["checkpointId"] == "far-side", "autosaved at the far-side checkpoint")
    settle(pg)


def beat_doors(pg):
    m = mark(pg)
    walk_into_wall(pg)   # up against the step
    wait_line(pg, "sandbox.doors", "two_doors")
    settle(pg)
    # Onto the step, then up to the plank ledge in front of the locked door.
    hop_up(pg, 10, stop_x=137.6)
    check(surface(player(pg)) == 10.0, f"on the step ({player(pg)['pos']})")
    hop_up(pg, 12)
    walk_into_wall(pg)
    check(surface(player(pg)) == 12.0, f"on the ledge by the locked door ({player(pg)['pos']})")
    press_e(pg)
    time.sleep(0.15)
    shot(pg, "locked_door_rattle")
    wait_line(pg, "sandbox.eagleDoor.locked", "locked_door")
    locked = events(pg, "interact:doorLocked", m)
    check([e["d"]["id"] for e in locked] == ["eagle-door"], "the upper door is locked")
    settle(pg)
    # Back off the ledge (left end) and to the lower door.
    walk_to(pg, 140.0)   # off the left end of the plank, down onto the step
    walk_into_wall(pg)   # off the step and along under the ledge to the lower door
    check(surface(player(pg)) == FAR_SIDE, f"down at the tunnel door ({player(pg)['pos']})")
    press_e(pg)
    time.sleep(0.3)
    shot(pg, "tunnel_door_open")
    wait_line(pg, "sandbox.tunnelDoor.open")
    check(any(e["d"]["id"] == "tunnel-door" for e in events(pg, "door:open", m)), "the tunnel door opens")
    settle(pg)
    walk_to(pg, 152.0)
    check(player(pg)["pos"]["x"] > 151, "walked through the tunnel")


def beat_finish(pg):
    m = mark(pg)
    running_jump(pg, 155.4, "p.grounded && p.pos.x > 159")
    check(surface(player(pg)) == FAR_SIDE and player(pg)["pos"]["x"] > 160, f"over the last pit ({player(pg)['pos']})")
    walk_into_wall(pg)   # up against the step to the dais
    hop_up(pg, 10, stop_x=164.6)
    hop_up(pg, 11)
    wait_line(pg, "sandbox.end", "the_end_door")
    settle(pg)
    walk_into_wall(pg)
    shot(pg, "exit_door")
    press_e(pg)
    harness.wait_scene(pg, "levelComplete", 5)
    time.sleep(0.8)
    shot(pg, "level_complete")
    done = events(pg, "level:complete", m)
    check(len(done) == 1 and done[0]["d"]["id"] == "chapter-one-end" and "nextLevel" not in done[0]["d"],
          f"level:complete from the exit door, no next level ({[e['d'] for e in done]})")
    pg.wait_for_function(
        "() => { const c = window.__sammy.narrator.current; return c && c.id === 'sandbox.complete'; }",
        timeout=5000)
    menu = st(pg)["menu"]
    typing = not narrator(pg)["current"]["revealed"]
    check(not typing or (menu["waitingForLine"] and not menu["canContinue"]),
          f"no continue prompt while the last line is still typing ({menu})")
    if typing:
        # A press while it types finishes the line instead of moving on.
        time.sleep(0.3)
        harness.tap(pg, "Space")
        time.sleep(0.2)
        n = narrator(pg)
        check(n["current"] and n["current"]["id"] == "sandbox.complete" and n["current"]["revealed"]
              and st(pg)["menu"]["screen"] == "celebrate", "Space while the line types reveals it all, and stays on the celebration")
        check(any(e["n"] == "narrator:revealed" and e["d"]["id"] == "sandbox.complete" for e in log(pg)[m:]),
              "narrator:revealed sent for the last line")
    done = events(pg, "chapter:complete", m)
    check([e["d"] for e in done] == [{"chapterId": "chapter-one", "unlocked": []}], f"Chapter One completed ({[e['d'] for e in done]})")
    pg.wait_for_function("window.__sammy.menu && window.__sammy.menu.canContinue === true", timeout=6000)
    shot(pg, "level_complete_prompt")
    harness.tap(pg, "Space")
    time.sleep(0.5)
    t = st(pg)["transition"]
    check(t["phase"] == "closing" and t["levelId"] == "bedroom", f"the swirl takes Sammy home ({t})")
    shot(pg, "swirl_home")
    pg.wait_for_function("window.__sammy.transition.phase === 'idle' && window.__sammy.level && window.__sammy.level.id === 'bedroom'",
                         timeout=10000)
    s = st(pg)
    check(s["sceneStack"] == ["playing"] and s["inputLocks"] == [], f"in the bedroom, input live ({s['sceneStack']}, {s['inputLocks']})")
    wait_line(pg, "bedroom.arrive", "bedroom_arrival")
    save = stored_save(pg)
    check(save and save["levelId"] == "bedroom" and save["checkpointId"] is None and save["completedChapters"] == ["chapter-one"],
          f"level complete autosaved: Continue goes to the bedroom, Chapter One completed ({save})")
    p = next((e for e in s["entities"] if e and e.get("type") == "portal"), None)
    check(p is not None and p["chapterId"] == "chapter-one", f"the portal shows Chapter One ({p and p['chapterId']})")
    check(s["chapters"]["completed"] == ["chapter-one"], f"__sammy.chapters: {s['chapters']}")
    settle(pg)
    # Quit to Title from the pause menu (W wraps from Resume to Quit).
    harness.tap(pg, "Escape")
    time.sleep(0.4)
    harness.tap(pg, "KeyW")
    time.sleep(0.2)
    harness.tap(pg, "Enter")
    harness.wait_scene(pg, "title", 8)
    time.sleep(0.6)
    shot(pg, "back_to_title")


def beat_new_game_again(pg):
    """A second New Game in the same session tells the story fresh; a Continue skips the intro."""
    m = mark(pg)
    harness.tap(pg, "KeyW")       # Continue is selected when there is a save; up to New Game
    time.sleep(0.2)
    harness.tap(pg, "Enter")
    time.sleep(0.3)
    check(st(pg)["menu"]["screen"] == "confirmOverwrite", "New Game over the save asks first")
    harness.tap(pg, "KeyA")       # to Yes
    time.sleep(0.2)
    harness.tap(pg, "Enter")
    harness.wait_scene(pg, "playing", 5)
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
    wait_line(pg, "sandbox.intro", "new_game_again_intro")
    starts = events(pg, "level:start", m)
    check(starts and starts[-1]["d"]["checkpointId"] is None, f"New Game: level:start has checkpointId null ({starts[-1:]})")
    seen = narrator(pg)["seenIds"]
    check(seen == ["sandbox.intro"], f"New Game forgot the old run's lines; only the intro is seen ({seen})")
    settle(pg)

    # Continue-style load at the clifftop (the params Continue passes), with the narrator's memory
    # wiped too, so only the intro's own condition can keep it quiet.
    m = mark(pg)
    pg.evaluate("window.__sammy.commands.changeScene('playing', {levelId: 'sandbox', checkpointId: 'clifftop', "
                "reachedCheckpoints: ['meadow', 'clifftop'], newStory: true})")
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false && "
                         "window.__sammy.level.checkpointId === 'clifftop'", timeout=10000)
    wait_line(pg, "resume.common", "continue_resume_line")
    starts = events(pg, "level:start", m)
    check(starts and starts[-1]["d"]["checkpointId"] == "clifftop", f"Continue: level:start carries the checkpoint ({starts[-1:]})")
    settle(pg)
    check("sandbox.intro" not in line_ids(pg, m), "Continue doesn't replay the intro")


def summary(pg):
    all_log = log(pg)
    names = [e["n"] for e in all_log]
    for e in all_log:
        if e["n"] == "narrator:line":
            lines_seen.append((e["d"]["id"], e["d"]["text"]))
    cps = [e["d"]["id"] for e in all_log if e["n"] == "checkpoint:reached"]
    check(cps == ["meadow", "clifftop", "far-side"], f"all three checkpoints, in order ({cps})")
    corr = sorted({e["d"]["id"] for e in all_log if e["n"] == "correction:triggered"})
    check({"eagles-perch", "nook", "great-gap-fall"} <= set(corr) and set(corr) <= {"eagles-perch", "nook", "great-gap-fall", "world-bottom"},
          f"corrections seen: {corr}")
    for name in ("player:flap", "player:glideStart", "interact:sign", "interact:twyx", "interact:doorLocked",
                 "door:open", "level:complete"):
        check(name in names, f"{name} happened")


def main():
    with harness.session(start_level=None, timeout=15) as s:
        pg = s.page
        pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
        pg.evaluate(PILOT)
        started = time.time()
        beats = (beat_title, beat_intro_and_nook, beat_sign_and_twyx, beat_meadow_checkpoint, beat_hops,
                 beat_cliff, beat_perch, beat_gap, beat_doors, beat_finish, beat_new_game_again)
        for beat in beats:
            print(f"-- {beat.__name__}")
            try:
                beat(pg)
            except Exception as error:
                release_all(pg)
                check(False, f"{beat.__name__} raised {type(error).__name__}: {str(error).splitlines()[0]}")
                shot(pg, f"error_{beat.__name__}")
                break   # later beats depend on where this one left Sammy
        summary(pg)
        print(f"\nplaythrough took {time.time() - started:.0f} s")

    print("\nNarrator lines, in order:")
    for line_id, text in lines_seen:
        print(f"  [{line_id}] {text}")
    print("\nScreenshots:")
    for path in shots:
        print("  " + path)
    print("console errors:", s.errors)
    all_fails = fails + s.errors
    print("FAIL" if all_fails else "PASS", all_fails)
    return 1 if all_fails else 0


if __name__ == "__main__":
    sys.exit(main())
