// Procedural terrain tiles: rounded, softly outlined ground with a grassy cap, and wooden
// one-way planks. Indoor floorboards live in drawFloorboards.js and are dispatched from here. Shapes are built once per tile at level load (buildTerrainTile).
// The static look is drawn in passes (outline, body, detail) so outlines never paint over a
// neighbor's fill; Terrain bakes those passes into cached canvases once. Only the swaying grass
// blades and flowers (drawTerrainAnimated) are drawn live every frame.
//
// Every static draw function takes an optional 2D context: given one, it draws with Canvas2D
// into it (baking); without one it draws with WebGL to the screen.
// A tile occupies the world cell [x, x+1] x [y, y+1] (y up). Corners only round where both
// touching sides are open, so connected ground reads as one soft blob, not a grid of squares.
import { vec2, drawPoly, drawEllipse, drawRect, drawCircle } from 'littlejs';
import {
    buildFloorboards, drawFloorboardsOutline, drawFloorboardsBody, drawFloorboardsDetail,
} from './drawFloorboards.js';

const OUTLINE = 0.06;          // soft outline thickness, world units
const CORNER_RADIUS = 0.3;
const SHADE_BOTTOM = 0.14;     // darker lip along open bottoms (light comes from above)
const SHADE_RIGHT = 0.07;
const GRASS_DEPTH = 0.36;      // how far the grass cap hangs down from the tile top
const GRASS_LIFT = 0.06;       // grass sits a hair above the collision top so it looks soft
const GRASS_OVERHANG = 0.08;   // grass pokes past open sides like frosting
const GRASS_END_RADIUS = 0.17;
const PLANK_DEPTH = 0.4;
const PLANK_END_RADIUS = 0.15;
const GRASS_BUMP_SIZE = 0.36;  // lumpy top edge, like a little bush
const RIM_WIDTH = 0.06;        // lit edge on open left sides (light comes from the upper left)
const ARC_SEGMENTS = 6;

/**
 * Precompute everything static about one tile.
 * @param {'ground'|'plank'|'floorboards'} style - the tile type's `draw` style (data/tileTypes.js)
 * @param {number} x - world cell x
 * @param {number} y - world cell y (bottom of the cell)
 * @param {{up:boolean, down:boolean, left:boolean, right:boolean, wallLeft:boolean, wallRight:boolean}} same
 *        - which neighbors are drawn in the same style; wallLeft/Right: a real (in-map) wall rises
 *          from the tile beside this one
 */
export function buildTerrainTile(style, x, y, same)
{
    const pos = vec2(x, y);
    if (style === 'floorboards')
        return buildFloorboards(pos, same);
    return style === 'plank' ? buildPlank(pos, same) : buildGround(pos, same);
}

/** Pass 1: outlines for every tile in view, before any fills. */
export function drawTerrainOutline(tile, palette, ctx)
{
    if (tile.style === 'floorboards')
        drawFloorboardsOutline(tile, palette, ctx);
    else if (tile.style === 'plank')
        poly(tile.outline, palette.woodOutline, ctx);
    else
    {
        tile.outline && poly(tile.outline, palette.outline, ctx);
        if (tile.grass)
        {
            poly(tile.grass.outline, palette.grassOutline, ctx);
            for (const blob of [...tile.grass.drips, ...tile.grass.bumps])
                circle(blob.pos, blob.size + OUTLINE * 2, palette.grassOutline, ctx);
        }
    }
}

/** Pass 2: main fills. */
export function drawTerrainBody(tile, palette, ctx)
{
    if (tile.style === 'floorboards')
        return drawFloorboardsBody(tile, palette, ctx);
    if (tile.style === 'plank')
    {
        poly(tile.body, palette.wood, ctx);
        poly(tile.shine, palette.woodShine, ctx);
        return;
    }
    poly(tile.shadow, palette.dirtShadow, ctx);
    poly(tile.body, palette.dirt, ctx);
}

/** Pass 3: specks, grass cap, nails. */
export function drawTerrainDetail(tile, palette, ctx)
{
    if (tile.style === 'floorboards')
        drawFloorboardsDetail(tile, palette, ctx);
    else if (tile.style === 'plank')
        drawPlankDetail(tile, palette, ctx);
    else
        drawGroundDetail(tile, palette, ctx);
}

/** Live pass, every frame: grass blades and flowers sway gently with `time`. */
export function drawTerrainAnimated(tile, palette, time)
{
    const grass = tile.grass;
    if (!grass)
        return;
    for (const blade of grass.blades)
    {
        const sway = Math.sin(time * 1.6 + blade.phase + tile.pos.x * 0.5) * 0.12;
        drawPoly(blade.points, blade.light ? palette.grassShine : palette.grass, 0, undefined, blade.pos, sway);
    }
    if (grass.flower)
        drawFlower(grass.flower, palette, time);
}

/** True if the tile has anything drawTerrainAnimated would draw. */
export function terrainTileIsAnimated(tile)
{
    return !!tile.grass && (tile.grass.blades.length > 0 || !!tile.grass.flower);
}

// ---------------------------------------------------------------------------------------------
// Ground

function buildGround(pos, same)
{
    const open = { up: !same.up, down: !same.down, left: !same.left, right: !same.right };
    const radii = {
        tl: open.up && open.left ? CORNER_RADIUS : 0,
        tr: open.up && open.right ? CORNER_RADIUS : 0,
        bl: open.down && open.left ? CORNER_RADIUS : 0,
        br: open.down && open.right ? CORNER_RADIUS : 0,
    };
    const x0 = pos.x, y0 = pos.y, x1 = pos.x + 1, y1 = pos.y + 1;
    const anyOpen = open.up || open.down || open.left || open.right;

    return {
        style: 'ground',
        pos,
        outline: anyOpen ? roundedRect(
            x0 - (open.left ? OUTLINE : 0), y0 - (open.down ? OUTLINE : 0),
            x1 + (open.right ? OUTLINE : 0), y1 + (open.up ? OUTLINE : 0),
            growRadii(radii, OUTLINE)) : null,
        shadow: roundedRect(x0, y0, x1, y1, radii),
        body: roundedRect(x0, y0 + (open.down ? SHADE_BOTTOM : 0),
            x1 - (open.right ? SHADE_RIGHT : 0), y1, radii),
        rim: open.left ? {
            pos: vec2(x0 + RIM_WIDTH / 2 + 0.04, (y0 + radii.bl + y1 - radii.tl) / 2),
            size: vec2(RIM_WIDTH, 1 - radii.bl - radii.tl),
        } : null,
        specks: buildSpecks(pos, open),
        grass: open.up ? buildGrass(pos, open) : null,
        tufts: open.up ? buildTufts(pos, same) : [],
    };
}

/** A grass tile at the foot of a wall gets a little three-lump bush tucked into the corner,
 *  so the ground doesn't meet the wall at a hard right angle. */
function buildTufts(pos, same)
{
    const tufts = [];
    const y = pos.y + 1 + GRASS_LIFT;
    const bush = (cornerX, dir, salt) =>
    {
        const grow = hash(pos.x, pos.y, salt) * 0.08;
        tufts.push(
            { pos: vec2(cornerX + dir * 0.36, y + 0.04), size: 0.26 + grow, dark: false },
            { pos: vec2(cornerX + dir * 0.06, y + 0.14), size: 0.46 + grow, dark: true },
            { pos: vec2(cornerX + dir * 0.16, y + 0.06), size: 0.36 + grow, dark: false });
    };
    if (same.wallLeft)
        bush(pos.x, 1, 70);
    if (same.wallRight)
        bush(pos.x + 1, -1, 71);
    return tufts;
}

function buildSpecks(pos, open)
{
    // Specks stay well inside the tile so they can never poke into open air.
    const top = open.up ? 1 - GRASS_DEPTH - 0.12 : 0.85;
    const specks = [];
    // Sparse on purpose: a speck in every tile reads as a grid of polka dots.
    if (hash(pos.x, pos.y, 1) < 0.4)
    {
        const blobSize = 0.24 + hash(pos.x, pos.y, 2) * 0.14;
        specks.push({
            kind: 'blob',
            pos: vec2(pos.x + 0.3 + hash(pos.x, pos.y, 3) * 0.4, pos.y + 0.25 + hash(pos.x, pos.y, 4) * (top - 0.45)),
            size: vec2(blobSize * 1.5, blobSize),
        });
    }
    if (hash(pos.x, pos.y, 5) < 0.35)
    {
        const w = 0.14 + hash(pos.x, pos.y, 6) * 0.1;
        specks.push({
            kind: 'pebble',
            pos: vec2(pos.x + 0.22 + hash(pos.x, pos.y, 7) * 0.56, pos.y + 0.2 + hash(pos.x, pos.y, 8) * (top - 0.35)),
            size: vec2(w, w * 0.7),
        });
    }
    return specks;
}

function buildGrass(pos, open)
{
    const x0 = pos.x - (open.left ? GRASS_OVERHANG : 0);
    const x1 = pos.x + 1 + (open.right ? GRASS_OVERHANG : 0);
    const y0 = pos.y + 1 - GRASS_DEPTH;
    const y1 = pos.y + 1 + GRASS_LIFT;
    const endRadii = {
        tl: open.left ? GRASS_END_RADIUS : 0, bl: open.left ? GRASS_END_RADIUS : 0,
        tr: open.right ? GRASS_END_RADIUS : 0, br: open.right ? GRASS_END_RADIUS : 0,
    };

    const drips = [];
    for (let i = 0; i < 2; i++)
    {
        // Scalloped underside: two soft bumps per tile, kept away from rounded ends.
        const lo = open.left ? 0.3 : 0.1, hi = open.right ? 0.7 : 0.9;
        const t = (i + hash(pos.x, pos.y, 20 + i)) / 2;
        drips.push({
            pos: vec2(pos.x + lo + t * (hi - lo), y0 + 0.01),
            size: 0.2 + hash(pos.x, pos.y, 22 + i) * 0.12,
        });
    }

    const bumps = [];
    for (let i = 0; i < 2; i++)
    {
        // Soft lumps along the top; skip the ones that would stick out past a rounded end.
        const bx = pos.x + (i + 0.5) / 2 + (hash(pos.x, pos.y, 25 + i) - 0.5) * 0.2;
        if ((open.left && bx < pos.x + 0.25) || (open.right && bx > pos.x + 0.75))
            continue;
        const size = GRASS_BUMP_SIZE + hash(pos.x, pos.y, 28 + i) * 0.1;
        bumps.push({ pos: vec2(bx, y1 - size / 2 + 0.05), size });
    }

    const blades = [];
    const bladeCount = Math.floor(hash(pos.x, pos.y, 30) * 4);   // 0..3, so the edge isn't uniform
    for (let i = 0; i < bladeCount; i++)
    {
        const height = 0.12 + hash(pos.x, pos.y, 31 + i) * 0.12;
        const lean = (hash(pos.x, pos.y, 35 + i) - 0.5) * 0.06;
        blades.push({
            pos: vec2(pos.x + 0.12 + hash(pos.x, pos.y, 39 + i) * 0.76, y1 + 0.02),
            points: [vec2(-0.04, 0), vec2(0.04, 0), vec2(lean, height)],
            phase: hash(pos.x, pos.y, 43 + i) * 6.28,
            light: hash(pos.x, pos.y, 47 + i) < 0.5,
        });
    }

    const hasFlower = hash(pos.x, pos.y, 50) < 0.14;
    return {
        outline: roundedRect(x0 - (open.left ? OUTLINE : 0), y0 - OUTLINE,
            x1 + (open.right ? OUTLINE : 0), y1 + OUTLINE, growRadii(endRadii, OUTLINE)),
        base: roundedRect(x0, y0, x1, y1, endRadii),
        shine: roundedRect(x0 + (open.left ? 0.12 : 0), y1 - 0.1,
            x1 - (open.right ? 0.12 : 0), y1 - 0.04, shrinkRadii(endRadii, 0.12)),
        drips,
        bumps,
        blades,
        flower: hasFlower ? {
            pos: vec2(pos.x + 0.25 + hash(pos.x, pos.y, 51) * 0.5, y1 + 0.2),
            colorIndex: Math.floor(hash(pos.x, pos.y, 52) * 3),
            phase: hash(pos.x, pos.y, 53) * 6.28,
        } : null,
    };
}

function drawGroundDetail(tile, palette, ctx)
{
    for (const speck of tile.specks)
    {
        if (speck.kind === 'blob')
            ellipse(speck.pos, speck.size, palette.dirtAlt, ctx);
        else
        {
            ellipse(speck.pos, speck.size, palette.pebble, ctx);
            ellipse(speck.pos.add(vec2(-speck.size.x * 0.18, speck.size.y * 0.18)),
                speck.size.scale(0.35), palette.pebbleShine, ctx);
        }
    }

    tile.rim && rect(tile.rim.pos, tile.rim.size, palette.dirtAlt, ctx);

    const grass = tile.grass;
    if (!grass)
        return;
    for (const blob of [...grass.drips, ...grass.bumps])
        circle(blob.pos, blob.size, palette.grass, ctx);
    poly(grass.base, palette.grass, ctx);
    poly(grass.shine, palette.grassShine, ctx);

    // The bush is drawn after the wall it leans on, so it carries its own outline.
    for (const lump of tile.tufts)
        circle(lump.pos, lump.size + OUTLINE * 2, palette.grassOutline, ctx);
    for (const lump of tile.tufts)
    {
        circle(lump.pos, lump.size, lump.dark ? palette.grassDark : palette.grass, ctx);
        circle(lump.pos.add(vec2(-lump.size * 0.15, lump.size * 0.18)), lump.size * 0.35,
            lump.dark ? palette.grass : palette.grassShine, ctx);
    }
}

function drawFlower(flower, palette, time)
{
    const sway = Math.sin(time * 1.3 + flower.phase) * 0.012;
    const head = flower.pos.add(vec2(sway, 0));
    drawRect(vec2((flower.pos.x + head.x) / 2, flower.pos.y - 0.11), vec2(0.035, 0.22), palette.grassDark);
    drawCircle(head, 0.27, palette.grassOutline);
    const petal = palette.flowers[flower.colorIndex % palette.flowers.length];
    for (let i = 0; i < 5; i++)
    {
        const a = i / 5 * Math.PI * 2 + flower.phase;
        drawCircle(head.add(vec2(Math.cos(a) * 0.06, Math.sin(a) * 0.06)), 0.1, petal);
    }
    drawCircle(head, 0.07, palette.flowerCenter);
}

// ---------------------------------------------------------------------------------------------
// Wooden one-way plank

function buildPlank(pos, same)
{
    const openLeft = !same.left, openRight = !same.right;
    const x0 = pos.x, x1 = pos.x + 1;
    const y0 = pos.y + 1 - PLANK_DEPTH, y1 = pos.y + 1;
    const radii = {
        tl: openLeft ? PLANK_END_RADIUS : 0, bl: openLeft ? PLANK_END_RADIUS : 0,
        tr: openRight ? PLANK_END_RADIUS : 0, br: openRight ? PLANK_END_RADIUS : 0,
    };
    return {
        style: 'plank',
        pos,
        openLeft,
        openRight,
        top: y1,
        bottom: y0,
        outline: roundedRect(x0 - (openLeft ? OUTLINE : 0), y0 - OUTLINE,
            x1 + (openRight ? OUTLINE : 0), y1 + OUTLINE, growRadii(radii, OUTLINE)),
        body: roundedRect(x0, y0, x1, y1, radii),
        shine: roundedRect(x0 + (openLeft ? 0.1 : 0), y1 - 0.1, x1 - (openRight ? 0.1 : 0), y1 - 0.04,
            shrinkRadii(radii, 0.1)),
        grainStart: x0 + 0.15 + hash(pos.x, pos.y, 60) * 0.2,
        grainLength: 0.3 + hash(pos.x, pos.y, 61) * 0.3,
    };
}

function drawPlankDetail(tile, palette, ctx)
{
    const midY = (tile.top + tile.bottom) / 2 - 0.03;
    rect(vec2(tile.grainStart + tile.grainLength / 2, midY), vec2(tile.grainLength, 0.035), palette.woodGrain, ctx);
    // Board seams between neighboring planks, each board pinned with a nail at both ends.
    if (!tile.openLeft)
        rect(vec2(tile.pos.x, midY + 0.02), vec2(0.04, PLANK_DEPTH - 0.08), palette.woodOutline, ctx);
    const nailY = midY + 0.03;
    for (const nailX of [tile.pos.x + 0.15, tile.pos.x + 0.85])
    {
        circle(vec2(nailX, nailY), 0.09, palette.woodGrain, ctx);
        circle(vec2(nailX, nailY), 0.055, palette.nail, ctx);
    }
}

// ---------------------------------------------------------------------------------------------
// Draw wrappers: WebGL to the screen by default, Canvas2D into `ctx` when baking.

function poly(points, color, ctx)
{
    drawPoly(points, color, 0, undefined, undefined, 0, !ctx, false, ctx);
}

function ellipse(pos, size, color, ctx)
{
    drawEllipse(pos, size, color, 0, 0, undefined, !ctx, false, ctx);
}

function circle(pos, size, color, ctx)
{
    drawCircle(pos, size, color, 0, undefined, !ctx, false, ctx);
}

function rect(pos, size, color, ctx)
{
    drawRect(pos, size, color, 0, !ctx, false, ctx);
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers

/** Convex rounded rectangle as a point list (counter-clockwise), with per-corner radius. */
function roundedRect(x0, y0, x1, y1, radii)
{
    const points = [];
    corner(points, x0, y0, radii.bl, 1, 1, Math.PI);           // bottom-left
    corner(points, x1, y0, radii.br, -1, 1, Math.PI * 1.5);    // bottom-right
    corner(points, x1, y1, radii.tr, -1, -1, 0);               // top-right
    corner(points, x0, y1, radii.tl, 1, -1, Math.PI * 0.5);    // top-left
    return points;
}

function corner(points, cx, cy, radius, dirX, dirY, startAngle)
{
    if (radius <= 0)
    {
        points.push(vec2(cx, cy));
        return;
    }
    const centerX = cx + dirX * radius, centerY = cy + dirY * radius;
    for (let i = 0; i <= ARC_SEGMENTS; i++)
    {
        const a = startAngle + i / ARC_SEGMENTS * Math.PI / 2;
        points.push(vec2(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius));
    }
}

function growRadii(radii, amount)
{
    const grow = r => r > 0 ? r + amount : 0;
    return { tl: grow(radii.tl), tr: grow(radii.tr), bl: grow(radii.bl), br: grow(radii.br) };
}

function shrinkRadii(radii, amount)
{
    const shrink = r => r > 0 ? Math.max(r - amount, 0.03) : 0;
    return { tl: shrink(radii.tl), tr: shrink(radii.tr), bl: shrink(radii.bl), br: shrink(radii.br) };
}

/** Deterministic 0..1 noise per tile, so variation is stable between frames and reloads. */
function hash(x, y, salt)
{
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
