// Terrain colors per time of day, picked by the level's `timeOfDay`.
// Kept separate from the backdrop palettes (T-010) so the tile art can be tuned on its own.
import { rgb } from '../../lib/littlejs/littlejs.esm.js';

export const TILE_PALETTES = {
    night: {
        outline:        rgb(.10, .07, .16),
        dirtShadow:     rgb(.25, .16, .25),
        dirt:           rgb(.40, .27, .33),
        dirtAlt:        rgb(.46, .31, .35),
        pebble:         rgb(.31, .20, .28),
        pebbleShine:    rgb(.55, .42, .46),
        grassOutline:   rgb(.07, .19, .19),
        grassDark:      rgb(.17, .42, .36),
        grass:          rgb(.25, .58, .44),
        grassShine:     rgb(.50, .82, .58),
        flowers:        [rgb(1, .72, .86), rgb(.80, .72, 1), rgb(.70, .90, 1)],
        flowerCenter:   rgb(1, .92, .55),
        woodOutline:    rgb(.17, .09, .09),
        wood:           rgb(.60, .39, .27),
        woodShine:      rgb(.78, .56, .38),
        woodGrain:      rgb(.46, .28, .20),
        nail:           rgb(.86, .82, .74),
    },
    day: {
        outline:        rgb(.24, .15, .14),
        dirtShadow:     rgb(.52, .34, .24),
        dirt:           rgb(.71, .49, .33),
        dirtAlt:        rgb(.76, .54, .37),
        pebble:         rgb(.58, .40, .28),
        pebbleShine:    rgb(.88, .72, .56),
        grassOutline:   rgb(.13, .32, .14),
        grassDark:      rgb(.32, .62, .26),
        grass:          rgb(.44, .78, .32),
        grassShine:     rgb(.70, .94, .48),
        flowers:        [rgb(1, .55, .70), rgb(1, .90, .35), rgb(.95, .95, 1)],
        flowerCenter:   rgb(1, .80, .25),
        woodOutline:    rgb(.30, .16, .10),
        wood:           rgb(.80, .56, .34),
        woodShine:      rgb(.95, .74, .48),
        woodGrain:      rgb(.64, .42, .25),
        nail:           rgb(.92, .90, .84),
    },
};
