// Toy building bricks, baked: big stacks Sammy climbs (furniture kind 'bricks') and little builds
// on the shelves (a house, a castle, a tower). Plain studs, no lettering.
// World units, y up. Brick colors come from the palette's `bricks` list, picked by position so
// every visit looks the same.
import { vec2 } from 'littlejs';
import { rect, roundRect, outlinedBox, poly, hash } from './roomShapes.js';

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
