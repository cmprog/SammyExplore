# Backlog

Status values: `draft` (waiting on stakeholder answers), `ready`, `in-progress`, `review`, `done`.

## Milestone 1: Core mechanics (DRAFT, pending stakeholder sign-off)

Goal: all the core systems work in a sandbox level, so later milestones are mostly content.
Sammy moves, jumps, glides, and flaps. The narrator talks and reacts. E interacts. Menus and screens work. Sound plays.

| ID | Task | Owner | Depends on | Status |
|----|------|-------|------------|--------|
| T-001 | Skeleton: index.html, engine init, scene manager, event bus, input mapping, `window.__sammy` hook | game-dev | none | draft |
| T-002 | Playtest harness: `smoke.py` + scenario runner | playtester | T-001 | draft |
| T-003 | Level system: data-driven tile maps, tile collision, camera follow, spawn and reset points, procedural tile art | game-dev | T-001 | draft |
| T-004 | Sammy controller: run, jump (coyote time + buffering), glide (hold Space while falling), limited flaps with cooldown/recharge, tuning file | game-dev | T-003 | draft |
| T-005 | Sammy art: cute round owl drawn in code, with idle/run/jump/glide/flap poses, blink, squash and stretch, flap charge indicator | game-dev | T-004 | draft |
| T-006 | Narrator system: event-driven triggers (zones, player actions, idling, "disobeying"), typewriter text box, queue and priority, scripts as data | game-dev | T-001 | draft |
| T-007 | Interaction system: E on interactables, prompt indicator, a test door and a test sign | game-dev | T-003 | draft |
| T-008 | Screens: title, pause, level complete (others TBD) | game-dev | T-001 | draft |
| T-009 | Audio: sound-effect catalog (ZzFX), a night music loop (ZzFXM), mute and volume | game-dev | T-001 | draft |
| T-010 | Backdrop: night parallax (sky, moon, stars, silhouettes), with palette support for daytime | game-dev | T-003 | draft |
| T-011 | M1 sandbox level that exercises every system above, plus placeholder narrator lines | game-dev | all | draft |

Parallel tracks once T-001 is done: {T-003 → T-004 → T-005, T-007, T-010} and {T-006}, {T-008}, {T-009}.

## Later (ideas only, stakeholder decides)

- Story premise and narrator voice (see docs/story/)
- Twyx (companion cat) and the rescue cats: Snowy, Moxie, Elphaba, Oshi ("the furry basketball")
- Real levels, day/night story beats
