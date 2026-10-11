// Narration for the dev `test` level. Mainly exercises the ignored-instruction machinery
// until the sandbox script (T-011) has the real gags.

// How far (world units) Sammy must travel from where the instruction was given.
const FOLLOW_DISTANCE = 8;
const IGNORE_DISTANCE = 4;

export default {
    id: 'test',

    instructions: [
        {
            id: 'goRight',
            success: ctx => !!ctx.playerPos && !!ctx.armedPos && ctx.playerPos.x > ctx.armedPos.x + FOLLOW_DISTANCE,
            failure: ctx => !!ctx.playerPos && !!ctx.armedPos && ctx.playerPos.x < ctx.armedPos.x - IGNORE_DISTANCE,
            timeout: 30,
        },
    ],

    lines: [
        {
            id: 'test.intro',
            trigger: 'level:start',
            priority: 50,
            once: true,
            text: 'This is the tale of a mighty Eagle. The Eagle flew RIGHT, toward adventure.',
            instruction: 'goRight',
        },
        {
            id: 'test.goRight.ignored',
            trigger: 'ignored:goRight',
            priority: 60,
            text: 'The Eagle went RIGHT. You went left. Is this a mirror? Am I in a mirror?',
        },
        {
            id: 'test.goRight.followed',
            trigger: 'followed:goRight',
            priority: 40,
            text: "Yes! Right! Exactly as written. ...Oh. It's still an owl.",
        },
    ],
};
