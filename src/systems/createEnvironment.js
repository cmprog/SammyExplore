// Builds the surroundings for a level from its environment (data/environments.js): the
// outdoor sky backdrop, or an indoor room. Either result has destroy() and debugState();
// a room also has tick(dt), setTimeOfDay(t), and dayCycleState().
import { ENVIRONMENTS } from '../data/environments.js';
import { Backdrop } from './Backdrop.js';
import { RoomEnvironment } from './RoomEnvironment.js';

export function createEnvironment(level)
{
    const environment = ENVIRONMENTS[level.environment];
    if (environment.kind === 'room')
        return new RoomEnvironment(level, environment);
    return new Backdrop(level.timeOfDay);
}
