# Sammy Explore

A small 2D platformer starring **Sammy the owl**. A narrator insists this is the epic tale of a mighty Eagle, and Sammy keeps proving otherwise. Along the way Sammy meets Twyx the tuxedo cat and (eventually) rescues Twyx's friends.

Built with [LittleJS](https://github.com/KilledByAPixel/LittleJS). All of the art and sound is generated in code; there are no image or audio files.

## Play

- **Online:** served with GitHub Pages from the repository root (see [Deploying](#deploying)).
- **Locally:**
  ```
  python -m http.server 8000
  ```
  Then open http://localhost:8000. A plain static server is enough; there is no build step.

### Controls

| Key | Action |
|---|---|
| A / D (or ← / →) | Move |
| Space | Jump. Press again in the air to **flap**; hold while falling to **glide** |
| E | Interact (signs, doors, cats) and skip narration |
| Esc | Pause |
| Mouse | Menus |

Progress saves automatically at checkpoints, in the browser's local storage.

## Development

- Open http://localhost:8000/?debug for the engine's debug build: the overlay is on backtick (`` ` ``), and `+` / `-` change game speed. Without `?debug` the release build is loaded.
- `window.__sammy` in the browser console shows live game state and debug commands, for example `__sammy.commands.loadLevel('test')`.
- Project conventions and architecture: [`CLAUDE.md`](CLAUDE.md). Event contract between systems: [`docs/EVENTS.md`](docs/EVENTS.md). Story bible: [`docs/story/premise.md`](docs/story/premise.md). Backlog: [`docs/BACKLOG.md`](docs/BACKLOG.md).

### Layout

```
index.html        entry point (import map picks the release or debug engine build)
lib/littlejs/     vendored LittleJS 1.18.29 (do not edit)
src/              game code: core/, scenes/, systems/, entities/, art/, data/
tools/playtest/   automated playtests (Playwright + headless Chrome)
docs/             backlog, task specs, event catalog, story bible
```

### Automated playtests

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows; use .venv/bin/python elsewhere
.venv/Scripts/python tools/playtest/smoke.py
.venv/Scripts/python tools/playtest/sandbox_playthrough.py      # full Chapter One run, about 2 minutes
```

The scripts use your installed Google Chrome. See [`tools/playtest/README.md`](tools/playtest/README.md) for the full list.

## Deploying

The game is a static site that runs straight from the repository root, and `.nojekyll` makes GitHub Pages serve the files untouched. To publish it: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.

## License

MIT; see [LICENSE](LICENSE). LittleJS is MIT-licensed by Frank Force; see `lib/littlejs/LICENSE`.
