// Narrator lines that apply in every level. Level scripts (<levelId>.js) are checked first,
// so a level can override any of these with the same trigger plus a key or a higher priority.
//
// Script shape (same for level scripts):
//   lines: [{
//       id,                 unique across all scripts
//       trigger,            bus event name ('player:land', 'narration:zone', ...) or a built-in:
//                             'idle:<seconds>'     no input for that long
//                             'spam:<event>'       <event> fired spam[event].count times in spam[event].seconds
//                             'ignored:<instrId>'  an instruction's failure condition came true
//                             'followed:<instrId>' an instruction's success condition came true
//       key?,               only match events whose payload key (or id) equals this, e.g. a zone key
//       text | texts[],     texts: one is picked at random, unseen ones first
//       priority?,          higher interrupts lower (default NARRATOR.DEFAULT_PRIORITY)
//       once?,              never repeat (for the whole session)
//       cooldown?,          seconds before this line can play again
//       skipIfBusy?,        drop it (don't queue or interrupt) if another line is showing
//       noStale?,           never dropped from the queue for being old (or by the queue limit):
//                             for lines that teach a move or point the way
//       condition?(ctx),    extra gate; ctx = { playerPos, events, payload } (playerPos may be null).
//                             Checked when the line is picked AND again when a queued line plays
//       instruction?,       once this line is fully shown, instructions[instruction] is armed
//   }]
//   A line with no trigger is say-only: played by id, e.g. a correction zone's `lineId`.
//   Lines count as seen once fully revealed. An interrupted `once`/instruction line is replayed.
//   spam: { <event>: { count, seconds } }        thresholds for 'spam:<event>' triggers
//   instructions: [{ id, success(ctx), failure(ctx), timeout? }]
//       ctx = { playerPos, armedPos, armedFor, events }. playerPos/armedPos are {x, y} or null
//       (no player yet), so conditions must handle null.
//
// Voice: grand storybook narrator who expected an Eagle. Flustered, never mean. See docs/story/premise.md.

const PRIORITY = {
    correction: 100,
    celebrate: 60,   // level complete: worth cutting off whatever was still being said
    resume: 50,      // same as a level intro; ties go to the level's own line
    nag: 30,
    idle: 20,
    shrug: 5,     // below the default: never interrupts anything
};

export default {
    id: 'common',

    spam: {
        // ~3 charges plus the flap cooldown: 5 in 6s means two full airborne bursts.
        'player:flap':      { count: 5, seconds: 6 },
        'player:flapEmpty': { count: 4, seconds: 3 },
        'interact:nothing': { count: 4, seconds: 5 },
        // Each pet with a line showing is spent skipping it, so 5 real pets in 8s is keen petting.
        'interact:twyx':    { count: 5, seconds: 8 },
    },

    instructions: [],

    lines: [
        // Corrections: a correction zone sent Sammy back. Never death or harm,
        // just the narrator fixing "their" story.
        {
            id: 'correction.common',
            trigger: 'correction:triggered',
            priority: PRIORITY.correction,
            texts: [
                'No, no, no. That is NOT where the Eagle goes. Let me just... rewrite that bit.',
                "Hmm. That's not in the script. *scribble scribble* There. Much better.",
                'Let us all pretend that never happened. An eagle would never. An owl, apparently, would.',
                'How did you even GET there? Never mind. Rewinding the story.',
                "I'm going to need a bigger eraser.",
                "The Eagle soared gracefully back to the right page. That's what happened. I wrote it down.",
                "Plot hole! Hold still, Sandy. Sammy. Sammy! I'm fixing it.",
                'Page twelve does not say the owl gets stuck somewhere silly. Let us try page twelve again.',
            ],
        },

        // Idling: escalates the longer nobody touches anything.
        {
            id: 'idle.1',
            trigger: 'idle:12',
            priority: PRIORITY.idle,
            cooldown: 30,
            texts: [
                'And our hero stood very still. Thinking heroic thoughts, no doubt.',
                'The hero paused, dramatically. Very dramatic. Any second now...',
                'The Eagle gazed bravely into the distance. Well, the owl did. Close enough.',
            ],
        },
        {
            id: 'idle.2',
            trigger: 'idle:30',
            priority: PRIORITY.idle,
            cooldown: 60,
            texts: [
                "Hello? The story only moves if YOU move. That's how stories work.",
                "I could describe the grass while we wait. It's green. That's all I've got.",
            ],
        },
        {
            id: 'idle.3',
            trigger: 'idle:60',
            priority: PRIORITY.idle,
            cooldown: 90,
            texts: [
                "Fine. I'll just hum. Hmm hmm hmmm. It's an eagle song. You wouldn't know it.",
                'Owls are supposed to be awake at night. It IS night. So... hello?',
            ],
        },
        {
            id: 'idle.4',
            trigger: 'idle:120',
            priority: PRIORITY.idle,
            once: true,
            text: "That's it. I'm writing THE END. Right now. ...I'm not, really. Please move?",
        },

        // Flapping far more than any self-respecting eagle would.
        {
            id: 'spam.flap',
            trigger: 'spam:player:flap',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            texts: [
                'Flap flap flap flap. Eagles SOAR, you know. Majestically. With far fewer flaps.',
                'The Eagle glided gracefully. The owl... flapped like a startled pillow.',
                "That's a lot of flapping. Are you flying, or whisking eggs?",
                "Easy! You'll flap your feathers right off. Then what would I narrate? A bald owl?",
            ],
        },
        {
            id: 'spam.flapEmpty',
            trigger: 'spam:player:flapEmpty',
            priority: PRIORITY.nag,
            cooldown: 15,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            texts: [
                "You're out of flaps. Flapping harder doesn't make more. I checked the rules.",
                "That's not flying, that's waving. Land somewhere and your flaps come back.",
            ],
        },

        // Pressing E with nothing nearby.
        {
            id: 'interact.nothing',
            trigger: 'interact:nothing',
            priority: PRIORITY.shrug,
            cooldown: 4,
            skipIfBusy: true,
            texts: [
                'You pressed E on... the air. The air says thank you.',
                "There's nothing there. Trust me. I wrote this place.",
                "Hoo are you talking to? There's nobody there.",
                'The Eagle never pokes empty air. ...Wait. Are you poking ME?',
            ],
        },
        {
            id: 'interact.nothing.spam',
            trigger: 'spam:interact:nothing',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            text: "Pressing E faster won't make a door appear. I'm not going to. ...Probably.",
        },

        // Twyx the cat. The narrator has no idea why a cat is in the Eagle's story.
        // First pet, then one attempt to recast Twyx as a hound, then little remarks now and then
        // (petting during the cooldown is just purring and hearts). Lines say "Twyx", never he/she.
        {
            id: 'twyx.meet',
            trigger: 'interact:twyx',
            priority: 42,
            once: true,
            text: "A cat?! There is no cat in the Eagle's story. ...The collar says 'Twyx'. Hello, Twyx. You're not in my notes.",
        },
        {
            id: 'twyx.hound',
            trigger: 'interact:twyx',
            priority: 41,
            once: true,
            text: "Behold, the Eagle's loyal HOUND! Fierce! Woofy! ...Twyx, could you bark? Just once? No. Fine. Cat.",
        },
        {
            id: 'twyx.pet',
            trigger: 'interact:twyx',
            cooldown: 8,
            skipIfBusy: true,
            texts: [
                'Twyx purrs. Eagles do not purr. I looked it up.',
                "The owl pets the cat. I didn't write that. I'm keeping it anyway.",
                'Twyx looks very pleased. At least SOMEONE in this story is.',
                "Purrrr. That's Twyx, not me. Narrators don't purr. Mostly.",
                "I still don't know why there's a cat here. But Twyx is very soft. I'll allow it.",
            ],
        },
        {
            id: 'twyx.spam',
            trigger: 'spam:interact:twyx',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            texts: [
                "So much petting! Twyx will be the fluffiest cat in any story. Possibly too fluffy.",
                'Pet, pet, pet. This is an ADVENTURE, not a petting zoo! ...Okay. One more.',
            ],
        },

        // A sign with no line of its own (its key has no keyed line). Keyed lines always win.
        {
            id: 'sign.fallback',
            trigger: 'interact:sign',
            cooldown: 3,
            texts: [
                "Let me see... *squints* It's very small writing. I think it says 'Eagles welcome'. Probably.",
                "It says... um. 'This way to the Eagle.' Yes. That's definitely what it says.",
                "I can't read it. Somebody wrote it in owl. Very messy handwriting, owls.",
            ],
        },

        // A locked door. A door's id can be used as a line key for a door-specific remark.
        {
            id: 'door.locked',
            trigger: 'interact:doorLocked',
            cooldown: 3,
            texts: [
                "Locked. Eagles don't need doors, you know. They just fly over things.",
                "It's locked. I'd have written a key, but I didn't think owls could carry one.",
                'Rattle all you like. That door is not in this chapter.',
            ],
        },

        // Continue: the story picks up at a bookmark (level:start with a checkpointId).
        {
            id: 'resume.common',
            trigger: 'level:start',
            priority: PRIORITY.resume,
            condition: ctx => !!ctx.payload?.checkpointId,
            texts: [
                "Ahem. Where were we? Ah yes, the mighty Eagle... Oh. It's the owl again. Carry on, then.",
                'Now, where did I put my bookmark? Ah, here it is. The story continues! Still no Eagle, I see.',
                "Welcome back! I kept your place. I also kept hoping an Eagle would turn up. It didn't.",
            ],
        },

        // Level complete: the narrator's remark while the celebration plays (T-008). Draft lines.
        {
            id: 'levelComplete.common',
            trigger: 'level:complete',
            priority: PRIORITY.celebrate,
            texts: [
                'And the Eagle reached the end of the chapter! ...The owl did. Fine. Well done, owl.',
                'The end of the chapter! I wrote a victory speech for the Eagle. You may borrow it.',
                "You made it! Don't tell the Eagle I said this, but... that was rather good.",
            ],
        },
    ],
};
