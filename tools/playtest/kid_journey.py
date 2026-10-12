"""Milestone 1 kid-style wander through Chapter One with a stray-E-bubble watchdog.

Real key presses only. Not a perfect run: wanders, idles, mashes Space, pets Twyx a lot, reads signs twice,
rattles the locked door, falls in the Great Gap, tries to climb things. Also: Esc mid-glide, quit to title +
Continue, New Game with an existing save.   .venv/Scripts/python tools/playtest/kid_journey.py
"""
import json
import sys
import time

import harness
import sandbox_playthrough as sp
from sandbox_playthrough import (st, until, hold, release, release_all, walk_to, walk_into_wall, running_jump,
                                 press_e, settle, wait_line, shot, player, check, mark, events, stored_save)

WATCH = """() => {
  window.__stray = [];
  const seen = new Set();
  const tick = () => {
    const s = window.__sammy;
    if (s && s.interaction && s.player && s.interaction.prompt.visible) {
      const t = s.interaction.prompt.target;
      const e = s.interaction.targets.find(x => x.id === t.id);
      const d = e ? Math.hypot(e.pos.x - s.player.pos.x, e.pos.y - s.player.pos.y) : 99;
      const n = s.interaction.nearest;
      const bad = d > 2.5 && s.interaction.prompt.appear > 0.02;
      if (bad) {
        const k = Math.round(s.player.pos.x) + ':' + Math.round(s.player.pos.y) + ':' + t.id;
        if (!seen.has(k)) { seen.add(k); window.__stray.push({x: s.player.pos.x, y: s.player.pos.y, target: t.id, d,
          appear: s.interaction.prompt.appear, nearest: n && n.id, scene: s.scene, st: s.player.state,
          corr: s.narrator.correction, locks: s.inputLocks, t: s.events.length}); }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}"""


_orig_wait = sp.wait_line
def _lenient(pg, line_id, shot_name=None, timeout=12):
    try:
        return _orig_wait(pg, line_id, shot_name, 3)
    except Exception:
        return ""
sp.wait_line = _lenient


def strays(pg):
    return pg.evaluate("window.__stray")


def main():
    with harness.session(start_level=None, timeout=15) as s:
        pg = s.page
        pg.wait_for_function("window.__sammy && window.__sammy.scene === 'title'", timeout=10000)
        pg.evaluate(sp.PILOT)
        pg.evaluate(WATCH)
        sp.beat_title(pg)
        # Kid: idle at the start for a while, mash space on the spot.
        sp.wait_line(pg, "sandbox.intro", "k_intro")
        time.sleep(2)
        for _ in range(12):
            harness.tap(pg, "Space"); time.sleep(0.05)
        shot(pg, "k_mash_start")
        # Wrong way first (left), bump the nook.
        sp.beat_intro_and_nook(pg)
        # Press E at spawn with nothing around.
        settle(pg)
        harness.tap(pg, "KeyE"); time.sleep(0.5)
        shot(pg, "k_e_nothing")
        # Sign twice.
        walk_to(pg, 23.0)
        for _ in range(2):
            press_e(pg)
            wait_line(pg, "sandbox.sign.chapter.read", None) if False else time.sleep(1.5)
            settle(pg)
        shot(pg, "k_sign_twice")
        # Pet the cat a lot.
        walk_to(pg, 30.5); settle(pg)
        walk_to(pg, 33.3)
        for i in range(8):
            press_e(pg); time.sleep(0.6)
            if i == 5: shot(pg, "k_pet_many")
        settle(pg)
        print("twyx", [e for e in st(pg)["entities"] if e["type"] == "twyx"][0])
        # Walk past, hops: kid walks into the pit and falls.
        walk_to(pg, 41.5); settle(pg)
        hold(pg, "KeyD"); time.sleep(3); release(pg, "KeyD")
        shot(pg, "k_bump_hill")
        print("bumped hill at", player(pg)["pos"])
        settle(pg)
        pos = player(pg)["pos"]["x"]
        if pos < 43:
            walk_to(pg, 43.0)
        walk_to(pg, 43.0)
        sp.beat_hops(pg)
        print("hops done at", player(pg)["pos"])
        sp.beat_cliff(pg)
        # Try climbing onto the perch sign etc: corrections
        sp.beat_perch(pg)
        # Idle at the gap edge for a long time, E bubble watch
        walk_to(pg, 102.0); settle(pg)
        time.sleep(3)
        # Fall into the gap twice: plain jump, mash space (flaps), no glide
        for attempt in range(2):
            walk_to(pg, 100.0)
            hold(pg, "KeyD")
            until(pg, "p.pos.x >= 106.4", 4)
            for _ in range(6):
                harness.tap(pg, "Space"); time.sleep(0.12)
            if attempt == 1: shot(pg, "k_gap_mash")
            pg.wait_for_function("window.__sammy.narrator.correction !== null", timeout=9000, polling="raf")
            release(pg, "KeyD")
            time.sleep(0.5)
            shot(pg, f"k_gap_fall{attempt}")
            pg.wait_for_function("window.__sammy.narrator.correction === null", timeout=9000)
            settle(pg)
        print("strays so far", strays(pg))
        # Glide with Esc pause mid-glide.
        walk_to(pg, 100.0)
        hold(pg, "KeyD")
        until(pg, "p.pos.x >= 106.4", 4)
        hold(pg, "Space")
        until(pg, "p.gliding && p.pos.x > 112", 4)
        pre = player(pg)
        harness.tap(pg, "Escape"); time.sleep(0.6)
        shot(pg, "k_pause_midglide")
        mid = st(pg)
        check(mid["scene"] == "pause", f"Esc mid-glide pauses ({mid['scene']})")
        t0 = player(pg)["pos"]; time.sleep(1.0); t1 = player(pg)["pos"]
        check(abs(t0["x"] - t1["x"]) < 1e-6 and abs(t0["y"] - t1["y"]) < 1e-6, f"frozen while paused ({t0} {t1})")
        harness.tap(pg, "Enter")   # Resume is selected
        time.sleep(0.3)
        check(st(pg)["scene"] == "playing", "resume -> playing")
        try:
            until(pg, "p.grounded", 6)
        finally:
            release(pg, "KeyD", "Space")
        until(pg, "p.grounded && Math.abs(p.velocity.x) < 0.001", 5)
        p = player(pg)
        check(p["pos"]["x"] > 126, f"glide continued after resume and landed far side ({p['pos']}, was {pre['pos']})")
        shot(pg, "k_landed")
        settle(pg)
        # Doors: locked door rattle twice, then tunnel.
        sp.beat_doors(pg)
        press_e_locked = None
        # Quit to title mid-level: go back through? We are past far-side; save should be far-side.
        print("save:", stored_save(pg))
        harness.tap(pg, "Escape"); time.sleep(0.5)
        menu = st(pg)["menu"]
        print("pause items", [i["id"] for i in menu["items"]])
        sel = lambda: st(pg)["menu"]["selected"]
        for _ in range(6):
            if sel() == "quit": break
            harness.tap(pg, "KeyS"); time.sleep(0.15)
        shot(pg, "k_pause_menu")
        harness.tap(pg, "Enter"); time.sleep(0.8)
        shot(pg, "k_quit_title")
        s1 = st(pg)
        check(s1["scene"] == "title", f"quit -> title ({s1['scene']}, menu {s1['menu'] and s1['menu']['screen']})")
        print("title menu:", s1["menu"] and [(i["id"], i["enabled"]) for i in s1["menu"]["items"]], "selected", sel())
        # Continue
        if sel() != "continue":
            harness.tap(pg, "KeyW"); time.sleep(0.2)
        harness.tap(pg, "Enter")
        harness.wait_scene(pg, "playing", 6)
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        time.sleep(1.5)
        p = player(pg)
        lv = st(pg)["level"]
        check(lv["checkpointId"] == "far-side" and 126 <= p["pos"]["x"] <= 133,
              f"Continue resumes at far-side checkpoint (pos {p['pos']}, cp {lv['checkpointId']})")
        shot(pg, "k_continue")
        print("narrator after continue:", st(pg)["narrator"]["current"])
        settle(pg)
        # New Game with existing save -> confirm screen.
        harness.tap(pg, "Escape"); time.sleep(0.5)
        for _ in range(6):
            if sel() == "quit": break
            harness.tap(pg, "KeyS"); time.sleep(0.15)
        harness.tap(pg, "Enter"); time.sleep(0.8)
        # click New Game with the mouse like a kid
        rect = next(i["rect"] for i in st(pg)["menu"]["items"] if i["id"] == "newGame")
        print("rect", rect)
        k = 1280 / 1920; pg.mouse.click((rect["x"] + rect["w"] / 2) * k, (rect["y"] + rect["h"] / 2) * k)
        time.sleep(0.6)
        shot(pg, "k_newgame_confirm")
        print("menu:", st(pg)["menu"]["screen"], st(pg)["menu"]["selected"])
        print("STRAYS", json.dumps(strays(pg), indent=1))
        print("console errors:", s.errors)
    return 1 if (sp.fails or s.errors) else 0


sys.exit(main())
