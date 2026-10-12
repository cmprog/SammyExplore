# T-011 M1 sandbox level and Twyx

## Acceptance criteria
- `src/entities/Twyx.js` + `src/art/drawTwyx.js`: **Twyx is a tuxedo cat**: black body, white chest/bib, white paws, white muzzle, green or yellow eyes, pink nose. Cute and round, in the same style as Sammy. Idle animations: tail swish, blink, occasional sit or lick. Interacting (E) plays a meow and a narrator line. The narrator is confused about why a cat is in an eagle story.
- `src/data/levels/sandbox.js`: a night level, a few screens wide, that exercises everything: running and jumping platforms, a gap that needs gliding, a tall section that needs flapping, a sign, a locked door and an unlocked door, Twyx, at least two checkpoints, one or two **correction setups** (somewhere silly Sammy can end up, which the narrator "fixes"), and an exit.
- `src/data/narration/sandbox.js`: **real, funny lines** in the approved voice. Level intro (the narrator introducing the Eagle... and finding an owl), at least one "ignored instruction" gag, zone remarks, sign reading, door remarks, Twyx remarks, checkpoint remarks, and the level exit.
- The New Game flow starts at the sandbox. Level complete shows "to be continued" and returns to title.
- A full playthrough by the playtester is possible with scripted inputs.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add any new event to it in the same change.

## Level-design notes (from T-004 and T-010 playtests)
- Sammy's movement numbers are in the comment in `src/data/tuning.js`. Heights Sammy must reach should be 5 tiles or less; heights he must NOT reach should be 6 or more.
- With a running jump plus glide Sammy covers about 9.9 tiles, so a "glide gap" must be much wider than 3 tiles (aim for about 7-9) to actually need gliding.
- The narrator box covers the bottom ~25% of the screen. Don't put important ground-level things where the camera puts them under the box. Consider a camera vertical offset or a framing tweak while narration shows.
