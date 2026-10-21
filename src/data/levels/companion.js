// Companion course (T-015): a small development level for the companion's following, built from
// T-014's mechanisms. Not part of the story; tools/playtest/companion_scenario.py drives it, and
// it is reachable only with __sammy.commands.loadLevel('companion').
//
// Left to right (world units, y up; the ground's top is y = 4):
//   - Start meadow x 0..10, spawn at x 2.5. Twyx lives here (x 6.5, roaming 2 tiles), and the
//     level is a companion hub, so E on her asks her along or lets her stay.
//   - A 1-tile step (x 10..14, top 5), then 2 more up (x 14..18, top 7): hops she can do.
//   - A 3-tile drop back to the ground (x 18..22), then a 2-wide gap (x 22..24): a small leap.
//   - A brick gate (x 27.5). Sammy hops over it; its lever is on the far side (x 29.5), so he
//     opens it for her from there. She waits at the gate until he does.
//   - A 4-wide gap (x 33..37) with a ruler bridge, its lever again on the far side (x 38.5):
//     Sammy jumps it, she waits at the edge until he lowers the bridge. Falling in is a
//     world-bottom correction (she trots back in beside him).
//   - A checkpoint (x 39..41) on the far side.
//   - A 4-tall ledge (x 46..58, top 8): too tall for her. A balloon lift in the shaft beside it
//     (x 44..46) shuttles up and down once its lever (x 42.5) is on. She waits beside the
//     shaft (never in it) and rides up when it comes back down for her.
//   - Down 4 to a long run to the finish (x 58..100): a checkpoint (x 84..86), far enough along
//     that the ledge is out of view, then an exit (x 96..98) that leads on to the test level. If
//     she's still waiting back at the ledge when Sammy gets here, she catches up at this checkpoint.
//     Over the run, a high plank (x 68..73, top 9) Sammy can flap onto and drop off of far ahead:
//     she can't follow him up, but finds she can just walk on to him.
export default {
    id: 'companion',
    name: 'Companion Course',
    timeOfDay: 'night',
    nextLevel: 'test',
    // A home base for testing: E on Twyx here asks her along or lets her stay (the bedroom is the
    // real one). She lives here (placed below), so letting her stay works too.
    companionHub: true,
    legend: {
        '.': 'empty',
        '#': 'solid',
        '=': 'platform',
    },
    tileMap: [
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................................................',
        '....................................................................=====...........................',
        '..............................................############..........................................',
        '..............####............................############..........................................',
        '..............####............................############..........................................',
        '..........########............................############..........................................',
        '######################..#########....#######..######################################################',
        '######################..#########....#######..######################################################',
        '######################..#########....#######..######################################################',
        '######################..#########....#######..######################################################',
    ],
    entities: [
        { type: 'twyx', id: 'twyx', x: 6, y: 13, roam: 2 },
        { type: 'gate', id: 'course-gate', x: 27, y: 13 },
        { type: 'lever', id: 'gate-lever', targets: ['course-gate'], x: 29, y: 13 },
        { type: 'lever', id: 'bridge-lever', targets: ['course-bridge'], x: 38, y: 13 },
        { type: 'bridge', id: 'course-bridge', length: 4, x: 33, y: 14 },
        { type: 'lever', id: 'lift-lever', targets: ['course-lift'], x: 42, y: 13 },
        { type: 'lift', id: 'course-lift', x: 44, y: 14, toX: 44, toY: 10, loop: true },
    ],
    zones: [
        { type: 'spawn', rect: { x: 2, y: 12, w: 1, h: 2 } },
        { type: 'checkpoint', id: 'after-bridge', rect: { x: 39, y: 11, w: 2, h: 3 } },
        { type: 'checkpoint', id: 'finish', rect: { x: 84, y: 11, w: 2, h: 3 } },
        { type: 'exit', id: 'course-end', rect: { x: 96, y: 10, w: 2, h: 4 } },
    ],
};
