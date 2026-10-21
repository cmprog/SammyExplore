// Narration for the bedroom, the home base (src/data/levels/bedroom.js).
// Placeholder arrival lines only (T-013); the real bedroom script comes with T-019.
// Voice guide: docs/story/premise.md.

export default {
    id: 'bedroom',

    lines: [
        {
            id: 'bedroom.arrive',
            trigger: 'level:start',
            priority: 50,
            once: true,
            // Only on a fresh arrival: Continue gets the common resume line instead.
            condition: ctx => !ctx.payload?.checkpointId,
            text: "And the mighty Eagle returned to a lofty mountain nest! ...This is a bedroom. It's very pink.",
        },
    ],
};
