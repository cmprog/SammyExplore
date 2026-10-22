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
//       tiers?,             escalation instead of text/texts: [{min, text | texts[]}, ...]. The line
//                             counts how many times it has started showing (cut off or not), and
//                             each play uses the tier with the highest `min` <= that count
//                             (1 = the first play; a count below every min uses the lowest tier).
//                             Within a tier, texts are picked like `texts`. So
//                               tiers: [{min: 1, texts}, {min: 4, texts}, {min: 8, text}, {min: 9, texts}]
//                             is plays 1-3, plays 4-7, play 8 only (a one-off payoff), then 9+ forever.
//                             Counts are session memory like `once`: forgetSeen() (New Game)
//                             resets them; loading another level doesn't.
//       countPer?,          'line' (default): one count for the line. 'key': one count per payload
//                             key (or id), so rereading sign A doesn't escalate sign B
//       draft?,             true: the wording is a draft the stakeholder hasn't approved yet.
//                             Documentation only; the narrator ignores it
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
//   A line can follow another: trigger 'narrator:revealed' with key '<the first line's id>'
//   (keep its priority at or below the first line's, so it waits instead of cutting it off).
//   Lines count as seen once fully revealed. An interrupted `once`/instruction line is replayed.
//   spam: { <event>: { count, seconds } }        thresholds for 'spam:<event>' triggers
//   instructions: [{ id, success(ctx), failure(ctx), timeout? }]
//       ctx = { playerPos, armedPos, armedFor, events }. playerPos/armedPos are {x, y} or null
//       (no player yet), so conditions must handle null.
//
// Voice: grand storybook narrator who expected an Eagle. Flustered, never mean. See docs/story/premise.md.
// Sammy is a boy, and the narrator's cast list only says "THE OWL (gender: Owl)", so "he" flusters
// it. Twyx is a girl ("she"). T-019 lines are marked `draft: true` until the stakeholder signs off.

const PRIORITY = {
    correction: 100,
    celebrate: 60,   // level complete: worth cutting off whatever was still being said
    resume: 50,      // same as a level intro; ties go to the level's own line
    companion: 30,   // above a pet remark, so asking Twyx along swaps the box to the join line
    nag: 30,
    catchUp: 25,     // waits behind a correction line (it arrives mid-rewrite)
    idle: 20,
    shrug: 5,     // below the default: never interrupts anything
};

// Companion and ability lines are keyed on the cat (the payload's `cat`), so a future cat with
// the same ability or the same hold-up never gets Twyx's name.
const isCat = cat => ctx => ctx.payload?.cat === cat;
const notCat = cat => ctx => !!ctx.payload?.cat && ctx.payload.cat !== cat;
const waitingFor = reason => ctx => ctx.payload?.cat === 'twyx' && ctx.payload?.reason === reason;
const caughtUpVia = (...vias) => ctx => ctx.payload?.cat === 'twyx' && vias.includes(ctx.payload?.via);

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
        // Corrections: a correction zone sent Sammy back. Never death or harm, just the narrator
        // fixing "their" story. It escalates: puzzled, then running out of eraser, then keeping
        // score, then one giving-up payoff (play 8), then cheerful resignation.
        {
            id: 'correction.common',
            trigger: 'correction:triggered',
            priority: PRIORITY.correction,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'No, no, no. That is NOT where the Eagle goes. Let me just... rewrite that bit.',
                    "Hmm. That's not in the script. *scribble scribble* There. Much better.",
                    'How did you even GET there? Never mind. Rewinding the story.',
                    "Plot hole! Hold still, Sandy. Sammy. Sammy! I'm fixing it.",
                ] },
                { min: 3, texts: [
                    "I'm going to need a bigger eraser.",
                    'Let us all pretend that never happened. An eagle would never. An owl, apparently, would.',
                    'Page twelve does not say the owl gets stuck somewhere silly. Let us try page twelve again.',
                    "The Eagle soared gracefully back to the right page. That's what happened. I wrote it down.",
                ] },
                { min: 5, texts: [
                    "That's a LOT of rewrites. I'm putting a little fence there. With a sign: 'No owls.'",
                    "Another rewind! I've started keeping score. Owl: lots. Script: very tired.",
                    "You keep finding the silly bits. Have you been reading my script? Is there a copy going round?",
                ] },
                { min: 8, texts: [
                    "I've run out of eraser. I'm just drawing a smiley face over it. There. Fixed. Ish.",
                    "No more eraser left. I'm fixing this one with a sticker. A shiny one. Much better.",
                ] },
                { min: 9, texts: [
                    "Back you go! Honestly, rewinding is my favourite part now. Don't tell the other narrators.",
                    '*scribble scribble* There. I hardly even sigh about it anymore. ...Sigh.',
                    'Wheee, rewind! See? I am having fun. This is my having-fun voice.',
                ] },
            ],
        },

        // Idling: escalates the longer nobody touches anything (12 s, 30 s, 60 s, 120 s), and
        // idle.1 and idle.4 also escalate each time it happens again.
        {
            id: 'idle.1',
            trigger: 'idle:12',
            priority: PRIORITY.idle,
            cooldown: 30,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'And our hero stood very still. Thinking heroic thoughts, no doubt.',
                    'The hero paused, dramatically. Very dramatic. Any second now...',
                    'The Eagle gazed bravely into the distance. Well, the owl did. Close enough.',
                ] },
                { min: 3, texts: [
                    'Standing still again. Is this a thinking pause, or a snack pause?',
                    'Shh. The owl is doing an owl thing. Staring. Very hard. At nothing.',
                    'And our hero... waited. Brave waiting. The bravest waiting I have ever seen.',
                ] },
                { min: 6, texts: [
                    "You stand still a lot. I've made a list of good standing spots. This one is top three.",
                    "Oh good, a pause. I'll warm up my narrating voice. Mi mi mi miiii.",
                ] },
            ],
        },
        {
            id: 'idle.2',
            trigger: 'idle:30',
            priority: PRIORITY.idle,
            cooldown: 60,
            draft: true,
            texts: [
                "Hello? The story only moves if YOU move. That's how stories work.",
                "I could describe the grass while we wait. It's green. That's all I've got.",
                'While we wait, I will tell a different story. A dragon sneezed. The end. Your turn.',
                'The owl stood so still, a moth landed on him. Him! The owl. Not the moth. Ahem.',
            ],
        },
        {
            id: 'idle.3',
            trigger: 'idle:60',
            priority: PRIORITY.idle,
            cooldown: 90,
            draft: true,
            texts: [
                "Fine. I'll just hum. Hmm hmm hmmm. It's an eagle song. You wouldn't know it.",
                'Owls are supposed to be awake at night. It IS night. So... hello?',
                "I'll count sheep while we wait. One sheep. Two sheep. Three... owls? Who let the owls in?",
            ],
        },
        {
            // The payoff: the narrator tries to end the story. Each long wait after that gets sillier.
            id: 'idle.4',
            trigger: 'idle:120',
            priority: PRIORITY.idle,
            cooldown: 300,
            draft: true,
            tiers: [
                { min: 1, text: "That's it. I'm writing THE END. Right now. ...I'm not, really. Please move?" },
                { min: 2, text: "THE END. ...You're still here? So am I. Fine. THE MIDDLE. Better?" },
                { min: 3, texts: [
                    "I've written THE END so often, it's started writing itself. Hello, THE END. Go away, THE END.",
                    'I made a cup of tea, read a book, and knitted a scarf. Still waiting. Nice scarf, though.',
                ] },
            ],
        },

        // Flapping far more than any self-respecting eagle would. Escalates to the narrator
        // having a go at flapping itself (play 5), then quiet surrender.
        {
            id: 'spam.flap',
            trigger: 'spam:player:flap',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'Flap flap flap flap. Eagles SOAR, you know. Majestically. With far fewer flaps.',
                    'The Eagle glided gracefully. The owl... flapped like a startled pillow.',
                    "That's a lot of flapping. Are you flying, or whisking eggs?",
                ] },
                { min: 3, texts: [
                    "Easy! You'll flap your feathers right off. Then what would I narrate? A bald owl?",
                    "More flapping! There's quite a breeze up here now. Hold on, my pages are blowing away.",
                    'Flap, flap, flap. You flap like it is your job. Is it your job?',
                    "I'm starting to hear the flapping in my sleep. Flappity flap.",
                ] },
                { min: 5, text: "Fine. If you can't beat them... FLAP! FLAP! ...Narrators can't fly. My script is all over the floor." },
                { min: 6, texts: [
                    "Flap all you like. I've tied my pages down with string.",
                    "Flapping again? I've stopped counting. We're at about a million.",
                ] },
            ],
        },
        {
            id: 'spam.flapEmpty',
            trigger: 'spam:player:flapEmpty',
            priority: PRIORITY.nag,
            cooldown: 15,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            draft: true,
            tiers: [
                { min: 1, texts: [
                    "You're out of flaps. Flapping harder doesn't make more. I checked the rules.",
                    "That's not flying, that's waving. Land somewhere and your flaps come back.",
                ] },
                { min: 3, texts: [
                    'No flaps left, so: very enthusiastic waving. Somebody will wave back eventually.',
                    'Out of flaps! Land on something. Anything. The flaps come back, I promise.',
                ] },
            ],
        },

        // Pressing E with nothing nearby. Builds to the narrator giving in and writing an
        // invisible door (play 7), which later remarks keep calling back to.
        {
            id: 'interact.nothing',
            trigger: 'interact:nothing',
            priority: PRIORITY.shrug,
            cooldown: 4,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'You pressed E on... the air. The air says thank you.',
                    "There's nothing there. Trust me. I wrote this place.",
                    "Hoo are you talking to? There's nobody there.",
                    'The Eagle never pokes empty air. ...Wait. Are you poking ME?',
                ] },
                { min: 4, texts: [
                    "Still nothing there. I checked again. I even looked behind the curtains.",
                    "Poke. Poke. The air is getting ticklish. Please stop, it's giggling.",
                    "You really want something to be there, don't you?",
                ] },
                { min: 7, text: "FINE. You win. I've written a tiny invisible door, right there. Ta-da! ...It's invisible." },
                { min: 8, texts: [
                    "The invisible door is still there. Invisibly. You're welcome.",
                    'Knock knock on the invisible door. Nobody answers. Nobody ever answers.',
                    "I'm very proud of that invisible door. Best thing I've ever written.",
                ] },
            ],
        },
        {
            id: 'interact.nothing.spam',
            trigger: 'spam:interact:nothing',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            draft: true,
            tiers: [
                { min: 1, text: "Pressing E faster won't make a door appear. I'm not going to. ...Probably." },
                { min: 2, texts: [
                    "So much E! The E key would like a little rest. It's been very brave.",
                    "E, E, E, E. Are you spelling something? Is it 'EEEEE'?",
                ] },
            ],
        },

        // Twyx the cat. The narrator has no idea why a cat is in the Eagle's story, but it's
        // warming to her fast. First pet, then one attempt to recast Twyx as a hound, then pet
        // remarks that grow fonder and build to a payoff (play 8), with purring and hearts in
        // between (the cooldown). Twyx care rules (premise.md): warm, loving, never in peril,
        // never leaving or left behind; the narrator can be baffled, never unkind.
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
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'Twyx purrs. Eagles do not purr. I looked it up.',
                    "The owl pets the cat. I didn't write that. I'm keeping it anyway.",
                    'Twyx looks very pleased. At least SOMEONE in this story is.',
                    "Purrrr. That's Twyx, not me. Narrators don't purr. Mostly.",
                    "I still don't know why there's a cat here. But Twyx is very soft. I'll allow it.",
                ] },
                { min: 4, texts: [
                    "Twyx leans right into the owl's wing. That cat adores you. It's written all over her whiskers.",
                    "More pets! Twyx's purr is now louder than my narrating. SPEAK UP, ME.",
                    "Twyx's tail has gone all question-marky. Even I know that means 'happy'.",
                ] },
                { min: 8, text: "Right. New chapter: 'The Owl Who Pets The Cat.' It's very long. Twyx gives it five stars." },
                { min: 9, texts: [
                    "Purr, pet, purr. Honestly? Best chapter so far. Don't tell the script.",
                    "I've stopped narrating the pets. I'm just quietly enjoying them.",
                    "Twyx is the softest thing in this whole story. That's a fact. I checked.",
                ] },
            ],
        },
        {
            id: 'twyx.spam',
            trigger: 'spam:interact:twyx',
            priority: PRIORITY.nag,
            cooldown: 20,
            skipIfBusy: true,   // a nag about something you did 9 s ago isn't funny
            draft: true,
            tiers: [
                { min: 1, texts: [
                    "So much petting! Twyx will be the fluffiest cat in any story. Possibly too fluffy.",
                    'Pet, pet, pet. This is an ADVENTURE, not a petting zoo! ...Okay. One more.',
                ] },
                { min: 3, texts: [
                    'This much petting is officially a hug. Twyx accepts the hug.',
                    "Twyx has been petted so much, she's mostly purr now. A purr with whiskers.",
                ] },
            ],
        },

        // --- The companion (T-015 events), keyed on the cat ---------------------------------
        // Twyx follows her person everywhere because she loves him. When she waits, she's safe,
        // patient and sure Sammy will sort it: never lost, never left.
        {
            id: 'companion.join.twyx',
            trigger: 'companion:join',
            condition: isCat('twyx'),
            priority: PRIORITY.companion,
            draft: true,
            tiers: [
                { min: 1, text: "Twyx trots over to follow the owl. Following her person is her favourite job. She's very good at it." },
                { min: 2, texts: [
                    'Twyx is coming along. Of course she is. Where the owl goes, Twyx goes.',
                    'And Twyx falls in right behind the owl. A small, fluffy bodyguard.',
                    'Twyx is on the job! The job is: follow the owl. Lovingly.',
                ] },
            ],
        },
        {
            // Any other cat (none yet but debug test cats): cat-agnostic.
            id: 'companion.join.anyCat',
            trigger: 'companion:join',
            condition: notCat('twyx'),
            priority: PRIORITY.companion,
            draft: true,
            text: 'A cat comes along to help. Every story is better with a cat in it.',
        },
        {
            id: 'companion.waiting.gap',
            trigger: 'companion:waiting',
            condition: waitingFor('gap'),
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            texts: [
                'Twyx sits at the edge and looks across. That gap is a bit much for paws. A bridge, maybe?',
                "Twyx can't jump that far. She's waiting, very politely, for someone to fix it.",
            ],
        },
        {
            id: 'companion.waiting.ledge',
            trigger: 'companion:waiting',
            condition: waitingFor('ledge'),
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            text: "Twyx looks up at the ledge, then at you. Too high for a cat. She's sure you'll sort it.",
        },
        {
            id: 'companion.waiting.gate',
            trigger: 'companion:waiting',
            condition: waitingFor('gate'),
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            text: "Twyx sits by the gate, tail curled up neat. She'd like it open, please.",
        },
        {
            id: 'companion.waiting.door',
            trigger: 'companion:waiting',
            condition: waitingFor('door'),
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            text: 'Twyx sits by the door, patient as anything. Doors are tricky without thumbs.',
        },
        {
            id: 'companion.waiting.lift',
            trigger: 'companion:waiting',
            condition: waitingFor('lift'),
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            text: "Twyx waits for the lift. She'd love a ride. Much easier than climbing.",
        },
        {
            // Back together after a wait (she made her own way, or Sammy came back for her).
            id: 'companion.caughtUp',
            trigger: 'companion:caughtUp',
            condition: caughtUpVia('walked', 'met'),
            priority: PRIORITY.catchUp,
            cooldown: 15,
            skipIfBusy: true,
            draft: true,
            texts: [
                "And Twyx is right back at the owl's side. Where she likes it best.",
                "Pad, pad, pad. Twyx bumps the owl's leg hello and purrs.",
                'Twyx and the owl, together again. Now the story can carry on properly.',
            ],
        },
        {
            // Brought in unseen at a checkpoint (or the below-the-world safety net).
            id: 'companion.caughtUp.shortcut',
            trigger: 'companion:caughtUp',
            condition: caughtUpVia('checkpoint', 'regroup'),
            priority: PRIORITY.catchUp,
            cooldown: 15,
            skipIfBusy: true,
            draft: true,
            texts: [
                "And there's Twyx, right beside you. Cats know shortcuts. Don't ask me where.",
                'Twyx turns up at the owl\'s side, looking very pleased with herself.',
            ],
        },
        {
            // A correction while she's along: she is put down beside Sammy under the page. Not
            // skipIfBusy: it arrives while the correction line shows, and waits for it.
            id: 'companion.caughtUp.correction',
            trigger: 'companion:caughtUp',
            condition: caughtUpVia('correction'),
            priority: PRIORITY.catchUp,
            cooldown: 30,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'Rewind! Twyx rides along on the page, snug beside him. Him! The owl. Yes. Him.',
                    'Twyx comes along for the rewind, right beside the owl. Where else would she be?',
                ] },
                { min: 3, texts: [
                    "Rewind, and Twyx is right there beside the owl again. She's used to my scribbling by now.",
                    "Twyx didn't even blink at the rewind. Cats are very calm about plot holes.",
                ] },
            ],
        },

        // --- Cat spots (T-016). Soft hints only: a cat is needed / a different cat is needed /
        // clear her way. Never say WHICH cat a spot wants. A spot's `key` (level data) lets a
        // level give one spot its own lines; the counts are per spot (countPer: 'key').
        {
            id: 'catspot.noCat',
            trigger: 'catspot:noCat',
            cooldown: 4,
            countPer: 'key',
            draft: true,
            tiers: [
                { min: 1, texts: [
                    "A cushion with a paw print on it. Owls don't have paws. Somebody with paws, perhaps?",
                    'This looks like a job for someone with whiskers.',
                    'You pat the cushion. The cushion waits for someone furrier.',
                ] },
                { min: 3, texts: [
                    "The cushion would like a cat, please. It's practically meowing.",
                    'Paw print. Cushion. Not a whisker in sight. Who do we know with whiskers?',
                ] },
                { min: 5, text: "Fine, I'll try. *pat pat* ...Nothing. I don't have paws either. Let's go find a cat." },
                { min: 6, texts: [
                    "Still no cat. The cushion and I have started a club. It's called Waiting For Whiskers.",
                    'The cushion sighs. I sigh too. This is a two-sigh cushion. It needs a cat.',
                ] },
            ],
        },
        {
            // Cat-agnostic on purpose: says nothing about who the cat is or who'd be right.
            id: 'catspot.wrongCat',
            trigger: 'catspot:wrongCat',
            cooldown: 4,
            countPer: 'key',
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'The cat sniffs the cushion and looks at you. Not her sort of job, apparently.',
                    'Hmm. This looks like a job for a different sort of cat.',
                    'Lovely cat. Wrong cushion. Picky things, cushions.',
                ] },
                { min: 3, texts: [
                    "The cat gives the cushion a polite sniff. And a polite 'no, thank you'.",
                    "This cushion wants someone else's paws. It's not personal. Cushions are just like that.",
                ] },
            ],
        },
        {
            id: 'catspot.unreachable',
            trigger: 'catspot:unreachable',
            cooldown: 6,
            text: "Your cat would love to help, but she can't get there. Perhaps the owl could clear the way?",
        },
        {
            id: 'ability.comfort',
            trigger: 'ability:used',
            condition: ctx => ctx.payload?.ability === 'comfort' && ctx.payload?.cat === 'twyx',
            cooldown: 6,
            draft: true,
            tiers: [
                { min: 1, text: 'Twyx snuggles close and purrs until the frazzled thing feels better. Nobody comforts like Twyx.' },
                { min: 2, texts: [
                    "A bunt, a purr, a snuggle. Twyx fixes it. She's very good at feelings.",
                    'Twyx works her magic. It is mostly purring. It works every time.',
                ] },
            ],
        },
        {
            // Comfort from any other cat (none yet): cat-agnostic.
            id: 'ability.comfort.anyCat',
            trigger: 'ability:used',
            condition: ctx => ctx.payload?.ability === 'comfort' && notCat('twyx')(ctx),
            cooldown: 6,
            draft: true,
            text: 'A cuddle and a purr, and the frazzled thing calms right down. Cats are good at this.',
        },

        // A sign with no line of its own (its key has no keyed line). Keyed lines always win.
        // Rereading the same sign escalates (per sign) to a dramatic reading.
        {
            id: 'sign.fallback',
            trigger: 'interact:sign',
            cooldown: 3,
            countPer: 'key',
            draft: true,
            tiers: [
                { min: 1, texts: [
                    "Let me see... *squints* It's very small writing. I think it says 'Eagles welcome'. Probably.",
                    "It says... um. 'This way to the Eagle.' Yes. That's definitely what it says.",
                    "I can't read it. Somebody wrote it in owl. Very messy handwriting, owls.",
                ] },
                { min: 3, texts: [
                    'It still says the same thing. Signs are like that. Very stubborn.',
                    'Reading it again? Okay. *squints harder* Nope. Same squiggles.',
                ] },
                { min: 5, text: "Let me read it in my best sign voice. *ahem* 'THIS... IS... A SIGN.' Thank you, thank you." },
                { min: 6, texts: [
                    "You and this sign are good friends now. I'll leave you two alone.",
                    "Same sign, same words. I know it by heart. Want to hear it? ...No? Fair.",
                ] },
            ],
        },

        // A locked door. A door's id can be used as a line key for a door-specific remark.
        // Rattling the same door escalates (per door) to a knock-knock joke.
        {
            id: 'door.locked',
            trigger: 'interact:doorLocked',
            cooldown: 3,
            countPer: 'key',
            draft: true,
            tiers: [
                { min: 1, texts: [
                    "Locked. Eagles don't need doors, you know. They just fly over things.",
                    "It's locked. I'd have written a key, but I didn't think owls could carry one.",
                    'Rattle all you like. That door is not in this chapter.',
                ] },
                { min: 3, texts: [
                    "Rattle, rattle. The door says 'still locked'. Doors aren't very chatty.",
                    "Still locked. My script just says 'door: locked'. Very short chapter.",
                ] },
                { min: 5, text: "Let me try. Knock knock! 'Who's there?' 'Owl.' 'Owl who?' 'Owl come back later.' ...Still locked." },
                { min: 6, texts: [
                    "You and that door are having a staring contest. The door is winning. Doors don't blink.",
                    "Locked, locked, locked. I'm saving the key for later. Ooh. Mysterious.",
                ] },
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
