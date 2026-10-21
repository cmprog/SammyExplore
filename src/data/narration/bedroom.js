// Narration for the bedroom, the home base (src/data/levels/bedroom.js).
// Placeholder lines only (T-013 arrival, T-017 portal lever, T-018 practice course); the real
// bedroom script comes with T-019.
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

        // --- T-018 practice course (PLACEHOLDERS: T-019 writes the real lines) -------------------
        // Zone keys from the level: practice.entry, practice.gap, practice.lever, practice.tunnel.
        // The cat spot's key is practice.mouse; the toy star's id is practice-star.
        // Twyx care rules (docs/story/premise.md): warm, never in peril, never left behind.
        {
            id: 'practice.entry',
            trigger: 'narration:zone',
            key: 'practice.entry',
            priority: 40,
            once: true,
            skipIfBusy: true,
            text: 'Ah, the practice course! Shelves, a bed, and a fort. Excellent training for an Eagle. Or an owl.',
        },
        {
            id: 'practice.gap',
            trigger: 'narration:zone',
            key: 'practice.gap',
            priority: 40,
            once: true,
            text: "A gap! Owls can flap across. Not everyone can flap, though. Is there a bridge somewhere?",
        },
        {
            id: 'practice.lever',
            trigger: 'narration:zone',
            key: 'practice.lever',
            priority: 40,
            once: true,
            text: 'A lever by the gap. In my experience, levers by gaps are very helpful levers.',
        },
        {
            id: 'practice.tunnel',
            trigger: 'narration:zone',
            key: 'practice.tunnel',
            priority: 40,
            once: true,
            skipIfBusy: true,
            text: "A toy mouse, all wound up in the fort's doorway. It's far too flustered to budge.",
        },
        {
            // The cushion with nobody along: a soft hint that never names a cat.
            id: 'practice.mouse.noCat',
            trigger: 'catspot:noCat',
            key: 'practice.mouse',
            cooldown: 4,
            texts: [
                'The mouse needs calming down. Owls are many things, but cuddly in a calming way? Somebody furry, maybe.',
                "A cushion with a paw print. Someone with paws might know what to do. Who has paws around here?",
            ],
        },
        {
            id: 'practice.mouse.calmed',
            trigger: 'ability:used',
            key: 'practice.mouse',
            cooldown: 6,
            text: "Twyx snuggles the little mouse until it unwinds. There. That's much better.",
        },
        {
            id: 'practice.star',
            trigger: 'collectible:found',
            key: 'practice-star',
            priority: 45,
            text: 'A lost toy star! It was in the fort all along. Well spotted, owl.',
        },
    ],
};
