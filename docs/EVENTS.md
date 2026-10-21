# Event catalog (the contract between systems)

Every bus event goes here. To add an event, add it to this file in the same change.
Payloads are plain data (they get cloned). Owner = the system that emits it.
`emit(name, data, {quiet: true})` skips the clone and the debug ring buffer (`__sammy.events`); use it only for
high-frequency events (currently `narrator:blip`). Quiet events still reach every listener.

| Event | Payload | Owner | Notes |
|---|---|---|---|
| `scene:change` | `{from, to, kind}` | SceneManager | `kind`: `change` (whole stack replaced), `push` (overlay opened, e.g. `pause`), `pop` (overlay closed). `from`/`to` are the top scene before/after |
| `level:start` | `{levelId, name, timeOfDay, size, checkpointId}` | playing scene | after the level is built; `size` = `{x, y}` in tiles. `checkpointId` = the checkpoint a Continue resumed at, `null` on a fresh start (so intros can stay quiet on Continue) |
| `level:loadFailed` | `{levelId, message}` | playing scene | the level could not be fetched or built; main.js returns to the title with a gentle notice |
| `level:complete` | `{...zoneProps, id, levelId, nextLevel?, door?}` | LevelLoader (exit zone) | `id` = exit zone id (required in data; a save key); once per level load. `nextLevel` = the exit's own `nextLevel`, else the level data's; absent on the last level. Autosaved by SaveSystem; opens the level complete overlay. An exit door (a door with `exitId`) fires the same exit path when it finishes opening: `id` = its `exitId`, `door` = the door's id |
| `checkpoint:reached` | `{id, levelId, pos}` | LevelLoader | `id` = checkpoint zone id; once per level load. Autosaved by SaveSystem. Not re-sent for a checkpoint restored by Continue |
| `correction:triggered` | `{...zoneProps, id, levelId}` | LevelLoader | Sammy is somewhere silly. `id` = zone id (`world-bottom` for falling off the world); optional `lineId`, `reason` |
| `correction:reset` | `{zoneId}` | Narrator | midpoint of the rewrite effect. The playing scene moves the player to `level.respawn`. Also sent immediately (no visuals) if the narrator is disposed/reloaded mid-correction and the reset hadn't gone out yet |
| `correction:done` | `{zoneId}` | Narrator | input unlocked. Also sent immediately (no visuals) on dispose/reload mid-correction. A `correction:triggered` arriving while a correction runs is ignored by the narrator; on `correction:done` the playing scene re-arms correction zones so one the player is still inside fires again |
| `narration:zone` | `{key, id, levelId}` | LevelLoader | |
| `narrator:blip` | `{lineId}` | Narrator | typewriter tick; emitted quietly (kept out of the debug event ring) |
| `narrator:line` | `{id, text}` | Narrator | a line started showing |
| `narrator:revealed` | `{id}` | Narrator | the showing line is fully revealed (typed out, or skipped to the end). The level complete overlay waits for it before offering to continue |
| `narrator:skip` | none | any (level complete overlay) | finish revealing the showing line now (no-op if nothing is typing). For screens that take the confirm press while a line is still typing |
| `player:jump` | none | Sammy | |
| `player:flap` | `{chargesLeft}` | Sammy | |
| `player:flapEmpty` | none | Sammy | tried to flap with 0 charges |
| `player:glideStart` | none | Sammy | |
| `player:glideEnd` | none | Sammy | **any** exit from glide (release, flap, land, reset) |
| `player:land` | `{impact}` | Sammy | impact is fall speed (0..1), so soft landings can sound softer |
| `interact:<type>` | `{id, ...}` | Interaction | E pressed with that interactable nearest and in range; emitted before its `interact()` runs. The payload is the interactable's `interactPayload()`. Types so far: `interact:door` `{id}`, `interact:sign` `{id, key}` (`key` = the sign's narration key, so a line with that `key` "reads" it), `interact:twyx` `{id}` (Twyx the cat; Audio meows. In a level with `companionHub: true` the Companion system treats it as asking her along or letting her stay, see `companion:*`; everywhere else it is just a pet), `interact:lever` `{id}` (the lever then emits `mechanism:toggle` or `mechanism:cycle`, which Audio clunks on). An E press the narrator used to skip/dismiss a line is never an interaction |
| `interact:nothing` | none | Interaction | E pressed with nothing in range |
| `interact:doorLocked` | `{id}` | Door | after `interact:door`, when the door is locked |
| `door:open` | `{id}` | Door | when the open animation starts (plays the creak) |
| `mechanism:toggle` | `{id, on, targets}` | any trigger (Lever; later cat spots) | the **activation API**: Mechanisms (the level's registry) calls `setActive(on)` on each target id. `id` = the trigger. A lever emits it when thrown (not at level start: a `startsOn` lever snaps its targets silently). Audio plays the lever clunk. **The targets' state is the truth**: a toggle lever counts as on exactly when all its targets are active, re-reads that before every throw and sends the opposite, and its handle shows it, so triggers sharing a target never drift |
| `mechanism:cycle` | `{id, targets}` | any trigger (a Lever in `cycle` mode; T-017's portal lever) | Mechanisms calls each target's `cycle()`, or flips it if it has none. Sent on every throw; Audio plays the lever clunk |
| `bridge:move` | `{id, down}` | Bridge | it actually starts lowering (`down: true`) or raising. A bridge never raises while anyone stands on it, so a raise is announced when it finally goes up. Not sent for a silent snap at level start |
| `gate:move` | `{id, open}` | Gate | it starts opening or closing |
| `lift:move` | `{id, toward}` | Lift | it sets off; `toward` = `'a'` or `'b'` (its first or second point). Plays the wind-up hum |
| `lift:arrive` | `{id, at}` | Lift | it reached an end (`'a'`/`'b'`) |
| `lift:held` | `{id}` | Lift | it stopped because the next step would push into someone it isn't carrying; once per hold (it carries on by itself when they move) |
| `companion:join` | `{cat}` | Companion | only in a companion hub level (level data `companionHub: true`, the bedroom): E on a cat who isn't the companion, and she comes along. `cat` = her id in `src/data/cats.js` (e.g. `'twyx'`), not the level entity id. One at a time: the previous companion gets `companion:leave` first (refused, so E is a pet, if the current companion is a visitor the hub doesn't place). Autosaved by SaveSystem |
| `companion:leave` | `{cat}` | Companion | only in a companion hub, and only for a cat that hub places (her home): E on the companion lets her stay and roam there. A visitor is never left behind (E is a pet); outside hubs E is always a pet. Autosaved by SaveSystem |
| `companion:waiting` | `{cat, reason}` | Companion | she stopped where Sammy's trail needs something she can't do. Sent once per hold-up: not again for the same reason until she has made progress (so a stuck re-try never repeats it). `reason`: `gap` (a gap too wide, or a bridge still up/in the way) \| `ledge` \| `gate` \| `door` \| `lift`. She re-checks often, including for a plain walk to Sammy, and carries on by herself when the way opens. Audio plays a "mrrp?" |
| `companion:caughtUp` | `{cat, via}` | Companion | she is back beside Sammy after being apart. `via`: `walked` (made her own way after waiting), `met` (Sammy came back to her), `correction` (put down beside him at the respawn under the page; she trots in once it lifts), `checkpoint` (left behind and Sammy reached a checkpoint: she comes in only when both where she was and where she appears are out of view, retrying as he moves; after `COMPANION.FETCH_FALLBACK_AFTER` s with no such spot, from just off the current screen, or under a sub-second page flip with no input lock. A fetch only starts at a checkpoint: put one after every gate, bridge or lift), `arrived` (level start, a level change or Continue), `regroup` (below-the-world safety net, also brought in unseen; or debug). Audio chirps |
| `menu:move` | none | menu scenes (Menu.js) | selection changed |
| `menu:select` | none | menu scenes (Menu.js), level complete | item activated, slider adjusted, or celebration continued |
| `audio:setVolume` | number | any (pause menu) | |
| `audio:setMuted` | boolean | any | |
| `audio:toggleMute` | none | any | |
| `audio:changed` | settings object | Audio | |

Mechanism state (levers, bridges, gates, lifts) is not saved: every level load rebuilds them as placed in the level data. A correction respawn keeps the level, so they keep their state. See `src/systems/Mechanisms.js`.

Save in localStorage `sammyexplore.save` (SaveSystem owns it), schema v2: `{schemaVersion, levelId, checkpointId, reachedCheckpoints, flags, catsRescued, companion, updatedAt}`. `companion` = the cat id along with Sammy, or null. v1 saves (M1, live) migrate by adding `companion: null`.

The companion is not tied to a level: she arrives with Sammy in every level (a level that places her own cat entity uses that one). Mechanism state rules above apply to her too (a lift carries her, a bridge holds her, a gate blocks her).

Settings in localStorage `sammyexplore.settings`: `{volume, muted, musicVolume, sfxVolume}`. Audio owns these keys. Other systems merge, never overwrite.

**The one read-only query exception:** menus may import `getAudioSettings()` from `src/systems/Audio.js` to show the current
sound state when they open (PauseScene does). It returns a copy and changes nothing. Changes still go only through the
`audio:*` events, and later updates come from `audio:changed`. Every other cross-system read goes through the bus.

Coordinates: level data (zone rects, entity x/y) uses tile column/row from the top-left of the map. Everything at runtime (events, `__sammy`, teleport) uses world space with y pointing up.

Narrator line triggers `idle:N`, `spam:<event>`, `ignored:<id>`, and `followed:<id>` are internal to the Narrator. They are not bus events.
