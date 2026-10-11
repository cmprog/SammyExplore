# Event catalog (the contract between systems)

Every bus event goes here. To add an event, add it to this file in the same change.
Payloads are plain data (they get cloned). Owner = the system that emits it.

| Event | Payload | Owner | Notes |
|---|---|---|---|
| `scene:change` | `{from, to}` | SceneManager | |
| `level:start` | `{levelId}` | LevelLoader / playing scene | after level is built |
| `level:complete` | `{levelId}` | LevelLoader (exit zone) | |
| `checkpoint:reached` | `{checkpointId, pos}` | LevelLoader | first time each checkpoint is reached |
| `correction:triggered` | `{zoneId, ...zoneProps}` | LevelLoader | Sammy is somewhere silly |
| `correction:reset` | `{zoneId}` | Narrator | midpoint of rewrite effect; the player moves to the last checkpoint |
| `correction:done` | `{zoneId}` | Narrator | input unlocked |
| `narration:zone` | `{key}` | LevelLoader | |
| `narrator:blip` | none | Narrator | typewriter tick |
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
