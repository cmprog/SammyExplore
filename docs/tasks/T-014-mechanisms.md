# T-014 Mechanisms: levers and what they move

**Goal:** Generic, data-wired level mechanisms. Sammy uses them to help a companion cat past places she can't go (T-015). Sammy can fly and the cat can't, so mechanisms mostly make paths walkable for her.

## Acceptance criteria
- **Lever** entity (`src/entities/Lever.js` plus art): an interactable that E toggles between on and off, with a satisfying throw animation and sound.
  - Props: `id`, `targets: [ids]`, `startsOn`, and `oneWay` (a lever that stays on once thrown).
  - It emits `mechanism:toggle {id, on, targets}`.
- **Targets** are entities that respond when a lever (or any trigger, such as a T-016 cat spot) activates them. They go through one small activation API, so later triggers can drive them too: they subscribe via the bus, or via a shared `Mechanisms` registry keyed by id. Your design; document it.
  - **Bridge:** a drawbridge or plank that lowers to span a gap and is solid when down. Animated.
  - **Gate:** a solid barrier (a toy-block wall or baby gate) that opens or slides away.
  - **Lift:** a platform that moves between two points when active. It can be toggled, or loop while on.
  - All targets are real collision for both Sammy and cats, using the existing solid-object approach the doors use. Validate props, and fail loudly for unknown target ids.
- **Visual language:** mechanisms read as toys and kid-made contraptions (Lego, wooden blocks, string and spools) so they fit both the bedroom and outdoor chapters. Use a palette per environment where cheap.
- **Sounds:** lever throw, bridge lowering, gate opening, lift humming. Add them to `src/data/sounds.js` and map them to events.
- **Save:** mechanism state does not persist across level loads for now. Document that.
- **Debug:** `__sammy.mechanisms` lists each mechanism's state, and `__sammy.commands.activate(id, on)` sets one.
- Put one of each (a lever + bridge, a lever + gate, and a lever + lift) in the `test` level, and keep the existing scenarios passing.
- Add `tools/playtest/mechanism_scenario.py`, which uses real E presses to check that each target changes state, its collision changes, and Sammy can stand on or pass through it as expected.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add `mechanism:toggle` and any other new event to it in the same change.
