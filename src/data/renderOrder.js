// Draw order for world objects (lower draws first). Shared so systems built in
// different tasks layer consistently: backdrop (T-010) < terrain < props < characters.
export const RENDER_ORDER = {
    backdrop: -100,
    terrain: 0,
    props: 10,
    characters: 20,
};
