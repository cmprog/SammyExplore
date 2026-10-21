// Where a level takes place. A level names one with `environment` (default 'outdoor').
//   kind 'sky'  - outdoors: the parallax sky and hills backdrop (systems/Backdrop.js). The level's
//                 `timeOfDay` picks the backdrop and terrain palettes.
//   kind 'room' - indoors (systems/RoomEnvironment.js): a baked wall with furniture and decor from
//                 the level's `room` block, a window onto the sky, and room lighting. `palette`
//                 names the room colors (roomPalettes.js) and the floor colors (tilePalettes.js);
//                 `dayCycle` names a cycle in dayCycle.js.
// A new indoor place (a house for a later chapter, say) is a new entry here plus its palettes.
export const DEFAULT_ENVIRONMENT = 'outdoor';

export const ENVIRONMENTS = {
    outdoor: { kind: 'sky' },
    bedroom: { kind: 'room', palette: 'bedroom', dayCycle: 'home' },
};
