// The bedroom: Sammy's home base (M2). Rescued cats live here, the chapter portal (T-017) stands
// here, and the practice course (T-018) fills the right end. Narration lives in
// src/data/narration/bedroom.js.
//
// `companionHub: true` marks the home base: the cats roam here, and Sammy picks a companion here
// (T-015 reads it).
//
// Indoors (`environment: 'bedroom'`, see data/environments.js): no outdoor backdrop. The wall,
// window, furniture and decor are drawn from the `room` block below, and a day/night cycle
// (data/dayCycle.js) runs the light outside the window and in the room.
//
// Sammy is owl-sized, so the furniture is a climbing frame. Surfaces are world heights (y up);
// the floor top is at 5 so the narrator's text box never covers the walkway.
//   - Portal alcove (x 1-9): the chapter portal (opening x 3-5, frame x 2-6, its sign above) and,
//     beside it, the lever that turns it to the next unlocked chapter. Sammy arrives just right
//     of them, and walking left into the swirl steps through to the chapter it shows.
//   - The rug, Twyx, and the toy chest (top 7), a low brick beside it (top 7), then two brick
//     stacks (tops 8 and 10).
//   - The desk (top 10, walk under it) below the window. Its sill (top 13) is a one-way ledge;
//     a long one-way shelf above the window (top 24) holds a brick castle and plushies.
//   - The bookshelf: one-way shelves at 8, 11, 14, 17 and a solid top at 20.
//   - The dresser (top 11), with brick steps (tops 7 and 9) up its left side and a toy shelf
//     (top 9) on its right, so a cat can cross it both ways; the nightlight is plugged in low on
//     the wall beside it.
//   - The practice course (x 55-84, T-018): an optional loop that teaches the companion's
//     follow / help-her-through / cat spot routine, about one screen. Left to right:
//       - entry (x 55-58, narration 'practice.entry'): little one-way toy shelves (9 by the
//         dresser, 7, then 9 again) up to the bed (footboard 10, mattress 9, headboard 11, with
//         2 tiles to walk under it): hops Twyx follows.
//       - the gap (x 71-76, 'practice.gap'): too wide for her. Sammy flaps across to the toy
//         cubby (top 11), where a one-way lever ('practice.lever') lowers a ruler bridge from his
//         side, and a checkpoint (her catch-up point if she's left waiting, see T-015).
//       - on the cubby, a cat spot cushion ('practice.tunnel') by a brick fort whose only way in
//         is a one-tile tunnel, blocked by the frazzled wind-up mouse. Twyx's Comfort calms it,
//         it scoots inside, and the toy star (a placeholder find) is in the fort.
//     Without Twyx, everything but the fort works the same (Sammy flies the gap; the cushion
//     answers with a hint). The cubby's sides are too tall for a cat from the floor, so the
//     bridge is her only way across. Ways out: back over the bridge (it stays down), or drop
//     into the gap: the floor there runs under the bed back to the entry, so nobody is stuck.
//   - A plush shelf (top 14) over the toy chest.
// Every height step is at most 5 tiles (a jump and flaps), and nothing here can strand Sammy:
// the room is closed (walls and ceiling are the level bounds) and the floor runs wall to wall.
//
// Coordinates are tile columns and rows from the top-left of tileMap (28 rows, so row =
// 27 - world cell y), like every level. Furniture tiles (legend 'furniture' and 'shelf') are
// invisible: each must lie inside one of `room.furniture`'s rects, whose art draws them.
export default {
    id: 'bedroom',
    name: 'The Bedroom',
    environment: 'bedroom',
    // The home base where rescued cats live and a companion is chosen (read by T-015).
    companionHub: true,
    legend: {
        '.': 'empty',
        '#': 'floor',
        '-': 'shelf',       // one-way: shelves, the window sill
        t: 'furniture',     // toy chest
        l: 'furniture',     // brick stacks
        d: 'furniture',     // desk top
        k: 'furniture',     // bookshelf top
        r: 'furniture',     // dresser
        b: 'furniture',     // bed: footboard, mattress, headboard
        c: 'furniture',     // toy cubby top
        f: 'furniture',     // brick fort (practice course)
    },
    tileMap: [
        '....................................................................................',   //  0
        '....................................................................................',   //  1
        '....................................................................................',   //  2
        '....................................................................................',   //  3
        '.........................--------------.............................................',   //  4  high shelf
        '....................................................................................',   //  5
        '....................................................................................',   //  6
        '....................................................................................',   //  7
        '.......................................kkkkkkk......................................',   //  8  bookshelf top
        '....................................................................................',   //  9
        '....................................................................................',   // 10
        '.......................................-------......................................',   // 11
        '....................................................................................',   // 12
        '....................................................................................',   // 13
        '............--------...................-------..................................ffff',   // 14  plush shelf; fort roof
        '..........................------------..........................................f...',   // 15  window sill; fort wall over the tunnel
        '....................................................................................',   // 16
        '.......................................-------..rrrrrrr..............bb.....cccccccc',   // 17  cubby top (course far side), headboard top
        '........................ll.dddddddddd...........rrrrrrr......b.......bb.............',   // 18  desk; footboard top
        '........................ll.....................lrrrrrrr--..--bbbbbbbbbb.............',   // 19  bed; toy shelves (top 9)
        '......................llll.............-------.lrrrrrrr......bbbbbbbbbb.....--------',   // 20  cubby shelf
        '...............ttttttlllll....................llrrrrrrr..--.........................',   // 21  toy shelf (top 7)
        '...............ttttttlllll....................llrrrrrrr.............................',   // 22  floor level
        '####################################################################################',   // 23  floor top = 5
        '####################################################################################',   // 24
        '####################################################################################',   // 25
        '####################################################################################',   // 26
        '####################################################################################',   // 27
    ],
    entities: [
        { type: 'twyx', id: 'twyx', x: 13, y: 22 },
        // T-017: the chapter portal (x = the middle of its opening) and its lever.
        { type: 'portal', id: 'portal', x: 4, y: 22 },
        { type: 'lever', id: 'portal-lever', mode: 'cycle', targets: ['portal'], x: 8, y: 22 },
        // T-018 practice course: the bridge over the gap (hinged on the cubby side, where its
        // lever is), the cat spot, the wind-up mouse in the fort's tunnel (it scoots inside to
        // the back wall once calm), and the toy star in the fort.
        { type: 'bridge', id: 'practice-bridge', length: 5, hinge: 'right', x: 71, y: 17 },
        { type: 'lever', id: 'practice-lever', targets: ['practice-bridge'], oneWay: true, x: 77, y: 16 },
        { type: 'catspot', id: 'practice-spot', ability: 'comfort', targets: ['practice-mouse'], key: 'practice.mouse', x: 79, y: 16 },
        { type: 'windupMouse', id: 'practice-mouse', restX: 83, x: 80, y: 16 },
        { type: 'collectible', id: 'practice-star', kind: 'toyStar', x: 82, y: 16 },
    ],
    zones: [
        { type: 'spawn', rect: { x: 11, y: 21, w: 1, h: 2 } },
        // T-019 room remarks (narration/bedroom.js): the portal (just right of its frame, clear
        // of the lever), the toy chest, the brick stacks, the window sill, the high shelf's brick
        // castle, and the book stack and craft blocks under the bed.
        { type: 'narration', key: 'bedroom.portal', rect: { x: 6, y: 17, w: 1, h: 6 } },
        { type: 'narration', key: 'bedroom.toys', rect: { x: 15, y: 17, w: 6, h: 6 } },
        { type: 'narration', key: 'bedroom.lego', rect: { x: 22, y: 15, w: 4, h: 8 } },
        { type: 'narration', key: 'bedroom.window', rect: { x: 27, y: 8, w: 10, h: 7 } },
        { type: 'narration', key: 'bedroom.castle', rect: { x: 25, y: 0, w: 14, h: 4 } },
        { type: 'narration', key: 'bedroom.blocks', rect: { x: 59, y: 21, w: 9, h: 2 } },
        // T-018 practice course. The checkpoint is past the bridge, where Twyx may wait.
        { type: 'narration', key: 'practice.entry', rect: { x: 56, y: 17, w: 2, h: 6 } },
        { type: 'narration', key: 'practice.gap', rect: { x: 67, y: 12, w: 4, h: 7 } },
        { type: 'narration', key: 'practice.lever', rect: { x: 76, y: 12, w: 2, h: 5 } },
        { type: 'narration', key: 'practice.tunnel', rect: { x: 79, y: 14, w: 1, h: 3 } },
        { type: 'checkpoint', id: 'practice-far-side', rect: { x: 76, y: 14, w: 3, h: 3 } },
    ],
    room: {
        // The nightlight plugs into the wall in this cell (low, beside the dresser).
        nightlight: { x: 56, y: 22 },
        // Each piece's rect covers its collision tiles above; the art draws the whole piece
        // (legs reach down to the floor). Each kind's art and layout: src/art/room/roomArt.js.
        furniture: [
            { kind: 'toyChest', x: 15, y: 21, w: 6, h: 2 },
            // A low brick between the chest and the stacks (T-020): no one-tile slot to get stuck in.
            { kind: 'bricks', x: 21, y: 21, w: 1, h: 2 },
            { kind: 'bricks', x: 22, y: 20, w: 2, h: 3 },
            { kind: 'bricks', x: 24, y: 18, w: 2, h: 5 },
            { kind: 'wallShelf', x: 12, y: 14, w: 8, h: 1 },
            { kind: 'desk', x: 27, y: 18, w: 10, h: 1 },
            // The window: the bottom row is the sill, the frame stands on it, one tile in from each end.
            { kind: 'window', x: 26, y: 6, w: 12, h: 10 },
            { kind: 'wallShelf', x: 25, y: 4, w: 14, h: 1 },
            { kind: 'bookshelf', x: 39, y: 8, w: 7, h: 15, shelfEvery: 3 },
            { kind: 'dresser', x: 48, y: 17, w: 7, h: 6 },
            // T-018: brick steps up the dresser's left side, so a cat can climb over it (she hops
            // at most 2): from the floor to 7, 9, then the dresser top at 11. The toy shelves on
            // its right side (below) are her steps on that side, into the practice course.
            { kind: 'bricks', x: 46, y: 21, w: 1, h: 2 },
            { kind: 'bricks', x: 47, y: 19, w: 1, h: 4 },
            // Footboard (1 wide, 3 tall), mattress (2 tall), headboard (2 wide, the full height).
            // T-018 practice course: three little toy shelves up to the bed, the bed (lower
            // headboard, so a cat can hop up it), the toy cubby across the gap, and the brick fort
            // on top of the cubby (its art draws the tunnel door and the room inside).
            { kind: 'wallShelf', x: 55, y: 19, w: 2, h: 1 },
            { kind: 'wallShelf', x: 57, y: 21, w: 2, h: 1 },
            { kind: 'wallShelf', x: 59, y: 19, w: 2, h: 1 },
            { kind: 'bed', x: 61, y: 17, w: 10, h: 4 },
            { kind: 'cubby', x: 76, y: 17, w: 8, h: 6, shelfEvery: 3 },
            { kind: 'brickFort', x: 80, y: 14, w: 4, h: 3 },
        ],
        // Decor never collides. Rect items ({x, y, w, h}) are placed like zones; standing items
        // ({x, y}) stand on the bottom of cell row y, centered on x (both may be fractional).
        decor: [
            // Wall
            { kind: 'fairyLights', x: .5, y: 1.3, w: 83, span: 5.5, sag: .55, every: 1.1 },
            { kind: 'poster', art: 'cat', x: 13, y: 7, w: 4, h: 5 },
            { kind: 'poster', art: 'landscape', x: 19, y: 7.4, w: 4.6, h: 4.2 },
            { kind: 'poster', art: 'heart', x: 47.8, y: 10.6, w: 3.4, h: 3.2 },
            { kind: 'poster', art: 'gem', x: 51.7, y: 9.6, w: 3.1, h: 3.4 },
            { kind: 'bunting', x: 59.5, y: 9, w: 15, sag: .9 },
            // Floor (drawn in front of the floorboards)
            { kind: 'rug', x: 10.4, y: 22, w: 13.2 },
            // Plush shelf over the toy chest
            { kind: 'plush', variant: 'bunny', x: 13.4, y: 13 },
            { kind: 'plush', variant: 'bear', x: 15.4, y: 13 },
            { kind: 'books', x: 16.8, y: 13, w: 2.9 },
            // Desk
            { kind: 'deskLamp', x: 28.3, y: 17 },
            { kind: 'pencilCup', x: 30.4, y: 17 },
            { kind: 'brickHouse', x: 33.3, y: 17 },
            { kind: 'bookStack', x: 35.6, y: 17 },
            // High shelf
            { kind: 'brickCastle', x: 27.8, y: 3 },
            { kind: 'plush', variant: 'jelly', x: 31.2, y: 3 },
            { kind: 'plush', variant: 'cat', x: 34.4, y: 3 },
            { kind: 'plant', x: 37.4, y: 3 },
            // Bookshelf, bottom to top
            { kind: 'books', x: 39.45, y: 21.55, w: 3.6 },
            { kind: 'plush', variant: 'frog', x: 44.3, y: 21.55 },
            { kind: 'books', x: 39.45, y: 19, w: 4.2 },
            { kind: 'plant', x: 44.6, y: 19 },
            { kind: 'plush', variant: 'bear', x: 40.4, y: 16 },
            { kind: 'books', x: 41.5, y: 16, w: 4.05 },
            { kind: 'books', x: 39.45, y: 13, w: 3.3 },
            { kind: 'brickHouse', x: 44.3, y: 13 },
            { kind: 'bookStack', x: 40.4, y: 10 },
            { kind: 'books', x: 41.7, y: 10, w: 3.85 },
            { kind: 'brickTower', x: 44.2, y: 7 },
            // Dresser
            { kind: 'plant', x: 48.3, y: 16 },
            { kind: 'photo', x: 50.7, y: 16 },
            { kind: 'plush', variant: 'cat', x: 53.3, y: 16 },
            // Practice course: a plush on the bed, toys under it (lost things end up under
            // beds), bins in the cubby, and craft blocks about.
            { kind: 'plush', variant: 'bunny', x: 63.6, y: 18 },
            { kind: 'craftBlock', variant: 'grass', x: 64.2, y: 22 },
            { kind: 'craftBlock', variant: 'plank', x: 66.6, y: 22, size: .6 },
            { kind: 'bookStack', x: 59.4, y: 22 },
            { kind: 'craftBlock', variant: 'stone', x: 72.6, y: 22 },
            { kind: 'craftBlock', variant: 'gem', x: 73.5, y: 22, size: .7 },
            { kind: 'craftBlock', variant: 'grass', x: 72.9, y: 21.2, size: .7 },
            { kind: 'bin', variant: 'grass', x: 78, y: 21.6 },
            { kind: 'bin', variant: 'gem', x: 82, y: 21.6 },
            { kind: 'bin', variant: 'heart', x: 78, y: 19 },
            { kind: 'plush', variant: 'frog', x: 82, y: 19 },
        ],
        // Space kept free for later tasks (checked at load): no tiles, furniture, decor, entities
        // or zones inside, unless the region allows furniture or decor. None at the moment: the
        // portal alcove (T-017) and the practice course (T-018) are built.
        reserved: [],
    },
};
