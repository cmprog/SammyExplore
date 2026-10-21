# Backlog

Status values: `draft` (waiting on stakeholder answers), `ready`, `in-progress`, `review`, `done`.

## Milestone 1: Core mechanics (approved 2026-10-11, built 2026-10-12, awaiting stakeholder review)

Goal: all the core systems work in a sandbox level, so later milestones are mostly content.
Sammy moves, jumps, glides, and flaps. The narrator talks and reacts. E interacts. Menus and screens work. Sound plays.

| ID | Task | Owner | Depends on | Status |
|----|------|-------|------------|--------|
| T-001 | Skeleton: index.html, engine init, scene manager, event bus, input mapping, `window.__sammy` hook | game-dev | none | done |
| T-002 | Playtest harness: `smoke.py` + scenario runner | playtester | T-001 | done |
| T-003 | Level system: data-driven tile maps, tile collision, camera follow, spawn and reset points, procedural tile art | game-dev | T-001 | done |
| T-004 | Sammy controller: run, jump (coyote time + buffering), glide (hold Space while falling), limited flaps with cooldown/recharge, tuning file | game-dev | T-003 | done |
| T-005 | Sammy art: cute round owl drawn in code, with idle/run/jump/glide/flap poses, blink, squash and stretch, flap charge indicator | game-dev | T-004 | done |
| T-006 | Narrator system: event-driven triggers (zones, player actions, idling, "disobeying"), typewriter text box, queue and priority, scripts as data | game-dev | T-001 | done |
| T-007 | Interaction system: E on interactables, prompt indicator, a test door and a test sign | game-dev | T-003 | done |
| T-008 | Screens + autosave: title (New Game/Continue with overwrite warning), pause, level complete; milestone-based autosave | game-dev | T-001 | done |
| T-009 | Audio: sound-effect catalog (ZzFX), a night music loop (ZzFXM), mute and volume | game-dev | T-001 | done |
| T-010 | Backdrop: night parallax (sky, moon, stars, silhouettes), with palette support for daytime | game-dev | T-003 | done |
| T-011 | M1 sandbox level + Twyx (tuxedo cat), real narrator lines | game-dev | all | done |

**M1 wrap-up:** done in T-012 (release build by default, `?debug` for development).

Parallel tracks once T-001 is done: {T-003 → T-004 → T-005, T-007, T-010} and {T-006}, {T-008}, {T-009}.

## Milestone 2: Home base and companions (approved 2026-10-13)

Goal: after Chapter One, Sammy arrives in the bedroom home base. Twyx follows him. He helps her past places she can't go, and her Comfort ability works at cat spots. A Minecraft-style portal with a lever is the chapter selector. Chapter Two itself is M3.

| ID | Task | Owner | Depends on | Status |
|----|------|-------|------------|--------|
| T-013 | Bedroom home base: indoor level art (pink walls, Minecraft-style decor, Lego, kid stuff), window with day/night outside, ~5 min lighting cycle, nightlight | game-dev | none | done |
| T-014 | Mechanisms: generic Lever/switch interactable plus targets (lowering platform/bridge, gate), data-wired | game-dev | none | done |
| T-015 | Companion follow: pick a cat in the base (E), she follows Sammy across levels, waits where she can't follow, and a mechanism lets her through | game-dev | T-014 | done |
| T-016 | Cat spots and abilities: CatSpot entity (doesn't show which cat), ability registry, Twyx's Comfort, narrator japes for no cat or the wrong cat | game-dev | T-015 | done |
| T-017 | Portal and chapters: chapters data, Minecraft-style portal with a per-chapter color and sign, lever cycles unlocked chapters, save progression, Chapter One → bedroom flow | game-dev | T-013 | done |
| T-018 | Bedroom practice course: a small section of the base that exercises following, a help-her-through mechanism, and a Comfort cat spot | game-dev | T-013..T-017 | in-progress |
| T-019 | Narration: bedroom lines, the cast-list gag, cat-spot japes, Twyx companion lines, more variety and escalation for repeated actions | game-dev | T-016, T-018 | ready |
| T-020 | M2 final review and playtest, plus fixes | reviewer/playtester | all | ready |

## Milestone 3: Chapter Two, Snowy (planned)
- Chapter Two level: Snowy (black cat, kitten-like and mischievous) has her collar stuck in her mouth. Twyx's Comfort frees her. Snowy then joins the base.
- Details to be set at the M2 check-in.

## Later (ideas only, stakeholder decides)

- **Hats** (the daughter's request, 2026-10-13): customize Sammy and the cats with hats that are collected or earned as bonus collectibles in levels, stored on a **hat shelf** in the bedroom.
- **Snowy's ability: pull-chain batter.** At a cat spot Sammy lifts her and she bats a chain or cord that opens something. Approved; not in M2 or M3. Other Snowy ideas for later chapters: clock chime, string chaser.
- **Narrator "Eagle" comments feel confusing and out of place.** Refine them as the story is fleshed out, so they foreshadow or hint and fit the game world. Until then, keep new Eagle references light and purposeful.
- Story premise approved: "This Is Not Your Story" (docs/story/premise.md)
- Twyx (companion cat) and the rescue cats: Snowy, Moxie, Elphaba, Oshi ("the furry basketball")
- Real levels, day/night story beats

## Follow-ups (small, fold into a later task)
- Audio: play the `correction` sound when a correction actually starts (e.g. on `narrator:line` for a correction, or a new `correction:start`), not on every `correction:triggered`.
- Pause mid-glide: the glide sound doesn't resume after unpausing (T-008 may have fixed this; verify).
- Lift sounds aren't distance-attenuated: an off-screen looping lift hums every leg.
- Playtest harness: rarely, `window.__sammy` is undefined at a scenario's first step (seen once in interaction_scenario). Make `session()` wait for the hook.
