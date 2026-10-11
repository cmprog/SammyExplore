# T-004 Sammy controller

## Acceptance criteria
- `src/entities/Sammy.js` (extends `EngineObject`). All movement numbers live in `src/data/tuning.js`.
- Run with acceleration and friction. Jump on Space, with variable height (releasing early cuts the jump), coyote time (~0.1s), and jump buffering (~0.1s).
- **Flap:** pressing Space while airborne, after the jump, uses one flap charge for an upward burst. Charges max out at about 3 (tunable). They refill on landing, and also refill slowly over time while airborne. There's a brief cooldown between flaps so mashing doesn't make Sammy shoot upward. Tune it so it feels good and floaty-owly, but don't let it trivialize levels. The stakeholder will give feedback on the tuning.
- **Glide:** holding Space while falling caps fall speed and slightly boosts air control.
- Movement states: `idle`, `run`, `jump`, `fall`, `glide`, `flap`, `land`. The controller emits events: `player:jump`, `player:flap`, `player:glideStart`, `player:land`, `player:flapEmpty` (tried to flap with no charges left), and `player:glideEnd` on **any** exit from glide. `player:land` carries `{impact}` (0..1).
- Sammy has a `resetTo(pos)` method. On `correction:reset` (emitted by the Narrator midway through its rewrite effect), Sammy moves to the last checkpoint, or to spawn if none. While a correction runs, input is locked by the Narrator. Emit `player:glideEnd` if Sammy was gliding.
- `window.__sammy.player` reports `{pos, vel, state, grounded, flapCharges, facing}`.
- Uses a temporary placeholder drawing (a circle). T-005 adds the real art.

## Event contract
Use only events listed in `docs/EVENTS.md`. Add any new event to it in the same change.
