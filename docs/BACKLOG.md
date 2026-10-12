# Backlog

Status values: `draft` (waiting on stakeholder answers), `ready`, `in-progress`, `review`, `done`.

## Milestone 1: Core mechanics (approved 2026-10-11)

Goal: all the core systems work in a sandbox level, so later milestones are mostly content.
Sammy moves, jumps, glides, and flaps. The narrator talks and reacts. E interacts. Menus and screens work. Sound plays.

| ID | Task | Owner | Depends on | Status |
|----|------|-------|------------|--------|
| T-001 | Skeleton: index.html, engine init, scene manager, event bus, input mapping, `window.__sammy` hook | game-dev | none | done |
| T-002 | Playtest harness: `smoke.py` + scenario runner | playtester | T-001 | done |
| T-003 | Level system: data-driven tile maps, tile collision, camera follow, spawn and reset points, procedural tile art | game-dev | T-001 | done |
| T-004 | Sammy controller: run, jump (coyote time + buffering), glide (hold Space while falling), limited flaps with cooldown/recharge, tuning file | game-dev | T-003 | in-progress |
| T-005 | Sammy art: cute round owl drawn in code, with idle/run/jump/glide/flap poses, blink, squash and stretch, flap charge indicator | game-dev | T-004 | ready |
| T-006 | Narrator system: event-driven triggers (zones, player actions, idling, "disobeying"), typewriter text box, queue and priority, scripts as data | game-dev | T-001 | done |
| T-007 | Interaction system: E on interactables, prompt indicator, a test door and a test sign | game-dev | T-003 | ready |
| T-008 | Screens + autosave: title (New Game/Continue with overwrite warning), pause, level complete; milestone-based autosave | game-dev | T-001 | in-progress |
| T-009 | Audio: sound-effect catalog (ZzFX), a night music loop (ZzFXM), mute and volume | game-dev | T-001 | done |
| T-010 | Backdrop: night parallax (sky, moon, stars, silhouettes), with palette support for daytime | game-dev | T-003 | in-progress |
| T-011 | M1 sandbox level + Twyx (tuxedo cat), real narrator lines | game-dev | all | ready |

**M1 wrap-up:** switch to the engine's release build (`littlejs.esm.min.js`, same version, debug off) for play sessions. The debug build lets `+`/`-` change game speed. Keep the debug build for development, e.g. through an import map or a `?debug` flag.

Parallel tracks once T-001 is done: {T-003 → T-004 → T-005, T-007, T-010} and {T-006}, {T-008}, {T-009}.

## Later (ideas only, stakeholder decides)

- Story premise approved: "This Is Not Your Story" (docs/story/premise.md)
- Twyx (companion cat) and the rescue cats: Snowy, Moxie, Elphaba, Oshi ("the furry basketball")
- Real levels, day/night story beats

## Follow-ups (small, fold into a later task)
- Audio: play the `correction` sound when a correction actually starts (e.g. on `narrator:line` for a correction, or a new `correction:start`), not on every `correction:triggered`.
- Pause mid-glide: the glide sound doesn't resume after unpausing.
