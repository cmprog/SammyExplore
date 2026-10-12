// Smooth-follow camera with look-ahead, clamped so it never shows past the level edges.
// Call update() once per step after objects have moved (the playing scene does it in updatePost).
// The host calls setNarrating() every step with whether the narrator's text box is up, to frame
// the view a little lower. The lower framing outlasts the box a moment, so back-to-back lines
// don't make the view bob up and down between them.
import {
    vec2, lerp, clamp, timeDelta, setCameraPos, setCameraScale, cameraPos, cameraScale, getCameraSize,
} from 'littlejs';
import {
    CAMERA_SCALE, CAMERA_FOLLOW_LERP_X, CAMERA_FOLLOW_LERP_Y, CAMERA_LOOK_AHEAD,
    CAMERA_LOOK_AHEAD_LERP, CAMERA_LOOK_AHEAD_MIN_SPEED, CAMERA_OFFSET_Y, CAMERA_NARRATION_OFFSET_Y,
    CAMERA_NARRATION_HOLD,
} from '../data/tuning.js';

export class Camera
{
    constructor()
    {
        this.target = null;      // anything with pos and velocity (Vector2s)
        this.bounds = null;      // level size in world units; bottom-left is (0, 0)
        this.facing = 1;
        this.lookAhead = 0;
        this.narrating = false;  // eased like any other move, by the follow lerp
        this.narrationHold = 0;  // seconds the lower framing stays after the box closes
    }

    /** showing: the narrator's text box is up this step. */
    setNarrating(showing)
    {
        if (showing)
            this.narrationHold = CAMERA_NARRATION_HOLD;
        else
            this.narrationHold = Math.max(0, this.narrationHold - timeDelta);
        this.narrating = showing || this.narrationHold > 0;
    }

    /** Follow a new target inside new bounds and jump straight there (no swoop on level load). */
    attach(target, bounds)
    {
        setCameraScale(CAMERA_SCALE);
        this.target = target;
        this.bounds = bounds.copy();
        this.facing = 1;
        this.lookAhead = 0;
        this.narrating = false;
        this.narrationHold = 0;
        this.snap();
    }

    detach()
    {
        this.target = null;
    }

    snap()
    {
        if (this.target)
            setCameraPos(this.clampToBounds(this.desiredPos()));
    }

    update()
    {
        if (!this.target)
            return;
        const speedX = this.target.velocity.x;
        if (Math.abs(speedX) > CAMERA_LOOK_AHEAD_MIN_SPEED)
            this.facing = Math.sign(speedX);
        // Ease the lead separately (and slower) so turning around swings the view gently.
        this.lookAhead = lerp(this.lookAhead, this.facing * CAMERA_LOOK_AHEAD, CAMERA_LOOK_AHEAD_LERP);

        const goal = this.clampToBounds(this.desiredPos());
        setCameraPos(vec2(
            lerp(cameraPos.x, goal.x, CAMERA_FOLLOW_LERP_X),
            lerp(cameraPos.y, goal.y, CAMERA_FOLLOW_LERP_Y)));
    }

    desiredPos()
    {
        const offsetY = CAMERA_OFFSET_Y + (this.narrating ? CAMERA_NARRATION_OFFSET_Y : 0);
        return vec2(this.target.pos.x + this.lookAhead, this.target.pos.y + offsetY);
    }

    clampToBounds(pos)
    {
        const half = getCameraSize().scale(0.5);
        const axis = (value, halfView, levelSize) => levelSize <= halfView * 2
            ? levelSize / 2                                  // level smaller than the view: center it
            : clamp(value, halfView, levelSize - halfView);
        return vec2(axis(pos.x, half.x, this.bounds.x), axis(pos.y, half.y, this.bounds.y));
    }

    debugState()
    {
        return { pos: { x: cameraPos.x, y: cameraPos.y }, scale: cameraScale, lookAhead: this.lookAhead, narrating: this.narrating, narrationHold: this.narrationHold };
    }
}
