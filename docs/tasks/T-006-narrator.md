# T-006 Narrator and corrections

Read `docs/story/premise.md` first. The voice matters.

## Acceptance criteria
- `src/systems/Narrator.js` plays lines from script data in `src/data/narration/<levelId>.js` plus `src/data/narration/common.js`.
- A line entry looks like: `{ id, trigger, text | texts[], priority, once?, cooldown?, condition? }`. If `texts` is given, one is chosen at random, preferring lines not yet seen.
- Triggers are bus events (`narration:zone`, `player:*`, `interact:*`, `checkpoint:reached`, `level:start`, `correction:triggered`) plus built-in behavior triggers:
  - `idle:N`: the player hasn't pressed anything for N seconds.
  - `ignored:<instructionId>`: the narrator gave an instruction and the player did the opposite. For example, the narrator says "go right" and the player goes left past a threshold. This is defined in data with a success condition and a failure condition.
  - `spam:<event>`: an event fired X times in Y seconds, e.g. flapping too much.
- Text box: storybook style, bottom of the screen, typewriter reveal with a soft blip (emit `narrator:blip` for the audio system), a large readable font, and automatic advance timed to reading speed. Pressing E or Enter skips the reveal. Lines queue, and a higher-priority line can interrupt a lower one.
- **Corrections (resets):** when `correction:triggered` fires, the narrator says a correction line (per zone via a `lineId`/key prop, or the common pool). It plays a "rewrite" visual: the screen gets a page-scribble or rewind effect, Sammy goes back to the last checkpoint, and it unscribbles. Input is locked during the effect. There is **never** death or hurt framing.
- `window.__sammy.narrator` reports `{current, queueLength, seenIds}`.
- Write **real, funny lines** in the approved voice for: common correction lines (at least 6), idling (at least 3 escalating), flap spam (at least 3), and pressing E on nothing (at least 3). Level-specific lines come in T-011.
