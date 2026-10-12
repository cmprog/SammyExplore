// Baked scenery strips behind the level: rolling hills, round and pointy trees, bushes.
// Each layer is a soft silhouette with a lighter rim along its top (moonlight or sunlight),
// a few gentle inner highlights for volume, and mist settling at its base. The farther the
// layer, the closer its colors sit to the sky's horizon: that is what sells the depth.
// Pure functions of (strip, layout, palette, rng), called once per level load. Each returns
// { solidBelowY, bottomColor }: the bake y under which every column is solid, and the color the
// strip ends with at its bottom edge (so the renderer can extend it with a plain band).
// Heights are bake coordinates: y up from the screen bottom (see backdropStrip.js).
import { vec2 } from 'littlejs';
import {
    stripCircle, stripEllipse, stripPoly, stripRect, stripGradient, stripRidge, periodicRidge, ridgeLow,
} from './backdropStrip.js';

const RIM = vec2(-3, 4);
const SCREEN_HEIGHT = 1080;   // rim offset: light comes from above, a touch from the left

// --- hills -------------------------------------------------------------------------------------

export function bakeHills(strip, layout, palette, rng)
{
    const w = strip.width;
    // A far mountain ridge, faded nearly into the horizon glow.
    const far = periodicRidge(rng, w, 525, [[2, 34], [5, 16], [11, 5]]);
    stripRidge(strip, far, palette.ridgeFarRim, RIM.y);
    stripRidge(strip, far, palette.ridgeFar);
    stripGradient(strip, 300, 525, [palette.mist.withAlpha(.75), palette.mist.withAlpha(0)], undefined, true);

    // Nearer, rounder hills: overlapping domes, like a quilt.
    const domes = [];
    for (let x = rng.float(0, 120); x < w; x += rng.float(240, 400))
    {
        const width = rng.float(480, 820);
        domes.push({ x, width, crest: rng.float(390, 465), height: width * rng.float(.55, .75) });
    }
    for (const d of domes)
        stripEllipse(strip, d.x + RIM.x, d.crest - d.height / 2 + RIM.y, d.width, d.height, palette.hillsRim);
    for (const d of domes)
        stripEllipse(strip, d.x, d.crest - d.height / 2, d.width, d.height, palette.hills);
    stripRect(strip, -1e4, 300, palette.hills);
    for (const d of domes)
        rng.bool(.55) && bakeHillTufts(strip, d, domes, palette, rng);
    // Thickest mist at the strip's bottom edge and below, so it ends in one flat color.
    const floor = SCREEN_HEIGHT - layout.bottom;
    stripGradient(strip, floor, 420, [palette.mist.withAlpha(.6), palette.mist.withAlpha(0)], undefined, true);
    stripGradient(strip, -1e4, floor, [palette.mist.withAlpha(.6), palette.mist.withAlpha(.6)], undefined, true);
    return { solidBelowY: ridgeLow(far, w), bottomColor: palette.hills.lerp(palette.mist, .6) };
}

/** Tiny far-away trees standing on a dome's crest (only where no other dome rises in front). */
function bakeHillTufts(strip, dome, domes, palette, rng)
{
    let dx = rng.float(-.3, .1) * dome.width / 2;
    for (let i = rng.int(1, 4); i--; dx += rng.float(22, 40))
    {
        const x = dome.x + dx;
        const y = domeTopAt(dome, x);
        if (domes.some(other => domeTopAt(other, x) > y + 2))
            continue;
        const size = rng.float(18, 30);
        stripPoly(strip, [vec2(-2, y - 6), vec2(2, y - 6), vec2(1.5, y + size * .7), vec2(-1.5, y + size * .7)], palette.hills, x, 4);
        stripCircle(strip, x + RIM.x * .5, y + size * .8 + RIM.y * .5, size, palette.hillsRim);
        stripCircle(strip, x, y + size * .8, size, palette.hills);
    }
}

/** Height of a dome's outline at x (ignores strip wrapping, which only costs a tuft or two). */
function domeTopAt(dome, x)
{
    const t = (x - dome.x) / (dome.width / 2);
    return Math.abs(t) >= 1 ? -Infinity : dome.crest - dome.height / 2 * (1 - Math.sqrt(1 - t * t));
}

// --- trees -------------------------------------------------------------------------------------

export function bakeTrees(strip, layout, palette, rng)
{
    const w = strip.width;
    const ground = periodicRidge(rng, w, 290, [[3, 16], [7, 7]]);
    // Little groves with clearings between them, so the hills behind can show through.
    const trees = [];
    const spacing = w / layout.groves;
    for (let g = 0; g < layout.groves; g++)
    {
        let x = (g + rng.float(0, .4)) * spacing;
        for (let n = rng.int(layout.perGrove[0], layout.perGrove[1] + 1); n--; x += rng.float(70, 120))
            trees.push(rng.bool(.6) ? roundTree(x, ground(x), rng) : pineTree(x, ground(x), rng));
    }
    // Rims first for every tree, so a neighbor's body never gets a bright edge drawn over it.
    for (const tree of trees)
        drawTreeShapes(strip, tree, palette.treesRim, RIM, palette.treesRim);
    stripRidge(strip, ground, palette.treesRim, RIM.y);
    for (const tree of trees)
        drawTreeShapes(strip, tree, palette.trees, vec2(), palette.trunk);
    for (const tree of trees)
        drawTreeDetail(strip, tree, palette);
    stripRidge(strip, ground, palette.trees);
    const floor = SCREEN_HEIGHT - layout.bottom;
    stripGradient(strip, floor, 400, [palette.mist.withAlpha(.4), palette.mist.withAlpha(0)], undefined, true);
    stripGradient(strip, -1e4, floor, [palette.mist.withAlpha(.4), palette.mist.withAlpha(.4)], undefined, true);
    return { solidBelowY: ridgeLow(ground, w), bottomColor: palette.trees.lerp(palette.mist, .4) };
}

function roundTree(x, groundY, rng)
{
    const trunkHeight = rng.float(70, 140);
    const size = rng.float(120, 170);
    const top = groundY + trunkHeight;
    const lobes = [{ x: 0, y: size * .35, d: size }];
    const sideCount = rng.int(2, 5);
    for (let i = 0; i < sideCount; i++)
    {
        const side = i % 2 ? 1 : -1;
        lobes.push({ x: side * size * rng.float(.3, .45), y: rng.float(-.05, .3) * size, d: size * rng.float(.55, .75) });
    }
    return { kind: 'round', x, groundY, top, trunkWidth: rng.float(16, 24), lobes };
}

function pineTree(x, groundY, rng)
{
    const trunkHeight = rng.float(24, 44);
    const width = rng.float(105, 145);
    const tiers = rng.int(3, 5);
    const tierHeight = rng.float(68, 88);
    return { kind: 'pine', x, groundY, top: groundY + trunkHeight, trunkWidth: rng.float(14, 20), width, tiers, tierHeight };
}

function drawTreeShapes(strip, tree, color, offset, trunkColor)
{
    const x = tree.x + offset.x;
    const tw = tree.trunkWidth / 2;
    const trunkTop = tree.kind === 'pine' ? tree.top + 10 : tree.top + 20;
    stripPoly(strip, [
        vec2(-tw * 1.3, tree.groundY - 10), vec2(tw * 1.3, tree.groundY - 10),
        vec2(tw * .8, trunkTop + offset.y), vec2(-tw * .8, trunkTop + offset.y),
    ], trunkColor, x, 60);
    if (tree.kind === 'round')
        for (const lobe of tree.lobes)
            stripCircle(strip, x + lobe.x, tree.top + lobe.y + offset.y, lobe.d, color);
    else
        for (const tier of pineTiers(tree))
        {
            stripPoly(strip, tier.points.map(p => vec2(p.x, p.y + offset.y)), color, x, tree.width);
            stripEllipse(strip, x, tier.baseY + offset.y + 4, tier.width * .96, 26, color);
        }
}

/** Stacked soft triangles, each tier narrower than the one below it. */
function pineTiers(tree)
{
    const tiers = [];
    for (let i = 0; i < tree.tiers; i++)
    {
        const width = tree.width * (1 - i / (tree.tiers + 1.2));
        const baseY = tree.top + i * tree.tierHeight * .62;
        const h = tree.tierHeight * 1.15;
        tiers.push({
            width, baseY,
            points: [vec2(-width / 2, baseY + 4), vec2(width / 2, baseY + 4), vec2(4, baseY + h), vec2(-4, baseY + h)],
        });
    }
    return tiers;
}

/** Soft lighter clumps on the upper left of each canopy lobe, for a bit of roundness. */
function drawTreeDetail(strip, tree, palette)
{
    if (tree.kind === 'round')
        for (const lobe of tree.lobes)
            stripCircle(strip, tree.x + lobe.x - lobe.d * .14, tree.top + lobe.y + lobe.d * .16, lobe.d * .5, palette.treesDetail);
    else
        for (const tier of pineTiers(tree))
            stripEllipse(strip, tree.x - tier.width * .14, tier.baseY + 22, tier.width * .34, 18, palette.treesDetail);
}

// --- bushes ------------------------------------------------------------------------------------

export function bakeBushes(strip, layout, palette, rng)
{
    const w = strip.width;
    const ground = periodicRidge(rng, w, 225, [[4, 12], [9, 5]]);
    const bushes = [];
    const spacing = w / layout.count;
    for (let i = 0; i < layout.count; i++)
    {
        const x = (i + rng.float(0, 1)) * spacing;
        const size = rng.float(70, 125);
        const puffs = [{ x: 0, y: size * .25, d: size }];
        for (let p = rng.int(2, 5); p--;)
            puffs.push({ x: rng.floatSign(.35, .8) * size, y: rng.float(0, .15) * size, d: size * rng.float(.5, .75) });
        bushes.push({ x, y: ground(x), puffs });
    }
    const pass = (dx, dy, scale, color, dxPerD = 0, dyPerD = 0) => bushes.forEach(bush => bush.puffs.forEach(p =>
        stripCircle(strip, bush.x + p.x + dx + p.d * dxPerD, bush.y + p.y + dy + p.d * dyPerD, p.d * scale, color)));
    pass(RIM.x, RIM.y, 1, palette.bushesRim);
    stripRidge(strip, ground, palette.bushesRim, RIM.y);
    pass(0, 0, 1, palette.bushes);
    pass(0, 0, .5, palette.bushesDetail, -.13, .15);
    stripRidge(strip, ground, palette.bushes);
    return { solidBelowY: ridgeLow(ground, w), bottomColor: palette.bushes };
}
