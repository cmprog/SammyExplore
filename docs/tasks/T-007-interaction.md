# T-007 Interaction system

## Acceptance criteria
- `src/systems/Interaction.js`: interactable entities register an interaction radius. The nearest one in range shows a floating "E" prompt bubble (drawn in code, with a gentle bob). Pressing E calls its `interact()` and emits `interact:<type>` with `{id}`.
- Pressing E with nothing in range emits `interact:nothing` (the narrator has lines for it).
- `src/entities/Door.js`: a cute rounded wooden door with a knob. It can be locked or unlocked, which is data-driven. An unlocked door animates open and either becomes passable or acts as a level exit, depending on its props. A locked door emits `interact:doorLocked`.
- `src/entities/Sign.js`: a signpost. Interacting with it emits an event carrying the sign's narration key, so the narrator can "read" it, or refuse to.
- Both are placeable from level data.
