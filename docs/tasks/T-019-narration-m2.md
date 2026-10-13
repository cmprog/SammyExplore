# T-019 Narration for M2, plus variety and escalation

Read `docs/story/premise.md`, including the voice guide, the Twyx care rules, and the approved cast-list gag.

## Stakeholder direction
- The voice is good. The stakeholder wants **more variety** in lines for repeated actions, and wants the narrator to **play with the player** when they do the same thing many times.
- The "Eagle"-style comments felt **confusing and out of place**. In new lines, keep Eagle references light and purposeful. Don't rewrite Chapter One's lines in this task; that comes later, once the story is fleshed out.
- **Approved gag:** the narrator's script has a cast list that says **"THE OWL (gender: Owl)"**, and the narrator gets flustered whenever Sammy is called "he". Sammy is a boy.

## Acceptance criteria
- **Escalation support in the narrator system:** a line can have count-based tiers, e.g. `tiers: [{min: 1, texts: […]}, {min: 4, texts: […]}, {min: 8, texts: […]}]`. The count is per line, or per trigger key, and is reset by `forgetSeen` on New Game.
  - Document the format in `common.js`, the way `noStale` is documented.
- **Apply escalation and more variety** to the repeated-action lines: petting Twyx, pressing E on nothing, flap spam, rereading signs, rattling locked doors, corrections (the 5th correction should feel different from the 1st), idling, and cat-spot no-cat/wrong-cat.
  - Aim for at least 3 tiers where it makes sense, with 2-4 variants per tier. The escalation should build to a payoff, for example the narrator giving up and doing something silly.
- **Bedroom lines:**
  - Arrival after Chapter One, including the **cast-list gag**.
  - Remarks about the room's decor (kid stuff, the blocky decorations, Lego underfoot).
  - The window and the day/night cycle (dawn and dusk remarks, and the nightlight coming on).
  - The portal and the lever, including clunking the lever when only one chapter is unlocked.
  - The practice course zones.
- **Companion lines:** Twyx joining, waiting (a hint toward the lever), catching up, and a correction while she's along.
  - Twyx lines are warm. She's loving and protective, and she follows her person. The narrator can be baffled, but never unkind, and **nothing about leaving, being lost, or goodbyes**.
- **Cat spot lines:**
  - **No cat:** escalating soft hints, e.g. "This looks like a job for someone with whiskers."
  - **Wrong cat:** generic and cat-agnostic for now.
  - **Comfort used:** for the toy mouse.
- Keep lines short (≤ about 20 words) and readable for a 9-year-old. Mark them all as drafts for the stakeholder.
- Add a scenario check that escalation tiers advance with repeats and reset on New Game.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add new events to it in the same change.
