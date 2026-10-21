# M2 check-in agenda (PM working notes)

## Needs your eyes
- Mechanism look: a wooden-ruler drawbridge, a toy-brick gate, a balloon lift with a wind-up key, and a wooden-block lever with a big red ball. Is this the direction you want?
- Comfort practice target (draft): a jittery wind-up toy mouse blocking a tunnel.
- Practice-course reward (draft): a placeholder sparkle or toy, standing in for future hats.

## Requirements questions
- Bedroom day/night: where should the clock start when Sammy arrives (a fixed time, the real-world time, or wherever it was last time)? How long should day and night each last within the ~5 min cycle? (Placeholder for now: starts in the morning, day and night roughly equal.)
- Bedroom decor (blocky "Minecraft-style" without copying): grass-block-pattern bins, pixel heart and gem posters, brick builds, blocky plushies (including a tuxedo-cat plush and poster as a nod to Twyx). Is that the right line?
- The nightlight is a little mushroom by the bed that "wakes up" at dusk. Should it sit nearer where Sammy arrives?

- Picking a companion: you can only ask a cat along in the bedroom (the home base). In Chapter One, E on Twyx is still just a pet. OK?
- Saves from before companions (M1 players) continue with no cat along, even if they met Twyx. OK?

- Replaying Chapter One with Twyx along: Chapter One is where Sammy *meets* Twyx. If she's already following him, should the "meeting" lines be skipped (she's just with him), should she wait at her usual spot anyway, or something else?

- Portal look: a slate-stone block frame with a gem keystone, a swirl in the chapter's color (Chapter One is moonlit aqua), and a wooden sign above. Colors OK?
- When Sammy arrives in the bedroom, the portal shows the newest unlocked chapter. OK?

- Cat spot look: a plump blue velvet cushion with a paw print and soft sparkles (doesn't hint which cat). OK?
- Comfort target (draft): a frazzled grey-lavender felt wind-up mouse in a tunnel. After Twyx comforts it, it scoots to the far end and sits contentedly. Keep it?
- When a cat-spot errand gets called off (Sammy wanders far away), Twyx just comes back to him. OK?

- Practice course reward (placeholder): a plush "toy star" with a face that pops into sparkles and confetti. Right placeholder look for future hats?
- Should found collectibles be remembered between visits? Right now the star (and the course) resets every time you return to the bedroom.
- The checkpoint past the course bridge autosaves, so Continue can resume up on the toy cubby instead of by the portal. OK, or should Continue always start at the bedroom's arrival spot?
- To let Twyx reach the course, the dresser got brick steps and the bed's headboard is lower. OK?

## Decisions PM made (FYI)
- A lever is the single source of truth for whether its targets start on or off.
- Bridges refuse to raise while anyone is standing on them (the lift does the same). A companion cat can never be dropped.
- GitHub Pages now deploys only the game files via Actions (switch Settings → Pages → Source to "GitHub Actions").
- Finishing any chapter returns to the bedroom (replaces "To be continued..."). Returning M1 players who already finished Chapter One continue in the bedroom.
- Entering a chapter through the portal autosaves at that chapter's start.
- E prefers levers, portals and signs over the companion cat, so a kid never accidentally sends Twyx home.
- While a cat ability plays, the camera gently zooms in so the moment reads at normal play size.
