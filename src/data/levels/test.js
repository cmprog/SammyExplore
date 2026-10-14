// Tiny development level: ground with two gaps (to test falling off the world), a raised hill,
// a floating island, one-way platforms stair-stepping up to a tall pillar (a silly spot that
// triggers a correction), a checkpoint, a narration zone, and an exit on the right.
// Interactables (T-007): a sign at the start of the right-hand meadow, an ordinary door further
// along (blocks the way until opened), and on the floating island a locked door and an exit door.
// Twyx the cat (T-011a) waits on the first meadow, just past the hill.
// Mechanisms (T-014): a ruler drawbridge over the second gap (raised, so the gap still drops
// off the world until its lever is thrown), and up in the sky above the hill a little "lab":
// a ledge with a lever-opened brick gate, and a lever-driven balloon lift that carries Sammy up
// and to the right onto a small shelf. All three levers are ordinary toggles.
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
        '.................##.......................##....',
        '..........................................##....',
        '.......................................===##....',
        '.......####..............######...........##....',
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
        // Mechanisms: levers name the ids they move.
        { type: 'lever', id: 'bridge-lever', targets: ['meadow-bridge'], x: 26, y: 13 },
        { type: 'bridge', id: 'meadow-bridge', length: 4, x: 28, y: 14 },
        { type: 'lever', id: 'gate-lever', targets: ['lab-gate'], x: 7, y: 6 },
        { type: 'gate', id: 'lab-gate', x: 9, y: 6 },
        { type: 'lever', id: 'lift-lever', targets: ['lab-lift'], x: 10, y: 6 },
        { type: 'lift', id: 'lab-lift', x: 11, y: 7, toX: 15, toY: 4 },
    ],
    zones: [
        { type: 'spawn', rect: { x: 2, y: 12, w: 1, h: 2 } },
        { type: 'narration', id: 'hello', key: 'test.hello', rect: { x: 5, y: 10, w: 1, h: 4 } },
        { type: 'checkpoint', id: 'middle', rect: { x: 24, y: 11, w: 2, h: 3 } },
        { type: 'correction', id: 'pillar-top', lineId: 'test.pillarTop', rect: { x: 42, y: 1, w: 2, h: 3 } },
        { type: 'exit', id: 'end', rect: { x: 46, y: 10, w: 2, h: 3 } },
    ],
};
