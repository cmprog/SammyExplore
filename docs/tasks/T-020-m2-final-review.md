# T-020 M2 final review and playtest

**Goal:** Confirm M2 works end to end as one experience before the stakeholder check-in. Fix what's broken; don't add features.

## Scope (M2 = T-013..T-019, commits on main since `d59c30e`'s parent chain: 19346ff..HEAD)
- Bedroom home base (art, window, day/night, nightlight), mechanisms, companion following, cat spots + Comfort, portal and chapters, practice course, narration and escalation.

## Acceptance criteria
- **Full journey, real keys, from the title:** New Game → Chapter One to the end → arrive in the bedroom (cast-list gag plays) → ask Twyx along → run the practice course with her (help-her-through, Comfort, star) → portal lever → replay Chapter One with Twyx along → back to the bedroom. No console errors, no soft-locks, Twyx never stranded.
- **Continue paths:** Continue after quitting mid-course; Continue from an M1-era save (schema v1 migrated, finished Chapter One) lands in the bedroom with no companion.
- **Full scenario suite passes** when run one at a time (parallel runs cause timing flakes).
- **Kid's-eye judgment:** does the bedroom feel like a place she'd want to hang out in? Is anything confusing, boring, too chatty, or ugly? Screenshots of the key moments.
- **Code health (reviewer):** cross-task integration across M2 — event contract (`docs/EVENTS.md` matches emits/listeners), `window.__sammy` current, data-over-code, Twyx special-care rules in all art/behavior/lines, no dead code or leftover placeholders, save schema v2 consistent.

## Out of scope
- Answers to the open stakeholder questions in `docs/checkin-M2.md` (don't change those behaviors).
- Eagle-line trimming, hats, Chapter Two.
