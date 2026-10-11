# T-005 Sammy art

## Acceptance criteria
- `src/art/drawSammy.js`: a pure function `(pos, state, time, opts)`. Sammy is a **cute, round cartoon owl**: big round eyes with highlights, ear tufts, a small beak, a lighter belly with a feather pattern, wings, and feet. Use a warm brown palette and a soft dark outline.
- Every movement state has a recognizable pose: idle (gentle bob and periodic blink), run (waddle bounce and feet), jump/fall (wings out), glide (wings fully spread), flap (wing stroke), land (squash). Faces left or right.
- Squash and stretch on jump and land.
- Flap charge indicator: small feather pips near Sammy or in the HUD that are readable at a glance.
- Feather particles on a flap. A dust puff on a hard landing.
- Playtester screenshots of each pose are reviewed for "would a 9-year-old call this cute."
