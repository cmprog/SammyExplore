// Narration for the M1 sandbox level, "Chapter One" (src/data/levels/sandbox.js).
// The narrator sets out to tell the tale of a mighty Eagle and keeps finding an owl in it.
// Draft lines for the stakeholder check-in. Voice guide: docs/story/premise.md.
//
// Keys: zone keys (narration zones), sign keys, and entity/zone ids (checkpoints, doors,
// the exit) from the level file. Correction zones name their line with `lineId`.
// `noStale` marks lines that teach a move or point the way: they wait in the queue as long as
// it takes instead of being dropped as old news.

const PRIORITY = {
    zone: 40,        // remarks on reaching a place
    checkpoint: 40,  // same as zone remarks: neither cuts the other off, the later one waits
    intro: 50,
    ignored: 60,     // the joke lands right away, over whatever else is showing
    correction: 100,
    celebrate: 60,
};

// How far (world units) Sammy must travel from where the intro finished for it to count.
const FOLLOW_DISTANCE = 8;
const IGNORE_DISTANCE = 4;

export default {
    id: 'sandbox',

    spam: {
        // The cliff asks for flaps: two climbs back to back can use all six (3 + 3) within a few
        // seconds, and the common 5-in-6s nag would scold the player for doing as told.
        'player:flap': { count: 7, seconds: 6 },
    },

    instructions: [
        {
            id: 'goRight',
            success: ctx => !!ctx.playerPos && !!ctx.armedPos && ctx.playerPos.x > ctx.armedPos.x + FOLLOW_DISTANCE,
            failure: ctx => !!ctx.playerPos && !!ctx.armedPos && ctx.playerPos.x < ctx.armedPos.x - IGNORE_DISTANCE,
            timeout: 60,
        },
    ],

    lines: [
        // --- The start: an Eagle story, starring an owl -------------------------------------
        {
            id: 'sandbox.intro',
            trigger: 'level:start',
            priority: PRIORITY.intro,
            once: true,
            // Only on a fresh start: Continue gets the common resume line instead.
            condition: ctx => !ctx.payload?.checkpointId,
            text: 'Once upon a time, a mighty Eagle set off to the RIGHT, toward adventure. Sharp of eye! Noble of beak!',
            instruction: 'goRight',
        },
        {
            id: 'sandbox.goRight.followed',
            trigger: 'followed:goRight',
            priority: 45,
            once: true,
            text: "Hang on. Round? Fluffy? Ear tufts? You're not an Eagle. You're an OWL! ...Fine. Carry on, owl.",
        },
        {
            // `once`, so if the nook correction cuts it off it comes back afterwards.
            id: 'sandbox.goRight.ignored',
            trigger: 'ignored:goRight',
            priority: PRIORITY.ignored,
            once: true,
            text: "The Eagle went RIGHT. You went left. And you're... an OWL?! This is not how chapter one goes.",
        },
        {
            // Say-only: the nook correction zone (left of the spawn) names it.
            id: 'sandbox.nook',
            priority: PRIORITY.correction,
            texts: [
                "Wait, there's a room down here? I never wrote a room! Who keeps adding rooms? *scribble scribble*",
                "The secret room again? It's not in my notes. Back to the start of the page you go.",
            ],
        },
        {
            id: 'sandbox.sign.chapter.read',
            trigger: 'interact:sign',
            key: 'sandbox.sign.chapter',
            priority: 41,
            once: true,
            text: "It says 'Chapter One: The Mighty Eagle.' Someone has drawn a little owl on it. In crayon.",
        },
        {
            id: 'sandbox.sign.chapter.again',
            trigger: 'interact:sign',
            key: 'sandbox.sign.chapter',
            priority: 40,
            texts: [
                'Still says Eagle. The crayon owl is still there too. Cheeky.',
                "I've read it already. The crayon owl is smiling at me. Stop it, crayon owl.",
            ],
        },

        // --- Twyx ----------------------------------------------------------------------------
        // Petting Twyx uses the common lines (twyx.meet, twyx.hound, ...). This one points the
        // way to the cat and teaches E.
        {
            id: 'sandbox.twyx.ahead',
            trigger: 'narration:zone',
            key: 'sandbox.twyx',
            priority: PRIORITY.zone,
            once: true,
            noStale: true,
            text: "Behold, the Eagle's noble steed! ...That's a cat. Why is there a cat? Press E to say hello, I suppose.",
        },
        {
            id: 'sandbox.checkpoint.meadow',
            trigger: 'checkpoint:reached',
            key: 'meadow',
            priority: PRIORITY.checkpoint,
            once: true,
            text: "I'll tuck a bookmark in here, in case the story needs fixing. Not that it will. Probably.",
        },

        // --- Hops and the cliff --------------------------------------------------------------
        {
            id: 'sandbox.hops',
            trigger: 'narration:zone',
            key: 'sandbox.hops',
            priority: PRIORITY.zone,
            once: true,
            noStale: true,
            text: 'Gaps and planks ahead! The Eagle hopped across them gracefully. Owls may hop too. Less gracefully.',
        },
        {
            id: 'sandbox.cliff',
            trigger: 'narration:zone',
            key: 'sandbox.cliff',
            priority: PRIORITY.zone,
            once: true,
            noStale: true,
            text: "A towering cliff! The Eagle would simply fly up. Owls... tap Space in the air to flap, I'm told.",
        },
        {
            id: 'sandbox.checkpoint.clifftop',
            trigger: 'checkpoint:reached',
            key: 'clifftop',
            priority: PRIORITY.checkpoint,
            once: true,
            text: 'Well climbed, Sandy. SAMMY. I knew that. Another bookmark, right here.',
        },

        // --- The Eagle's Perch (a correction setup) -----------------------------------------
        {
            id: 'sandbox.sign.perch.read',
            trigger: 'interact:sign',
            key: 'sandbox.sign.perch',
            priority: 41,
            once: true,
            text: "'EAGLE'S PERCH. NO OWLS.' ...Yes, I wrote that one myself. I think it's very clear.",
        },
        {
            id: 'sandbox.sign.perch.again',
            trigger: 'interact:sign',
            key: 'sandbox.sign.perch',
            priority: 40,
            texts: [
                'It still says no owls. In capital letters. I checked.',
                "Same sign. Same words. Eagles only. I'm not changing it.",
            ],
        },
        {
            // Say-only: the perch correction zone names it.
            id: 'sandbox.perch',
            priority: PRIORITY.correction,
            texts: [
                'Off! OFF! That perch is for the Eagle. Did you not read the sign? Rewriting!',
                "We've talked about this. E-A-G-L-E. That spot is for my cardboard Eagle cutout now.",
                'An owl on the Eagle\'s Perch? Not in MY story. *scribble* There. You were never up there.',
            ],
        },

        // --- The Great Gap (needs a glide) ---------------------------------------------------
        {
            id: 'sandbox.leap',
            trigger: 'narration:zone',
            key: 'sandbox.leap',
            priority: PRIORITY.zone,
            once: true,
            noStale: true,
            text: 'The Great Gap! Here the Eagle soared across, majestically. You could hold Space to glide. Less majestically.',
        },
        {
            // Say-only: the correction zone at the bottom of the Great Gap names it, so a fall
            // there gets a glide hint instead of a generic rewrite.
            id: 'sandbox.gap.fall',
            priority: PRIORITY.correction,
            texts: [
                'That was more of a plop than a soar. Hold Space while falling to glide. Again!',
                'Eagles glide across. Owls, apparently, drop like a muffin. Hold Space this time. Rewinding!',
                "Almost! Jump, then keep Space HELD to glide. The wings do the work. Let's try again.",
            ],
        },
        {
            id: 'sandbox.checkpoint.farSide',
            trigger: 'checkpoint:reached',
            key: 'far-side',
            priority: PRIORITY.checkpoint,
            once: true,
            text: "You... glided. Gracefully, even. I'm not crying. Narrators don't cry. Bookmark!",
        },

        // --- Two doors -----------------------------------------------------------------------
        {
            id: 'sandbox.doors',
            trigger: 'narration:zone',
            key: 'sandbox.doors',
            priority: PRIORITY.zone,
            once: true,
            text: 'Two doors! The Eagle always takes the grand door, up top. Naturally.',
        },
        {
            id: 'sandbox.eagleDoor.locked',
            trigger: 'interact:doorLocked',
            key: 'eagle-door',
            priority: 41,
            once: true,
            text: "Locked. That's the Eagle's private room. Eagles need their privacy. And their snacks.",
        },
        {
            id: 'sandbox.eagleDoor.again',
            trigger: 'interact:doorLocked',
            key: 'eagle-door',
            priority: 40,
            texts: [
                'Still locked. Only the Eagle has a key. And the Eagle is... somewhere. Busy.',
                "Rattling won't help. Try the little door down below. It's not grand, but it opens.",
            ],
        },
        {
            id: 'sandbox.tunnelDoor.open',
            trigger: 'door:open',
            key: 'tunnel-door',
            priority: PRIORITY.zone,
            once: true,
            text: "The owl takes the little door. Not grand at all. ...It does open, though. I'll allow it.",
        },

        // --- The end of the chapter ----------------------------------------------------------
        {
            id: 'sandbox.end',
            trigger: 'narration:zone',
            key: 'sandbox.end',
            priority: PRIORITY.zone,
            once: true,
            noStale: true,
            text: 'And there it glows: the end of Chapter One! Press E on the door. The Eagle would do it with style.',
        },
        {
            id: 'sandbox.complete',
            trigger: 'level:complete',
            key: 'chapter-one-end',
            priority: PRIORITY.celebrate,
            text: 'THE END of Chapter One! Starring the Eagle. And... a very round, very brave owl. Well done, Sammy.',
        },
    ],
};
