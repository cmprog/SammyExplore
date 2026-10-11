# T-006b Narrator integration (merge of t006-narrator into main)

A `git merge t006-narrator` is **in progress** in the main checkout. `src/main.js` and `src/data/tuning.js` have conflicts.

## Acceptance criteria
- Conflicts are resolved, keeping both sides:
  - `main.js` keeps T-003's playing scene as the startup scene (`test` level) and T-009's `initAudio()` inside gameInit, and adds the narrator.
  - `tuning.js` keeps all constants from both sides.
- **The narrator is hosted by PlayingScene, not BootScene.** BootScene goes back to its plain placeholder, or has no narrator.
  - `enter`: `loadScript(levelId)` is called before the level's async load emits `level:start`. Set `setPlayerPositionProvider(() => player pos)`.
  - The narrator updates **before** the player and other gameplay, per the ordering rule in the Narrator header.
  - `renderPost` draws the text box and the correction overlay.
  - `exit` disposes the narrator, which completes any running correction.
- **Corrections go through the narrator.** The temporary `correction:triggered` → respawn listener in PlayingScene is replaced by a `correction:reset` → move the player to `level.respawn` listener, so the move happens while the page is covered.
- The `correction:triggered` zone re-fire during the effect is ignored (the narrator already ignores a second trigger; confirm it).
- `docs/EVENTS.md` is updated:
  - `correction:*` events can also come from `cancel()`, with no visuals.
  - Note the `{quiet:true}` emit option.
- `tools/playtest/narrator_scenario.py` has been copied into main. Adapt it to the playing scene and widen the idle.2 window: the idle timer now pauses while a line shows.
- All scenarios pass: smoke, input, level, narrator. Also run a real end-to-end check: walk the box off the pillar or fall off the world in the `test` level, and see the scribble, the respawn under the page, and the narrator line. Screenshot it and look at it.
- Commit the merge yourself when everything passes, with the message "Merge T-006: narrator and corrections", ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The PM authorizes this commit.
