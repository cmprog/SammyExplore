// Narration for the bedroom, the home base (src/data/levels/bedroom.js).
// Placeholder lines only (T-013 arrival, T-017 portal lever); the real bedroom script comes with T-019.
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
        {
            // T-017: the portal lever, with only one chapter to show (portal:select changed: false).
            id: 'bedroom.portal.onlyOne',
            trigger: 'portal:select',
            condition: ctx => ctx.payload?.changed === false,
            cooldown: 20,
            skipIfBusy: true,
            texts: [
                'Clunk. The portal thinks very hard about where else to go. It only knows one place, so far.',
                'The lever has exactly one setting right now. It is a very loyal lever.',
                "Other chapters? I haven't written them yet. I'm a narrator, not a printing press.",
            ],
        },
    ],
};
