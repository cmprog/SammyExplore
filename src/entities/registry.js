// Entity type registry: level data says `{ type: 'door', x, y, ...props }`, this maps the type
// to a factory. New entity kinds (doors, signs, cats) add one line to ENTITY_FACTORIES.
//
// A factory receives (pos, props, context):
//   pos     - world-space center of the tile cell the entity was placed on
//   props   - everything in the entity entry except type/x/y
//   context - { levelId, levelSize }
// and returns the created object (usually an EngineObject) so the level can destroy it on unload.
const ENTITY_FACTORIES = {
    // door: (pos, props) => new Door(pos, props),   // T-007
};

const factories = new Map(Object.entries(ENTITY_FACTORIES));

/** Add or replace a factory at runtime (debug tools and tests use this). */
export function registerEntityType(type, factory)
{
    factories.set(type, factory);
}

export function entityTypes()
{
    return [...factories.keys()];
}

/** Create one entity, or return null (with a warning) if the type is unknown. */
export function spawnEntity(type, pos, props, context)
{
    const factory = factories.get(type);
    if (!factory)
    {
        console.warn(`level "${context.levelId}": unknown entity type "${type}", skipped`);
        return null;
    }
    return factory(pos, props, context) ?? null;
}
