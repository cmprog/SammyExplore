# Event catalog (the contract between systems)

Every bus event goes here. To add an event, add it to this file in the same change.
Payloads are plain data (they get cloned). Owner = the system that emits it.

| Event | Payload | Owner | Notes |
|---|---|---|---|
| `scene:change` | `{from, to}` | SceneManager | |
| `level:start` | `{levelId, name, timeOfDay, size}` | playing scene | after the level is built; `size` = `{x, y}` in tiles |
| `level:complete` | `{...zoneProps, id, levelId}` | LevelLoader (exit zone) | `id` = exit zone id (required in data; a save key); once per level load |
| `checkpoint:reached` | `{id, levelId, pos}` | LevelLoader | `id` = checkpoint zone id; once per level load |
| `correction:triggered` | `{...zoneProps, id, levelId}` | LevelLoader | Sammy is somewhere silly. `id` = zone id (`world-bottom` for falling off the world); optional `lineId`, `reason` |
| `correction:reset` | `{zoneId}` | Narrator | midpoint of the rewrite effect. The playing scene moves the player to `level.respawn` |
| `correction:done` | `{zoneId}` | Narrator | input unlocked |
| `narration:zone` | `{key, id, levelId}` | LevelLoader | |
| `narrator:blip` | `{lineId}` | Narrator | typewriter tick; emitted quietly (kept out of the debug event ring) |
| `narrator:line` | `{id, text}` | Narrator | a line started showing |
| `player:jump` | none | Sammy | |
| `player:flap` | `{chargesLeft}` | Sammy | |
| `player:flapEmpty` | none | Sammy | tried to flap with 0 charges |
| `player:glideStart` | none | Sammy | |
| `player:glideEnd` | none | Sammy | **any** exit from glide (release, flap, land, reset) |
| `player:land` | `{impact}` | Sammy | impact is fall speed (0..1), so soft landings can sound softer |
| `interact:<type>` | `{id}` | Interaction | e.g. `interact:door`, `interact:sign`, `interact:twyx` |
| `interact:nothing` | none | Interaction | E pressed with nothing in range |
| `interact:doorLocked` | `{id}` | Door | |
| `door:open` | `{id}` | Door | when the open animation starts (plays the creak) |
| `menu:move` | none | menu scenes | selection changed |
| `menu:select` | none | menu scenes | item activated |
| `audio:setVolume` | number | any (pause menu) | |
| `audio:setMuted` | boolean | any | |
| `audio:toggleMute` | none | any | |
| `audio:changed` | settings object | Audio | |

Settings in localStorage `sammyexplore.settings`: `{volume, muted, musicVolume, sfxVolume}`. Audio owns these keys. Other systems merge, never overwrite.

Coordinates: level data (zone rects, entity x/y) uses tile column/row from the top-left of the map. Everything at runtime (events, `__sammy`, teleport) uses world space with y pointing up.

Narrator line triggers `idle:N`, `spam:<event>`, `ignored:<id>`, and `followed:<id>` are internal to the Narrator. They are not bus events.
