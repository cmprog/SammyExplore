"""T-008 screens and autosave: title (keyboard + mouse), Continue greyed with no save, New Game, checkpoint
autosave (localStorage), pause overlay keeps level state, sound settings via the pause menu, Quit to Title,
Continue at the checkpoint, overwrite confirm (No keeps / Yes replaces), level complete -> To be continued
-> title, nextLevel path, and blocked storage."""
import json
import sys
import time

import harness

fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def stored_save(pg):
    text = pg.evaluate("localStorage.getItem('sammyexplore.save')")
    return json.loads(text) if text else None


def to_page(pg, x, y):
    """Game canvas pixels (1920x1080) -> page coordinates for the mouse."""
    r = pg.evaluate("(() => { const b = document.querySelector('canvas').getBoundingClientRect();"
                    " return {x: b.left, y: b.top, w: b.width, h: b.height}; })()")
    return r["x"] + x / 1920 * r["w"], r["y"] + y / 1080 * r["h"]


def item_rect(pg, item_id):
    menu = st(pg)["menu"]
    return next(i["rect"] for i in menu["items"] if i["id"] == item_id)


def hover(pg, item_id, dx=0):
    r = item_rect(pg, item_id)
    pg.mouse.move(*to_page(pg, r["x"] + dx, r["y"]), steps=4)
    time.sleep(0.15)


def click(pg, item_id, dx=0):
    hover(pg, item_id, dx)
    pg.mouse.down()
    time.sleep(0.08)
    pg.mouse.up()
    time.sleep(0.2)


def press(pg, key, wait=0.2):
    harness.tap(pg, key)
    time.sleep(wait)


def selected(pg):
    return (st(pg)["menu"] or {}).get("selected")


def count_events(pg, name):
    return sum(1 for e in st(pg)["events"] if e["name"] == name)


def wait_level(pg):
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.loading === false",
                         timeout=10000)


def wait_for(pg, predicate, timeout=5):
    t = time.time()
    while time.time() - t < timeout:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def title_checks(pg):
    harness.wait_scene(pg, "title")
    time.sleep(1.2)
    s = st(pg)
    items = {i["id"]: i["enabled"] for i in s["menu"]["items"]}
    check(s["save"] is None and stored_save(pg) is None, "fresh start: no save")
    check(items == {"newGame": True, "continue": False}, f"Continue greyed out with no save ({items})")
    check(s["menu"]["selected"] == "newGame", "New Game selected by default")
    harness.shot(pg, "screens_01_title")

    press(pg, "KeyS")
    check(selected(pg) == "newGame", "keyboard skips the disabled Continue")
    hover(pg, "continue")
    click(pg, "continue")
    check(st(pg)["scene"] == "title" and selected(pg) == "newGame", "mouse can't pick the disabled Continue")

    hover(pg, "newGame", dx=-150)
    check(selected(pg) == "newGame", "hover keeps New Game")
    click(pg, "newGame")
    wait_level(pg)
    save = stored_save(pg)
    check(save is not None and save["levelId"] == "test" and save["checkpointId"] is None and save["schemaVersion"] == 1,
          f"New Game (click) -> playing, fresh save at level start ({save})")


def checkpoint_autosave(pg):
    time.sleep(0.5)
    pg.evaluate("window.__sammy.commands.teleport(25, 4.5)")
    ok = wait_for(pg, lambda: (stored_save(pg) or {}).get("checkpointId") == "middle")
    save = stored_save(pg)
    check(ok, f"checkpoint autosave in localStorage ({save})")
    check(set(save) >= {"schemaVersion", "levelId", "checkpointId", "flags", "catsRescued", "updatedAt"},
          "save has the spec shape")
    check(st(pg)["save"] == save, "__sammy.save matches localStorage")
    check(st(pg)["saveStatus"]["iconShowing"], "saved feather icon is showing")
    harness.shot(pg, "screens_02_saved_icon")
    time.sleep(1.0)


def pause_checks(pg):
    before = st(pg)["player"]["pos"]
    press(pg, "Escape", 0.5)
    s = st(pg)
    check(s["scene"] == "pause" and s["sceneStack"] == ["playing", "pause"], f"Esc opens pause over playing ({s['sceneStack']})")
    check(s["menu"]["selected"] == "resume", "Resume selected")
    harness.hold(pg, "KeyD", 0.5)
    harness.shot(pg, "screens_03_pause")
    check(st(pg)["player"]["pos"] == before, "world frozen while paused (D held, player still)")

    press(pg, "KeyS")
    check(selected(pg) == "sound", "S moves to Sound")
    press(pg, "Enter", 0.3)
    s = st(pg)
    settings = json.loads(pg.evaluate("localStorage.getItem('sammyexplore.settings')") or "{}")
    check(s["audio"]["muted"] is True and s["menu"]["audio"]["muted"] is True and settings.get("muted") is True,
          "Sound toggles off via audio:toggleMute")
    press(pg, "Enter", 0.3)
    check(st(pg)["audio"]["muted"] is False, "Sound toggles back on")
    press(pg, "ArrowDown")
    check(selected(pg) == "volume", "arrow down moves to Volume")
    vol = st(pg)["audio"]["volume"]
    press(pg, "KeyD")
    check(abs(st(pg)["audio"]["volume"] - min(1, vol + 0.1)) < 1e-6, "D raises volume one step")
    click(pg, "volume", dx=-200)
    check(abs(st(pg)["audio"]["volume"] - vol) < 1e-6, "click on the left half lowers volume")
    check(st(pg)["scene"] == "pause", "still paused after settings")

    click(pg, "resume")
    time.sleep(0.4)
    s = st(pg)
    check(s["scene"] == "playing" and s["sceneStack"] == ["playing"], "click Resume -> playing")
    check(s["player"]["pos"] == before and s["level"]["checkpointId"] == "middle", "level state intact after resume")

    # Space confirms Resume; it must not become a jump.
    press(pg, "Escape", 0.4)
    pg.keyboard.down("Space")
    time.sleep(0.4)
    s = st(pg)
    check(s["scene"] == "playing", "Space on Resume closes the pause menu")
    check(abs(s["player"]["pos"]["y"] - before["y"]) < 1e-6, "held Space after Resume does not jump")
    pg.keyboard.up("Space")
    time.sleep(0.2)

    press(pg, "Escape", 0.4)
    press(pg, "Escape", 0.4)
    check(st(pg)["scene"] == "playing", "Esc toggles pause closed")


def quit_and_continue(pg):
    press(pg, "Escape", 0.4)
    press(pg, "KeyW")
    check(selected(pg) == "quit", "W wraps from Resume to Quit to Title")
    press(pg, "Enter", 0.6)
    harness.wait_scene(pg, "title")
    s = st(pg)
    check(s["sceneStack"] == ["title"] and s["player"] is None, "Quit to Title unloads the level")
    check(s["menu"]["selected"] == "continue", "Continue selected by default when a save exists")
    moves = count_events(pg, "menu:move")
    press(pg, "KeyW")
    check(selected(pg) == "newGame", "W moves up to New Game")
    press(pg, "ArrowDown")
    check(selected(pg) == "continue", "arrow down moves to Continue")
    check(count_events(pg, "menu:move") >= moves + 2, "menu:move emitted")
    harness.shot(pg, "screens_04_title_with_save")
    press(pg, "Enter")
    wait_level(pg)
    time.sleep(0.4)
    s = st(pg)
    pos = s["player"]["pos"]
    check(abs(pos["x"] - 25) < 0.3 and s["level"]["checkpointId"] == "middle",
          f"Continue resumes at the checkpoint ({pos}, checkpoint {s['level']['checkpointId']})")


def overwrite_confirm(pg):
    pg.evaluate("window.__sammy.commands.changeScene('title')")
    harness.wait_scene(pg, "title")
    time.sleep(0.4)
    old = stored_save(pg)
    click(pg, "newGame")
    s = st(pg)
    check(s["menu"]["screen"] == "confirmOverwrite" and s["menu"]["selected"] == "no", "New Game with a save asks first (No selected)")
    time.sleep(0.5)
    harness.shot(pg, "screens_05_confirm")
    press(pg, "Enter")
    s = st(pg)
    check(s["scene"] == "title" and s["menu"]["screen"] == "title", "No closes the confirm")
    check(stored_save(pg) == old, "No keeps the save")

    check(selected(pg) == "newGame", "New Game still selected after No")
    press(pg, "Enter")
    check(st(pg)["menu"]["screen"] == "confirmOverwrite", "Enter on New Game asks again")
    press(pg, "Escape")
    check(st(pg)["menu"]["screen"] == "title" and stored_save(pg) == old, "Esc on the confirm = No")

    press(pg, "Enter")
    press(pg, "KeyA")
    check(selected(pg) == "yes", "A moves to Yes")
    time.sleep(0.05)
    press(pg, "Enter")
    wait_level(pg)
    new = stored_save(pg)
    check(new["checkpointId"] is None and new["updatedAt"] != old["updatedAt"], f"Yes replaces the save ({new})")
    check(abs(st(pg)["player"]["pos"]["x"] - 2.5) < 0.3, "Yes starts at the level spawn")


def level_complete(pg):
    time.sleep(0.5)
    pg.evaluate("window.__sammy.commands.teleport(47, 5.5)")
    ok = wait_for(pg, lambda: st(pg)["scene"] == "levelComplete")
    s = st(pg)
    check(ok and s["sceneStack"] == ["playing", "levelComplete"], "exit -> level complete overlay")
    check("levelComplete" in s["inputLocks"], "gameplay locked during the celebration")
    save = stored_save(pg)
    check(save["flags"].get("levelComplete.test") is True and save["checkpointId"] is None, f"level complete autosaves ({save})")
    time.sleep(1.4)
    nar = st(pg)["narrator"]["current"]
    check(nar is not None and nar["id"] == "levelComplete.common", f"narrator remark plays ({nar and nar['id']})")
    harness.shot(pg, "screens_06_level_complete")
    press(pg, "Space", 0.8)
    check(st(pg)["menu"]["screen"] == "toBeContinued", "no nextLevel -> To be continued")
    time.sleep(0.8)
    harness.shot(pg, "screens_07_to_be_continued")
    press(pg, "Enter", 0.5)
    harness.wait_scene(pg, "title")
    s = st(pg)
    check(s["sceneStack"] == ["title"] and s["inputLocks"] == [], "To be continued -> title, input unlocked")


def next_level_path(pg):
    pg.evaluate("window.__sammy.commands.loadLevel('test')")
    wait_level(pg)
    time.sleep(0.3)
    pg.evaluate("window.__sammy.commands.emit('level:complete', {id: 'end', levelId: 'test', nextLevel: 'test'})")
    harness.wait_scene(pg, "levelComplete")
    time.sleep(1.4)
    pg.mouse.down()
    time.sleep(0.08)
    pg.mouse.up()
    ok = wait_for(pg, lambda: st(pg)["sceneStack"] == ["playing"])
    check(ok, "nextLevel set -> click continues into the next level")


def blocked_storage(pg):
    wait_level(pg)
    pg.evaluate("(() => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; })()")
    pg.evaluate("window.__sammy.commands.teleport(25, 4.5)")
    ok = wait_for(pg, lambda: (st(pg)["save"] or {}).get("checkpointId") == "middle")
    s = st(pg)
    check(ok and s["saveStatus"]["storageOk"] is False and s["scene"] == "playing",
          "blocked storage: save kept in memory, game keeps running")


def main():
    with harness.session(start_level=None) as s:
        pg = s.page
        steps = [title_checks, checkpoint_autosave, pause_checks, quit_and_continue,
                 overwrite_confirm, level_complete, next_level_path, blocked_storage]
        for step in steps:
            try:
                step(pg)
            except Exception as error:
                check(False, f"{step.__name__} crashed: {error}")
                break
        pg.evaluate("window.__sammy.commands.clearSave()")
        check(st(pg)["save"] is None, "clearSave() deletes the save")
    for e in s.errors:
        check(False, e)
    print("FAIL" if fails else "PASS", f"({len(fails)} failures)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
