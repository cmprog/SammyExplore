// The cats (T-015). `id` is the cat's own name key: it is what companion events and the save
// carry ({cat: 'twyx'}), whatever level entity is drawing her. `entityType` is her entry in
// entities/registry.js, used to bring her along into a level that doesn't place her itself.
// Adding a cat: an entry here plus her class (CatBody + art + animator) in the registry.
export const CATS = {
    twyx: { id: 'twyx', name: 'Twyx', entityType: 'twyx' },
};

// Test-only cats, added at runtime by __sammy.commands.addTestCat (e.g. T-016's wrong-cat check).
// They borrow a real cat's entity type for their body and are never saved.
const testCats = {};

/** The entry for a cat id (a real cat or a debug test cat), or null. */
export function catDef(id)
{
    return (typeof id === 'string' && (CATS[id] ?? testCats[id])) || null;
}

/** Every cat entity type in play, real and test, so their E presses can be heard. */
export function catEntityTypes()
{
    return [...new Set([...Object.values(CATS), ...Object.values(testCats)].map(cat => cat.entityType))];
}

/** Debug: a pretend cat with its own id, drawn with `entityType`. Returns false if the id is a real cat. */
export function registerTestCat(id, entityType = 'twyx')
{
    if (typeof id !== 'string' || !id || CATS[id])
        return false;
    testCats[id] = { id, name: id, entityType, test: true };
    return true;
}
