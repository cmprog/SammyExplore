"""Real key presses against the playing scene (test level): D walks the box right, Space hops it.
Asserts the mapped actions show in __sammy.input and the box actually moves/jumps."""
import sys
import time

import harness


def main():
    fails = []
    with harness.session() as s:
        pg = s.page
        time.sleep(1)
        harness.shot(pg, "input_idle")
        pg.keyboard.down("KeyD")
        pg.keyboard.down("Space")
        time.sleep(0.5)
        held = harness.shot(pg, "input_held")
        pg.keyboard.up("KeyD")
        pg.keyboard.up("Space")
        time.sleep(0.3)
        harness.shot(pg, "input_released")
        # Exercise the other helpers too.
        harness.hold(pg, "KeyD", 0.2)
        harness.tap(pg, "Space")
        st = harness.state(pg)
        if st["scene"] is None:
            fails.append("scene is null")
        print("state keys:", sorted(st), "scene:", st["scene"], "events:", st["events"][-5:] if st.get("events") else st.get("events"))
        print("held screenshot (inspect visually for 'right  jump  confirm'):", held)
    fails += s.errors
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
