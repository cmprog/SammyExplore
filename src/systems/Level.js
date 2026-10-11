// A loaded level: its terrain, zones, and spawned entities. Owns their lifetime.
export class Level
{
    constructor({ id, name, timeOfDay, size, terrain, zones, entities })
    {
        this.id = id;
        this.name = name;
        this.timeOfDay = timeOfDay;
        this.size = size;          // in tiles (world units)
        this.terrain = terrain;
        this.zones = zones;
        this.entities = entities;
    }

    destroy()
    {
        for (const entity of this.entities)
            entity.destroy?.();
        this.entities = [];
        this.terrain.destroy();
    }

    /** Plain-data view for window.__sammy.level. */
    debugState()
    {
        return {
            id: this.id,
            name: this.name,
            timeOfDay: this.timeOfDay,
            size: { x: this.size.x, y: this.size.y },
            entityCount: this.entities.length,
            ...this.zones.debugState(),
        };
    }
}
