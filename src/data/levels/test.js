// Tiny development level: ground with two gaps (to test falling off the world), a raised hill,
// a floating island, one-way platforms stair-stepping up to a tall pillar (a silly spot that
// triggers a correction), a checkpoint, a narration zone, and an exit on the right.
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
    entities: [],
    zones: [
        { type: 'spawn', rect: { x: 2, y: 12, w: 1, h: 2 } },
        { type: 'narration', id: 'hello', key: 'test.hello', rect: { x: 5, y: 10, w: 1, h: 4 } },
        { type: 'checkpoint', id: 'middle', rect: { x: 24, y: 11, w: 2, h: 3 } },
        { type: 'correction', id: 'pillar-top', lineId: 'test.pillarTop', rect: { x: 42, y: 1, w: 2, h: 3 } },
        { type: 'exit', id: 'end', rect: { x: 46, y: 10, w: 2, h: 3 } },
    ],
};
