# Playtest scripts

Run from the repo root with the project venv:

    .venv/Scripts/python tools/playtest/smoke.py
    .venv/Scripts/python tools/playtest/input_scenario.py
    .venv/Scripts/python tools/playtest/sammy_scenario.py     # T-004 movement; prints measured jump/flap/glide numbers
    .venv/Scripts/python tools/playtest/interaction_scenario.py   # T-007 E prompt, sign, doors (real E presses)

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
`shot(page, name)`, `wait_scene(page, name)`. Keys are KeyboardEvent codes (`KeyD`, `Space`).
LittleJS "DEBUG build loaded" is a warning and is ignored.
