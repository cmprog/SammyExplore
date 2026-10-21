// The chapter portal (T-017): a chunky frame of beveled stone blocks (a blocky, game-style frame:
// our own speckled slate, no copied texture) around an opening filled with a slowly turning swirl
// in the chapter's color, with a glowing gem keystone on top and a wooden sign above that names
// the chapter. The bottom row of blocks is set into the floor, so Sammy walks straight in.
// Pure drawing: drawPortal(feet, state, time), drawPortalLight(feet, state, time) for the room's
// light map, and the particle draws drawPortalMote / drawPortalSpark.
//
// Units are tiles, relative to the feet (bottom center of the opening, on the floor), y up.
import {
    vec2, rgb, drawRect, drawPoly, drawEllipse, drawEllipseGradient, drawTile, drawCircle, WHITE, CLEAR_WHITE,
} from 'littlejs';
import { roundedRectPoints } from './shapes.js';
import { starPoints } from './toyParts.js';

const STONE = rgb(.40, .38, .54);
const STONE_LIGHT = rgb(.56, .54, .70);
const STONE_TOP = rgb(.66, .64, .80);
const STONE_DARK = rgb(.27, .25, .38);
const SPECKS = [rgb(.33, .31, .46), rgb(.50, .48, .64), rgb(.46, .42, .58)];
const OUTLINE = rgb(.14, .11, .20);
const SHADOW = rgb(.03, .02, .08, .3);
const DEEP = rgb(.07, .05, .18);
const BOARD = rgb(.88, .64, .40);
const BOARD_LIGHT = rgb(.97, .78, .54);
const BOARD_EDGE = rgb(.70, .48, .28);
const WOOD_LINE = rgb(.20, .11, .08);
const POST = rgb(.55, .35, .21);
const NAIL = rgb(.45, .44, .52);
const CLEAR = rgb(0, 0, 0, 0);

const HALF_W = 1.5;        // the opening: 3 wide...
const OPEN_H = 4;          // ...4 tall, standing on the floor
const COLUMNS = 5;         // blocks across the top (the opening plus one each side)
const SIGN_W = 5.4;
const SIGN_H = 1.3;
const SIGN_Y = 6.2;        // board center above the feet
const ARMS = 3;
const ARM_STEPS = 18;
const TWIST = 4.4;         // radians an arm winds from the rim to the middle
const SQUARENESS = .55;    // 0 = the swirl is an ellipse, 1 = it fills the opening's corners

/** The opening, relative to the feet: what Sammy steps into. */
export const PORTAL_OPENING = { halfWidth: HALF_W, height: OPEN_H };
/** Height of the sign's top above the feet. */
export const PORTAL_TOP = SIGN_Y + SIGN_H / 2;

/**
 * @param {Vector2} feet
 * @param {{color:Color, spin:number, pop:number, flip:number, sign:{tile:TileInfo, aspect:number}|null,
 *          flash:number}} portal
 *   color: the swirl's color now (blending between chapters); spin: swirl angle; pop: 0..1 swell;
 *   flip: sign flip progress 0..1 (0.5 = edge on); sign: the baked title (art/bakeSignText.js);
 *   flash: 0..1 just after a switch (the gem and rim brighten)
 */
export function drawPortal(feet, portal, time)
{
    drawEllipse(feet.add(vec2(0, .02)), vec2(COLUMNS + 1, .3), SHADOW);
    drawSwirl(feet, portal, time);
    drawFrame(feet, portal);
    drawKeystone(feet, portal, time);
    drawSign(feet, portal, time);
}

// --- the swirl ---------------------------------------------------------------------------------

function shades(color)
{
    return {
        dark: color.lerp(DEEP, .6),
        mid: color,
        light: color.lerp(WHITE, .55),
    };
}

/** A point of the unit disc stretched most of the way out to fill the opening (a circle of radius
 *  r becomes a rounded rectangle at r), so the arms reach toward the corners but stay curvy. */
function toOpening(feet, u, v, grow)
{
    const r = Math.hypot(u, v), m = Math.max(Math.abs(u), Math.abs(v));
    const k = m > 1e-6 ? 1 + (r / m - 1) * SQUARENESS : 0;
    return vec2(feet.x + u * k * HALF_W * grow, feet.y + OPEN_H / 2 + v * k * OPEN_H / 2 * grow);
}

function drawSwirl(feet, { color, spin, pop }, time)
{
    const c = shades(color);
    const center = feet.add(vec2(0, OPEN_H / 2));
    const grow = 1 + pop;
    drawRect(center, vec2(HALF_W * 2 + .1, OPEN_H + .1), c.dark);
    drawEllipseGradient(center, vec2(HALF_W * 2.6, OPEN_H * 1.2), c.mid.withAlpha(.85), c.mid.withAlpha(0), 0);
    for (let k = 0; k < ARMS; k++)
    {
        const start = spin + k * Math.PI * 2 / ARMS;
        const arm = [];
        for (let i = 0; i <= ARM_STEPS; i++)
        {
            const s = .06 + .98 * i / ARM_STEPS;   // 0 middle .. ~1 the rim (a touch past, under the frame)
            const a = start + (1 - s) * TWIST;
            arm.push({ p: toOpening(feet, Math.cos(a) * s, Math.sin(a) * s, grow), s });
        }
        ribbon(arm, s => .05 + s * .62, c.mid.lerp(c.light, .25).withAlpha(.5));
        ribbon(arm, s => .02 + s * .2, c.light.withAlpha(.85));
    }
    // Sparkles riding the swirl in toward the middle.
    for (let i = 0; i < 9; i++)
    {
        const t = (time * .3 + i / 9) % 1;
        const a = spin * 1.4 + i * 2.4 + t * 3;
        const p = toOpening(feet, Math.cos(a) * (1 - t) * .95, Math.sin(a) * (1 - t) * .95, grow);
        drawStar4(p, .16 * Math.sin(t * Math.PI), WHITE.withAlpha(.85 * Math.sin(t * Math.PI)), a);
    }
    const breathe = 1 + Math.sin(time * 2.3) * .08 + pop;
    drawEllipseGradient(center, vec2(1.5, 1.8).scale(breathe), WHITE.withAlpha(.9), c.light.withAlpha(0), 0);
}

/** A tapered band along `points` ({p, s}): quads that share their edges, so no seams. */
function ribbon(points, widthAt, color)
{
    const sides = points.map(({ p, s }, i) =>
    {
        const a = points[Math.max(0, i - 1)].p, b = points[Math.min(points.length - 1, i + 1)].p;
        const dir = b.subtract(a);
        const n = vec2(-dir.y, dir.x).normalize(widthAt(s) / 2);
        return [p.add(n), p.subtract(n)];
    });
    for (let i = 0; i < sides.length - 1; i++)
        drawPoly([sides[i][0], sides[i + 1][0], sides[i + 1][1], sides[i][1]], color, 0, CLEAR);
}

function drawStar4(pos, size, color, angle)
{
    if (size <= .005)
        return;
    const points = [];
    for (let i = 0; i < 8; i++)
    {
        const a = angle + i * Math.PI / 4;
        const r = i % 2 ? size * .3 : size;
        points.push(vec2(pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r));
    }
    drawPoly(points, color, 0, CLEAR);
}

// --- the frame ---------------------------------------------------------------------------------

function frameBlocks()
{
    const blocks = [];
    const edge = (COLUMNS - 1) / 2;
    for (let i = 0; i < COLUMNS; i++)
    {
        blocks.push({ x: i - edge, y: -.5, inner: 'top' });             // set into the floor
        blocks.push({ x: i - edge, y: OPEN_H + .5, inner: i === 0 || i === COLUMNS - 1 ? null : 'bottom' });
    }
    for (let row = 0; row < OPEN_H; row++)
    {
        blocks.push({ x: -edge, y: row + .5, inner: 'right' });
        blocks.push({ x: edge, y: row + .5, inner: 'left' });
    }
    return blocks;
}
const BLOCKS = frameBlocks();

function drawFrame(feet, { color, flash })
{
    const rim = color.lerp(WHITE, .45).withAlpha(.5 + flash * .4);
    for (const block of BLOCKS)
    {
        const pos = feet.add(vec2(block.x, block.y));
        drawBlock(pos, hash(block.x * 7 + block.y * 13));
        if (block.inner)
            drawRim(pos, block.inner, rim);
    }
}

/** One chunky beveled block, with a few speckles placed by `seed` so each block looks its own. */
function drawBlock(pos, seed)
{
    drawRect(pos, vec2(1.02), OUTLINE);
    drawRect(pos, vec2(.9), STONE);
    drawRect(pos.add(vec2(0, .36)), vec2(.9, .18), STONE_TOP);
    drawRect(pos.add(vec2(-.38, -.02)), vec2(.14, .7), STONE_LIGHT);
    drawRect(pos.add(vec2(0, -.38)), vec2(.9, .14), STONE_DARK);
    drawRect(pos.add(vec2(.38, -.02)), vec2(.14, .7), STONE_DARK);
    for (let i = 0; i < 4; i++)
    {
        const h = hash(seed * 31 + i * 17);
        const gx = Math.floor(h * 5), gy = Math.floor(hash(h * 97 + i) * 4);
        drawRect(pos.add(vec2(-.24 + gx * .12, -.2 + gy * .13)), vec2(.12), SPECKS[i % SPECKS.length]);
    }
}

/** The swirl's light on the block faces that look into the opening. */
function drawRim(pos, side, color)
{
    const offset = { top: vec2(0, .38), bottom: vec2(0, -.38), left: vec2(-.38, 0), right: vec2(.38, 0) }[side];
    const size = side === 'top' || side === 'bottom' ? vec2(.9, .14) : vec2(.14, .9);
    drawRect(pos.add(offset), size, color);
}

function drawKeystone(feet, { color, flash }, time)
{
    const c = shades(color);
    const pos = feet.add(vec2(0, OPEN_H + .5));
    const glow = .55 + .2 * Math.sin(time * 2.6) + flash * .4;
    drawEllipseGradient(pos, vec2(1.6 + flash), c.light.withAlpha(glow * .7), c.light.withAlpha(0), 0);
    const gem = (w, h) => [vec2(0, h), vec2(w, 0), vec2(0, -h), vec2(-w, 0)].map(p => p.add(pos));
    drawPoly(gem(.34, .4), c.mid, .05, OUTLINE);
    drawPoly([vec2(0, .4), vec2(.34, 0), vec2(0, 0)].map(p => p.add(pos)), c.light, 0, CLEAR);
    drawPoly([vec2(0, -.4), vec2(-.34, 0), vec2(0, 0)].map(p => p.add(pos)), c.dark, 0, CLEAR);
    drawCircle(pos.add(vec2(-.08, .14)), .09, WHITE.withAlpha(.85));
}

// --- the sign ----------------------------------------------------------------------------------

function drawSign(feet, { color, flip, sign }, time)
{
    for (const x of [-1.6, 1.6])
    {
        drawRect(feet.add(vec2(x, OPEN_H + 1.18)), vec2(.22, .5), WOOD_LINE);
        drawRect(feet.add(vec2(x, OPEN_H + 1.18)), vec2(.12, .5), POST);
    }
    // The board turns over (around its middle, edge on at flip 0.5) to show the new title.
    const turn = Math.abs(Math.cos(flip * Math.PI));
    const sway = Math.sin(time * 1.1) * .012;
    const center = feet.add(vec2(0, SIGN_Y));
    const h = Math.max(.06, SIGN_H * turn);
    drawPoly(roundedRectPoints(SIGN_W, h, Math.min(.22, h / 2)), BOARD, .06, WOOD_LINE, center, sway);
    if (turn < .2)
        return;
    drawPoly(roundedRectPoints(SIGN_W - .3, .1 * turn, .04), BOARD_LIGHT, 0, CLEAR, center.add(vec2(0, h / 2 - .14 * turn)), sway);
    drawPoly(roundedRectPoints(SIGN_W - .3, .07 * turn, .03), BOARD_EDGE, 0, CLEAR, center.add(vec2(0, -h / 2 + .1 * turn)), sway);
    for (const x of [-SIGN_W / 2 + .3, SIGN_W / 2 - .3])
    {
        drawCircle(center.add(vec2(x, .3 * turn)), .11, NAIL, .02, WOOD_LINE);
        const star = center.add(vec2(x, -.2 * turn));
        const points = starPoints(0, 0, .2, sway).map(([px, py]) => vec2(star.x + px, star.y + py * turn));
        drawPoly(points, shades(color).mid, .035, WOOD_LINE);
    }
    if (sign)
    {
        const height = .74, width = Math.min(SIGN_W - 1.3, height * sign.aspect);
        drawTile(center, vec2(width, width / sign.aspect * turn), sign.tile, WHITE, sway);
    }
}

// --- the light it casts (room light map, additive) ---------------------------------------------

/** @param {{color:Color, flash:number}} portal  @param {{radius:number, strength:number, pulse:number}} light */
export function drawPortalLight(feet, { color, flash }, light, time)
{
    const center = feet.add(vec2(0, OPEN_H / 2));
    const k = light.strength * (1 + Math.sin(time * 2.3) * light.pulse + flash * .5);
    const tint = (amount) => rgb(color.r * amount, color.g * amount, color.b * amount, amount);
    drawEllipseGradient(center, vec2(light.radius * 2), tint(k), CLEAR, 0);
    drawEllipseGradient(center, vec2(light.radius * .9), tint(k * .8), CLEAR, 0);
    // The swirl itself glows: lit nearly fully, whatever the time of day.
    drawRect(center, vec2(HALF_W * 2, OPEN_H), rgb(.8, .8, .8, .8));
    drawEllipseGradient(feet.add(vec2(0, SIGN_Y)), vec2(SIGN_W * 1.1, SIGN_H * 2.4), tint(k * .7), CLEAR, 0);
}

// --- particles ---------------------------------------------------------------------------------

/** A glowing mote drifting out of the swirl. @param {{size:number, alpha:number, color:Color}} p */
export function drawPortalMote(pos, p)
{
    drawEllipseGradient(pos, vec2(p.size * 4), p.color.withAlpha(p.alpha * .45), CLEAR_WHITE, 0);
    drawCircle(pos, p.size, p.color.lerp(WHITE, .5).withAlpha(p.alpha));
}

/** A twinkly four-point spark (lever switch, stepping in). */
export function drawPortalSpark(pos, p)
{
    drawStar4(pos, p.size * (1 - p.progress * .5), p.color.withAlpha(p.alpha), p.angle);
}

function hash(n)
{
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}
