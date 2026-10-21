// Narrow companion test level (T-015): a single room narrower than the view, with an upper
// floor (top y = 24) high above the ground (top y = 4). Sammy gets up there with a debug teleport;
// the companion can't follow, waits below out of sight, and when he reaches the checkpoint up top
// there is no out-of-sight ground near him to bring her in from. She must still rejoin, without
// ever being seen to pop: she comes in under the quick page flip (Companion FETCH_FALLBACK_AFTER).
// Dev only: __sammy.commands.loadLevel('companion_narrow'); tools/playtest/companion_scenario.py.
export default {
    id: 'companion_narrow',
    name: 'Narrow Room',
    timeOfDay: 'night',
    legend: {
        '.': 'empty',
        '#': 'solid',
    },
    tileMap: [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '##########################',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '##########################',
        '##########################',
        '##########################',
        '##########################',
    ],
    entities: [],
    zones: [
        { type: 'spawn', rect: { x: 3, y: 24, w: 1, h: 2 } },
        { type: 'checkpoint', id: 'upstairs', rect: { x: 18, y: 3, w: 2, h: 3 } },
    ],
};
