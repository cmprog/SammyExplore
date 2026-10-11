# T-010 Backdrop

## Acceptance criteria
- `src/art/drawBackdrop.js` plus `src/data/palettes.js` with `night` and `day` palettes. The level's `timeOfDay` selects the palette.
- Night: a gradient sky, a big soft moon with a glow, twinkling stars, and 2-3 parallax layers (distant hills, then tree silhouettes, then nearer bushes). Optional drifting fireflies.
- Day: the same layers in day colors, with a sun and fluffy clouds instead of moon and stars.
- Rendered behind the tile layer. Parallax is relative to the camera. It must keep good framerate in headless playtests.
- Must look polished in screenshots. This is the first thing the kid sees.
