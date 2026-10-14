# T-015 Companion following

**Goal:** A rescued cat can be chosen as Sammy's companion. She follows him through levels, waits where she can't follow, and Sammy helps her through with mechanisms (T-014).
**Twyx is the first companion. Follow the special-care rules in `docs/story/premise.md`.** Following her person is who Twyx is, so make it feel loving: she trots after Sammy, looks back for him, and is happy to catch up. She is never lost or left behind for good.

## Acceptance criteria
- **Choosing:** in the bedroom, pressing E on a cat asks her to come along, and she becomes the companion. Pressing E on the current companion lets her stay and roam the base again. One companion at a time.
  - Event `companion:join {cat}` / `companion:leave {cat}`.
  - The current companion is stored in the save, which needs a **schema bump to v2** with a migration from v1, since v1 saves now exist on the live site.
- **Following:**
  - The companion follows Sammy's recent ground path (a breadcrumb trail), keeping a comfortable distance of about 1.5-3 tiles.
  - She can walk, hop up about 1-2 tiles, jump small gaps of about 2 tiles, and drop down. She **cannot fly or glide**, and she is never blocked by Sammy himself.
  - Put the limits in `src/data/tuning.js` (`COMPANION`).
  - Use the existing collision helpers. The LittleJS PathFinder plugin is available if useful.
- **Waiting:** when the trail needs something she can't do (a wide gap, a tall ledge, a closed gate), she stops at the edge, sits, looks toward Sammy, and gives a little "mrrp?". Event `companion:waiting {cat, reason}`.
  - When the way opens (a bridge lowers, a gate opens, a lift arrives), she continues on her own and catches up. Event `companion:caughtUp {cat}`.
  - Nothing ever makes her disappear.
- **Never stranded:**
  - On a correction reset she appears beside Sammy at the respawn point, entering in a friendly way (she trots in, not a pop).
  - On any level transition (portal, exit, Continue) she arrives with Sammy.
  - If she is far behind with no path and Sammy has reached a checkpoint, she catches up there, with a narrator-friendly reason (T-019 writes the lines).
- **Debug:** `__sammy.companion` reports `{cat, state: following|waiting|catchingUp|idle, pos, reason}`.
- The roaming cats in the bedroom wander gently between spots when they aren't the companion. Twyx can roam.
- Add `tools/playtest/companion_scenario.py`, using the test level's mechanisms (from T-014) or a small dedicated test level. It checks:
  - she follows across walkable ground and small hops
  - she waits at a gap and a gate, and continues after the lever
  - she reappears beside Sammy after a correction
  - she comes along on a level change

## Event contract
Use only events listed in `docs/EVENTS.md`. Add new events to it in the same change.

## Notes from T-014 (mechanisms)
- To ride lifts, stand on bridges, and be blocked by gates, cats need `mass > 0` and `setCollision(true, false, true)`, the same as Sammy. Twyx currently has no physics.
- A lift waits rather than squash someone in its path (`lift:held`). **The companion must never idle or wait under or inside a lift's path.** Pick her waiting spot so she can't lock a lift.
- Use the shared `objectsStandingOn(surface)` helper and the side-effect-free collision predicates in `terrainCollision.js`.
- Mechanism truth rule: a target's actual state is the truth, and levers re-sync from their targets.
