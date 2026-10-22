// Narration for the bedroom, the home base (src/data/levels/bedroom.js).
// Draft lines (T-019, `draft: true`) for the stakeholder. Voice guide: docs/story/premise.md.
//
// Keys: zone keys from the level (bedroom.* decor and portal zones, practice.* course zones),
// the practice cat spot's key (practice.mouse) and the toy star's id (practice-star).
// The room comes back again and again, so most remarks have tiers (see common.js): a first
// remark, then shorter ones for later visits. Decor remarks use a cooldown and skipIfBusy so
// walking about the room never turns into a lecture.
// Twyx care rules (premise.md): warm, loving, never in peril, never leaving or left behind.

const PRIORITY = {
    arrive: 50,
    zone: 40,
    decor: 15,      // passing remarks: never cut anything off
    sky: 15,
    companion: 31,  // a bedroom hint beats the common companion line (30)
};

const DECOR_COOLDOWN = 90;   // seconds before the same bit of the room is remarked on again
const SKY_COOLDOWN = 60;

const fresh = ctx => !ctx.payload?.checkpointId;   // Continue gets the common resume line instead
const phaseIs = phase => ctx => ctx.payload?.phase === phase;

export default {
    id: 'bedroom',

    lines: [
        // --- Arriving home -------------------------------------------------------------------
        // The first arrival (after Chapter One) leads into the cast-list gag: two follow-up lines
        // chained on narrator:revealed. Later arrivals are short "home again" remarks.
        {
            id: 'bedroom.arrive',
            trigger: 'level:start',
            priority: PRIORITY.arrive,
            condition: fresh,
            draft: true,
            tiers: [
                { min: 1, text: 'And our hero flew home to his mighty mountain nest! ...This is a bedroom. A very pink one.' },
                { min: 2, texts: [
                    "Home again, to the pink bedroom. I've stopped expecting a mountain nest. Mostly.",
                    "Back home! The owl returns. He returns. HE. See? I'm getting better at that.",
                    "Welcome home, owl. Nothing's changed. The Lego is exactly where you'd step on it.",
                ] },
            ],
        },
        {
            id: 'bedroom.castList',
            trigger: 'narrator:revealed',
            key: 'bedroom.arrive',
            priority: PRIORITY.arrive,
            once: true,
            draft: true,
            text: "Let me check my cast list. 'THE HERO: an Eagle.' Crossed out. 'THE OWL (gender: Owl).' ...Helpful.",
        },
        {
            id: 'bedroom.castList.he',
            trigger: 'narrator:revealed',
            key: 'bedroom.castList',
            priority: PRIORITY.arrive,
            once: true,
            draft: true,
            text: "Someone's crayoned 'HE'S A BOY' in the margin. Oh. He. Him. His. Right. Noted. Ahem.",
        },

        // --- The room (narration zones in the level) -----------------------------------------
        {
            id: 'bedroom.toys',
            trigger: 'narration:zone',
            key: 'bedroom.toys',
            priority: PRIORITY.decor,
            cooldown: DECOR_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: "A toy chest, a plush bear and a bunny. This is definitely a kid's room. A very cosy one." },
                { min: 2, texts: [
                    'The plush bear is watching you. Kindly. Bears are like that.',
                    'The toy chest is full of treasure. Mostly socks. Fluffy ones.',
                ] },
            ],
        },
        {
            id: 'bedroom.lego',
            trigger: 'narration:zone',
            key: 'bedroom.lego',
            priority: PRIORITY.decor,
            cooldown: DECOR_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: 'Lego bricks, right where you would step on them! Owls hop over. Grown-ups step on them and shout.' },
                { min: 2, texts: [
                    'More Lego. I once stepped on one in a story. I narrated VERY loudly.',
                    "Somebody built a tower of bricks. It's wonky. It's perfect.",
                ] },
            ],
        },
        {
            id: 'bedroom.castle',
            trigger: 'narration:zone',
            key: 'bedroom.castle',
            priority: PRIORITY.decor,
            cooldown: DECOR_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: 'A brick castle on the very top shelf! Every castle needs a hero. Hello, hero. ...Hello, owl.' },
                { min: 2, text: "The king of the brick castle is a plush jellyfish. I didn't write that either." },
            ],
        },
        {
            id: 'bedroom.blocks',
            trigger: 'narration:zone',
            key: 'bedroom.blocks',
            priority: PRIORITY.decor,
            cooldown: DECOR_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: 'A grass block, a plank block and a stack of books. Everything under here is square. Somebody loves blocks.' },
                { min: 2, texts: [
                    'Under the bed: blocks and books. Lost things always end up under beds.',
                    "These blocks are so square. Do they come in round? I'd like a round one, please.",
                ] },
            ],
        },
        {
            id: 'bedroom.window',
            trigger: 'narration:zone',
            key: 'bedroom.window',
            priority: PRIORITY.decor,
            cooldown: DECOR_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: 'Through the window: the whole wide world. Full of stories. And, I suspect, more cats.' },
                { min: 2, texts: [
                    'What a view! Somewhere out there, the next chapter is waiting to be written. Slowly. By me.',
                    "You like this window. Me too. It's the only part of the room that isn't pink.",
                ] },
            ],
        },

        // --- Day and night (daycycle:* events) ----------------------------------------------
        // Dropped if anything else is being said: the sky will turn again.
        {
            id: 'bedroom.dawn',
            trigger: 'daycycle:phase',
            condition: phaseIs('dawn'),
            priority: PRIORITY.sky,
            cooldown: SKY_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            texts: [
                "The sun peeks in. Good morning! Owls usually go to bed now. This one clearly won't.",
                'Dawn! The sky has gone pink to match the walls. Very tidy of it.',
            ],
        },
        {
            id: 'bedroom.dusk',
            trigger: 'daycycle:phase',
            condition: phaseIs('dusk'),
            priority: PRIORITY.sky,
            cooldown: SKY_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            texts: [
                "The sun's going down. The sky goes orange, then pink, then... owl o'clock.",
                'Sunset. Even the clouds look sleepy. Not the owl, though. The owl looks thrilled.',
            ],
        },
        {
            id: 'bedroom.nightlight',
            trigger: 'daycycle:nightlight',
            condition: ctx => ctx.payload?.on === true,
            priority: PRIORITY.sky,
            cooldown: SKY_COOLDOWN,
            skipIfBusy: true,
            draft: true,
            texts: [
                'Click! The nightlight comes on. A soft little glow, so nobody steps on the Lego.',
                'The nightlight is on. Nothing scary in here. Just plushies, blocks, and one owl.',
            ],
        },

        // --- The portal and its lever (T-017) ------------------------------------------------
        {
            id: 'bedroom.portal',
            trigger: 'narration:zone',
            key: 'bedroom.portal',
            priority: PRIORITY.decor,
            cooldown: 60,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, text: 'The portal! A swirly door into the story. Step in, and off we go.' },
                { min: 2, texts: [
                    'The portal hums a little tune. It sounds like adventure. Or a fridge.',
                    'Swirly, isn\'t it? I asked for a normal door. They gave me swirls.',
                ] },
            ],
        },
        {
            // Only one chapter to show (portal:select changed: false). Pulling it again and again
            // builds to the narrator writing a chapter on the spot (play 6).
            id: 'bedroom.portal.onlyOne',
            trigger: 'portal:select',
            condition: ctx => ctx.payload?.changed === false,
            cooldown: 5,
            skipIfBusy: true,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'Clunk. The portal thinks very hard about where else to go. It only knows one place, so far.',
                    'The lever has exactly one setting right now. It is a very loyal lever.',
                    "Other chapters? I haven't written them yet. I'm a narrator, not a printing press.",
                ] },
                { min: 4, texts: [
                    'Clunk. Clunk. Still one chapter. The lever is trying its very best.',
                    "You can pull it all day. I've only written one chapter so far. Writing is HARD.",
                ] },
                { min: 6, text: "FINE. I'll write one now. 'Chapter Three and a Half: The Owl Pulls A Lever.' ...The end." },
                { min: 7, texts: [
                    'Clunk. The lever and I agree: more chapters, please. Soon.',
                    'Still just the one. But I do like the clunk. Clunk is my favourite noise now.',
                ] },
            ],
        },
        // --- Twyx in the bedroom (T-015) ----------------------------------------------------
        {
            // She waits at the practice gap: point at the lever on the far side.
            id: 'bedroom.twyx.waiting.gap',
            trigger: 'companion:waiting',
            condition: ctx => ctx.payload?.cat === 'twyx' && ctx.payload?.reason === 'gap',
            priority: PRIORITY.companion,
            cooldown: 10,
            draft: true,
            texts: [
                'Twyx sits at the edge of the gap and looks across. Right at that lever. Hmm.',
                "Twyx can't jump that far. She's staring at the lever on the other side. Meaningfully.",
            ],
        },

        // --- T-018 practice course ------------------------------------------------------------
        // Zone keys from the level: practice.entry, practice.gap, practice.lever, practice.tunnel.
        {
            id: 'practice.entry',
            trigger: 'narration:zone',
            key: 'practice.entry',
            priority: PRIORITY.zone,
            once: true,
            skipIfBusy: true,
            draft: true,
            text: 'A practice course! Shelves to hop, a gap to cross, a fort to explore. Training time, owl.',
        },
        {
            id: 'practice.gap',
            trigger: 'narration:zone',
            key: 'practice.gap',
            priority: PRIORITY.zone,
            once: true,
            draft: true,
            text: "A gap! Owls can flap across. Cats can't. If only there were a bridge somewhere...",
        },
        {
            id: 'practice.lever',
            trigger: 'narration:zone',
            key: 'practice.lever',
            priority: PRIORITY.zone,
            once: true,
            draft: true,
            text: "A lever, right by the gap. I'm not saying pull it. I'm just saying it's a lovely lever.",
        },
        {
            id: 'practice.tunnel',
            trigger: 'narration:zone',
            key: 'practice.tunnel',
            priority: PRIORITY.zone,
            once: true,
            skipIfBusy: true,
            draft: true,
            text: "A toy mouse, wound up tight and whirring in the fort's doorway. It's far too frazzled to budge.",
        },
        {
            // The cushion with nobody along: soft hints that never name a cat, building to the
            // narrator's own (failed) attempt at calming the mouse.
            id: 'practice.mouse.noCat',
            trigger: 'catspot:noCat',
            key: 'practice.mouse',
            cooldown: 4,
            draft: true,
            tiers: [
                { min: 1, texts: [
                    'The toy mouse is all wound up. It needs a cuddle from someone furry and calm.',
                    'A cushion with a paw print, right by a frazzled mouse. Someone with paws might help.',
                ] },
                { min: 3, texts: [
                    "Owls are good at lots of things. Calming wind-up mice isn't one. Who's good at cuddles?",
                    'The mouse whirrs. The cushion waits. Somebody purry would be perfect here.',
                ] },
                { min: 5, text: "I tried singing the mouse a lullaby. It whirred louder. Let's leave this one to someone with whiskers." },
                { min: 6, texts: [
                    'Mouse: still frazzled. Cushion: still empty. Owl: still lovely. Missing: whiskers.',
                    'The mouse and I are both waiting for a cuddle expert. Know any?',
                ] },
            ],
        },
        {
            // Comfort lines are keyed on the cat: this one is Twyx's. A later comfort cat gets the
            // cat-agnostic line below.
            id: 'practice.mouse.calmed',
            trigger: 'ability:used',
            key: 'practice.mouse',
            condition: ctx => ctx.payload?.cat === 'twyx',
            cooldown: 6,
            draft: true,
            tiers: [
                { min: 1, text: 'Twyx snuggles the little mouse until it stops whirring. Sometimes all you need is a cat.' },
                { min: 2, texts: [
                    "The mouse got wound up again. Twyx doesn't mind. She'd calm it every single day.",
                    'Purr, bunt, snuggle. One calm mouse. Twyx makes it look easy.',
                ] },
            ],
        },
        {
            id: 'practice.mouse.calmed.anyCat',
            trigger: 'ability:used',
            key: 'practice.mouse',
            condition: ctx => !!ctx.payload?.cat && ctx.payload.cat !== 'twyx',
            cooldown: 6,
            draft: true,
            text: 'A cuddle and a purr, and the little mouse stops whirring. Cats are good at this.',
        },
        {
            // The star is back on every visit (finds aren't saved yet), so repeat finds escalate.
            id: 'practice.star',
            trigger: 'collectible:found',
            key: 'practice-star',
            priority: 45,
            draft: true,
            tiers: [
                { min: 1, text: 'A toy star, hiding in the fort! Lost toys always end up somewhere silly. Well spotted, owl.' },
                { min: 2, texts: [
                    "The star's back in the fort again. I think it just likes it in there.",
                    "Found the star again! It's becoming a tradition. I'll write it in the book.",
                ] },
                { min: 4, texts: [
                    "You're a star-finding expert now. That's a real job. I think.",
                    "Star found! Again! I'm going to need a bigger star chart.",
                ] },
            ],
        },
    ],
};
