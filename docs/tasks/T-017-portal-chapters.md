# T-017 Portal and chapters

**Goal:** Use a portal in the bedroom to choose chapters. Chapter One leads to the bedroom.

## Stakeholder requirements
- The chapter portal is a **Minecraft-style portal frame**, made of chunky blocks with a swirling portal surface.
- An **interactable lever** next to it changes which chapter the portal connects to.
- The portal lists **only unlocked chapters**.
- **Each chapter has its own portal color**, and a **sign above the portal** names the chapter.
- Don't use logos or copyrighted characters. A blocky frame and a swirly surface are fine.

## Acceptance criteria
- **Chapters as data** (`src/data/chapters.js`). Each chapter is `{id, title, levelId, portalColor, unlock}`. Chapter One is `{levelId: 'sandbox', title: 'Chapter One', …}` and is always unlocked. Adding Chapter Two in M3 should only need a data entry.
- **Progression and save:**
  - The save records `unlockedChapters` and `completedChapters`. It is coordinated with T-015's schema v2: one bump with one migration, and a v1 save migrates cleanly.
  - Finishing a chapter marks it completed and unlocks the chapters its data says it unlocks.
- **Flow:**
  - New Game still starts Chapter One.
  - Finishing Chapter One goes to the **bedroom**, with the celebration, then an arrival, replacing "To be continued...". Finishing any chapter returns to the bedroom.
  - Continue resumes wherever the save is: in a chapter at a checkpoint, or in the bedroom.
- **Portal entity:**
  - Chunky block frame, an animated swirl in the selected chapter's color, and particles.
  - The sign above the portal is drawn in code (no fonts or assets) and shows the chapter title.
  - Walking into the portal enters that chapter, with a swirly transition. The companion comes along (T-015).
- **Portal lever:** E cycles to the next unlocked chapter, changing the portal color and the sign with a nice transition.
  - With only one chapter unlocked, the lever still clunks, and the narrator can comment.
  - Reuse T-014's Lever art and behaviour (as a "cycle" mode) if it's in place; otherwise coordinate.
- Place the portal in the bedroom's reserved portal alcove (T-013).
- **Events:** `portal:select {chapterId}`, `portal:enter {chapterId}`, `chapter:complete {chapterId}`. Add them to `docs/EVENTS.md`.
- **Debug:** `__sammy.chapters` reports `{unlocked, completed, selected}`, and `__sammy.commands.unlockChapter(id)` unlocks one.
- **Playtests:**
  - Update `sandbox_playthrough.py` so it ends in the bedroom.
  - Add `tools/playtest/portal_scenario.py`, which checks: lever cycling (with a debug-unlocked fake second chapter that points at the `test` level), entering the portal, returning to the bedroom after completing a chapter, and Continue landing in the bedroom.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add new events to it in the same change.
