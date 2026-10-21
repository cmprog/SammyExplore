// Cat spot course (T-016): a small development level for cat spots and Twyx's Comfort. Not part
// of the story (T-018 builds the bedroom practice course); tools/playtest/catspot_scenario.py
// drives it, and it is reachable only with __sammy.commands.loadLevel('catspot').
//
// Left to right (world units, y up; the ground's top is y = 4):
//   - Start meadow x 0..11, spawn at x 2.5. Twyx lives here (x 5.5, roaming 2 tiles), and the
//     level is a companion hub, so E on her asks her along (or setCompanion('twyx')).
//   - A lever (x 10.5) and its brick gate (x 12.5), both on this side: the gate is here so a
//     test can leave her behind it (Sammy hops over) for the "she can't get there" hint.
//   - The cat spot cushion (x 17.5) in front of a tall wall (x 18..23) with a narrow 1-tile
//     tunnel through it at ground level. A frazzled wind-up toy mouse sits in the tunnel mouth
//     (x 18.5) and blocks it: Sammy can't fly over the wall (it reaches the top of the map).
//     E at the cushion with Twyx along: she comforts the mouse, it calms down and scoots
//     through the tunnel to the far side (x 24.5), clearing the way.
//   - The far meadow x 23..34.
export default {
    id: 'catspot',
    name: 'Cat Spot Course',
    timeOfDay: 'night',
    companionHub: true,
    legend: {
        '.': 'empty',
        '#': 'solid',
    },
    tileMap: [
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................#####...........',
        '..................................',
        '##################################',
        '##################################',
        '##################################',
        '##################################',
    ],
    entities: [
        { type: 'twyx', id: 'twyx', x: 5, y: 9, roam: 2 },
        { type: 'lever', id: 'gate-lever', targets: ['spot-gate'], x: 10, y: 9 },
        { type: 'gate', id: 'spot-gate', x: 12, y: 9 },
        { type: 'catspot', id: 'tunnel-spot', ability: 'comfort', targets: ['tunnel-mouse'], x: 17, y: 9 },
        { type: 'windupMouse', id: 'tunnel-mouse', restX: 24, x: 18, y: 9 },
    ],
    zones: [
        { type: 'spawn', rect: { x: 2, y: 8, w: 1, h: 2 } },
    ],
};
