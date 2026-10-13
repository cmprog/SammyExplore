# SammyExplore

A small 2D platformer starring **Sammy the owl**, made for a 9-year-old player who is a tough critic.
Weekend-prototype scope, but the game **will keep growing**, so don't design anything into a corner.

## Who decides what

- **The user is the stakeholder and owns all requirements** (story, characters, mechanics, look, scope).
  Never invent requirements. If a task leaves a "what" question open, raise it; don't guess.
- The main session acts as **producer/PM**. It breaks requirements into tasks in `docs/tasks/`,
  delegates them to the `game-dev`, `reviewer`, and `playtester` subagents, and decides whether each task passes.
- Technical guidance from the user goes in the "Stakeholder technical guidance" section below. It overrides anything else here.

## Stakeholder technical guidance

- No image, audio, or font asset files. All art is drawn in code with LittleJS drawing primitives,
  and all sound is generated in code (ZzFX sound effects, ZzFXM music).
- Quality still matters. Go for a cute, round, cartoon style, and add polish (particles, easing, squash and stretch).
- Python tooling runs in the project venv (`.venv`). Never install into global Python.
- Fixed 16:9 game resolution (1920x1080, using `canvasFixedSize`), scaled to fit the browser window. Targets desktop and laptop.
- No manual reset key. Resets come from level design: a narrator "correction" when Sammy ends up somewhere weird.
- Saving is automatic, triggered by gameplay milestones (checkpoints, level complete, and later cat rescues), stored in localStorage.
  The title screen offers New Game and Continue. New Game warns before overwriting an existing save.
  The save data carries a schema version so it can change later.
- Story and characters are in `docs/story/premise.md`. Narrator lines must follow the voice guide there.
- **Twyx is the heart of the game.** Follow the special-care rules for her in `docs/story/premise.md` in all art, behavior, and lines.

## Stack

- **LittleJS 1.18.29**, vendored at `lib/littlejs/littlejs.esm.js`. Do not edit it and do not upgrade it without asking.
  `lib/littlejs/littlejs.d.ts` is the API reference; grep it before you assume a function exists or guess its signature.
  The ESM build already includes the plugins we may use: ZzFX/ZzFXMusic, Tween, UI system, LightSystem, PostProcess, drawUtilities.
- Plain ES modules with no build step and no npm runtime dependencies. Import the engine as `'littlejs'`; an import map in `index.html` points it at the min build, or at the debug build with `?debug`.
- Run locally: `python -m http.server 8000` from the repo root, then open http://localhost:8000 (release build) or http://localhost:8000/?debug (debug build with the engine overlay, which the playtest harness uses).

## Controls (stakeholder-defined)

W/A/S/D to move, Space to jump/flap/glide, E to interact, Esc to pause. Mouse is used for menus.
All input goes through the input-mapping module; gameplay code never reads raw keys directly.

## Architecture rules (so we can grow)

- **Data over code.** Levels, narrator scripts, sound definitions, and tuning constants live in data modules
  under `src/data/`, separate from the systems that use them. Adding a level or a narrator line should not require touching engine code.
- **One module per system**: scenes/state, input, level loading, player, narrator, interaction, audio, rendering helpers.
  Keep modules small. Systems talk through a small event bus (`src/core/events.js`) rather than importing each other directly.
  **`docs/EVENTS.md` is the event contract.** Only emit or listen for events listed there. When you add an event, add it to the catalog in the same change.
- **Scenes** (title, playing, paused, level complete, and so on) go through one scene manager.
- **Resets are never framed as death or harm.** Sammy doesn't get hurt.
- **Test hook.** `window.__sammy` exposes read-only game state (scene, player position/state, flap charges,
  the current narrator line, recent events) plus a few debug commands (load level, teleport). The playtester depends on this.
  Keep it current whenever a system changes.

## Layout

```
index.html            entry point (loads src/main.js as a module)
lib/littlejs/         vendored engine (read-only)
src/main.js           engine init, wires up systems
src/core/             scene manager, event bus, input mapping, debug hook
src/scenes/           one file per scene (title, playing, paused, ...)
src/systems/          narrator, interaction, audio, level loader, camera, etc.
src/entities/         Sammy, cats, interactables
src/art/              procedural drawing (one file per character/prop/backdrop)
src/data/             levels, narrator scripts, sfx/music definitions, tuning constants
tools/playtest/       Playwright playtest scripts (run with .venv/Scripts/python)
docs/BACKLOG.md       milestones and task list (owned by the PM)
docs/tasks/           one spec per task: T-###-short-name.md
docs/story/           story bible: premise, characters, narrator voice
```

## JavaScript conventions

- Standard modern JS: `const`/`let`, classes for entities (extending `EngineObject`), camelCase for functions and variables,
  PascalCase for classes, UPPER_SNAKE for tuning constants.
- One class per file, and the file is named after the class.
- Comment *why*, not *what*. Keep functions short.

## Workflow

1. The PM writes `docs/tasks/T-###-*.md` containing: goal, acceptance criteria, files likely touched, and out-of-scope items.
2. `game-dev` implements it and commits nothing; it reports back with a summary.
3. `reviewer` reviews `git diff` against the spec, and `playtester` runs scripted playtests. These two run in parallel.
4. The PM decides: accept and commit, or send it back to `game-dev`. After 2 failed fix rounds, the PM escalates.
5. The PM checks in with the user at milestone boundaries only, and has a real requirements conversation there.
