// The toy star (T-018): a placeholder find, a plump plush star with a sleepy-happy face that
// floats and twinkles where it was lost. Collected, it bursts into sparkles and a ring of light.
// Pure drawing: drawToyStar(center, look, time), drawToyStarLight(center, look, light, time) for
// the room's light map, and particles drawStarSparkle(pos, p) and drawFoundRing(pos, p).
import { vec2, rgb, drawCircleGradient, drawEllipseGradient } from 'littlejs';
import { ArtFrame } from './ArtFrame.js';
import { TOY_LINE } from './toyParts.js';

const RADIUS = .4;           // tip radius in art units (the star is ~.8 across at scale 1)
const POINTS = 70;           // outline samples: enough for smooth round tips
const PLUMP = .6;            // inner radius as a fraction of the tips: high = puffy
const CLEAR = rgb(1, 1, 1, 0);

/** [x, y] points of a puffy five-point star: round tips and soft dips between them. */
function puffyStar(radius, dy = 0)
{
    const points = [];
    for (let i = 0; i < POINTS; i++)
    {
        const a = i / POINTS * Math.PI * 2;
        const tip = (Math.cos(5 * (a - Math.PI / 2)) + 1) / 2;   // 1 at each tip
        const r = radius * (PLUMP + (1 - PLUMP) * tip ** 1.6);
        points.push([Math.cos(a) * r, Math.sin(a) * r + dy]);
    }
    return points;
}

/**
 * @param {Vector2} center
 * @param {{scale:number, spin:number, squash:number, glow:number, blink:number, alpha?:number, palette:object}} look
 *   squash: + taller, - flatter; glow 0..1 the halo behind it; blink 1 = eyes shut
 */
export function drawToyStar(center, look, time)
{
    const P = look.palette, alpha = look.alpha ?? 1;
    const a = color => alpha < 1 ? color.withAlpha(color.a * alpha) : color;
    if (look.glow > 0)
    {
        const pulse = 1 + Math.sin(time * 2.4) * .08;
        drawCircleGradient(center, 1.9 * look.scale * pulse, P.toyStarGlow.withAlpha(.32 * look.glow * alpha), CLEAR);
    }
    const frame = ArtFrame.root(center, { scale: look.scale, stretchX: 1 - look.squash * .5, stretchY: 1 + look.squash }).child(0, 0, look.spin);
    frame.poly(puffyStar(RADIUS + TOY_LINE), a(P.outline));
    frame.poly(puffyStar(RADIUS), a(P.toyStarDark));
    frame.poly(puffyStar(RADIUS * .93, .025), a(P.toyStar));
    frame.ellipse(-.13, .16, .17, .085, a(P.toyStarLight), .7);
    frame.circle(.02, .27, .05, a(P.toyStarLight));
    drawFace(frame, look.blink, a, P);
}

function drawFace(frame, blink, a, P)
{
    for (const side of [-1, 1])
    {
        frame.ellipse(side * .17, -.06, .09, .05, a(P.blush));
        if (blink > .5)
            frame.arc(side * .095, .03, .08, .05, Math.PI + .3, Math.PI * 2 - .3, .03, a(P.bead), 5);
        else
        {
            frame.ellipse(side * .095, .03, .07, .095, a(P.bead));
            frame.circle(side * .095 - .015, .055, .03, a(P.shine));
        }
    }
    frame.arc(0, -.05, .1, .07, Math.PI + .5, Math.PI * 2 - .5, .03, a(P.bead), 6);
}

/** Its glow in the room's light map (additive). */
export function drawToyStarLight(center, { glow, scale }, light, time)
{
    const k = light.strength * glow * (1 + Math.sin(time * 2.4) * .1);
    drawEllipseGradient(center, vec2(light.radius * 2 * scale), rgb(1, .9, .6, k), CLEAR, 0);
    drawEllipseGradient(center, vec2(.9 * scale), rgb(1, 1, .9, Math.min(1, k * 1.4)), CLEAR, 0);
}

/** A little five-point star flying off in the burst. @param {{size:number, alpha:number, color:Color, angle:number}} p */
export function drawStarSparkle(pos, p)
{
    const frame = ArtFrame.root(pos, { scale: p.size * (1 - p.progress * .4) }).child(0, 0, p.angle);
    const points = [];
    for (let i = 0; i < 10; i++)
    {
        const angle = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .45 : 1;
        points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    frame.poly(points, p.color.withAlpha(p.alpha));
}

/** A ring of light that widens and fades. @param {{size:number, progress:number, alpha:number, color:Color}} p */
export function drawFoundRing(pos, p)
{
    const d = p.size * (.3 + p.progress * 1.2);
    ArtFrame.root(pos).arc(0, 0, d, d, 0, Math.PI * 2, .07 * (1 - p.progress) + .01, p.color.withAlpha(p.alpha), 24);
}

/** A scrap of confetti tumbling down. @param {{size:number, alpha:number, color:Color, angle:number, age:number}} p */
export function drawConfettiBit(pos, p)
{
    const flip = Math.cos(p.age * 9 + p.swayPhase);   // turning over in the air
    const w = p.size, h = p.size * .55 * Math.max(.15, Math.abs(flip));
    ArtFrame.root(pos).child(0, 0, p.angle).poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], p.color.withAlpha(p.alpha));
}
