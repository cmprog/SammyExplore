# T-003 Level system

**Goal:** Data-driven levels, so adding a level means adding a data file.

## Acceptance criteria
- Levels live in `src/data/levels/<id>.js` and export `{ id, name, timeOfDay: 'night'|'day', tileMap: [strings...], legend: {char: tileType}, entities: [{type, x, y, ...props}], zones: [{type, rect, ...props}] }`. Map rows are written top to bottom.
- `src/systems/LevelLoader.js` builds tile collision from the map (LittleJS `TileCollisionLayer` or equivalent; check the API in the d.ts), spawns entities from a type registry (`src/entities/registry.js`), and registers zones.
- Tile types to start with: `solid` (ground), `platform` (one-way, Sammy can jump up through it), `empty`. Tiles are drawn **procedurally**: cute rounded ground with a grassy top edge and subtle variation. No texture files.
- Zone types to start with: `spawn`, `checkpoint` (emits `checkpoint:reached` once, with its id), `correction` (emits `correction:triggered` with the zone's props; this is how resets work, see T-006), `narration` (emits `narration:zone` with its key), and `exit` (emits `level:complete`).
- The bottom edge of the level is implicitly a `correction` zone, so falling off the world never leaves Sammy stuck.
- `src/systems/Camera.js`: smooth follow with a look-ahead, clamped to the level bounds.
- `window.__sammy.level` reports `{id, size}`. `__sammy.commands.loadLevel(id)` loads a level.
- A tiny `test` level exists for development, plus a `playing` scene that loads a level.

## Out of scope
The player's movement feel (T-004). A temporary box that moves with WASD is fine for testing.
