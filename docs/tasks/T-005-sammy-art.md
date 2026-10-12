# T-005 Sammy art

## Acceptance criteria
- `src/art/drawSammy.js`: a pure function `(pos, state, time, opts)`. Sammy is a **cute, round cartoon owl**: big round eyes with highlights, ear tufts, a small beak, a lighter belly with a feather pattern, wings, and feet. Use a warm brown palette and a soft dark outline.
- Every movement state has a recognizable pose: idle (gentle bob and periodic blink), run (waddle bounce and feet), jump/fall (wings out), glide (wings fully spread), flap (wing stroke), land (squash). Faces left or right.
- Squash and stretch on jump and land.
- Flap charge indicator: small feather pips near Sammy or in the HUD that are readable at a glance.
- Feather particles on a flap. A dust puff on a hard landing.
- Playtester screenshots of each pose are reviewed for "would a 9-year-old call this cute."

## Event contract
Use only events listed in `docs/EVENTS.md`. Add any new event to it in the same change.

## Integration notes (added by PM)
- Replace `src/art/drawSammyPlaceholder.js` in Sammy's render with `drawSammy`. Keep the hitbox from `tuning.js`; the art may overhang it slightly.
- Swap the title screen's placeholder owl in `src/art/titleArt.js` (`drawTitleSammy`) for `drawSammy`. The title currently draws in Canvas2D screen space, so add a small adapter or a screen-space option.
- Also swap `drawTitleBackdrop` to use the real backdrop (T-010, `src/systems/Backdrop.js` / `src/art/drawBackdrop.js`), so the title matches the game.
- The playtest found the flap charge pips too small to read. Make the flap indicator clearly readable at 720p.
- Flap should *feel* like a whoosh: wing-stroke pose plus feather particles. Hard landings get a dust puff with an impact scale (`player:land {impact}`).
