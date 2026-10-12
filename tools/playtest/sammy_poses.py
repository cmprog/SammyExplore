"""T-005 Sammy art: captures every pose up close for review, plus the title screen.

Each pose is reached with real key presses in the test level. An in-page watcher pauses the
engine (setPaused) on the exact frame the pose condition holds, so short states like 'land'
(0.12 s) and the flap stroke are caught reliably and nothing moves while the shot is taken.
The narrator box and other 2D-canvas UI are hidden only while a close-up is taken.
The camera is zoomed in from this script only (setCameraScale through the engine module), so
the game itself carries no debug zoom.

Output (tools/playtest/out/): poses/<name>.png close-ups, poses_sheet.png (all close-ups on one
page), title.png and title_sammy.png. Exits non-zero on console/page errors or a pose that never
showed up.

    .venv/Scripts/python tools/playtest/sammy_poses.py
"""
import base64
import sys
import time

import harness

ZOOM = 4                 # times the game's 64 px per tile
GROUND_Y = 4.0           # test level ground top (world y) for x < 7
# Air poses happen high up: there the camera is held by the level's top edge, so Sammy sits
# mid-screen with room below for the feather burst (near the ground he is framed low).
AIR_Y = 16.3
HALF_H = 0.45            # half of Sammy's hitbox height: pos.y = feet + HALF_H
CLIP_TILES = (3.4, 3.4)  # close-up size in tiles, around Sammy's feet
VIEW = {"width": 1920, "height": 1080}
fails = []
shots = []

WAIT_AND_PAUSE = """async ([cond, timeoutMs]) => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const test = new Function('p', 't', 'return ' + cond);
    const start = performance.now();
    return await new Promise(resolve => {
        const poll = () => {
            const p = window.__sammy.player;
            if (p && test(p, m.time)) { m.setPaused(true); resolve(true); return; }
            if (performance.now() - start > timeoutMs) { resolve(false); return; }
            requestAnimationFrame(poll);
        };
        poll();
    });
}"""

# Sammy's feet in page pixels (the canvas is letterboxed into the viewport).
FEET_ON_PAGE = """async () => {
    const m = await import('/lib/littlejs/littlejs.esm.js');
    const p = window.__sammy.player;
    const feet = m.worldToScreen(m.vec2(p.pos.x, p.pos.y - p.size.y / 2));
    const rect = m.mainCanvas.getBoundingClientRect();
    const k = rect.width / m.mainCanvasSize.x;
    return { x: rect.left + feet.x * k, y: rect.top + feet.y * k, tile: m.cameraScale * k };
}"""


def zoom(page, factor):
    page.evaluate("async f => { const m = await import('/lib/littlejs/littlejs.esm.js'); m.setCameraScale(64 * f); }", factor)


def unpause(page):
    page.evaluate("async () => { const m = await import('/lib/littlejs/littlejs.esm.js'); m.setPaused(false); }")


def teleport_feet(page, x, feet_y):
    page.evaluate(f"__sammy.commands.teleport({x}, {feet_y + HALF_H})")


def settle_camera(page):
    # The engine is paused but the camera keeps easing (it runs in updatePost, and its look-ahead
    # is deliberately slow); let it arrive so the close-up is centered.
    time.sleep(3)


def show_overlay(page, visible):
    """Hide the 2D overlay canvas (narrator box, UI) so it can't cover the zoomed-in Sammy."""
    page.evaluate("async v => { const m = await import('/lib/littlejs/littlejs.esm.js'); m.mainCanvas.style.opacity = v ? '' : '0'; }", visible)


def capture(page, name, cond, timeout=4.0, note=""):
    """Wait for `cond` (JS over p = __sammy.player, t = engine time), freeze, and shoot a close-up."""
    ok = page.evaluate(WAIT_AND_PAUSE, [cond, int(timeout * 1000)])
    if not ok:
        print(f"FAIL {name}: never saw {cond}")
        fails.append(name)
        return None
    settle_camera(page)
    feet = page.evaluate(FEET_ON_PAGE)
    w, h = CLIP_TILES[0] * feet["tile"], CLIP_TILES[1] * feet["tile"]
    view = page.viewport_size
    # Feet at 70% down, kept inside the page (near the ground the camera frames Sammy low).
    clip = {"x": min(max(0, feet["x"] - w / 2), view["width"] - w),
            "y": min(max(0, feet["y"] - h * .7), view["height"] - h), "width": w, "height": h}
    path = harness.OUT / "poses" / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    show_overlay(page, False)
    page.screenshot(path=str(path), clip=clip)
    show_overlay(page, True)
    look = harness.state(page)["player"]["look"]
    print(f"ok   {name:<16} state={harness.state(page)['player']['state']:<6} {note} -> {path}")
    print(f"       look={look}")
    shots.append((name, path))
    unpause(page)
    return path


def stand(page, x, facing_key=None):
    teleport_feet(page, x, GROUND_Y)
    if facing_key:
        harness.tap(page, facing_key)
    page.wait_for_function("__sammy.player.grounded && Math.abs(__sammy.player.vel.x) < .001", timeout=4000)


def run_poses(page):
    # Idle: breathing, then the curious head tilt and the look at the camera (stateTime-driven).
    stand(page, 3)
    capture(page, "idle", "p.state === 'idle' && p.look.stateTime > .6 && p.look.stateTime < 1.2", note="(rest)")
    capture(page, "idle_head_tilt", "p.state === 'idle' && p.look.stateTime > 2.75", timeout=6)
    capture(page, "idle_look_camera", "p.state === 'idle' && p.look.stateTime > 5.3", timeout=6)
    capture(page, "idle_blink", "p.state === 'idle' && (t % 3.4) > .05 && (t % 3.4) < .09", timeout=6)
    stand(page, 5, "KeyA")
    capture(page, "idle_left", "p.state === 'idle' && p.look.stateTime > .5", note="(facing left)")

    # Run: two moments of the waddle, both directions.
    stand(page, 1.5)
    page.keyboard.down("KeyD")
    capture(page, "run_right_a", "p.state === 'run' && p.look.stateTime > .2")
    capture(page, "run_right_b", "p.state === 'run' && p.look.stateTime > .3")
    page.keyboard.up("KeyD")
    stand(page, 6)
    page.keyboard.down("KeyA")
    capture(page, "run_left", "p.state === 'run' && p.look.stateTime > .25")
    page.keyboard.up("KeyA")

    # Jump: the stretched take-off, then the fall after the apex.
    stand(page, 3)
    page.keyboard.down("Space")
    capture(page, "jump", "p.state === 'jump' && p.vel.y > .2")
    page.keyboard.up("Space")
    teleport_feet(page, 3, AIR_Y + 1)
    capture(page, "fall", "p.state === 'fall' && p.vel.y < -.3")

    # Flap: mid wing-stroke with the feather burst, then right after it.
    teleport_feet(page, 3, AIR_Y)
    time.sleep(.15)
    harness.tap(page, "Space")
    capture(page, "flap_burst", "p.state === 'flap' && p.look.flapAge > .04", note="(feathers just flung out)")
    teleport_feet(page, 3, AIR_Y)
    time.sleep(.15)
    harness.tap(page, "Space")
    capture(page, "flap_stroke", "p.state === 'flap' && p.look.flapAge > .1")
    teleport_feet(page, 3, AIR_Y)
    time.sleep(.15)
    harness.tap(page, "Space")
    capture(page, "flap_feathers", "p.look.flapAge > .3 && p.look.flapAge < .45", note="(feathers drifting)")

    # Glide: wings spread, leaning into the direction of travel.
    teleport_feet(page, 2, 14)
    time.sleep(.1)
    page.keyboard.down("KeyD")
    page.keyboard.down("Space")
    capture(page, "glide_right", "p.state === 'glide' && p.look.stateTime > .5")
    page.keyboard.up("Space")
    page.keyboard.up("KeyD")
    teleport_feet(page, 16, 14)
    time.sleep(.1)
    page.keyboard.down("KeyA")
    page.keyboard.down("Space")
    capture(page, "glide_left", "p.state === 'glide' && p.look.stateTime > .5")
    page.keyboard.up("Space")
    page.keyboard.up("KeyA")

    # Hard landing from high up: squash and dust, then the dust a moment later.
    teleport_feet(page, 3, 13)
    capture(page, "land_hard", "p.state === 'land'", note="(squash)")
    teleport_feet(page, 3, 13)
    capture(page, "land_dust", "p.grounded && p.look.stateTime > .12 && p.look.particles > 0", note="(dust)")
    stand(page, 3)
    page.keyboard.down("Space")
    page.wait_for_function("__sammy.player.vel.y > 0", timeout=3000)
    page.keyboard.up("Space")
    capture(page, "land_soft", "p.state === 'land'", note="(hop: little squish, no dust)")

    # Flap feathers: all spent (ghosts), one coming back.
    teleport_feet(page, 3, 13)
    for _ in range(3):
        time.sleep(.2)
        harness.tap(page, "Space")
    capture(page, "pips_empty", "p.flapCharges === 0 && p.state === 'fall'")


def run_actual_size(page):
    """Game zoom in a 1280x720 window: is Sammy readable, and are the flap feathers?"""
    page.set_viewport_size({"width": 1280, "height": 720})
    zoom(page, 1)
    stand(page, 3)
    capture(page, "720p_idle", "p.state === 'idle' && p.look.stateTime > .5")
    teleport_feet(page, 3, 12)
    time.sleep(.15)
    harness.tap(page, "Space")
    capture(page, "720p_two_flaps_left", "p.flapCharges === 2 && p.state === 'fall'")
    page.set_viewport_size(VIEW)
    zoom(page, ZOOM)


def contact_sheet(page):
    tiles = "".join(
        f"<figure><img src='data:image/png;base64,{base64.b64encode(path.read_bytes()).decode()}'>"
        f"<figcaption>{name}</figcaption></figure>" for name, path in shots)
    page.set_content("<html><body style='margin:0;background:#222;display:flex;flex-wrap:wrap'>"
                     "<style>figure{margin:6px;color:#eee;font:20px sans-serif;text-align:center}"
                     "img{width:420px;display:block}</style>" + tiles + "</body></html>")
    path = harness.OUT / "poses_sheet.png"
    page.screenshot(path=str(path), full_page=True)
    print("sheet:", path)


def title_shots():
    with harness.session(start_level=None) as s:
        s.page.set_viewport_size(VIEW)
        s.page.wait_for_function("window.__sammy.scene === 'title'", timeout=10000)
        time.sleep(1.5)
        print("title:", harness.shot(s.page, "title"))
        s.page.screenshot(path=str(harness.OUT / "title_sammy.png"), clip={"x": 300, "y": 380, "width": 560, "height": 560})
        print("title close-up:", harness.OUT / "title_sammy.png")
    return s.errors


def main():
    with harness.session() as s:
        s.page.set_viewport_size(VIEW)
        time.sleep(.5)
        zoom(s.page, ZOOM)
        run_poses(s.page)
        run_actual_size(s.page)
        contact_sheet(s.page)
        errors = list(s.errors)
    errors += title_shots()
    for e in errors:
        print("ERROR", e)
    if fails or errors:
        print("FAIL", fails)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
