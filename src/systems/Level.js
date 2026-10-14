// A loaded level: its terrain, zones, and spawned entities. Owns their lifetime.
// `environment` names its surroundings (data/environments.js); `timeOfDay` is set outdoors,
// `room` (the world-space layout from systems/roomLayout.js) indoors.
export class Level
{
    constructor({ id, name, environment, timeOfDay, room = null, size, terrain, zones, entities })
    {
        this.id = id;
        this.name = name;
        this.environment = environment;
        this.timeOfDay = timeOfDay;
        this.room = room;
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
            environment: this.environment,
            timeOfDay: this.timeOfDay,
            reserved: this.room?.reserved ?? [],
            size: { x: this.size.x, y: this.size.y },
            entityCount: this.entities.length,
            ...this.zones.debugState(),
        };
    }
}
