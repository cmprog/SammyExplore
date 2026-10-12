// Draw order for world objects (lower draws first). Shared so systems built in
// different tasks layer consistently: backdrop (T-010) < terrain < props < cats < characters.
// Cats sit just behind Sammy, so he walks in front of them rather than through them.
export const RENDER_ORDER = {
    backdrop: -100,
    terrain: 0,
    props: 10,
    cats: 15,
    characters: 20,
};
