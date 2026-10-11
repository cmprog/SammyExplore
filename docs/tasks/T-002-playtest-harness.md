# T-002 Playtest harness

**Owner:** playtester

## Acceptance criteria
- `tools/playtest/harness.py`: a shared helper. It starts `http.server` on a free port in a background thread, launches Chrome headless (with the swiftshader args from the playtester agent), collects console errors and page errors, and provides helpers: `hold(page, key, seconds)`, `tap(page, key)`, `state(page)` (returns `window.__sammy` serialized as JSON), `shot(page, name)`, and `wait_scene(page, name)`.
- `tools/playtest/smoke.py`: loads the game, waits 2 seconds, takes a screenshot to `tools/playtest/out/smoke.png`, and exits non-zero on any console error or if `window.__sammy` is missing. It should run in under 15 seconds.
- `tools/playtest/README.md` explains how to run it and how to add a scenario.
- It has been run against T-001 and passes.
