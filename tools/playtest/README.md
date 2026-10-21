# Playtest scripts

Run from the repo root with the project venv:

    .venv/Scripts/python tools/playtest/smoke.py
    .venv/Scripts/python tools/playtest/input_scenario.py
    .venv/Scripts/python tools/playtest/sammy_scenario.py     # T-004 movement; prints measured jump/flap/glide numbers
    .venv/Scripts/python tools/playtest/sammy_poses.py        # T-005 art: zoomed close-up of every pose -> out/poses/, out/poses_sheet.png
    .venv/Scripts/python tools/playtest/interaction_scenario.py   # T-007 E prompt, sign, doors (real E presses)
    .venv/Scripts/python tools/playtest/twyx_scenario.py      # T-011a Twyx: facing, petting, narrator lines; pose sheet -> out/twyx/, out/twyx_sheet.png
    .venv/Scripts/python tools/playtest/sandbox_playthrough.py   # T-011b full sandbox run, title -> To be continued -> New Game again (~2 min); out/sandbox_NN_*.png
    .venv/Scripts/python tools/playtest/narrator_queue_scenario.py   # T-012 queue rules: noStale, condition re-check, forgetSeen
    .venv/Scripts/python tools/playtest/release_smoke.py      # T-012 release build (no ?debug): loads clean, no speed keys, no debug overlay
    .venv/Scripts/python tools/playtest/mechanism_scenario.py # T-014 levers, bridge, gate, lift (real E presses): state, collision, riding; out/mech_*.png
    .venv/Scripts/python tools/playtest/companion_scenario.py # T-015 Twyx following (companion course, test + sandbox levels), save v1->v2; out/companion/, out/companion_sheet.png (~4 min)
    .venv/Scripts/python tools/playtest/planner_bench.py      # T-015 cat leap planner cost per call (ms)

## Debug and release builds

`index.html` picks the engine with an import map: every module imports the bare specifier
`littlejs`. Without `?debug` that is `lib/littlejs/littlejs.esm.min.js` (the release build players
get: debug off, so no debug overlay and no `+`/`-` speed keys). With `?debug` in the URL it is
`lib/littlejs/littlejs.esm.js`. `harness.session()` loads `index.html?debug` by default, so every
scenario runs the debug build; `session(debug=False)` loads the release build (`release_smoke.py`).
In-page probes can `await import('littlejs')` to get whichever build the page is running.

Screenshots land in `tools/playtest/out/` (gitignored). A non-zero exit means a console error,
page error, or missing `window.__sammy`.

## Adding a scenario

Create `tools/playtest/<name>.py`:

    import sys, harness
    def main():
        with harness.session() as s:
            harness.hold(s.page, "KeyD", 0.5)
            print(harness.state(s.page)["scene"])
            harness.shot(s.page, "my_scenario")
        return 1 if s.errors else 0
    sys.exit(main())

The game boots to the title screen; `session()` jumps straight into the `test` level by default
(`session(start_level=None)` stays on the title, `start_level="other"` picks a level).

Helpers in `harness.py`: `session()`, `hold(page, key, seconds)`, `tap(page, key)`, `state(page)`,
`shot(page, name)`, `wait_scene(page, name)`.
Debug commands worth knowing: `__sammy.commands.entityAction(id, action, hold)` pokes an entity
(Twyx: `stand`/`sit`/`lick` [held if `hold`], `blink`, `swish`, `pet`, `release`); `__sammy.entities`
lists every level entity's debug state. `__sammy.mechanisms` lists levers and their targets, and
`__sammy.commands.activate(id, on)` throws a lever or sets a target directly.
`__sammy.companion` is `{cat, state: following|waiting|catchingUp|idle, pos, reason, ...}` (null with nobody along);
`__sammy.commands.setCompanion('twyx' | null)` chooses one now (any level; E only chooses in a `companionHub` level),
`addTestCat('id')` adds a pretend cat (Twyx's body, never saved) for wrong-cat tests, `companionGoTo(x, y)` sends her to a
spot (no args: follow again), `regroupCompanion()` brings her to Sammy (she trots in),
and `cameraFocus(x, y)` / `cameraFocus()` frames a point instead of Sammy (pose captures). `loadLevel('companion')` is
the companion course (a companion hub); `loadLevel('companion_narrow')` is a room narrower than the view (page-flip fallback). Debug `teleport` puts Sammy's center there: give it a hair over feet + 0.45, since 8.45 - 0.45
rounds into the tile below and he falls through. Keys are KeyboardEvent codes (`KeyD`, `Space`).
LittleJS "DEBUG build loaded" is a warning and is ignored.

## Assert state, not pixels, for overlay UI

Headless Chrome (swiftshader) can present a stale frame of the 2D overlay canvas in a screenshot.
This was proven with a "ghost" E bubble: `__sammy.interaction.prompt.visible` was false, and the
bubble stayed fixed on screen while the camera scrolled under it, so it was a compositor artifact,
not something the game drew. For overlay UI (prompts, text boxes, menus), assert on `__sammy`
state, and treat screenshots as illustrations for a human, not as evidence.
