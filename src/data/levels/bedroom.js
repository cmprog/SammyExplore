// The bedroom: Sammy's home base (M2). Rescued cats live here, the chapter portal (T-017) stands
// here, and later a practice course (T-018). Narration lives in src/data/narration/bedroom.js.
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
//   - The rug, Twyx, and the toy chest (top 7), then two brick stacks (tops 8 and 10).
//   - The desk (top 10, walk under it) below the window. Its sill (top 13) is a one-way ledge;
//     a long one-way shelf above the window (top 24) holds a brick castle and plushies.
//   - The bookshelf: one-way shelves at 8, 11, 14, 17 and a solid top at 20.
//   - The dresser (top 11), and the nightlight plugged in low on the wall beside it.
//   - Practice course (x 57-83): RESERVED. The bed (mattress top 9, headboard 14, room to walk
//     under) and the toy cubby (one-way shelves at 8 and 11, top 15) stand in it for now.
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
        '...............................................................................ccccc',   // 13  cubby top
        '............--------...................-------.............................bb.......',   // 14  plush shelf
        '..........................------------.....................................bb.......',   // 15  window sill
        '...........................................................................bb.......',   // 16
        '.......................................-------.rrrrrrrr....................bb..-----',   // 17
        '........................ll.dddddddddd..........rrrrrrrr...b................bb.......',   // 18  desk
        '........................ll.....................rrrrrrrr...bbbbbbbbbbbbbbbbbbb.......',   // 19  bed
        '......................llll.............-------.rrrrrrrr...bbbbbbbbbbbbbbbbbbb..-----',   // 20
        '...............tttttt.llll.....................rrrrrrrr.............................',   // 21
        '...............tttttt.llll.....................rrrrrrrr.............................',   // 22  floor level
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
    ],
    zones: [
        { type: 'spawn', rect: { x: 11, y: 21, w: 1, h: 2 } },
    ],
    room: {
        // The nightlight plugs into the wall in this cell (low, beside the dresser).
        nightlight: { x: 56, y: 22 },
        // Each piece's rect covers its collision tiles above; the art draws the whole piece
        // (legs reach down to the floor). Each kind's art and layout: src/art/room/roomArt.js.
        furniture: [
            { kind: 'toyChest', x: 15, y: 21, w: 6, h: 2 },
            { kind: 'bricks', x: 22, y: 20, w: 2, h: 3 },
            { kind: 'bricks', x: 24, y: 18, w: 2, h: 5 },
            { kind: 'wallShelf', x: 12, y: 14, w: 8, h: 1 },
            { kind: 'desk', x: 27, y: 18, w: 10, h: 1 },
            // The window: the bottom row is the sill, the frame stands on it, one tile in from each end.
            { kind: 'window', x: 26, y: 6, w: 12, h: 10 },
            { kind: 'wallShelf', x: 25, y: 4, w: 14, h: 1 },
            { kind: 'bookshelf', x: 39, y: 8, w: 7, h: 15, shelfEvery: 3 },
            { kind: 'dresser', x: 47, y: 17, w: 8, h: 6 },
            // Footboard (1 wide, 3 tall), mattress (2 tall), headboard (2 wide, the full height).
            { kind: 'bed', x: 58, y: 14, w: 19, h: 7 },
            { kind: 'cubby', x: 79, y: 13, w: 5, h: 10, shelfEvery: 3 },
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
            // Bed and cubby (inside the practice course region; T-018 may move them)
            { kind: 'plush', variant: 'bunny', x: 70.6, y: 18 },
            { kind: 'bin', variant: 'grass', x: 80.3, y: 21.6 },
            { kind: 'bin', variant: 'gem', x: 82.7, y: 21.6 },
            { kind: 'bin', variant: 'heart', x: 80.3, y: 19 },
            { kind: 'bin', variant: 'star', x: 82.7, y: 19 },
            { kind: 'bin', variant: 'grass', x: 80.3, y: 16 },
            { kind: 'plush', variant: 'frog', x: 82.7, y: 16 },
        ],
        // Space kept free for later tasks (checked at load): no tiles, furniture, decor, entities
        // or zones inside, unless the region allows furniture or decor.
        reserved: [
            // T-018: the practice course, about one screen. The bed and cubby (and the toys on
            // them) are placeholders it can keep, move, or rebuild (the course goes under and
            // around them).
            { id: 'practice-course', task: 'T-018', x: 57, y: 5, w: 27, h: 18, allowFurniture: true, allowDecor: true },
        ],
    },
};
