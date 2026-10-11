// Placeholder body for the T-003 test box (T-004/T-005 replace it with Sammy).
// Just friendly enough not to look broken in screenshots: a soft rounded block with eyes.
import { vec2, rgb, drawRect, drawCircle } from '../../lib/littlejs/littlejs.esm.js';

const OUTLINE = rgb(.10, .07, .16);
const BODY = rgb(.95, .78, .45);
const SHINE = rgb(1, .92, .70);
const EYE = rgb(.12, .08, .14);

/** @param {{size:number, facing:number}} state */
export function drawTempBox(pos, state, time)
{
    const s = state.size;
    const bob = Math.sin(time * 3) * 0.02;
    const center = pos.add(vec2(0, bob));
    roundedBlock(center, s + 0.1, OUTLINE);
    roundedBlock(center, s, BODY);
    drawCircle(center.add(vec2(-s * 0.22, s * 0.25)), s * 0.22, SHINE);
    const blink = (time % 3.7) < 0.12;
    for (const side of [-1, 1])
    {
        const eyePos = center.add(vec2(state.facing * s * 0.12 + side * s * 0.17, s * 0.05));
        if (blink)
            drawRect(eyePos, vec2(s * 0.16, s * 0.04), EYE);
        else
            drawCircle(eyePos, s * 0.16, EYE);
    }
}

function roundedBlock(center, size, color)
{
    const r = size * 0.3;
    drawRect(center, vec2(size, size - r * 2), color);
    drawRect(center, vec2(size - r * 2, size), color);
    for (const cx of [-1, 1])
        for (const cy of [-1, 1])
            drawCircle(center.add(vec2(cx * (size / 2 - r), cy * (size / 2 - r))), r * 2, color);
}
