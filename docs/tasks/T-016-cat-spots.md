# T-016 Cat spots and abilities (Twyx: Comfort)

**Goal:** Marked cat spots where a companion's ability is needed. Twyx's ability is **Comfort**: she snuggles and grooms to calm something upset. In M3 this is how she frees Snowy (Snowy's collar is stuck in her mouth, and Twyx calms her and grooms it loose).

## Stakeholder requirements
- A cat spot is marked, but it **does not show which cat** it needs.
- Controls stay simple: E at the spot.
- With **no cat** or the **wrong cat**, the narrator makes japes that work as **soft hints**.

## Acceptance criteria
- **CatSpot** entity: a subtle but noticeable marker, e.g. a paw-print mat or cushion with a gentle sparkle. It must read as "a cat could do something here" and must never show which cat.
  - Props: `id`, `ability`, `targets` (mechanism ids, or comfort targets to activate), and optional narration keys.
  - E at the spot:
    - **With the right companion:** she walks to the spot and performs the ability with a lovely animation. It emits `ability:used {ability, cat, spotId}` and activates the targets through the T-014 activation API.
    - **No companion:** emits `catspot:noCat {spotId, ability}`.
    - **Wrong companion:** emits `catspot:wrongCat {spotId, ability, cat}`.
- **Abilities as data:** `src/data/abilities.js` maps each ability to the cats that have it, its animation, and its effect. Adding Snowy's future pull-chain ability should be a data addition plus one animation.
- **Comfort:**
  - The target is an "upset" entity that becomes "calm" when comforted, then does its job (moves aside, opens, activates its own targets).
  - Twyx's animation: she curls up close, grooms or headbutts, hearts and purr particles appear, and there's a calming sound.
  - Build a generic `Upset` entity base so Snowy-with-a-stuck-collar (M3) can reuse it.
  - For M2's practice course, make one comfort target: a **jittery wind-up toy mouse** that is too frazzled to move out of a narrow tunnel. When comforted it settles and scoots aside, clearing the way. This is draft content; the stakeholder reviews it at the check-in.
- Placeholder narration lines for `catspot:noCat`, `catspot:wrongCat`, and `ability:used` (T-019 writes the real ones).
- **Debug:** `__sammy.catSpots` reports each spot's state.
- Add `tools/playtest/catspot_scenario.py` covering: no cat, Twyx doing Comfort with the target calming and the way clearing, and a wrong-cat path. A fake second cat is needed for the wrong-cat check; use a test-only cat id via debug, and don't add a real cat.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add new events to it in the same change.
