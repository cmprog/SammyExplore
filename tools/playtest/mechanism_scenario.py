"""T-014 mechanism scenario (test level), with real E presses on the levers.

For each lever + target pair it checks the events (interact:lever, mechanism:toggle, the target's
own move event), the target's state, that its collision changes, and that Sammy can stand on it
or pass it as expected:
  - bridge: Sammy falls through the gap while it is up; E lowers it; he stands on it and walks
    across; E raises it and he drops through again. Thrown while he stands on it, it stays down
    (held) until he steps off, and only then announces bridge:move {down: false} and rises.
  - gate: blocks Sammy while closed; E opens it and he walks through; closing it on top of him
    doesn't trap him (he walks out).
  - lift: Sammy stands on it, E sends it up and to the right; he rides it every frame with his
    feet on the plate (no jitter); thrown back (debug), it carries him down without him falling
    through or leaving it. A Space press on the last step before landing on the plate is a
    buffered jump (not a flap), with no position snap (ground probes have no side effects).
  - levers follow their targets: a gate changed directly makes its lever show it, and the next
    throw sends the opposite of the gate's real state.
Also: a cycle-mode lever (built in page) emits mechanism:cycle and springs back; a loop-mode lift
(built in page) shuttles and stops after its trip when switched off; target validation;
__sammy.mechanisms and __sammy.commands.activate; a level reload resets everything (not saved).
Screenshots go to out/mech_*.png.

Test level layout (world units, y up): ground top y = 4; the bridge spans the gap x 28..32 at
y = 4 (lever x 26.5); the sky lab ledge is x 7..11, top y = 11 (gate-lever x 7.5, gate x 9.5,
lift-lever x 10.5); the lift plate (2 wide) starts at x 11..13 top 11 and goes to x 15..17 top 14.
"""
import sys
import time

import harness

GROUND = 4.45   # Sammy's center standing on the ground (feet at 4, hitbox 0.9 tall)
LAB = 11.45     # ... on the sky lab ledge
HALF_H = 0.45
WATCHED = ["interact:lever", "mechanism:toggle", "mechanism:cycle", "bridge:move", "gate:move",
           "lift:move", "lift:arrive", "lift:held", "interact:nothing", "correction:triggered",
           "player:jump", "player:flap", "player:land"]

fails = []


def check(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)


def st(pg):
    return harness.state(pg)


def player(pg):
    return st(pg)["player"]


def mech(pg, mech_id):
    return next(m for m in st(pg)["mechanisms"] if m["id"] == mech_id)


def nearest_id(pg):
    n = st(pg)["interaction"]["nearest"]
    return n["id"] if n else None


def install_recorder(pg):
    # Note: Mechanisms subscribed to mechanism:toggle before this recorder, so a target's move
    # event (emitted from inside that handler) is recorded before the toggle itself.
    pg.evaluate("""async names => {
        const bus = await import('/src/core/events.js');
        const fresh = !window.__rec;
        window.__rec = [];
        if (fresh)
            for (const n of names) bus.on(n, d => window.__rec.push({n, d}));
    }""", WATCHED)


def rec(pg):
    return pg.evaluate("window.__rec")


def mark(pg):
    return len(rec(pg))


def since(pg, start, name=None):
    return [e for e in rec(pg)[start:] if name is None or e["n"] == name]


def settle(pg, timeout=30):
    """Dismiss narration with Enter (never E) until nothing is showing or queued."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        n = st(pg)["narrator"]
        if n["current"] is None and n["queueLength"] == 0:
            time.sleep(0.3)
            n = st(pg)["narrator"]
            if n["current"] is None and n["queueLength"] == 0:
                return True
        if n["current"]:
            harness.tap(pg, "Enter")
        time.sleep(0.25)
    return False


def stand(pg, x, y, wait=0.6):
    pg.evaluate(f"__sammy.commands.teleport({x}, {y})")
    time.sleep(wait)


def wait_until(pg, fn, timeout=3.0, step=0.05):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if fn():
            return True
        time.sleep(step)
    return False


def press_e(pg, expect_nearest):
    settle(pg)
    check(nearest_id(pg) == expect_nearest, f"E prompt is on {expect_nearest} (nearest {nearest_id(pg)})")
    start = mark(pg)
    harness.tap(pg, "KeyE")
    time.sleep(0.15)
    return start


def names_since(pg, start):
    return [e["n"] for e in since(pg, start)]


# -- per-frame recorder for riding the lift ---------------------------------------------------

def start_ride_log(pg):
    pg.evaluate("""() => {
        window.__ride = [];
        const loop = () => {
            const h = window.__sammy, p = h.player, l = h.mechanisms.find(m => m.id === 'lab-lift');
            if (p && l)
                window.__ride.push({feet: p.pos.y - p.size.y / 2, x: p.pos.x, grounded: p.grounded,
                    top: l.pos.y + l.size.y / 2, t: l.t, moving: l.moving});
            if (window.__ride) window.__rideId = requestAnimationFrame(loop);
        };
        loop();
    }""")


def stop_ride_log(pg):
    return pg.evaluate("() => { cancelAnimationFrame(window.__rideId); const r = window.__ride; window.__ride = null; return r; }")


# -- tests --------------------------------------------------------------------------------------

def test_bridge(pg):
    b = mech(pg, "meadow-bridge")
    check(not b["active"] and b["lowered"] == 0 and not b["solid"], f"bridge starts raised and not solid: {b}")
    harness.shot(pg, "mech_bridge_raised")
    stand(pg, 30, GROUND + 1.5, wait=0.3)
    y = player(pg)["pos"]["y"]
    check(y < GROUND - 0.5, f"raised bridge: Sammy drops into the gap (y {y:.2f})")
    stand(pg, 26.0, GROUND)

    start = press_e(pg, "bridge-lever")
    names = names_since(pg, start)
    check(names[:1] == ["interact:lever"] and set(names[1:3]) == {"mechanism:toggle", "bridge:move"},
          f"E: interact:lever, mechanism:toggle, bridge:move: {names}")
    tog = since(pg, start, "mechanism:toggle")
    check(tog and tog[0]["d"] == {"id": "bridge-lever", "on": True, "targets": ["meadow-bridge"]},
          f"mechanism:toggle payload {tog[:1]}")
    mv = since(pg, start, "bridge:move")
    check(mv and mv[0]["d"] == {"id": "meadow-bridge", "down": True}, f"bridge:move payload {mv[:1]}")
    check(st(pg)["audio"]["lastSound"] in ("leverThrow", "bridgeMove"), f"a mechanism sound played ({st(pg)['audio']['lastSound']})")
    time.sleep(0.3)
    harness.shot(pg, "mech_bridge_lowering")
    check(wait_until(pg, lambda: mech(pg, "meadow-bridge")["lowered"] == 1, timeout=2), "bridge lowers fully")
    check(mech(pg, "meadow-bridge")["solid"], "lowered bridge is solid")
    lever = mech(pg, "bridge-lever")
    check(lever["active"] and lever["throws"] == 1, f"lever is on: {lever}")

    stand(pg, 30, GROUND + 0.6, wait=0.7)
    p = player(pg)
    check(p["grounded"] and abs(p["pos"]["y"] - GROUND) < 0.03, f"Sammy stands on the lowered bridge: {p['pos']}")
    harness.shot(pg, "mech_bridge_down")

    stand(pg, 26.0, GROUND)
    low = 99
    pg.keyboard.down("KeyD")
    t0 = time.time()
    while time.time() - t0 < 1.4:
        low = min(low, player(pg)["pos"]["y"])
        time.sleep(0.03)
    pg.keyboard.up("KeyD")
    x = player(pg)["pos"]["x"]
    check(x > 32.3 and low > GROUND - 0.05, f"Sammy walks across the bridge (x {x:.2f}, lowest y {low:.2f})")

    stand(pg, 26.0, GROUND)
    start = press_e(pg, "bridge-lever")
    mv = since(pg, start, "bridge:move")
    check(mv and mv[0]["d"] == {"id": "meadow-bridge", "down": False}, f"E again raises it: {mv[:1]}")
    check(wait_until(pg, lambda: not mech(pg, "meadow-bridge")["solid"], timeout=1), "raising bridge stops being solid")
    stand(pg, 30, GROUND + 0.6, wait=0.3)
    y = player(pg)["pos"]["y"]
    check(y < GROUND - 0.5, f"raised again: Sammy drops through (y {y:.2f})")
    stand(pg, 26.0, GROUND)
    test_bridge_holds_while_occupied(pg)


def test_bridge_holds_while_occupied(pg):
    check(pg.evaluate("__sammy.commands.activate('bridge-lever', true)") is True, "lever lowers the bridge again")
    check(wait_until(pg, lambda: mech(pg, "meadow-bridge")["lowered"] == 1, timeout=2), "bridge is down")
    stand(pg, 30, GROUND + 0.3, wait=0.6)
    start = mark(pg)
    check(pg.evaluate("__sammy.commands.activate('bridge-lever', false)") is True, "lever thrown off while Sammy is on the bridge")
    time.sleep(1.5)
    b, p = mech(pg, "meadow-bridge"), player(pg)
    check(b["lowered"] == 1 and b["solid"] and b["held"] and not b["active"],
          f"the bridge stays down (held) while Sammy stands on it: {b}")
    check(p["grounded"] and abs(p["pos"]["y"] - GROUND) < 0.03, f"...and Sammy is still standing on it: {p['pos']}")
    check(not since(pg, start, "bridge:move"), f"no bridge:move while held: {since(pg, start, 'bridge:move')}")
    check(not mech(pg, "bridge-lever")["active"], "the lever shows its target is off")
    harness.shot(pg, "mech_bridge_held")
    harness.hold(pg, "KeyD", 1.0)
    x = player(pg)["pos"]["x"]
    check(x > 32.4, f"Sammy walks off the bridge (x {x:.2f})")
    check(wait_until(pg, lambda: not mech(pg, "meadow-bridge")["solid"], timeout=1.5), "once he is off, it rises")
    mv = since(pg, start, "bridge:move")
    check(mv and mv[0]["d"] == {"id": "meadow-bridge", "down": False}, f"bridge:move {{down: false}} when it actually starts rising: {mv}")
    stand(pg, 26.0, GROUND)


def test_gate(pg):
    g = mech(pg, "lab-gate")
    check(not g["active"] and not g["passable"], f"gate starts closed: {g}")
    stand(pg, 8.0, LAB)
    harness.hold(pg, "KeyD", 0.6)
    x = player(pg)["pos"]["x"]
    check(x < 9.1 - 0.4 + 0.02, f"closed gate blocks Sammy (x {x:.2f})")
    harness.shot(pg, "mech_gate_closed")

    start = press_e(pg, "gate-lever")
    names = names_since(pg, start)
    check(names[:1] == ["interact:lever"] and set(names[1:3]) == {"mechanism:toggle", "gate:move"},
          f"E: interact:lever, mechanism:toggle, gate:move: {names}")
    mv = since(pg, start, "gate:move")
    check(mv and mv[0]["d"] == {"id": "lab-gate", "open": True}, f"gate:move payload {mv[:1]}")
    time.sleep(0.25)
    g = mech(pg, "lab-gate")
    check(0 < g["open"] < 1 and g["size"]["y"] < 2, f"sinking, its collision box shrinks with the drawn wall: {g}")
    harness.shot(pg, "mech_gate_opening")
    check(wait_until(pg, lambda: mech(pg, "lab-gate")["open"] == 1, timeout=2), "gate opens fully")
    check(mech(pg, "lab-gate")["passable"], "open gate is passable")
    harness.shot(pg, "mech_gate_open")
    harness.hold(pg, "KeyD", 0.5)
    x = player(pg)["pos"]["x"]
    check(x > 9.9 + 0.4, f"Sammy walks through the open gate (x {x:.2f})")

    # Close it on top of him: he must be able to walk out, not be stuck inside.
    stand(pg, 9.5, LAB)
    pg.evaluate("__sammy.commands.activate('lab-gate', false)")
    check(wait_until(pg, lambda: not mech(pg, "lab-gate")["passable"], timeout=1.5), "gate closes")
    harness.hold(pg, "KeyD", 0.3)
    x = player(pg)["pos"]["x"]
    check(x > 9.9 + 0.4, f"a gate closing on Sammy doesn't trap him (x {x:.2f})")
    check(mech(pg, "lab-gate")["excused"] == 0, "once he's clear, the gate stops excusing him")
    stand(pg, 11.0, LAB)   # back on the ledge (a long walk can carry him off the far end of the lift)
    harness.hold(pg, "KeyA", 0.6)
    x = player(pg)["pos"]["x"]
    check(x > 9.9 + 0.38, f"...and once he's out, it blocks him again (x {x:.2f}, gate {mech(pg, 'lab-gate')})")
    # The gate was closed directly, not by its lever: the lever must show that...
    check(wait_until(pg, lambda: not mech(pg, "gate-lever")["active"], timeout=0.5),
          f"the lever follows its gate being closed by something else: {mech(pg, 'gate-lever')}")
    # ...so a real E throw now opens it again (the opposite of the gate's real state).
    stand(pg, 8.2, LAB)
    start = press_e(pg, "gate-lever")
    tog = since(pg, start, "mechanism:toggle")
    check(tog and tog[0]["d"]["on"] is True, f"the next throw sends the opposite of the gate's state: {tog[:1]}")
    check(wait_until(pg, lambda: mech(pg, "lab-gate")["passable"], timeout=1.5), "gate is open again for the lift test")
    check(mech(pg, "gate-lever")["active"], "and the lever shows on")


def test_lift(pg):
    lift = mech(pg, "lab-lift")
    check(lift["at"] == "a" and not lift["active"], f"lift waits at A: {lift}")
    stand(pg, 11.6, LAB, wait=0.7)
    p = player(pg)
    check(p["grounded"] and abs(p["pos"]["y"] - LAB) < 0.03, f"Sammy stands on the lift at A: {p['pos']}")
    harness.shot(pg, "mech_lift_a")

    start = press_e(pg, "lift-lever")
    start_ride_log(pg)
    names = names_since(pg, start)
    check(names[:2] == ["interact:lever", "mechanism:toggle"], f"E: interact:lever, mechanism:toggle: {names}")
    check(wait_until(pg, lambda: since(pg, start, "lift:move"), timeout=1.5), "lift sets off after winding up")
    mv = since(pg, start, "lift:move")
    check(mv and mv[0]["d"] == {"id": "lab-lift", "toward": "b"}, f"lift:move payload {mv[:1]}")
    time.sleep(0.9)
    harness.shot(pg, "mech_lift_riding_up")
    check(wait_until(pg, lambda: since(pg, start, "lift:arrive"), timeout=5), "lift arrives at B")
    time.sleep(0.2)
    ride = stop_ride_log(pg)
    arr = since(pg, start, "lift:arrive")
    check(arr and arr[0]["d"] == {"id": "lab-lift", "at": "b"}, f"lift:arrive payload {arr[:1]}")
    check_ride(ride, "up")
    p = player(pg)
    check(p["grounded"] and abs(p["pos"]["y"] - (14 + HALF_H)) < 0.03 and p["pos"]["x"] > 15.2,
          f"Sammy arrived at B on the plate: {p['pos']}")
    harness.shot(pg, "mech_lift_b")

    start = mark(pg)
    start_ride_log(pg)
    check(pg.evaluate("__sammy.commands.activate('lift-lever', false)") is True, "activate('lift-lever', false) sends it back")
    check(wait_until(pg, lambda: since(pg, start, "lift:arrive"), timeout=6), "lift comes back down to A")
    time.sleep(0.2)
    ride = stop_ride_log(pg)
    check_ride(ride, "down")
    p = player(pg)
    check(p["grounded"] and abs(p["pos"]["y"] - LAB) < 0.03, f"Sammy rode it back down to A: {p['pos']}")
    test_buffered_jump_onto_lift(pg)
    stand(pg, 8.2, LAB)   # out of the lift's way
    test_lift_holds(pg)


STEP_HOOK = """async () => {
    const m = await import('littlejs');
    const sammy = m.engineObjects.find(o => o.constructor.name === 'Sammy');
    const proto = Object.getPrototypeOf(sammy);
    if (proto.__hooked) return;
    proto.__hooked = true;
    const orig = proto.update;
    window.__stepPre = [];
    window.__steps = [];
    proto.update = function (...a) {
        for (const f of window.__stepPre.slice()) f();
        window.__steps.push({y: this.pos.y, vy: this.velocity.y, grounded: !!this.groundObject});
        if (window.__steps.length > 600) window.__steps.shift();
        return orig.apply(this, a);
    };
}"""

LAST_STEP_PRESS = """([top, half]) => new Promise(resolve => {
    // Right before each Sammy.update: when this step leaves him airborne above the plate and the
    // next one lands, press Space now (engine-step exact; Playwright key latency can't be).
    const hook = () => {
        const p = window.__sammy.player;
        const gap = p.pos.y - half - top;
        const step = -p.vel.y;
        if (!p.grounded && step > 0.1 && gap >= step && gap < 2 * step) {
            window.__stepPre.splice(window.__stepPre.indexOf(hook), 1);
            document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }));
            setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })), 300);
            resolve({ gap, step });
        } else if (p.grounded && gap < 0.01) {
            window.__stepPre.splice(window.__stepPre.indexOf(hook), 1);
            resolve(null);
        }
    };
    window.__stepPre.push(hook);
})"""


def test_buffered_jump_onto_lift(pg):
    """The landing probe (hasGroundWithin) asks the lift collideWithObject; that must not move
    Sammy. Falling at full speed onto the plate, a press on the last step before touchdown jumps."""
    check(mech(pg, "lab-lift")["at"] == "a", "lift is back at A")
    pg.evaluate(STEP_HOOK)
    stand(pg, 12, 16.5, wait=0)
    pg.evaluate("window.__steps = []")
    start = mark(pg)
    pressed = pg.evaluate(LAST_STEP_PRESS, [11.0, HALF_H])
    time.sleep(0.6)
    seq = [n for n in names_since(pg, start) if n.startswith("player:")]
    check(pressed is not None, f"pressed Space on the last step before landing on the lift ({pressed})")
    check("player:flap" not in seq and "player:jump" in seq and "player:land" in seq
          and seq.index("player:land") < seq.index("player:jump"),
          f"a buffered press landing on the lift jumps, not flaps: {seq}")
    steps = pg.evaluate("window.__steps")
    falling = []
    for st_ in steps:
        if st_["vy"] > 0:
            break
        falling.append(st_)
    jumps = [abs(b["y"] - a["y"]) for a, b in zip(falling, falling[1:])]
    worst = max(jumps) if jumps else 0
    rises = [b["y"] - a["y"] for a, b in zip(falling, falling[1:]) if b["y"] - a["y"] > 0.01]
    check(len(falling) > 5 and worst <= 0.38 + 0.01 and not rises,
          f"no position snap on the way down (largest step {worst:.3f}, rises {rises})")
    time.sleep(1.0)
    stand(pg, 11.6, LAB, wait=0.6)


def test_lift_holds(pg):
    """A mover (a stand-in for a cat, hanging in mid-air) parked across the lift's path: the lift
    stops short of it (lift:held, once) instead of pushing into it, and goes on once it's gone."""
    out = pg.evaluate("""async () => {
        const m = await import('littlejs');
        const h = window.__sammy;
        // Tall, parked beside the path so the plate (rising up and to the right) meets its side half way, not its feet. No gravity.
        const blocker = new m.EngineObject(m.vec2(15.5, 12.3), m.vec2(.8, 1.6));
        blocker.setCollision(true, false, true);
        blocker.gravityScale = 0;
        blocker.mass = 1;
        const lift = () => h.mechanisms.find(x => x.id === 'lab-lift');
        const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 30)); };
        h.commands.activate('lab-lift', true);
        await until(() => lift().held || lift().at === 'b', 8000);
        await new Promise(r => setTimeout(r, 400));   // still waiting a moment later
        const held = lift();
        blocker.destroy();
        await until(() => lift().at === 'b', 8000);
        const after = lift();
        h.commands.activate('lab-lift', false);
        return { held, after };
    }""")
    held, after = out["held"], out["after"]
    check(held["held"] and 0.2 < held["t"] < 0.8, f"the lift waits for someone in its way instead of pushing them: {held}")
    ev = since(pg, 0, "lift:held")
    check(len(ev) == 1 and ev[0]["d"] == {"id": "lab-lift"}, f"lift:held once per hold: {ev}")
    check(not after["held"] and after["t"] > 0.9, f"...and carries on once they're gone: {after}")
    wait_until(pg, lambda: mech(pg, "lab-lift")["at"] == "a", timeout=6)


def check_ride(ride, label):
    moving = [r for r in ride if r["moving"]]
    check(len(moving) > 20, f"{label}: recorded the trip ({len(moving)} frames)")
    gaps = [abs(r["feet"] - r["top"]) for r in moving]
    worst = max(gaps) if gaps else 99
    ungrounded = sum(1 for r in moving if not r["grounded"])
    check(worst < 0.02, f"{label}: Sammy's feet stay on the plate every frame (worst gap {worst:.4f})")
    check(ungrounded == 0, f"{label}: Sammy stays grounded the whole ride ({ungrounded} airborne frames)")


def test_cycle_lever(pg):
    """A cycle-mode lever (T-017's portal lever) built in page, targeting the gate: every throw
    emits mechanism:cycle, the gate (no cycle()) flips, and the handle springs back."""
    out = pg.evaluate("""async () => {
        const { Lever } = await import('/src/entities/Lever.js');
        const { Mechanisms } = await import('/src/systems/Mechanisms.js');
        const bus = await import('/src/core/events.js');
        const m = await import('littlejs');
        const got = [];
        const off = bus.on('mechanism:cycle', d => got.push(d));
        const lever = new Lever(m.vec2(3.5, 4.5), { id: 'cycle-test', targets: ['lab-gate'], mode: 'cycle' }, {});
        const before = window.__sammy.mechanisms.find(x => x.id === 'lab-gate').active;
        lever.interact();
        const after = window.__sammy.mechanisms.find(x => x.id === 'lab-gate').active;
        const thrownAngle = lever.restAngle();
        await new Promise(r => setTimeout(r, 600));
        const restAngle = lever.restAngle();
        lever.destroy();
        off();
        return { got, before, after, thrownAngle, restAngle, active: lever.active };
    }""")
    check(out["got"] == [{"id": "cycle-test", "targets": ["lab-gate"]}], f"cycle lever emits mechanism:cycle: {out['got']}")
    check(out["before"] != out["after"], f"a target without cycle() flips on mechanism:cycle ({out['before']} -> {out['after']})")
    check(out["thrownAngle"] < 0 < out["restAngle"] and out["active"] is False,
          f"cycle lever throws over and springs back ({out['thrownAngle']} then {out['restAngle']})")


def test_loop_lift(pg):
    """A loop-mode lift (built in page, up in the empty sky at the left): while active it shuttles
    A -> B -> A on its own; switched off mid-trip it finishes that trip and stops."""
    out = pg.evaluate("""async () => {
        const { Lift } = await import('/src/entities/Lift.js');
        const bus = await import('/src/core/events.js');
        const m = await import('littlejs');
        const got = [];
        const offs = ['lift:move', 'lift:arrive'].map(n => bus.on(n, d => d.id === 'loop-test' && got.push(n + ':' + (d.toward || d.at))));
        const lift = new Lift(m.vec2(2.5, 15.5), { id: 'loop-test', toX: 2, toY: 3, loop: true }, { levelSize: { x: 48, y: 18 } });
        lift.setActive(true);
        const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await new Promise(r => setTimeout(r, 30)); };
        await until(() => got.includes('lift:move:a'), 6000);
        lift.setActive(false);
        await until(() => got.filter(g => g.startsWith('lift:arrive')).length >= 2, 4000);
        await new Promise(r => setTimeout(r, 1500));
        const final = lift.debugState();
        lift.destroy();
        offs.forEach(off => off());
        return { got, at: final.at, moving: final.moving };
    }""")
    check(out["got"][:4] == ["lift:move:b", "lift:arrive:b", "lift:move:a", "lift:arrive:a"],
          f"loop lift shuttles A -> B -> A: {out['got']}")
    check(len(out["got"]) == 4 and out["at"] == "a" and not out["moving"],
          f"switched off mid-trip, it finishes the trip and stops: {out}")


def test_validation(pg):
    out = pg.evaluate("""async () => {
        const reg = await import('/src/entities/registry.js');
        const tries = {
            unknown: [{ type: 'lever', id: 'l', targets: ['nope'], x: 0, y: 0 }],
            notTarget: [{ type: 'lever', id: 'l', targets: ['s'], x: 0, y: 0 }, { type: 'sign', id: 's', key: 'k', x: 1, y: 0 }],
            ok: [{ type: 'lever', id: 'l', targets: ['g'], x: 0, y: 0 }, { type: 'gate', id: 'g', x: 1, y: 0 }],
        };
        const result = {};
        for (const [name, entities] of Object.entries(tries))
        {
            try { reg.validateMechanismLinks({ entities }, msg => { throw new Error(msg); }); result[name] = 'passed'; }
            catch (e) { result[name] = e.message; }
        }
        return result;
    }""")
    check("no entity has that id" in out["unknown"], f"unknown target id fails loudly: {out['unknown']}")
    check("can't be moved" in out["notTarget"], f"a non-target id fails loudly: {out['notTarget']}")
    check(out["ok"] == "passed", f"a lever targeting a gate validates: {out['ok']}")


def test_debug_hook(pg):
    ms = st(pg)["mechanisms"]
    ids = {m["id"]: m["type"] for m in ms}
    check(ids == {"bridge-lever": "lever", "meadow-bridge": "bridge", "gate-lever": "lever", "lab-gate": "gate",
                  "lift-lever": "lever", "lab-lift": "lift"}, f"__sammy.mechanisms lists them all: {ids}")
    check(all("active" in m and "role" in m for m in ms), "each reports role and active")


def test_reload_resets(pg):
    pg.evaluate("__sammy.commands.loadLevel('test')")
    time.sleep(0.5)
    pg.wait_for_function("window.__sammy.scene === 'playing' && window.__sammy.level && window.__sammy.level.loading === false")
    ms = {m["id"]: m["active"] for m in st(pg)["mechanisms"]}
    check(not any(ms.values()), f"reloading the level resets every mechanism (not saved): {ms}")


def main():
    with harness.session() as s:
        pg = s.page
        pg.wait_for_function("window.__sammy.level && window.__sammy.level.loading === false", timeout=10000)
        pg.evaluate("window.__sammy.commands.clearSave()")
        install_recorder(pg)
        settle(pg)
        test_debug_hook(pg)
        test_bridge(pg)
        test_gate(pg)
        test_lift(pg)
        test_cycle_lever(pg)
        test_loop_lift(pg)
        test_validation(pg)
        corrections = [e for e in rec(pg) if e["n"] == "correction:triggered"]
        check(not corrections, f"no corrections fired during the run: {corrections}")
        test_reload_resets(pg)

    print("console errors:", s.errors)
    fails.extend(s.errors)
    print("FAIL" if fails else "PASS", fails)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
