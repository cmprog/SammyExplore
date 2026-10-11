# T-009 Audio

## Acceptance criteria
- `src/systems/Audio.js` listens to bus events and plays sounds from `src/data/sounds.js`, which holds named ZzFX parameter arrays. Gameplay code never calls `zzfx` directly.
- Sound effects: jump, flap (soft whoosh plus wing flutter), flapEmpty (a sad little puff), glide (a soft airy sound while gliding), land, interact, doorOpen, doorLocked, checkpoint (a pleasant chime), correction (a "rewind" sound), narratorBlip (subtle, not annoying when repeated), menuMove, menuSelect, meow (Twyx), levelComplete fanfare.
- Music: a gentle, cozy night loop using LittleJS `ZzFXMusic`, defined in `src/data/music.js`. It should be calm and not grating on repeat.
- Master volume, mute, and music/sfx balance come from settings (`sammyexplore.settings`, see T-008), defaulting to modest volume. Expose `setVolume`/`setMuted` for the pause menu.
- Audio starts only after the first user input, to respect browser autoplay rules.
