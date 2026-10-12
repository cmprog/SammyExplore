// Level zones: rectangles that react when the tracked body (the player) enters them.
// Everything is edge-triggered (fires on entering, re-arms on leaving) so standing in a zone
// doesn't spam the bus. Checkpoints and exits additionally fire only once per level load.
import { vec2 } from '../../lib/littlejs/littlejs.esm.js';
import { emit } from '../core/events.js';

export const ZONE_TYPES = ['spawn', 'checkpoint', 'correction', 'narration', 'exit'];

/** Implicit correction zone under the whole level, so falling off the world never strands anyone. */
export const FALL_ZONE_ID = 'world-bottom';
const FALL_ZONE_WIDTH_PAD = 1000;
const FALL_ZONE_DEPTH = 1000;

export class Zones
{
    /**
     * @param {string} levelId
     * @param {Array<{type:string, id:string, pos:Vector2, size:Vector2, props:object}>} zones - world space
     * @param {Vector2} levelSize
     * @param {number} fallMargin - how far below y = 0 the fall zone starts
     */
    constructor(levelId, zones, levelSize, fallMargin)
    {
        this.levelId = levelId;
        this.zones = zones.map(zone => ({ ...zone, inside: false, fired: false }));
        this.zones.push({
            type: 'correction',
            id: FALL_ZONE_ID,
            pos: vec2(levelSize.x / 2, -fallMargin - FALL_ZONE_DEPTH / 2),
            size: vec2(levelSize.x + FALL_ZONE_WIDTH_PAD * 2, FALL_ZONE_DEPTH),
            props: { reason: 'fellOffWorld', implicit: true },
            inside: false,
            fired: false,
        });

        const spawn = this.zones.find(zone => zone.type === 'spawn');
        /** Where Sammy starts, and where a correction puts Sammy back until a checkpoint is reached. */
        this.spawnPoint = standingPoint(spawn);
        this.respawnPoint = this.spawnPoint.copy();
        this.checkpointId = null;
    }

    /** Resume at a checkpoint reached in an earlier session: it becomes the respawn point, and it
     *  and every id in `reached` won't fire (or autosave) again this load, so walking back past an
     *  earlier checkpoint can't move the respawn backwards. Returns false if `id` doesn't exist. */
    restoreCheckpoint(id, reached = [])
    {
        for (const z of this.zones)
            if (z.type === 'checkpoint' && (z.id === id || reached.includes(z.id)))
                z.fired = true;
        const zone = this.zones.find(z => z.type === 'checkpoint' && z.id === id);
        if (!zone)
            return false;
        this.checkpointId = zone.id;
        this.respawnPoint = standingPoint(zone);
        return true;
    }

    /** After a correction finishes: forget which correction zones the body is inside, so one it is
     *  still in fires again. A correction:triggered that arrives while another correction runs is
     *  ignored by the narrator, and an edge-triggered zone would otherwise never fire again
     *  (e.g. falling off the world a second time mid-correction meant falling forever). */
    rearmCorrections()
    {
        for (const zone of this.zones)
            if (zone.type === 'correction')
                zone.inside = false;
    }

    /** Check the tracked body (an axis-aligned box) against every zone. */
    update(pos, size)
    {
        // Test everything first, then emit: a listener (e.g. a correction) may move the body,
        // and the remaining zones must not be tested against a position from mid-loop.
        const entered = [];
        for (const zone of this.zones)
        {
            const inside = overlaps(zone, pos, size);
            if (inside && !zone.inside)
                entered.push(zone);
            zone.inside = inside;
        }
        entered.forEach(zone => this.enter(zone));
    }

    enter(zone)
    {
        const { levelId } = this;
        switch (zone.type)
        {
            case 'checkpoint':
                if (zone.fired)
                    return;
                zone.fired = true;
                this.checkpointId = zone.id;
                this.respawnPoint = standingPoint(zone);
                emit('checkpoint:reached', { id: zone.id, levelId, pos: plain(this.respawnPoint) });
                return;
            case 'correction':
                emit('correction:triggered', { ...zone.props, id: zone.id, levelId });
                return;
            case 'narration':
                emit('narration:zone', { ...zone.props, id: zone.id, levelId });
                return;
            case 'exit':
                if (zone.fired)
                    return;
                zone.fired = true;
                emit('level:complete', { ...zone.props, id: zone.id, levelId });
                return;
            // 'spawn' only marks a position.
        }
    }

    /** Plain-data view for the debug hook. */
    debugState()
    {
        return {
            spawn: plain(this.spawnPoint),
            respawn: plain(this.respawnPoint),
            checkpointId: this.checkpointId,
            zones: this.zones.map(zone => ({
                type: zone.type,
                id: zone.id,
                pos: plain(zone.pos),
                size: plain(zone.size),
                inside: zone.inside,
                fired: zone.fired,
                props: zone.props,
            })),
        };
    }
}

/** Bottom-center of a zone: where a body should stand when placed there. */
function standingPoint(zone)
{
    return vec2(zone.pos.x, zone.pos.y - zone.size.y / 2);
}

function overlaps(zone, pos, size)
{
    return Math.abs(zone.pos.x - pos.x) * 2 < zone.size.x + size.x
        && Math.abs(zone.pos.y - pos.y) * 2 < zone.size.y + size.y;
}

function plain(v)
{
    return { x: v.x, y: v.y };
}
