"""T-020 the whole M2 journey in one browser session, real key presses from the title screen.

  title -> New Game -> Chapter One (sandbox_playthrough's real-key beats, no teleports) -> its exit door
  -> swirl home -> the bedroom arrival (cast-list gag lines) -> walk to Twyx, E asks her along ->
  across the room to the dresser -> the practice course with her (climb, flap the gap, the checkpoint,
  E on the lever = help her through, the cushion = Comfort, the toy star) -> quit to title mid-course and
  Continue (resumes at the course checkpoint, Twyx still along) -> back home over the dresser ->
  the portal lever (E) -> walk into the portal with Twyx along -> Chapter One again (real keys through the
  start of the level, Twyx following) -> debug teleport near the exit door, real keys through the door ->
  swirl home -> the bedroom with Twyx.
  Then, in fresh pages: an M1-era v1 save that finished Chapter One -> Continue lands in the bedroom,
  no companion, and the room is playable (walk, E on Twyx works, portal shows Chapter One).

Debug teleports are used only where noted with "TELEPORT" in the output:
  - if the walk across the room to the dresser (chest, brick stacks, desk, bookshelf) fails in real keys
  - the jump from near the start of Chapter One to near its exit door in the replay (Twyx's following
    in the middle of that level is companion_scenario's job)
Screenshots: tools/playtest/out/m2_NN_*.png

    .venv/Scripts/python tools/playtest/m2_journey.py
"""
import json
import sys
import time

import harness
import practice_scenario as ps
import sandbox_playthrough as sp

fails = []
shots = []
n = [0]


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def snap(pg, name, hide_box=False):
    n[0] += 1
    if hide_box:
        pg.evaluate("async () => { const m = await import('littlejs'); m.mainCanvas.style.opacity = '0'; }")
    path = harness.shot(pg, f"m2_{n[0]:02d}_{name}")
    if hide_box:
        pg.evaluate("async () => { const m = await import('littlejs'); m.mainCanvas.style.opacity = ''; }")
    shots.append(str(path))
    print("     shot:", path)


def st(pg):
    return harness.state(pg)


def comp(pg):
    return pg.evaluate("__sammy.companion")


def stored_save(pg):
    text = pg.evaluate("localStorage.getItem('sammyexplore.save')")
    return json.loads(text) if text else None


def wait_level(pg, level_id, timeout=15):
    pg.wait_for_function(f"window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.id === '{level_id}'"
                         " && !window.__sammy.level.loading && window.__sammy.transition.phase === 'idle'", timeout=timeout * 1000)


def to_title_via_pause(pg):
    harness.tap(pg, "Escape")
    time.sleep(0.4)
    harness.tap(pg, "KeyW")      # wraps from Resume to Quit
    time.sleep(0.2)
    harness.tap(pg, "Enter")
    harness.wait_scene(pg, "title", 8)
    time.sleep(0.8)


def continue_from_title(pg):
    menu = st(pg)["menu"]
    check(menu["selected"] == "continue", f"Continue is the selected item ({menu['selected']})")
    harness.tap(pg, "Enter")
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && !window.__sammy.level.loading", timeout=15000)
    time.sleep(0.8)


def lines_in_bedroom(pg, since):
    return [e["d"]["id"] for e in sp.events(pg, "narrator:line", since)]


# --- part 1: Chapter One, home, ask Twyx along -----------------------------------------------------

def chapter_one(pg):
    for beat in (sp.beat_title, sp.beat_intro_and_nook, sp.beat_sign_and_twyx, sp.beat_meadow_checkpoint, sp.beat_hops,
                 sp.beat_cliff, sp.beat_perch, sp.beat_gap, sp.beat_doors):
        print(f"-- {beat.__name__}")
        beat(pg)
    check(True, "Chapter One played with real keys up to the exit door (see sandbox checks above)")


def finish_to_bedroom(pg):
    """Same as sandbox_playthrough.beat_finish up to the swirl home, but stays in the bedroom."""
    m = sp.mark(pg)
    sp.running_jump(pg, 155.4, "p.grounded && p.pos.x > 159")
    sp.walk_into_wall(pg)
    sp.hop_up(pg, 10, stop_x=164.6)
    sp.hop_up(pg, 11)
    sp.wait_line(pg, "sandbox.end")
    sp.settle(pg)
    sp.walk_into_wall(pg)
    sp.press_e(pg)
    harness.wait_scene(pg, "levelComplete", 5)
    time.sleep(0.8)
    snap(pg, "chapter_one_complete")
    pg.wait_for_function("window.__sammy.menu && window.__sammy.menu.canContinue === true", timeout=20000)
    harness.tap(pg, "Space")
    pg.wait_for_function("window.__sammy.transition.phase === 'idle' && window.__sammy.level && window.__sammy.level.id === 'bedroom'",
                         timeout=15000)
    return m


def bedroom_arrival(pg, m):
    s = st(pg)
    check(s["level"]["id"] == "bedroom" and s["inputLocks"] == [], f"in the bedroom, input live ({s['level']['id']}, {s['inputLocks']})")
    check(s["companion"] is None, f"nobody along yet ({s['companion']})")
    sp.wait_line(pg, "bedroom.arrive")
    time.sleep(0.5)
    snap(pg, "bedroom_arrival")
    t0 = time.time()
    seen = []
    while time.time() - t0 < 40:
        seen = lines_in_bedroom(pg, m)
        if "bedroom.castList.he" in seen:
            break
        cur = st(pg)["narrator"]["current"]
        if cur and cur["id"] == "bedroom.castList":
            snap(pg, "cast_list_gag")
        if cur and cur["revealed"]:
            time.sleep(1.0)   # a kid reads it for a second
            harness.tap(pg, "Enter")
        time.sleep(0.2)
    check("bedroom.arrive" in seen and "bedroom.castList" in seen and "bedroom.castList.he" in seen,
          f"arrival then the cast-list gag, in order ({[i for i in seen if i.startswith('bedroom')]})")
    sp.settle(pg)
    save = stored_save(pg)
    check(save["levelId"] == "bedroom" and save["completedChapters"] == ["chapter-one"], f"saved: home, Chapter One done ({save['levelId']})")


def ask_twyx(pg):
    ps.install(pg)
    time.sleep(0.5)
    snap(pg, "bedroom_day_wide")
    tw = ps.twyx(pg)
    ps.walk_to(pg, tw["pos"]["x"] - 1.0, jump_when_stuck=False)
    ps.face(pg, "KeyD")
    ps.settle(pg)
    check((st(pg)["interaction"]["nearest"] or {}).get("id") == "twyx", f"E prompt is on Twyx ({st(pg)['interaction']['nearest']})")
    snap(pg, "ask_twyx_prompt")
    m0 = ps.mark(pg)
    ps.press_e(pg)
    check(ps.wait_until(lambda: any(e["n"] == "companion:join" for e in ps.since(pg, m0)), 3), "E on Twyx asks her along (companion:join)")
    ps.settle(pg)
    check((comp(pg) or {}).get("cat") == "twyx", f"Twyx is the companion ({comp(pg)})")
    check(stored_save(pg)["companion"] == "twyx", "and it was saved")
    snap(pg, "twyx_along")


def cross_room(pg):
    """Real keys onto the toy chest; then TELEPORT past the furniture (chest, brick stacks, desk, bookshelf:
    bedroom_scenario covers them, and a 1-tile slot between the chest and the bricks traps a bot's walk), then
    real keys from the bookshelf's foot up the dresser. Twyx trots over (regroup)."""
    m = ps.mark(pg)
    ps.walk_to(pg, 13.5, jump_when_stuck=False, timeout=4)
    p = ps.jump_to(pg, 17.5)
    check(abs(ps.feet(p) - 7) < .15, f"real jump onto the toy chest (feet {ps.feet(p):.2f})")
    ps.settle(pg)
    snap(pg, "on_the_toy_chest")
    print("     TELEPORT: Sammy to the floor by the bookshelf (x 43.5); Twyx trots over (regroupCompanion)")
    ps.teleport(pg, 43.5, ps.FLOOR)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(ps.wait_until(lambda: abs(ps.twyx(pg)["pos"]["x"] - 43.5) < 4 and abs(ps.cat_feet(ps.twyx(pg)) - ps.FLOOR) < .2, 25),
          f"Twyx trots over to him ({ps.twyx(pg)['pos']})")
    ps.settle(pg)
    for x, top, what in ((46.5, 7, "the low brick step"), (47.5, 9, "the tall brick step"), (50.5, 11, "the dresser")):
        p = ps.jump_to(pg, x)
        check(abs(ps.feet(p) - top) < .1, f"up {what}: feet {ps.feet(p):.2f}, x {p['pos']['x']:.2f} (expected {top})")
    p = ps.move_to(pg, 53.5)
    check(ps.wait_until(lambda: abs(ps.cat_feet(ps.twyx(pg)) - 11) < .1 and ps.twyx(pg)["pos"]["x"] > 48, 25),
          f"Twyx climbs onto the dresser too ({ps.twyx(pg)['pos']})")
    waits = ps.since(pg, m, "companion:waiting")
    print(f"     waits crossing the room: {[(w['d']) for w in waits]}")
    ps.settle(pg)


def course(pg):
    m_course = ps.mark(pg)
    ps.climb_course(pg)
    check(ps.wait_until(lambda: abs(ps.cat_feet(ps.twyx(pg)) - 11) < .1 and ps.twyx(pg)["pos"]["x"] > 68, 12),
          f"Twyx hops after him onto the headboard ({ps.twyx(pg)['pos']})")
    ps.settle(pg)
    snap(pg, "course_at_the_gap")
    m_gap = ps.mark(pg)
    p = ps.jump_to(pg, ps.LEVER_X - .9, flaps=2)
    check(p["pos"]["x"] > ps.GAP[1] and abs(ps.feet(p) - ps.CUBBY_TOP) < .1, f"Sammy flaps across the gap ({p['pos']})")
    check(ps.wait_until(lambda: any(e["n"] == "companion:waiting" for e in ps.since(pg, m_gap)), 6), "Twyx waits at the gap's edge")
    time.sleep(0.5)
    check(any(e["d"]["id"] == "practice-far-side" for e in ps.since(pg, m_gap, "checkpoint:reached")), "checkpoint past the bridge")
    ps.settle(pg)
    ps.face(pg, "KeyD")
    snap(pg, "waiting_across_the_gap")
    m_l = ps.mark(pg)
    ps.press_e(pg)
    check(ps.wait_until(lambda: any(e["n"] == "bridge:move" and e["d"]["down"] for e in ps.since(pg, m_l)), 3), "E on the lever lowers the bridge")
    check(ps.wait_until(lambda: any(e["n"] == "companion:caughtUp" for e in ps.since(pg, m_l)), 10), "she walks across to him")
    ps.settle(pg)
    snap(pg, "twyx_crossed")
    # Comfort
    ps.walk_to(pg, ps.SPOT_X - .8, jump_when_stuck=False, timeout=4)
    ps.settle(pg)
    check((st(pg)["interaction"]["nearest"] or {}).get("id") == "practice-spot", f"E prompt on the cushion ({st(pg)['interaction']['nearest']})")
    m_s = ps.mark(pg)
    ps.press_e(pg)
    ps.move_to(pg, ps.LEVER_X)
    ps.face(pg, "KeyD")
    check(ps.wait_until(lambda: any(e["n"] == "ability:start" for e in ps.since(pg, m_s)), 10), "Twyx walks to the cushion and starts Comfort")
    time.sleep(1.6)
    snap(pg, "comfort_in_action")
    check(ps.wait_until(lambda: any(e["n"] == "upset:calmed" for e in ps.since(pg, m_s)), 6), "the mouse calms")
    check(ps.wait_until(lambda: ps.entity(pg, "practice-mouse")["arrived"], 6), "it scoots to the back of the fort")
    ps.settle(pg)
    # Star
    m_star = ps.mark(pg)
    ps.walk_to(pg, ps.STAR_X - .3, jump_when_stuck=False, timeout=5)
    check(ps.wait_until(lambda: any(e["n"] == "collectible:found" for e in ps.since(pg, m_star)), 3), "the toy star is found")
    time.sleep(0.7)
    snap(pg, "toy_star")
    time.sleep(0.6)
    snap(pg, "toy_star_burst")
    ps.settle(pg)
    time.sleep(1.5)
    check(not ps.since(pg, m_course, "correction:triggered"), "no corrections during the course")
    snap(pg, "course_done_twyx_beside")


def quit_and_continue_mid_course(pg):
    check(ps.entity(pg, "practice-star")["state"] == "gone", "set-up: the star has been found")
    save = stored_save(pg)
    check(save["levelId"] == "bedroom" and save["checkpointId"] == "practice-far-side" and save["companion"] == "twyx",
          f"saved at the course checkpoint with Twyx along ({save['levelId']}, {save['checkpointId']}, {save['companion']})")
    to_title_via_pause(pg)
    snap(pg, "title_with_save")
    continue_from_title(pg)
    s = st(pg)
    check(s["level"]["id"] == "bedroom" and s["level"]["checkpointId"] == "practice-far-side", f"Continue: the bedroom, at the course checkpoint ({s['level']['checkpointId']})")
    p = s["player"]
    check(ps.feet(p) > 10.9 and p["pos"]["x"] > 75, f"Sammy is up on the cubby ({p['pos']})")
    c = s["companion"]
    check(c and c["cat"] == "twyx", f"Twyx is still along ({c and c['cat']})")
    ps.install(pg)
    time.sleep(1.5)
    tw = ps.twyx(pg)
    print(f"     Twyx after Continue: {tw['pos']}, state {comp(pg)['state']}")
    check(abs(tw["pos"]["x"] - p["pos"]["x"]) < 8, f"Twyx is with him, not left somewhere ({tw['pos']})")
    ps.settle(pg)
    snap(pg, "continue_mid_course")
    # The course resets on a resume (bridge up, mouse back in the tunnel, star back): can she still do Comfort?
    ps.walk_to(pg, ps.SPOT_X - .8, jump_when_stuck=False, timeout=4)
    ps.settle(pg)
    m_s = ps.mark(pg)
    ps.press_e(pg)
    ok = ps.wait_until(lambda: any(e["n"] == "ability:start" for e in ps.since(pg, m_s)), 10)
    un = ps.since(pg, m_s, "catspot:unreachable")
    check(ok, f"after Continue the cushion still works (Comfort starts); got {[(e['n'], e['d'].get('reason')) for e in ps.since(pg, m_s)]}")
    snap(pg, "continue_cushion_try")


def go_home(pg):
    """Drop into the gap and walk out under the bed, up the dresser (real keys), TELEPORT across the
    furniture to the floor by the portal, regroup."""
    m = ps.mark(pg)
    print(f"     Twyx now: {comp(pg)['state']} at {ps.twyx(pg)['pos']}")
    p = ps.move_to(pg, ps.GAP[1] - 1.5, timeout=8)
    check(abs(ps.feet(p) - ps.FLOOR) < .1, f"drops into the gap onto the floor ({p['pos']})")
    ps.walk_to(pg, 56, jump_when_stuck=False, timeout=8)
    ok = ps.wait_until(lambda: ps.twyx(pg)["pos"]["x"] < 60 and abs(ps.cat_feet(ps.twyx(pg)) - ps.FLOOR) < .2, 20)
    check(ok, f"Twyx follows him down the gap and out from under the bed ({ps.twyx(pg)['pos']})")
    for x, top, what, fl in ((59.2, 7, "the low toy shelf, from the floor", 0), (56.0, 9, "the toy shelf by the dresser", 0), (53.0, 11, "the dresser", 0)):
        p = ps.jump_to(pg, x, flaps=fl)
        if abs(ps.feet(p) - top) > .1:
            p = ps.jump_to(pg, x, flaps=fl + 1)
        check(abs(ps.feet(p) - top) < .1, f"up {what}: feet {ps.feet(p):.2f}, x {p['pos']['x']:.2f}")
    ps.move_to(pg, 46.5, timeout=6)
    p = ps.move_to(pg, 37.5, timeout=8)
    check(abs(ps.feet(p) - ps.FLOOR) < .1, f"back into the room ({p['pos']})")
    ok = ps.wait_until(lambda: ps.twyx(pg)["pos"]["x"] < 42 and abs(ps.cat_feet(ps.twyx(pg)) - ps.FLOOR) < .2, 25)
    check(ok, f"Twyx follows over the dresser ({ps.twyx(pg)['pos']})")
    print("     TELEPORT: Sammy to the floor by the portal (x 12.5); Twyx trots over")
    ps.teleport(pg, 12.5, ps.FLOOR)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    check(ps.wait_until(lambda: abs(ps.twyx(pg)["pos"]["x"] - 12.5) < 5, 25), f"Twyx trots home to him ({ps.twyx(pg)['pos']})")
    ps.settle(pg)
    waits = ps.since(pg, m, "companion:waiting")
    print(f"     waits since the Continue: {[w['d'] for w in waits]}")
    snap(pg, "home_by_the_portal")


def portal_trip(pg):
    ps.walk_to(pg, 9.6, jump_when_stuck=False, timeout=6)
    ps.face(pg, "KeyA")
    ps.settle(pg)
    nearest = st(pg)["interaction"]["nearest"]
    check((nearest or {}).get("id") == "portal-lever", f"E prompt is on the portal lever, not Twyx ({nearest})")
    m = ps.mark(pg)
    ps.press_e(pg)
    time.sleep(1.0)
    check(comp(pg) and comp(pg)["cat"] == "twyx", "Twyx stayed along after the lever E")
    snap(pg, "portal_lever_thrown")
    ps.settle(pg)
    sp.mark(pg)
    ps.install(pg)
    m_log = sp.mark(pg)
    # let Twyx catch up, then walk left into the swirl
    ps.wait_until(lambda: abs(ps.twyx(pg)["pos"]["x"] - ps.player(pg)["pos"]["x"]) < 5, 10)
    pg.keyboard.down("KeyA")
    ok = ps.wait_until(lambda: st(pg)["transition"]["phase"] == "closing", 10)
    time.sleep(0.4)
    snap(pg, "portal_swirl")
    pg.keyboard.up("KeyA")
    check(ok, "walking left into the portal starts the swirl")
    wait_level(pg, "sandbox", 20)
    time.sleep(1.5)
    s = st(pg)
    check(s["level"]["id"] == "sandbox" and s["companion"] and s["companion"]["cat"] == "twyx", f"Chapter One, Twyx along ({s['level']['id']}, {s['companion'] and s['companion']['cat']})")
    ps.wait_until(lambda: (comp(pg) or {}).get("state") in ("idle", "following"), 8)
    save = stored_save(pg)
    check(save["levelId"] == "sandbox" and save["checkpointId"] is None, f"entering via the portal saved the chapter start ({save['levelId']})")
    snap(pg, "chapter_one_with_twyx")
    return m_log


def replay_chapter_one(pg, m_log):
    """Real keys through the start of the level with Twyx along; then TELEPORT near the exit."""
    ps.settle(pg)
    sp.walk_to(pg, 20, timeout=20)
    ps.settle(pg)
    sp.walk_to(pg, 40, timeout=30)
    tw = pg.evaluate("__sammy.entities.filter(e => e && e.type === 'twyx')")
    print(f"     Twyx entities in Chapter One: {[(t['id'], t['pos']) for t in tw]}")
    snap(pg, "replay_meadow")
    c = comp(pg)
    print(f"     companion: {c['state']} at {c['pos']}  Sammy x {ps.player(pg)['pos']['x']:.1f}")
    check(abs(c["pos"]["x"] - ps.player(pg)["pos"]["x"]) < 15, "Twyx kept up on the replay's meadow walk")
    lines = [e["d"]["id"] for e in sp.events(pg, "narrator:line", m_log)]
    print(f"     lines on the replay so far: {lines}")
    print("     TELEPORT: near the exit door (160.5), the middle of the level is companion_scenario's")
    pg.evaluate("__sammy.commands.teleport(160.5, 9.46)")
    pg.evaluate("__sammy.commands.regroupCompanion()")
    time.sleep(3)
    ps.settle(pg)
    sp.walk_into_wall(pg)   # real keys from here: up the steps to the dais and the door
    sp.hop_up(pg, 10, stop_x=164.6)
    sp.hop_up(pg, 11)
    ps.settle(pg)
    sp.walk_into_wall(pg)
    snap(pg, "replay_exit_door")
    nearest = st(pg)["interaction"]["nearest"]
    print(f"     nearest at door: {nearest}")
    sp.press_e(pg)
    harness.wait_scene(pg, "levelComplete", 5)
    time.sleep(0.8)
    pg.wait_for_function("window.__sammy.menu && window.__sammy.menu.canContinue === true", timeout=20000)
    snap(pg, "replay_complete")
    harness.tap(pg, "Space")
    pg.wait_for_function("window.__sammy.transition.phase === 'idle' && window.__sammy.level && window.__sammy.level.id === 'bedroom'",
                         timeout=15000)
    time.sleep(2.0)
    s = st(pg)
    check(s["level"]["id"] == "bedroom" and s["companion"] and s["companion"]["cat"] == "twyx", "back in the bedroom with Twyx")
    ok = ps.wait_until(lambda: abs(ps.twyx(pg)["pos"]["x"] - ps.player(pg)["pos"]["x"]) < 6, 10)
    check(ok, f"Twyx is beside him on arrival ({ps.twyx(pg)['pos']} vs {ps.player(pg)['pos']})")
    ps.settle(pg)
    snap(pg, "back_in_bedroom_with_twyx")
    stray = pg.evaluate("window.__stray")
    return stray


# --- part 2: the M1-era save ----------------------------------------------------------------------

V1_FINISHED = {"schemaVersion": 1, "levelId": "sandbox", "checkpointId": None, "reachedCheckpoints": [],
               "flags": {"levelComplete.sandbox": True}, "catsRescued": [], "updatedAt": "2026-10-12T18:20:00.000Z"}


def v1_continue(page_url, s_errors):
    with harness.session(start_level=None) as s2:
        pg = s2.page
        pg.set_viewport_size({"width": 1920, "height": 1080})
        pg.wait_for_function("window.__sammy.scene === 'title'", timeout=10000)
        pg.evaluate(f"localStorage.setItem('sammyexplore.save', {json.dumps(json.dumps(V1_FINISHED))})")
        pg.reload()
        pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
        time.sleep(1.0)
        snap(pg, "title_v1_save")
        continue_from_title(pg)
        s = st(pg)
        check(s["level"]["id"] == "bedroom", f"v1 save (finished Chapter One): Continue lands in the bedroom ({s['level']['id']})")
        check(s["companion"] is None, f"...with no companion ({s['companion']})")
        check(s["save"]["schemaVersion"] == 2 and s["chapters"]["completed"] == ["chapter-one"], f"migrated to v2, Chapter One done ({s['chapters']})")
        ps.install(pg)
        time.sleep(2)
        snap(pg, "v1_continue_bedroom")
        # real keys: the room works, E on Twyx still asks her along from here
        ps.settle(pg)
        tw = ps.twyx(pg)
        ps.walk_to(pg, tw["pos"]["x"] - 1.0, jump_when_stuck=False)
        ps.face(pg, "KeyD")
        ps.press_e(pg)
        ps.wait_until(lambda: (comp(pg) or {}).get("cat") == "twyx", 3)
        check((comp(pg) or {}).get("cat") == "twyx", "from the migrated save, E still asks Twyx along")
        # and the portal walks into Chapter One
        portal = next(e for e in st(pg)["entities"] if e and e.get("type") == "portal")
        check(portal["chapterId"] == "chapter-one", "portal shows Chapter One")
        return list(s2.errors)


# --- main -----------------------------------------------------------------------------------------

def main():
    errors = []
    with harness.session(start_level=None, timeout=15) as s:
        pg = s.page
        pg.set_viewport_size({"width": 1920, "height": 1080})
        pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
        pg.evaluate(sp.PILOT)

        def run(name, fn, *a):
            print(f"=== {name}")
            try:
                return fn(*a)
            except Exception as error:
                sp.release_all(pg)
                check(False, f"{name} raised {type(error).__name__}: {str(error).splitlines()[0]}")
                snap(pg, "error_" + name)
                raise SystemExit_(name)

        class SystemExit_(Exception):
            pass

        try:
            run("chapter_one", chapter_one, pg)
            m = run("finish_to_bedroom", finish_to_bedroom, pg)
            run("bedroom_arrival", bedroom_arrival, pg, m)
            run("ask_twyx", ask_twyx, pg)
            run("cross_room", cross_room, pg)
            run("course", course, pg)
            run("quit_and_continue_mid_course", quit_and_continue_mid_course, pg)
            run("go_home", go_home, pg)
            m_log = run("portal_trip", portal_trip, pg)
            run("replay_chapter_one", replay_chapter_one, pg, m_log)
        except SystemExit_ as e:
            print("journey stopped at", e)
        errors += s.errors
    try:
        errors += v1_continue(None, None)
    except Exception as error:
        check(False, f"v1_continue raised {type(error).__name__}: {str(error).splitlines()[0]}")
    all_fails = fails + sp.fails + ps.fails + errors
    print("\nScreenshots:")
    for p in shots:
        print("  " + p)
    print("console errors:", errors)
    print("FAIL" if all_fails else "PASS", all_fails)
    return 1 if all_fails else 0


if __name__ == "__main__":
    sys.exit(main())
