// Tiny development level: ground with two gaps (to test falling off the world), a raised hill,
// a floating island, one-way platforms stair-stepping up to a tall pillar (a silly spot that
// triggers a correction), a checkpoint, a narration zone, and an exit on the right.
// Interactables (T-007): a sign at the start of the right-hand meadow, an ordinary door further
// along (blocks the way until opened), and on the floating island a locked door and an exit door.
// Twyx the cat (T-011a) waits on the first meadow, just past the hill.
//
// Coordinates in level data (entities and zone rects) are tile columns and rows counted from
// the top-left of tileMap, the same way the map reads. The loader converts them to world space.
export default {
    id: 'test',
    name: 'Test Meadow',
    timeOfDay: 'night',
    legend: {
        '.': 'empty',
        '#': 'solid',
        '=': 'platform',
    },
    tileMap: [
        '................................................',
        '................................................',
        '................................................',
        '................................................',
        '..........................................##....',
        '..........................................##....',
        '.......................................===##....',
        '.........................######...........##....',
        '.........................######........===##....',
        '..........................................##....',
        '.............====....................==...##....',
        '..................====....................##....',
        '.......######......................===....##....',
        '.......######.............................######',
        '##################....######....################',
        '##################....######....################',
        '##################....######....################',
        '##################....######....################',
    ],
    // Doors stand on the given tile and fill the one above it too.
    entities: [
        { type: 'sign', id: 'meadow-sign', key: 'test.sign', x: 33, y: 13 },
        { type: 'twyx', id: 'twyx', x: 15, y: 13 },
        { type: 'door', id: 'meadow-door', x: 40, y: 13 },
        { type: 'door', id: 'island-locked', locked: true, x: 26, y: 6 },
        { type: 'door', id: 'island-exit', exitId: 'island-door', x: 29, y: 6 },
    ],
    zones: [
        { type: 'spawn', rect: { x: 2, y: 12, w: 1, h: 2 } },
        { type: 'narration', id: 'hello', key: 'test.hello', rect: { x: 5, y: 10, w: 1, h: 4 } },
        { type: 'checkpoint', id: 'middle', rect: { x: 24, y: 11, w: 2, h: 3 } },
        { type: 'correction', id: 'pillar-top', lineId: 'test.pillarTop', rect: { x: 42, y: 1, w: 2, h: 3 } },
        { type: 'exit', id: 'end', rect: { x: 46, y: 10, w: 2, h: 3 } },
    ],
};
