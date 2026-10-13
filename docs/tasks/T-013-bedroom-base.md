# T-013 Bedroom home base

**Goal:** The home base level, `bedroom`. This is where Sammy arrives after Chapter One, where rescued cats roam, and where the chapter portal (T-017) and a small practice course (T-018) will live.
Read `docs/story/premise.md` first, including the Twyx care rules.

## Stakeholder requirements
- A **girl's bedroom**: pink walls, **Minecraft-style decorations**, Lego, typical kid stuff. It should feel cozy.
  - Evoke "blocky pixel-art game" with blocky plushies, pixel-art posters, a block-pattern rug and so on, but **no logos and no copyrighted characters**.
- **One window** that clearly shows the time of day outside.
- **Day/night cycle of about 5 minutes.** The room darkens and lightens with the time of day. A **nightlight** turns on at night.

## Acceptance criteria
- The level `src/data/levels/bedroom.js` uses the existing level format.
  - Sammy is owl-sized, so the furniture is big platforms, and the room plays as a platforming space: floor, bed, desk, dresser, bookshelf shelves (one-way), toy chest, and Lego-brick stacks.
  - It is about 2-3 screens wide with a few vertical layers.
  - It **reserves two empty, clearly commented regions**: a portal alcove for T-017 (at least 6x8 tiles of floor-level space), and a practice-course region for T-018 (about 1 screen, e.g. under or around the bed and a toy shelf).
- **Indoor environment support.** Levels can declare an indoor environment (e.g. `environment: 'bedroom'`) instead of the outdoor sky backdrop.
  - Add an indoor backdrop: a wallpaper wall with trim, wall decorations, and posters, all baked like the outdoor backdrop for performance.
  - Add indoor tile palettes: wooden floorboards or carpet, and furniture tops.
  - Keep data over code: palettes, decor placement, and cycle timings live in `src/data/`.
- **Window:** a framed window in the wall shows the outside sky for the current time of day: sun and clouds by day, moon and stars by night, sunrise and sunset tints in between. Reuse the outdoor sky drawing where you can.
- **Day/night cycle system** (`src/systems/DayCycle.js`):
  - A time of day value in 0..1 runs over a configurable period (default 300 s).
  - Room lighting eases between day and night tints. Use a cheap full-screen tint, or the LightSystem plugin if it performs well; measure.
  - At night a **nightlight** (a cute plug-in lamp) glows with soft warm light.
  - Expose `__sammy.dayCycle` with `{t, phase}` and add `__sammy.commands.setTimeOfDay(t)` for tests.
  - Event: `daycycle:phase {phase}` when the phase changes (dawn, day, dusk, night). Add it to `docs/EVENTS.md`.
- **Twyx** is placed in the bedroom using the existing `twyx` entity. She just idles there; companion behaviour is T-015.
- **Temporary entry:** `__sammy.commands.loadLevel('bedroom')`. The real flow from Chapter One comes in T-017.
- **Look:** cozy and polished. Take screenshots at day, dusk, and night and judge them critically. The nightlight glow at night should feel safe and warm.
- Add a playtest `tools/playtest/bedroom_scenario.py` that loads the bedroom, steps the cycle through its phases with `setTimeOfDay`, takes screenshots, and checks that walking and jumping onto furniture works.

## Out of scope
The portal, practice course, companion following, and narration content (T-014 to T-019). A few placeholder narration lines for arrival are fine.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add any new event to it in the same change.
