# T-018 Bedroom practice course

**Goal:** A small, optional section of the bedroom, in the region T-013 reserved, that teaches the companion loop before Chapter Two. It does this through play, not tutorials.

## Acceptance criteria
- The course is built in the reserved region, for example under and around the bed and a toy shelf. It's playful and kid-room themed, roughly one screen, and takes about 1-2 minutes. It contains:
  - Walkable stretches and small hops that Twyx follows across.
  - At least one **help-her-through** moment where Sammy flies or glides past something Twyx can't cross, then uses a lever (T-014) to lower a bridge or open a gate for her.
  - A **cat spot** (T-016) with the jittery wind-up toy mouse. Comfort clears the tunnel, and a small reward is behind it. The reward is a placeholder for the future hat collectibles, such as a sparkle or a toy; **don't build a hat system**.
  - The course must be finishable whether Twyx is the companion or not. Without her, the cat spot is the one blocked part, and the narrator hints.
- No soft-locks; every area has a way back out.
- Narration hooks: zone keys at the course entry, the gap, the lever, and the tunnel, for T-019 to fill in.
- Add `tools/playtest/practice_scenario.py`: a full real-key run with Twyx as the companion, plus a run without her.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add new events to it in the same change.
