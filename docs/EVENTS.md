# Event catalog (the contract between systems)

Every bus event goes here. To add an event, add it to this file in the same change.
Payloads are plain data (they get cloned). Owner = the system that emits it.
`emit(name, data, {quiet: true})` skips the clone and the debug ring buffer (`__sammy.events`); use it only for
high-frequency events (currently `narrator:blip`). Quiet events still reach every listener.

| Event | Payload | Owner | Notes |
|---|---|---|---|
| `scene:change` | `{from, to, kind}` | SceneManager | `kind`: `change` (whole stack replaced), `push` (overlay opened, e.g. `pause`), `pop` (overlay closed). `from`/`to` are the top scene before/after |
| `level:start` | `{levelId, name, timeOfDay, size}` | playing scene | after the level is built; `size` = `{x, y}` in tiles |
| `level:loadFailed` | `{levelId, message}` | playing scene | the level could not be fetched or built; main.js returns to the title with a gentle notice |
| `level:complete` | `{...zoneProps, id, levelId, nextLevel?}` | LevelLoader (exit zone) | `id` = exit zone id (required in data; a save key); once per level load. `nextLevel` = the exit's own `nextLevel`, else the level data's; absent on the last level. Autosaved by SaveSystem; opens the level complete overlay |
| `checkpoint:reached` | `{id, levelId, pos}` | LevelLoader | `id` = checkpoint zone id; once per level load. Autosaved by SaveSystem. Not re-sent for a checkpoint restored by Continue |
| `correction:triggered` | `{...zoneProps, id, levelId}` | LevelLoader | Sammy is somewhere silly. `id` = zone id (`world-bottom` for falling off the world); optional `lineId`, `reason` |
| `correction:reset` | `{zoneId}` | Narrator | midpoint of the rewrite effect. The playing scene moves the player to `level.respawn`. Also sent immediately (no visuals) if the narrator is disposed/reloaded mid-correction and the reset hadn't gone out yet |
| `correction:done` | `{zoneId}` | Narrator | input unlocked. Also sent immediately (no visuals) on dispose/reload mid-correction. A `correction:triggered` arriving while a correction runs is ignored by the narrator |
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
| `menu:move` | none | menu scenes (Menu.js) | selection changed |
| `menu:select` | none | menu scenes (Menu.js), level complete | item activated, slider adjusted, or celebration continued |
| `audio:setVolume` | number | any (pause menu) | |
| `audio:setMuted` | boolean | any | |
| `audio:toggleMute` | none | any | |
| `audio:changed` | settings object | Audio | |

Save in localStorage `sammyexplore.save` (SaveSystem owns it): `{schemaVersion, levelId, checkpointId, reachedCheckpoints, flags, catsRescued, updatedAt}`.

Settings in localStorage `sammyexplore.settings`: `{volume, muted, musicVolume, sfxVolume}`. Audio owns these keys. Other systems merge, never overwrite.

**The one read-only query exception:** menus may import `getAudioSettings()` from `src/systems/Audio.js` to show the current
sound state when they open (PauseScene does). It returns a copy and changes nothing. Changes still go only through the
`audio:*` events, and later updates come from `audio:changed`. Every other cross-system read goes through the bus.

Coordinates: level data (zone rects, entity x/y) uses tile column/row from the top-left of the map. Everything at runtime (events, `__sammy`, teleport) uses world space with y pointing up.

Narrator line triggers `idle:N`, `spam:<event>`, `ignored:<id>`, and `followed:<id>` are internal to the Narrator. They are not bus events.
