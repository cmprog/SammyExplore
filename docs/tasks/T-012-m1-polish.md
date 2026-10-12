# T-012 M1 polish and release build

Fixes from the final M1 review and playtest, plus the M1 wrap-up item. The detailed fix suggestions are in the PM's dispatch message.

## Acceptance criteria
1. **New Game starts the narrator fresh.**
   - Add `LineBook.forgetSeen()` and expose it through the Narrator.
   - `startNewGame` passes `newStory: true`, and PlayingScene calls `forgetSeen()` before `loadScript`.
   - A second New Game in the same session replays the full Chapter One narration.
2. **Level complete never cuts off the final line.**
   - Add `narrator:revealed {id}`, and register it in `docs/EVENTS.md`.
   - The continue prompt only appears and accepts input once the line is revealed, or after a cap set in tuning.
   - A confirm press while the line is still typing finishes the reveal, for example via a `narrator:skip` event, also registered in `EVENTS.md`.
3. **Teaching lines never go stale.**
   - Add a per-line `noStale` option, honored by both the stale pruning and the `QUEUE_MAX` truncation.
   - Mark `sandbox.twyx.ahead`, `sandbox.cliff`, `sandbox.leap`, `sandbox.end` and `sandbox.hops` with it.
   - Re-check `condition` when a line plays, not only when it is queued.
4. **The gap-fall hint is level data.** Replace the hard-coded `GAP_LEFT`/`GAP_RIGHT` in `narration/sandbox.js` with a correction zone in the level that uses `lineId: 'sandbox.gap.fall'`.
5. **Continue doesn't replay the intro.** `level:start` carries `checkpointId` (update `EVENTS.md`). The sandbox intro only plays on a fresh start. Optionally add a short "where were we..." resume line.
6. **The camera doesn't bob.** Add hysteresis, about 1s set in tuning, before the narration offset eases back.
7. **Hardening.** `playerPos()` returns a copy.
8. **Playtest reliability.**
   - `sandbox_playthrough` asserts `__sammy.interaction.prompt.visible === false` during the glide.
   - The README notes that headless screenshots of 2D-overlay UI can show stale frames.
9. **Release build (M1 wrap-up).** Play sessions use `lib/littlejs/littlejs.esm.min.js`, which has debug off and no `+`/`-` speed keys. Development keeps the debug build via `?debug` in the URL.
   - Use an import map in `index.html`: every module imports from a bare specifier such as `littlejs`, and the map picks the file.
   - Copy `littlejs.esm.min.js` from the same 1.18.29 package into `lib/littlejs/`. The PM will supply it.
   - The playtest harness loads with `?debug`, so the existing scenarios keep their debug behavior. Add one smoke check without `?debug` that confirms the release build loads with no console errors.
10. Every scenario passes, including `sandbox_playthrough`.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add any new event to it in the same change.
