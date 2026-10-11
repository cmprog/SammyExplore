// Our own update-step counter. The engine's `frame` and `time` freeze while the engine is paused,
// but gameUpdatePost still runs every step, so counting there keeps advancing during pause.
let frameCount = 0;

export function tickFrame()
{
    frameCount++;
}

export function currentFrame()
{
    return frameCount;
}
