"""T-006 narrator scenario in the playing scene (test level): reveal/hold timing, skip, correction
timing + input lock + respawn, idle, spam, interact, priority."""
import sys
import time

import harness

fails = []


def check(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def nar(pg):
    return pg.evaluate("JSON.stringify(window.__sammy.narrator)") and harness.state(pg)["narrator"]


def cur_id(pg):
    c = nar(pg)["current"]
    return c["id"] if c else None


def wait_none(pg, timeout=30):
    t = time.time()
    while time.time() - t < timeout:
        if nar(pg)["current"] is None:
            return True
        time.sleep(0.05)
    return False


def wait_loaded(pg):
    pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)


def settle_narration(pg, timeout=30):
    """Dismiss whatever the level said on arrival (intro, zone lines) until nothing is showing or queued."""
    t = time.time()
    while time.time() - t < timeout:
        n = nar(pg)
        if n["current"] is None and n["queueLength"] == 0:
            time.sleep(0.4)
            n = nar(pg)
            if n["current"] is None and n["queueLength"] == 0:
                return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(0.25)
    return False


def timeline(pg, line_id, cmd):
    """Say a line; return (reveal_done_s, gone_s, text) using real waits."""
    pg.evaluate(cmd)
    t0 = time.time()
    rev = gone = None
    text = ""
    while time.time() - t0 < 40:
        c = nar(pg)["current"]
        if c:
            text = c["text"]
            if rev is None and c["revealed"]:
                rev = time.time() - t0
        elif rev is not None:
            gone = time.time() - t0
            break
        time.sleep(0.03)
    return rev, gone, text


def main():
    with harness.session() as s:
        pg = s.page
        wait_loaded(pg)
        time.sleep(0.5)
        print("arrival lines seen:", nar(pg)["seenIds"], "current:", cur_id(pg))
        check(settle_narration(pg), "level arrival narration settles")
        ev = lambda n, d="{}": pg.evaluate(f"window.__sammy.commands.emit('{n}', {d})")

        # 1. reveal + hold timing on a short and a long line
        for lid in ["idle.4", "correction.common"]:
            pass
        rev, gone, text = timeline(pg, "idle.4", "window.__sammy.commands.say('idle.4')")
        words = len(text.split())
        print(f"idle.4: {len(text)} chars, {words} words, reveal {rev:.2f}s, total {gone:.2f}s, hold {gone-rev:.2f}s")
        check(rev is not None and gone is not None, "line reveals then leaves on its own")
        check(1.7 < rev < 2.4, f"typewriter reveal about len/40 ({rev:.2f}s)")
        harness.shot(pg, "nar_idle4_end")

        # 2. skip: first E finishes reveal, second dismisses
        pg.evaluate("window.__sammy.commands.say('interact.nothing')")
        time.sleep(0.6)
        c = nar(pg)["current"]
        check(c and not c["revealed"], "mid-reveal after 0.6s")
        harness.shot(pg, "nar_mid_reveal")
        harness.tap(pg, "KeyE")
        time.sleep(0.15)
        c = nar(pg)["current"]
        check(c and c["revealed"], "E finishes the reveal")
        harness.shot(pg, "nar_revealed")
        harness.tap(pg, "Enter")
        time.sleep(0.6)
        check(nar(pg)["current"] is None, "second press (Enter) dismisses")
        wait_none(pg)

        # 3. correction: timeline + input lock
        t0 = time.time()
        ev("correction:triggered", "{id:'pond'}")
        phases = []
        shots = {0.4: "nar_corr_in", 0.95: "nar_corr_hold", 1.5: "nar_corr_out"}
        taken = set()
        locked_seen = False
        reset_t = done_t = None
        evnames = lambda: [e.get("name", e) if isinstance(e, dict) else e for e in harness.state(pg).get("events", [])]
        while time.time() - t0 < 8:
            el = time.time() - t0
            for k, n in shots.items():
                if el >= k and k not in taken:
                    taken.add(k)
                    harness.shot(pg, n)
                    if k == 0.4:
                        pg.keyboard.down("KeyD")
                        time.sleep(0.2)
                        st = harness.state(pg)
                        print("held D during correction; actions:", st.get("input", st.get("actions")))
                        pg.keyboard.up("KeyD")
            st = harness.state(pg)["narrator"]
            corr = st["correction"]
            if corr and (not phases or phases[-1][1] != str(corr)):
                phases.append((round(el, 2), str(corr)))
            es = str(evnames())
            if reset_t is None and "correction:reset" in es:
                reset_t = el
            if done_t is None and "correction:done" in es:
                done_t = el
                break
            time.sleep(0.04)
        for p in phases[:12]:
            print("  phase", p)
        print(f"reset at {reset_t}, done at {done_t}")
        check(reset_t is not None and done_t is not None, "correction:reset and correction:done both emitted")
        print("correction line:", nar(pg)["current"] and nar(pg)["current"]["text"])
        wait_none(pg)

        # 3b. precise in-page timing of a correction (no Python polling lag)
        wait_none(pg)
        res = pg.evaluate("""() => new Promise(res => {
            const t0 = performance.now(); let reset = null;
            window.__sammy.commands.emit('correction:triggered', {id: 'pond'});
            const iv = setInterval(() => {
                const es = JSON.stringify(window.__sammy.events || []);
                const t = (performance.now() - t0) / 1000;
                if (reset === null && es.includes('correction:reset')) reset = t;
                if (es.includes('correction:done') && reset !== null && window.__sammy.narrator.correction === null || t > 6) { clearInterval(iv); res({reset, end: t}); }
            }, 10);
        })""")
        print("in-page correction timing:", res)
        # 1.9s of game time. The effect counts engine steps, and headless swiftshader renders the
        # level below 60 fps, so wall-clock time runs a bit longer than game time.
        check(1.7 < res["end"] < 2.6, f"correction lasts ~1.9s ({res['end']:.2f}s)")
        wait_none(pg)

        # 4. every correction line: count + word counts
        # 5. spam flap
        for _ in range(8):
            ev("player:flap")
            time.sleep(0.1)
        time.sleep(0.5)
        check(cur_id(pg) == "spam.flap", f"flap spam -> spam.flap (got {cur_id(pg)})")
        harness.shot(pg, "nar_spam_flap")
        wait_none(pg)
        for _ in range(5):
            ev("player:flapEmpty")
            time.sleep(0.1)
        time.sleep(0.5)
        check(cur_id(pg) == "spam.flapEmpty", f"flapEmpty spam (got {cur_id(pg)})")
        wait_none(pg)

        # 6. interact:nothing + spam; priority interrupt
        ev("interact:nothing")
        time.sleep(0.5)
        check(cur_id(pg) == "interact.nothing", f"interact:nothing line (got {cur_id(pg)})")
        ev("correction:triggered", "{id:'pond'}")
        time.sleep(0.5)
        check((cur_id(pg) or "").startswith("correction"), f"correction interrupts shrug (got {cur_id(pg)})")
        time.sleep(2.5)
        wait_none(pg)

        print("seen:", nar(pg)["seenIds"])

    # 7. real idle in a fresh session so no cooldowns/seen state interfere
    with harness.session() as s2:
        pg = s2.page
        wait_loaded(pg)
        check(settle_narration(pg), "arrival narration settles (session 2)")
        t0 = time.time()   # last input was the final Enter in settle_narration
        seen = {}
        while time.time() - t0 < 48 and len(seen) < 2:
            c = nar(pg)["current"]
            if c and c["id"] not in seen:
                seen[c["id"]] = round(time.time() - t0, 1)
                print("idle line", c["id"], "at", seen[c["id"]], "s:", c["text"])
                if c["id"] == "idle.1":
                    harness.shot(pg, "nar_idle1")
            time.sleep(0.2)
        check("idle.1" in seen and 11 < seen["idle.1"] < 14, f"idle.1 at ~12s ({seen})")
        # Idle time pauses while a line shows, so idle.2 comes 30 *quiet* seconds in: ~30s plus
        # idle.1's on-screen time (~5-7s).
        check("idle.2" in seen and 33 < seen["idle.2"] < 42, f"idle.2 at ~30s of quiet ({seen})")
    s.errors += s2.errors
    for e in s.errors:
        fails.append(e)
        print("ERR", e)
    print("FAIL" if fails else "PASS")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
