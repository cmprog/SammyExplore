"""T-017 the chapter portal: chapters as data, the portal and its lever, the swirl, progression and save.

Checks (real key presses for the lever, walking into the portal and menus; teleports, addTestChapter,
unlockChapter and setCompanion only set up tests):
- Save: a real v1 blob and a real v2 blob from before T-017 (no chapter lists) load cleanly. A save that
  had finished Chapter One (flags["levelComplete.sandbox"]) gets Chapter One completed, and if it was
  parked at the start of the finished chapter, Continue lands in the bedroom. Mid-chapter saves stay put.
  Junk chapter lists are cleaned up.
- The bedroom portal: in the old alcove, showing Chapter One (aqua), its sign, the lever beside it.
- The lever with one chapter unlocked: it clunks (mechanism:cycle), the portal stays on Chapter One
  (portal:select changed: false), and the narrator comments.
- With a debug-unlocked fake second chapter (pointing at the `test` level): E cycles to it (color and sign
  change, portal:select changed: true), and back, and to it again.
- Walking into the portal with Twyx along: portal:enter, the swirl (closing, covered, opening; input locked
  throughout), the test level at its spawn, Twyx arrives with Sammy.
- Completing that chapter: level:complete -> chapter:complete -> celebration -> swirl home -> the bedroom.
  Test chapters are never saved.
- Chapter One for real: its level:complete marks it completed and saves it; a replay that changes nothing
  writes no extra save.
- Interaction priority: with Twyx (the companion) at Sammy's side by the lever, E throws the lever and does
  not send her home; with nothing else in range, E is hers.
- A step into the portal that starts no trip re-arms it (after a second, once Sammy steps out and back in).
- Entering Chapter One through the portal autosaves its start: quit before the first checkpoint and
  Continue starts Chapter One.
- Continue (after a reload) lands in the bedroom; New Game starts Chapter One with fresh chapters.

Screenshots (tools/playtest/out/): portal_<phase>.png for night, dawn, day, dusk; portal_switch_*.png
mid-switch; portal_swirl_*.png for the transition; portal_home.png.

    .venv/Scripts/python tools/playtest/portal_scenario.py
"""
import json
import sys
import time

import harness

FLOOR_Y = 5.45
PHASES = [("night", .9), ("dawn", .235), ("day", .5), ("dusk", .74)]
WATCHED = ["portal:select", "portal:enter", "chapter:complete", "mechanism:cycle", "level:complete", "level:start",
           "narrator:line", "companion:caughtUp", "scene:change"]
SAVE_KEY = "sammyexplore.save"

fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def wait_until(fn, timeout=5.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if fn():
            return True
        time.sleep(step)
    return False


def install_recorder(pg):
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        window.__rec = [];
        for (const n of names) bus.on(n, d => window.__rec.push({n, d, locks: window.__sammy.inputLocks}));
    }""", WATCHED)


def recorded(pg, name, since=0):
    return [e["d"] for e in pg.evaluate("window.__rec")[since:] if e["n"] == name]


def mark(pg):
    return pg.evaluate("window.__rec.length")


def stored_save(pg):
    text = pg.evaluate(f"localStorage.getItem('{SAVE_KEY}')")
    return json.loads(text) if text else None


def reload_to_title(pg):
    pg.reload()
    pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
    time.sleep(.8)
    install_recorder(pg)


def wait_level(pg, level_id, timeout=15):
    pg.wait_for_function(f"window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.id === '{level_id}'"
                         " && !window.__sammy.level.loading", timeout=timeout * 1000)


def load_level(pg, level_id):
    pg.evaluate(f"__sammy.commands.loadLevel('{level_id}')")
    wait_level(pg, level_id)
    time.sleep(.4)


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


def portal(pg):
    return next((e for e in st(pg)["entities"] if e and e.get("type") == "portal"), None)


def stand(pg, x, y=FLOOR_Y, wait=.5):
    pg.evaluate(f"__sammy.commands.teleport({x}, {y})")
    time.sleep(wait)


def press_e(pg):
    harness.tap(pg, "KeyE")
    time.sleep(.25)


def hide_narrator_box(pg, hidden):
    pg.evaluate("""async hidden => { const m = await import('littlejs'); m.mainCanvas.style.opacity = hidden ? '0' : ''; }""", hidden)


def to_title_and_continue(pg):
    reload_to_title(pg)
    menu = st(pg)["menu"]
    check(menu["selected"] == "continue", f"Continue is offered ({menu['selected']})")
    harness.tap(pg, "Enter")
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && !window.__sammy.level.loading", timeout=15000)
    time.sleep(.4)
    return st(pg)


# --- save: live v1 and v2 blobs -------------------------------------------------------------------

V1_FINISHED = {"schemaVersion": 1, "levelId": "sandbox", "checkpointId": None, "reachedCheckpoints": [],
               "flags": {"levelComplete.sandbox": True}, "catsRescued": [], "updatedAt": "2026-10-12T18:20:00.000Z"}
V2_MIDWAY = {"schemaVersion": 2, "levelId": "sandbox", "checkpointId": "meadow", "reachedCheckpoints": ["meadow"],
             "flags": {}, "catsRescued": [], "companion": "twyx", "updatedAt": "2026-10-19T09:00:00.000Z"}
V2_FINISHED = {"schemaVersion": 2, "levelId": "sandbox", "checkpointId": None, "reachedCheckpoints": [],
               "flags": {"levelComplete.sandbox": True}, "catsRescued": [], "companion": "twyx",
               "updatedAt": "2026-10-19T09:00:00.000Z"}
V2_REPLAYING = {**V2_FINISHED, "checkpointId": "clifftop", "reachedCheckpoints": ["meadow", "clifftop"]}
V2_JUNK = {**V2_MIDWAY, "unlockedChapters": "lots", "completedChapters": ["nope", "chapter-one", "chapter-one"]}


def put_save(pg, blob):
    pg.evaluate(f"localStorage.setItem('{SAVE_KEY}', {json.dumps(json.dumps(blob))})")


def test_saves(pg):
    put_save(pg, V1_FINISHED)
    s = to_title_and_continue(pg)
    save = s["save"]
    check(s["saveStatus"]["status"] == "ok" and save["schemaVersion"] == 2 and save["companion"] is None,
          f"real v1 blob loads as v2 ({s['saveStatus']['status']}, {save})")
    check(save["completedChapters"] == ["chapter-one"] and save["unlockedChapters"] == ["chapter-one"],
          f"v1 that finished Chapter One: completed ({save['completedChapters']}, unlocked {save['unlockedChapters']})")
    check(s["level"]["id"] == "bedroom", f"v1 parked after the end of Chapter One: Continue lands in the bedroom ({s['level']['id']})")
    check(s["chapters"]["completed"] == ["chapter-one"], f"chapters restored on Continue ({s['chapters']})")

    put_save(pg, V2_MIDWAY)
    s = to_title_and_continue(pg)
    save = s["save"]
    check(save["completedChapters"] == [] and save["unlockedChapters"] == ["chapter-one"] and save["companion"] == "twyx",
          f"real v2 blob without chapter lists: defaults, companion kept ({save})")
    check(s["level"]["id"] == "sandbox" and s["level"]["checkpointId"] == "meadow",
          f"v2 mid-chapter: Continue resumes at the checkpoint ({s['level']['id']}, {s['level']['checkpointId']})")
    check(s["chapters"] == {"unlocked": ["chapter-one"], "completed": [], "selected": "chapter-one"}, f"chapters: {s['chapters']}")

    put_save(pg, V2_FINISHED)
    s = to_title_and_continue(pg)
    check(s["save"]["completedChapters"] == ["chapter-one"] and s["level"]["id"] == "bedroom" and s["save"]["companion"] == "twyx",
          f"v2 that finished Chapter One: completed, Continue in the bedroom with Twyx ({s['level']['id']}, {s['save']})")
    check(s["companion"] and s["companion"]["cat"] == "twyx", f"Twyx comes along into the bedroom ({s['companion'] and s['companion']['cat']})")

    put_save(pg, V2_REPLAYING)
    s = to_title_and_continue(pg)
    check(s["save"]["completedChapters"] == ["chapter-one"] and s["level"]["id"] == "sandbox" and s["level"]["checkpointId"] == "clifftop",
          f"v2 replaying a finished Chapter One: completed, resumes the replay ({s['level']['id']}, {s['level']['checkpointId']})")

    put_save(pg, V2_JUNK)
    s = to_title_and_continue(pg)
    check(s["save"]["completedChapters"] == ["chapter-one"] and s["save"]["unlockedChapters"] == ["chapter-one"],
          f"junk chapter lists cleaned up ({s['save']['completedChapters']}, {s['save']['unlockedChapters']})")


# --- the portal in the bedroom ----------------------------------------------------------------------

def test_portal_in_bedroom(pg):
    p = portal(pg)
    check(p is not None and p["chapterId"] == "chapter-one" and p["title"] == "Chapter One" and p["levelId"] == "sandbox",
          f"the portal shows Chapter One: {p}")
    check(p["color"] == {"r": .22, "g": .78, "b": .92}, f"in Chapter One's color: {p['color']}")
    check(1 <= p["feet"]["x"] - 2.5 and p["feet"]["x"] + 2.5 <= 10, f"in the old portal alcove (x 1-10): {p['feet']}")
    lever = next(e for e in st(pg)["entities"] if e and e.get("id") == "portal-lever")
    check(lever["mode"] == "cycle" and lever["targets"] == ["portal"], f"its lever cycles it: {lever}")


def lever_spot(pg):
    lever = next(e for e in st(pg)["entities"] if e and e.get("id") == "portal-lever")
    return lever["pos"]["x"] + .35


def test_one_chapter(pg):
    settle(pg)
    stand(pg, lever_spot(pg))
    check((st(pg)["interaction"]["nearest"] or {}).get("id") == "portal-lever", f"the lever is in reach: {st(pg)['interaction']['nearest']}")
    m = mark(pg)
    press_e(pg)
    cycles = recorded(pg, "mechanism:cycle", m)
    selects = recorded(pg, "portal:select", m)
    check(cycles and cycles[0]["id"] == "portal-lever", f"E throws the lever (mechanism:cycle): {cycles}")
    check(selects == [{"chapterId": "chapter-one", "changed": False}], f"only one chapter: it stays put: {selects}")
    check(st(pg)["chapters"]["selected"] == "chapter-one" and portal(pg)["chapterId"] == "chapter-one", "still Chapter One")
    ok = wait_until(lambda: any(l["id"] == "bedroom.portal.onlyOne" for l in recorded(pg, "narrator:line", m)), 3)
    check(ok, "the narrator comments on the one-setting lever")
    time.sleep(.6)
    harness.shot(pg, "portal_one_chapter")
    settle(pg)


def test_cycling(pg):
    check(pg.evaluate("__sammy.commands.addTestChapter('test-chapter', {title: 'The Test Meadow'})") is True, "addTestChapter")
    check(pg.evaluate("__sammy.commands.unlockChapter('test-chapter')") is True, "unlockChapter")
    check(pg.evaluate("__sammy.commands.unlockChapter('no-such-chapter')") is False, "unlockChapter rejects an unknown id")
    c = st(pg)["chapters"]
    check(c["unlocked"] == ["chapter-one", "test-chapter"] and c["selected"] == "chapter-one", f"__sammy.chapters: {c}")
    stand(pg, lever_spot(pg))
    hide_narrator_box(pg, True)
    m = mark(pg)
    press_e(pg)
    p = portal(pg)
    check(recorded(pg, "portal:select", m) == [{"chapterId": "test-chapter", "changed": True}], "E: on to the test chapter")
    check(p["chapterId"] == "test-chapter" and p["switching"], f"the portal turns to it: {p}")
    harness.shot(pg, "portal_switch_mid")
    time.sleep(.8)
    p = portal(pg)
    check(p["signChapterId"] == "test-chapter" and not p["switching"] and p["color"]["r"] > .9,
          f"the sign flips to the new title and the swirl takes its color: {p}")
    check(st(pg)["chapters"]["selected"] == "test-chapter", "Chapters remembers the pick")
    harness.shot(pg, "portal_switch_done")
    press_e(pg)
    time.sleep(.9)
    check(portal(pg)["chapterId"] == "chapter-one" and portal(pg)["signChapterId"] == "chapter-one", "E again: back to Chapter One (wraps)")
    press_e(pg)
    time.sleep(.9)
    check(portal(pg)["chapterId"] == "test-chapter", "and to the test chapter again")
    hide_narrator_box(pg, False)


def companion_entity(pg):
    cat = st(pg)["companion"]
    return next((e for e in st(pg)["entities"] if e and e.get("id") == (cat or {}).get("entityId")), None)


def test_priority(pg):
    """Twyx at Sammy's side by the lever: E is the lever's, and she stays along."""
    pg.evaluate("__sammy.commands.setCompanion('twyx')")
    settle(pg)
    lever_x = lever_spot(pg) - .35
    # Sammy just right of the lever, Twyx sent to sit between them: closer to him than the lever is.
    stand(pg, lever_x + 1.1, wait=.2)
    pg.evaluate(f"__sammy.commands.companionGoTo({lever_x + .65}, {FLOOR_Y})")
    wait_until(lambda: st(pg)["companion"]["atGoal"], 8)
    stand(pg, lever_x + 1.1, wait=.3)
    harness.tap(pg, "KeyA")   # face the lever (a tap barely moves him)
    time.sleep(.3)
    p = st(pg)["player"]["pos"]
    cat = companion_entity(pg)
    d_cat, d_lever = abs(cat["pos"]["x"] - p["x"]), abs(lever_x - p["x"])
    print(f"     Sammy x {p['x']:.2f}, Twyx {d_cat:.2f} away, lever {d_lever:.2f} away")
    targets = {t.get("id") for t in st(pg)["interaction"]["targets"]}
    check("twyx" in targets, "Twyx is an interactable here (E could send her home)")
    nearest = (st(pg)["interaction"]["nearest"] or {}).get("id")
    check(d_cat < d_lever, "set-up: Twyx is nearer to Sammy than the lever")
    check(nearest == "portal-lever", f"Twyx beside Sammy ({d_cat:.2f} away), the lever in reach: E targets the lever ({nearest})")
    m = mark(pg)
    pg.evaluate("""async () => { window.__left = []; const bus = await import('/src/core/events.js');
        bus.on('companion:leave', d => window.__left.push(d)); }""")
    press_e(pg)
    check(recorded(pg, "mechanism:cycle", m), "E threw the lever")
    check(pg.evaluate("window.__left.length") == 0 and st(pg)["companion"]["cat"] == "twyx", "and did NOT send Twyx home")
    settle(pg)
    pg.evaluate("__sammy.commands.companionGoTo()")   # follow again
    # Nothing else in range: E is hers (only the target is checked; pressing would let her stay home).
    stand(pg, 20, wait=.2)
    pg.evaluate("__sammy.commands.regroupCompanion()")
    ok = wait_until(lambda: (st(pg)["interaction"]["nearest"] or {}).get("type") == "twyx", 6)
    check(ok, f"with nothing else in range, E is Twyx's ({st(pg)['interaction']['nearest']})")
    # Put the portal back on the test chapter for the trip (the throw above moved it).
    if portal(pg)["chapterId"] != "test-chapter":
        pg.evaluate("__sammy.commands.activate('portal-lever')")
        time.sleep(.7)


def test_rearm(pg):
    """A portal:enter that starts no trip (stubbed out here) must not leave the portal dead."""
    settle(pg)
    pg.evaluate("""async () => { const m = await import('/src/systems/SwirlTransition.js');
        window.__realStart = m.SwirlTransition.prototype.start; m.SwirlTransition.prototype.start = () => false; }""")
    try:
        x = portal(pg)["feet"]["x"]
        m = mark(pg)
        stand(pg, x + 3.5, wait=.3)   # outside: armed
        stand(pg, x, wait=.3)         # in the opening
        check(len(recorded(pg, "portal:enter", m)) == 1 and portal(pg)["entered"] and st(pg)["transition"]["phase"] == "idle",
              "a step in that starts no trip: portal:enter, no swirl")
        time.sleep(1.4)
        p = portal(pg)
        check(not p["entered"] and not p["armed"], f"after a second it re-arms, waiting for Sammy to step out ({p['entered']}, {p['armed']})")
        check(len(recorded(pg, "portal:enter", m)) == 1, "standing in it doesn't fire again")
        stand(pg, x + 3.5, wait=.3)
        check(portal(pg)["armed"], "stepping out arms it")
        stand(pg, x, wait=.3)
        check(len(recorded(pg, "portal:enter", m)) == 2, "out and back in: the portal works again")
    finally:
        pg.evaluate("""async () => { const m = await import('/src/systems/SwirlTransition.js');
            m.SwirlTransition.prototype.start = window.__realStart; }""")
    stand(pg, lever_spot(pg) + 1.5, wait=.6)


def test_enter(pg):
    pg.evaluate("__sammy.commands.regroupCompanion()")
    time.sleep(1.5)
    settle(pg)
    stand(pg, lever_spot(pg) + 1.5)
    m = mark(pg)
    pg.keyboard.down("KeyA")
    ok = wait_until(lambda: recorded(pg, "portal:enter", m), 4)
    pg.keyboard.up("KeyA")
    enters = recorded(pg, "portal:enter", m)
    check(ok and enters[0]["chapterId"] == "test-chapter" and enters[0]["levelId"] == "test",
          f"walking left into the swirl: portal:enter {enters}")
    s = st(pg)
    check(s["transition"]["phase"] == "closing" and "swirl" in s["inputLocks"], f"the swirl closes in, input locked: {s['transition']}, {s['inputLocks']}")
    time.sleep(.4)
    harness.shot(pg, "portal_swirl_closing")
    check(wait_until(lambda: st(pg)["transition"]["phase"] == "covered", 3), "the view is covered")
    harness.shot(pg, "portal_swirl_covered")
    check(wait_until(lambda: st(pg)["transition"]["phase"] == "opening", 8), "it opens on the new place")
    check("swirl" in st(pg)["inputLocks"], "input still locked while it opens")
    time.sleep(.35)
    harness.shot(pg, "portal_swirl_opening")
    check(wait_until(lambda: st(pg)["transition"]["phase"] == "idle", 3), "the swirl is gone")
    s = st(pg)
    check(s["level"]["id"] == "test" and s["inputLocks"] == [], f"in the test chapter's level, input live ({s['level']['id']}, {s['inputLocks']})")
    check(abs(s["player"]["pos"]["x"] - s["level"]["spawn"]["x"]) < .3, "at its spawn")
    starts = recorded(pg, "level:start", m)
    check(starts and starts[-1]["levelId"] == "test" and starts[-1]["checkpointId"] is None, f"a fresh start: {starts[-1:]}")
    ok = wait_until(lambda: any(e["via"] == "arrived" for e in recorded(pg, "companion:caughtUp", m)), 5)
    check(ok and st(pg)["companion"]["cat"] == "twyx", f"Twyx came along ({st(pg)['companion']})")
    locks = [e["locks"] for e in pg.evaluate("window.__rec")[m:] if e["n"] == "level:start"]
    check(locks and "swirl" in locks[-1], "the level started under the swirl (input locked)")


def test_complete_chapter(pg):
    settle(pg)
    m = mark(pg)
    stand(pg, 47, 5.5, wait=.2)
    check(wait_until(lambda: st(pg)["scene"] == "levelComplete", 4), "the test level's exit -> celebration")
    done = recorded(pg, "chapter:complete", m)
    check(done == [{"chapterId": "test-chapter", "unlocked": []}], f"chapter:complete for the test chapter: {done}")
    check("test-chapter" in st(pg)["chapters"]["completed"], f"marked completed: {st(pg)['chapters']}")
    save = stored_save(pg)
    check(save["levelId"] == "bedroom" and "test-chapter" not in save["completedChapters"] + save["unlockedChapters"],
          f"saved: continue in the bedroom; test chapters never saved ({save})")
    ok = wait_until(lambda: (st(pg)["menu"] or {}).get("canContinue") or (st(pg)["narrator"]["current"] and not st(pg)["narrator"]["current"]["revealed"]), 6)
    if not st(pg)["menu"]["canContinue"]:
        harness.tap(pg, "Space")   # finish the remark
    check(wait_until(lambda: st(pg)["menu"]["canContinue"] is True, 8), "the continue prompt")
    harness.tap(pg, "Space")
    time.sleep(.2)
    check(st(pg)["transition"]["phase"] == "closing" and st(pg)["transition"]["levelId"] == "bedroom", f"swirl home: {st(pg)['transition']}")
    time.sleep(.4)
    harness.shot(pg, "portal_swirl_home")
    check(wait_until(lambda: st(pg)["transition"]["phase"] == "idle", 8), "home")
    s = st(pg)
    check(s["sceneStack"] == ["playing"] and s["level"]["id"] == "bedroom" and s["inputLocks"] == [],
          f"back in the bedroom ({s['sceneStack']}, {s['level']['id']}, {s['inputLocks']})")
    check(s["companion"]["cat"] == "twyx", "Twyx came home too")
    check(portal(pg)["chapterId"] == "test-chapter", f"the portal still shows the last pick: {portal(pg)['chapterId']}")
    time.sleep(.8)
    harness.shot(pg, "portal_home")


def test_chapter_one(pg):
    load_level(pg, "sandbox")
    m = mark(pg)
    already = "chapter-one" in stored_save(pg)["completedChapters"]
    pg.evaluate("""() => { window.__writes = 0; const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (k === 'sammyexplore.save') window.__writes++; return set.call(this, k, v); }; }""")
    pg.evaluate("__sammy.commands.emit('level:complete', {id: 'chapter-one-end', levelId: 'sandbox'})")
    check(wait_until(lambda: st(pg)["scene"] == "levelComplete", 3), "Chapter One's exit -> celebration")
    check(recorded(pg, "chapter:complete", m) == [{"chapterId": "chapter-one", "unlocked": []}], "chapter:complete for Chapter One")
    save = stored_save(pg)
    check(save["completedChapters"] == ["chapter-one"] and save["unlockedChapters"] == ["chapter-one"] and save["levelId"] == "bedroom",
          f"Chapter One saved as completed, continue in the bedroom ({save})")
    writes = pg.evaluate("window.__writes")
    check(already and writes == 1, f"replaying a finished chapter: only level complete's own write ({writes} writes; already done: {already})")


def test_enter_chapter_one(pg):
    """Through the portal into Chapter One autosaves its start: quit before a checkpoint, Continue starts it."""
    check(stored_save(pg)["levelId"] == "bedroom", "set-up: the save says bedroom")
    settle(pg)
    if portal(pg)["chapterId"] != "chapter-one":
        pg.evaluate("__sammy.commands.activate('portal-lever')")   # set-up only
        time.sleep(.8)
        settle(pg)
    check(portal(pg)["chapterId"] == "chapter-one", "the portal shows Chapter One")
    m = mark(pg)
    stand(pg, lever_spot(pg) + 1.5)
    pg.keyboard.down("KeyA")
    wait_until(lambda: recorded(pg, "portal:enter", m), 4)
    pg.keyboard.up("KeyA")
    check(wait_until(lambda: st(pg)["transition"]["phase"] == "idle" and st(pg)["level"]["id"] == "sandbox", 10), "into Chapter One")
    save = stored_save(pg)
    check(save["levelId"] == "sandbox" and save["checkpointId"] is None and save["reachedCheckpoints"] == [],
          f"portal:enter autosaved Chapter One's start ({save})")
    settle(pg)
    harness.tap(pg, "Escape")
    time.sleep(.4)
    harness.tap(pg, "KeyW")
    time.sleep(.2)
    harness.tap(pg, "Enter")
    harness.wait_scene(pg, "title", 8)
    s = to_title_and_continue(pg)
    check(s["level"]["id"] == "sandbox" and s["level"]["checkpointId"] is None
          and abs(s["player"]["pos"]["x"] - s["level"]["spawn"]["x"]) < .3,
          f"quit before the first checkpoint, Continue: Chapter One's start ({s['level']['id']}, {s['level']['checkpointId']})")


def test_continue_bedroom(pg):
    s = to_title_and_continue(pg)
    check(s["level"]["id"] == "bedroom" and s["chapters"]["completed"] == ["chapter-one"],
          f"Continue lands in the bedroom with Chapter One done ({s['level']['id']}, {s['chapters']})")
    check(s["chapters"]["unlocked"] == ["chapter-one"], "the test chapter is gone after a reload (never saved)")


def test_new_game(pg):
    pg.evaluate("__sammy.commands.changeScene('title')")
    harness.wait_scene(pg, "title")
    time.sleep(.6)
    harness.tap(pg, "KeyW")
    time.sleep(.2)
    harness.tap(pg, "Enter")
    time.sleep(.3)
    harness.tap(pg, "KeyA")
    time.sleep(.2)
    harness.tap(pg, "Enter")
    wait_level(pg, "sandbox")
    s = st(pg)
    check(s["chapters"] == {"unlocked": ["chapter-one"], "completed": [], "selected": "chapter-one"} and s["save"]["completedChapters"] == [],
          f"New Game: Chapter One, chapters start fresh ({s['chapters']}, {s['save']['completedChapters']})")


def screenshots(pg):
    load_level(pg, "bedroom")
    settle(pg)
    hide_narrator_box(pg, True)
    stand(pg, 11, wait=.2)
    pg.evaluate("__sammy.commands.setTimeOfDay(.9)")
    time.sleep(1.2)
    print("     shot:", harness.shot(pg, "portal_night_test_chapter"))
    if portal(pg)["chapterId"] != "chapter-one":
        pg.evaluate("__sammy.commands.activate('portal-lever')")   # set-up only: back to Chapter One
    for phase, t in PHASES:
        stand(pg, 11, wait=.2)
        pg.evaluate(f"__sammy.commands.setTimeOfDay({t})")
        time.sleep(1.6)
        print("     shot:", harness.shot(pg, f"portal_{phase}"))
    hide_narrator_box(pg, False)


def main():
    with harness.session(start_level=None) as s:
        pg = s.page
        pg.set_viewport_size({"width": 1920, "height": 1080})
        pg.wait_for_function("window.__sammy.scene === 'title'", timeout=10000)
        install_recorder(pg)
        steps = [test_saves, lambda pg: load_level(pg, "bedroom"), test_portal_in_bedroom, test_one_chapter, test_cycling,
                 test_priority, test_rearm, test_enter, test_complete_chapter, screenshots, test_chapter_one,
                 test_continue_bedroom, test_enter_chapter_one, test_new_game]
        for step in steps:
            try:
                step(pg)
            except Exception as error:
                check(False, f"{getattr(step, '__name__', 'step')} crashed: {type(error).__name__}: {str(error).splitlines()[0]}")
                harness.shot(pg, "portal_error")
                break
        pg.evaluate("__sammy.commands.clearSave()")
        errors = list(s.errors)
    for e in errors:
        print("ERROR", e)
    fails.extend(errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
