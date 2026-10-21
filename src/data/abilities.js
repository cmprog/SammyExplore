// Cat abilities (T-016), used at cat spots (entities/CatSpot.js, systems/CatSpots.js).
// Adding an ability (e.g. Snowy's pull-chain in M3) = an entry here plus one animation on the
// cat who has it (her class's performAbility(animation) and her animator).
//
//   cats       cat ids (data/cats.js) who have it. Any other companion is the "wrong cat".
//   animation  the name her cat class plays (CatBody.performAbility)
//   duration   seconds the cat spends on it at the spot; then she follows Sammy again
//   effectAt   seconds in, the moment it works: ability:used, then the spot's targets are driven.
//              Both come from the animation's own timeline (tuning.js), so they never drift apart.
//   effect     'activate' - targets are set active (on: true). Once they all are, the spot is done.
//              'toggle'   - like a lever: on = !(all targets active), and the spot stays usable
//   soothes    while it plays, targets that can be soothed (Upset.soothe) settle visibly
//   face       'target' (toward the spot's first target beside it), 'left' or 'right'
//   backoff    tiles she stops short of the cushion's middle, away from where she faces (so she
//              nuzzles up to whoever she's helping without hiding their face)
//   sounds     {start, used}: sound names (data/sounds.js) for ability:start / ability:used.
//              The start sound is stopped if the ability is called off (ability:cancel).
import { TWYX_COMFORT } from './tuning.js';

export const ABILITIES = {
    // Twyx: she snuggles close, bunts and grooms whatever is upset until it calms down.
    comfort: {
        id: 'comfort',
        cats: ['twyx'],
        animation: 'comfort',
        duration: TWYX_COMFORT.LENGTH,
        effectAt: TWYX_COMFORT.CURL_FROM,   // it works as she curls up close, content
        effect: 'activate',
        soothes: true,
        face: 'target',
        backoff: 0.25,
        sounds: { start: 'purr', used: 'comfortChime' },
    },
};

/** The entry for an ability id, or null. */
export function abilityDef(id)
{
    return (typeof id === 'string' && ABILITIES[id]) || null;
}

/** Can this cat (a cat id) do this ability? Test cats never can. */
export function catHasAbility(catId, abilityId)
{
    return !!abilityDef(abilityId)?.cats.includes(catId);
}
