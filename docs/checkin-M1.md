# M1 check-in agenda (PM working notes)

Questions for the stakeholder, collected during the M1 run.

## Needs your ears and eyes
- Listen to the music ("Owl Lullaby", a music-box loop of about 40s) and the sound effects, especially the meow, flap, and narrator blip. The agents couldn't hear any of it.
- Flap and glide tuning feel. Current numbers:
  - jump about 2.6 tiles high
  - 3 flaps about +2.7 tiles in real play
  - glide covers about 2.7 tiles sideways per tile of drop
  - running jump plus glide about 10 tiles across
  - flaps refill on landing, plus 1 charge after 3s in the air

  Things to feel out: does flapping early in a jump feel laggy (0.15s cooldown)? Is the glide too floaty or not floaty enough?

- Read the Chapter One narration drafts (`src/data/narration/sandbox.js`, `common.js`). Keep, cut, or rewrite any you like.

- Watch for a faint "E" bubble hanging in the sky while gliding over the Great Gap. Headless tests showed it as a stale-frame artifact (game state says it's hidden), but we need a real-screen check.

## Playtester's kid's-eye notes (for discussion)
- Best moments: gliding the Great Gap ("I'm not crying"), petting Twyx over and over, and going left into the room the narrator "never wrote".
- Weak spots: a dead stretch of plain walking before the first hill (a kid who doesn't jump bumps into it); mashing Space at the gap burns all the flaps and plops her in; the first full-screen scribble could read as a glitch; typing lines are slow if you don't know Enter/E skips.

## Requirements questions
- The Great Gap is 19 tiles wide and drops 5 tiles; you can't see the far side until you're gliding (a leap of faith). Flaps alone can't cross it, and the narrator hints to hold Space. Is this the right difficulty?
- Checkpoints are invisible (the narrator says "bookmark" and the save feather shows). Do you want a visible checkpoint prop, e.g. a bookmark ribbon?
- "Chapter One" isn't shown anywhere on screen. Should there be a chapter title card at level start?
- The locked "Eagle's private room" door: should it ever open in a later chapter?
- Music: one track for everywhere, or different music per level or scene? Should it get quieter while paused?
- Narrator memory: should "already said that" lines be remembered across play sessions (saved), or start fresh each time she plays?
- Narrator text box: should it show a small "E to skip" hint? (PM leaning yes.)
- Drop-through platforms: should holding S let Sammy drop down through the wooden one-way platforms?
- Platform look: the one-way platforms are drawn as wooden planks. OK?
- Correction effect: the page gets scribbled out, then erased (~1.9s). Does it feel funny or too long? The playtester suggested a shorter version after the first few corrections, or letting the player skip it. Your call.

- Game title on screen: currently "Sammy Explore". Keep it, or something like "This Is Not Your Story", or both (a subtitle)?
- Screen wording placeholders: "Level Complete!", "To be continued...", menu labels. Fine, or do you want to word them?
- Menu font: Comic Sans-style rounded system font (no font files allowed). OK?
- Quit to Title: should it confirm "you'll go back to your last checkpoint"?
- After the final level: Continue currently replays the last level. What should happen?
- Backdrop: should daytime get live critters (e.g. butterflies) to match the night fireflies? Story props in the background (e.g. an Eagle statue on a far hill)? Different scenery per level?
- Sammy's look: amber owl eyes (the old placeholder had plain dark pupils). Show her the pose sheet (`tools/playtest/out/poses_sheet.png`)!
- Twyx: green eyes; the narrator learns the name from Twyx's collar; lines avoid he/she because Twyx's gender isn't decided. Is Twyx a boy or a girl, or should it stay neutral? Show her the Twyx sheet.
- Flap-charge feathers fade out while Sammy is on the ground with all charges full, and reappear when he jumps. Should they always show instead?
- Doors: right now they're freestanding doors in a meadow (no wall), so Sammy can hop over a closed one. Is that the gag you want, or should doors sit in walls, hollow trees, and so on?
- Locked doors: how should they get unlocked later (keys, a cat, the narrator relenting)? Nothing unlocks them yet.
- Should opened doors stay open after Continue (saved), or reset?

## Decisions PM made (FYI)
- The game runs the engine's release build by default (no `+`/`-` speed hotkeys). Use `?debug` for development.
- Glide is taught by the narrator in Chapter One (a hint at the Great Gap, and a stronger hint if you fall in).
- Worktree isolation workaround (path case), see memory.
- Level bounds: the left and right map edges and the top of the map are invisible walls. Only the bottom triggers a narrator correction, for falling off the world. Tell me if you'd rather leaving through the sides or the top count as "somewhere silly" too.
- We hit the session usage limit while running 3 Opus game-dev agents in parallel. All three were resumed from their transcripts and nothing was lost. Options for the future: less parallelism, or Sonnet for some game-dev and reviewer tasks. Your call on cost versus speed.
- Added a shared event catalog (`docs/EVENTS.md`) after parallel tasks drifted on event names.
