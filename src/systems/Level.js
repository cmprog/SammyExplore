// A loaded level: its terrain, zones, spawned entities, and mechanism registry. Owns their lifetime.
export class Level
{
    constructor({ id, name, timeOfDay, size, terrain, zones, entities, mechanisms })
    {
        this.id = id;
        this.name = name;
        this.timeOfDay = timeOfDay;
        this.size = size;          // in tiles (world units)
        this.terrain = terrain;
        this.zones = zones;
        this.entities = entities;
        this.mechanisms = mechanisms;   // systems/Mechanisms.js
    }

    destroy()
    {
        this.mechanisms?.destroy();
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
