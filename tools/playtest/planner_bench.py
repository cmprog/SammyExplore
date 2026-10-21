"""Planner cost benchmark (T-015 review): average time per catNavigation.planLeap call, in page.

Cases on the companion course, with Twyx as the companion:
  - gap_fail: at the edge of the 4-wide bridge gap (bridge up), aiming at the far side. No leap
    exists, so every candidate arc is simulated: the worst case, and what a waiting cat re-checks.
  - step_up: at the foot of the 2-tile step, aiming at its top (succeeds early).
  - drop: at the top of the 3-tile drop, aiming at the ground below.

    .venv/Scripts/python tools/playtest/planner_bench.py
"""
import json
import sys

import harness

BENCH = """async () => {
    const nav = await import('/src/systems/catNavigation.js');
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const cat = m.engineObjects.find(o => o.catId && o.companion);
    const cases = {
        gap_fail: { feet: [32.85, 4], target: { x: 38.5, y: 4 } },
        step_up:  { feet: [13.55, 5], target: { x: 15.5, y: 7 } },
        drop:     { feet: [17.85, 7], target: { x: 20, y: 4 } },
    };
    const out = {};
    for (const [name, c] of Object.entries(cases))
    {
        const feet = m.vec2(...c.feet), solids = nav.blockersFor(cat);
        const accepts = l => Math.abs(l.feet.y - c.target.y) < .35;
        let found = null;
        const runs = 300, t0 = performance.now();
        for (let i = 0; i < runs; i++)
            found = nav.planLeap(cat, feet, { toward: c.target, accepts }, solids);
        out[name] = { msPerCall: (performance.now() - t0) / runs, found: !!found };
    }
    return out;
}"""


def main():
    with harness.session(start_level="companion") as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("__sammy.commands.setCompanion('twyx')")
        pg.wait_for_timeout(500)
        result = pg.evaluate(BENCH)
        for name, r in result.items():
            print(f"{name:<10} {r['msPerCall']:.4f} ms/call  found={r['found']}")
        print(json.dumps(result))
    return 1 if s.errors else 0


if __name__ == "__main__":
    sys.exit(main())
