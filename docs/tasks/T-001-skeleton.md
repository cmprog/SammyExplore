# T-001 Skeleton

**Goal:** A runnable game shell that every later system plugs into.

## Acceptance criteria
- `index.html` loads `src/main.js` as an ES module. Serving with `python -m http.server 8000` shows the game with no console errors.
- Fixed 1920x1080 canvas (`canvasFixedSize`), scaled to fit the browser and letterboxed, with a dark background.
- `src/core/events.js`: a tiny event bus (`on`, `off`, `emit`). It keeps a ring buffer of the last 50 events for the debug hook.
- `src/core/input.js`: action mapping. Actions are `left`, `right`, `up`, `down`, `jump`, `interact`, `pause`, and `confirm` (Enter/Space on menus). Keys: WASD, Space, E, Esc, plus arrow keys as aliases. It exposes `isDown(action)`, `wasPressed(action)`, and `wasReleased(action)`. Mouse clicks are available for UI.
- `src/core/SceneManager.js`: register scenes by name, `change(name, params)`, and an `enter`/`exit`/`update`/`render`/`renderPost` lifecycle. `main.js` routes the engine callbacks into it.
- One placeholder scene, `boot`, which draws "Sammy Explore" text so we can see it works.
- `src/core/debugHook.js`: installs `window.__sammy` with `scene`, `events` (recent), `version`, and a `register(key, getterFn)` so later systems can add state. It also has `commands`, an object that systems can add debug commands to.
- Folder layout as described in CLAUDE.md, including a stub `src/data/tuning.js`.

## Out of scope
Actual gameplay, art, and sound.
