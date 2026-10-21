// Toy building bricks, baked: big stacks Sammy climbs (furniture kind 'bricks') and little builds
// on the shelves (a house, a castle, a tower). Plain studs, no lettering.
// World units, y up. Brick colors come from the palette's `bricks` list, picked by position so
// every visit looks the same.
import { vec2 } from 'littlejs';
import { rect, roundRect, outlinedBox, poly, gradient, softShadow, hash } from './roomShapes.js';

const STUD_W = .5, STUD_H = .2;

/** One brick: body with a lit top and shaded bottom; studs on top if `studs` (count). */
export function brick(ctx, x0, y0, x1, y1, color, p, studs = 0)
{
    const light = color.lerp(p.paintLight, .35), shade = color.lerp(p.outline, .3);
    if (studs)
    {
        const w = x1 - x0, studW = Math.min(STUD_W, w / studs * .62);
        for (let i = 0; i < studs; i++)
        {
            const cx = x0 + w * (i + .5) / studs;
            outlinedBox(ctx, cx - studW / 2, y1 - .02, cx + studW / 2, y1 + STUD_H * (studW / STUD_W), .05, shade, p.outline);
            rect(ctx, cx - studW / 2, y1 + .02, cx + studW / 2 - studW * .25, y1 + STUD_H * (studW / STUD_W) - .03, color);
            rect(ctx, cx - studW / 2 + studW * .15, y1 + .04, cx - studW / 2 + studW * .3, y1 + STUD_H * (studW / STUD_W) - .05, light);
        }
    }
    const r = Math.min(.08, (y1 - y0) * .2);
    outlinedBox(ctx, x0, y0, x1, y1, r, shade, p.outline);
    roundRect(ctx, x0, y0 + (y1 - y0) * .16, x1 - .04, y1, r, color);
    rect(ctx, x0 + .06, y1 - (y1 - y0) * .2, x1 - .1, y1 - (y1 - y0) * .1, light);
}

function brickColor(p, x, y, salt = 0)
{
    return p.bricks[Math.floor(hash(x, y, salt) * p.bricks.length)];
}

// --- the big climbable stacks: one brick per tile row, studs on the top one ---------------------

export function drawBrickStack(ctx, { x0, y0, x1, y1 }, p)
{
    for (let y = y0, row = 0; y < y1 - .01; y++, row++)
    {
        const top = y + 1 >= y1 - .01;
        // Every other row is nudged a hair, like a stack built by hand.
        const nudge = (hash(x0, row, 9) - .5) * .12;
        brick(ctx, x0 + .04 + nudge, y, x1 - .04 + nudge, y + 1, brickColor(p, x0, row), p, top ? Math.round(x1 - x0) : 0);
    }
}

// --- small builds (decor: stand at {x, base}) -------------------------------------------------------

export function drawBrickHouse(ctx, { x, base }, p)
{
    const w = 1.5, h = .32;
    brick(ctx, x - w / 2 - .1, base, x + w / 2 + .1, base + .14, p.bricks[3], p);   // a green base plate
    for (let row = 0; row < 3; row++)
    {
        const y = base + .14 + row * h;
        brick(ctx, x - w / 2, y, x - .05, y + h, brickColor(p, x, row, 2), p);
        brick(ctx, x + .05, y, x + w / 2, y + h, brickColor(p, x + 1, row, 2), p);
    }
    // A window, then a stepped roof of red bricks with studs on the ridge.
    outlinedBox(ctx, x - .18, base + .4, x + .18, base + .72, .03, p.bricks[2].lerp(p.paintLight, .5), p.outline);
    const roofY = base + .14 + 3 * h;
    brick(ctx, x - w / 2 - .12, roofY, x + w / 2 + .12, roofY + .26, p.bricks[0], p);
    brick(ctx, x - w / 2 + .2, roofY + .26, x + w / 2 - .2, roofY + .52, p.bricks[0], p);
    brick(ctx, x - .3, roofY + .52, x + .3, roofY + .78, p.bricks[0], p, 2);
}

export function drawBrickCastle(ctx, { x, base }, p)
{
    const wallColor = p.bricks[5], towerColor = p.bricks[4];
    // Wall between two towers, with battlements and an arched door.
    for (let row = 0; row < 3; row++)
        brick(ctx, x - .9, base + row * .34, x + .9, base + (row + 1) * .34, row % 2 ? wallColor : wallColor.lerp(p.bricks[4], .15), p);
    for (const bx of [-.75, -.25, .25, .75])
        brick(ctx, x + bx - .18, base + 1.02, x + bx + .18, base + 1.3, wallColor, p, 1);
    outlinedBox(ctx, x - .25, base, x + .25, base + .6, .22, p.wood, p.outline);
    for (const side of [-1, 1])
    {
        const tx = x + side * 1.1;
        for (let row = 0; row < 5; row++)
            brick(ctx, tx - .32, base + row * .34, tx + .32, base + (row + 1) * .34, row % 2 ? towerColor : towerColor.lerp(p.paintLight, .2), p);
        brick(ctx, tx - .4, base + 1.7, tx + .4, base + 1.95, towerColor, p, 2);
        outlinedBox(ctx, tx - .07, base + .9, tx + .07, base + 1.3, .05, p.outline.lerp(p.back, .3), p.outline);
    }
    // A little pennant on the right tower.
    const fx = x + 1.1, fy = base + 2.15;
    rect(ctx, fx - .03, fy - .2, fx + .03, fy + .65, p.outline);
    poly(ctx, [vec2(0, 0), vec2(.5, -.14), vec2(0, -.3)], p.bricks[2], fx + .03, fy + .62);
}

export function drawBrickTower(ctx, { x, base }, p)
{
    for (let row = 0; row < 5; row++)
        brick(ctx, x - .4, base + row * .38, x + .4, base + (row + 1) * .38, brickColor(p, x, row, 5), p, row === 4 ? 2 : 0);
}

// --- a brick fort (T-018): a hollow toy fort with a low tunnel door --------------------------------
// The piece's rect is the whole fort. Its collision tiles are the left wall above the door (one
// column) and the roof (the top row); everything else is open: the door is the bottom-left cell,
// and the room inside is the rest. The far wall is the room's own wall (the fort stands against it).

const FORT_ROW = .5;   // two bricks per tile row, so the walls read as small toy bricks

export function drawBrickFort(ctx, { x0, y0, x1, y1 }, p)
{
    const wall = x0 + 1, roof = y1 - 1, door = y0 + 1;
    drawFortInside(ctx, wall, y0, x1, roof, p);
    drawFortDoor(ctx, x0, y0, wall, door, p);
    // The left wall above the door: staggered bricks, one row per half tile.
    for (let y = door, row = 0; y < roof - .01; y += FORT_ROW, row++)
        fortCourse(ctx, x0, wall, y, row, p);
    drawFortArch(ctx, x0, wall, door, p);
    // The roof: two courses of long bricks with studs along the top, and a pennant.
    for (let row = 0; row < 2; row++)
        fortCourse(ctx, x0 - .08, x1, roof + row * FORT_ROW, row + 7, p, row === 1);
    drawPennant(ctx, x1 - .7, y1 + .18, p);
}

/** One course of bricks from xa to xb with its bottom at y. Odd rows start with a half brick. */
function fortCourse(ctx, xa, xb, y, row, p, studs = false)
{
    const long = 1;
    let x = xa;
    for (let i = 0; x < xb - .01; i++)
    {
        const w = Math.min(i === 0 && row % 2 ? long / 2 : long, xb - x);
        brick(ctx, x + .02, y, x + w - .02, y + FORT_ROW, brickColor(p, x * 2, row, 21), p, studs ? Math.max(1, Math.round(w * 2)) : 0);
        x += w;
    }
}

/** The cozy room inside: a shaded back wall with faint brick lines and a soft warm glow. */
function drawFortInside(ctx, x0, y0, x1, y1, p)
{
    const back = p.backDark, deep = p.backDark.lerp(p.outline, .35);
    rect(ctx, x0, y0, x1, y1, back);
    for (let y = y0 + FORT_ROW, row = 0; y < y1 - .01; y += FORT_ROW, row++)
    {
        rect(ctx, x0, y - .02, x1, y + .02, deep.withAlpha(.35));
        for (let x = x0 + (row % 2 ? .5 : 1); x < x1 - .1; x += 1)
            rect(ctx, x - .02, y, x + .02, y + FORT_ROW, deep.withAlpha(.3));
    }
    // Shade under the roof, a little light on the floor.
    gradient(ctx, x0, y1 - .7, x1, y1, deep.withAlpha(.8), deep.withAlpha(0));
    softShadow(ctx, (x0 + x1) / 2, y0 + .5, (x1 - x0) * 1.1, 1.6, p.paintLight.withAlpha(.18));
    // The far wall: a narrow column of bricks where the fort meets the room's wall.
    for (let y = y0, row = 0; y < y1 - .01; y += FORT_ROW, row++)
        brick(ctx, x1 - .22, y, x1, y + FORT_ROW, brickColor(p, x1, row, 23), p);
}

/** The low door: brick sides with a dark, round-topped tunnel through them. */
function drawFortDoor(ctx, x0, y0, x1, y1, p)
{
    const dark = p.backDark.lerp(p.outline, .6), side = brickColor(p, x0, 0, 22);
    brick(ctx, x0 + .02, y0, x1 - .02, y1, side, p);
    for (const [grow, color] of [[.055, p.outline], [0, dark]])
    {
        rect(ctx, x0 + .1 - grow, y0, x1 - .1 + grow, y0 + .5, color);
        roundRect(ctx, x0 + .1 - grow, y0, x1 - .1 + grow, y1 - .06 + grow, .38 + grow, color);
    }
}

/** A ring of little bricks over the door (art only: it rests on the wall above). */
function drawFortArch(ctx, x0, x1, y, p)
{
    for (let i = 0; i < 5; i++)
    {
        const a = Math.PI * (i + .5) / 5;
        const cx = (x0 + x1) / 2 + Math.cos(a) * .42, cy = y - .14 + Math.sin(a) * .18;
        brick(ctx, cx - .1, cy - .09, cx + .1, cy + .09, p.bricks[i % 2 ? 1 : 5], p);
    }
}

/** A little flag on a stick, standing on the roof. */
function drawPennant(ctx, x, y, p)
{
    rect(ctx, x - .045, y - .05, x + .045, y + 1.15, p.outline);
    rect(ctx, x - .02, y, x + .02, y + 1.12, p.paintLight);
    poly(ctx, [vec2(0, 0), vec2(.62, -.17), vec2(0, -.36)].map(v => vec2(v.x * 1.1 - .03, v.y * 1.12 + .02)), p.outline, x, y + 1.1);
    poly(ctx, [vec2(0, 0), vec2(.62, -.17), vec2(0, -.36)], p.bricks[4], x, y + 1.1);
}
