# T-011 M1 sandbox level and Twyx

## Acceptance criteria
- `src/entities/Twyx.js` + `src/art/drawTwyx.js`: **Twyx is a tuxedo cat**: black body, white chest/bib, white paws, white muzzle, green or yellow eyes, pink nose. Cute and round, in the same style as Sammy. Idle animations: tail swish, blink, occasional sit or lick. Interacting (E) plays a meow and a narrator line. The narrator is confused about why a cat is in an eagle story.
- `src/data/levels/sandbox.js`: a night level, a few screens wide, that exercises everything: running and jumping platforms, a gap that needs gliding, a tall section that needs flapping, a sign, a locked door and an unlocked door, Twyx, at least two checkpoints, one or two **correction setups** (somewhere silly Sammy can end up, which the narrator "fixes"), and an exit.
- `src/data/narration/sandbox.js`: **real, funny lines** in the approved voice. Level intro (the narrator introducing the Eagle... and finding an owl), at least one "ignored instruction" gag, zone remarks, sign reading, door remarks, Twyx remarks, checkpoint remarks, and the level exit.
- The New Game flow starts at the sandbox. Level complete shows "to be continued" and returns to title.
- A full playthrough by the playtester is possible with scripted inputs.
