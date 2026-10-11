# M1 check-in agenda (PM working notes)

Questions for the stakeholder, collected during the M1 run.

## Needs your ears and eyes
- Listen to the music ("Owl Lullaby", a music-box loop of about 40s) and the sound effects, especially the meow, flap, and narrator blip. The agents couldn't hear any of it.
- Flap and glide tuning feel.

## Requirements questions
- Music: one track for everywhere, or different music per level or scene? Should it get quieter while paused?
- Narrator memory: should "already said that" lines be remembered across play sessions (saved), or start fresh each time she plays?
- Narrator text box: should it show a small "E to skip" hint? (PM leaning yes.)
- Drop-through platforms: should holding S let Sammy drop down through the wooden one-way platforms?
- Platform look: the one-way platforms are drawn as wooden planks. OK?
- Correction effect: the page gets scribbled out, then erased (~1.9s). Does it feel funny or too long? The playtester suggested a shorter version after the first few corrections, or letting the player skip it. Your call.

## Decisions PM made (FYI)
- The engine's debug build allows `+`/`-` speed hotkeys. We'll switch to the release build for play sessions.
- Worktree isolation workaround (path case), see memory.
- Level bounds: the left and right map edges and the top of the map are invisible walls. Only the bottom triggers a narrator correction, for falling off the world. Tell me if you'd rather leaving through the sides or the top count as "somewhere silly" too.
- Added a shared event catalog (`docs/EVENTS.md`) after parallel tasks drifted on event names.
