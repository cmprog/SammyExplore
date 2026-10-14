// Room colors for indoor environments (environments.js names one by `palette`). These are the
// colors in full daylight: room lighting (dayCycle.js `ambient`) darkens and tints them, so
// they are kept bright and clean here. Floor tile colors live in tilePalettes.js.
import { rgb } from 'littlejs';

export const ROOM_PALETTES = {
    bedroom: {
        outline:       rgb(.38, .20, .32),   // soft plum ink around everything
        shadow:        rgb(.30, .10, .28, .22),

        // Wall
        wall:          rgb(.98, .78, .85),
        wallPattern:   rgb(.95, .66, .77),
        wallSparkle:   rgb(1, .90, .94),
        wallShade:     rgb(.62, .26, .46, .30),  // corners and under the trim
        wainscot:      rgb(.93, .56, .70),
        wainscotLight: rgb(.97, .68, .79),
        wainscotDark:  rgb(.84, .45, .60),
        trim:          rgb(1, .96, .95),
        trimShade:     rgb(.90, .80, .84),

        // Painted furniture (desk, shelves, dresser, cubby)
        paint:         rgb(1, .97, .96),
        paintShade:    rgb(.91, .84, .88),
        paintLight:    rgb(1, 1, 1),
        accent:        rgb(.99, .58, .72),   // knobs, edge bands
        accentDark:    rgb(.86, .40, .58),
        back:          rgb(.86, .63, .80),   // inside the bookshelf and cubbies
        backDark:      rgb(.74, .50, .70),
        bracket:       rgb(.66, .52, .86),

        // Wood (toy chest, desk legs)
        wood:          rgb(.80, .55, .33),
        woodLight:     rgb(.92, .70, .45),
        woodDark:      rgb(.58, .36, .22),
        metal:         rgb(.70, .72, .80),
        metalDark:     rgb(.42, .44, .54),

        // Bed
        bedFrame:      rgb(.80, .70, .98),
        bedFrameLight: rgb(.90, .84, 1),
        bedFrameDark:  rgb(.63, .52, .86),
        mattress:      rgb(1, .98, .97),
        quilt:         [rgb(1, .66, .80), rgb(.80, .72, 1), rgb(.66, .92, .84), rgb(1, .90, .66)],
        quiltBase:     rgb(.96, .58, .76),
        quiltShade:    rgb(.82, .42, .62),
        pillow:        rgb(1, 1, 1),
        pillowShade:   rgb(.88, .86, .96),

        // Window
        frame:         rgb(1, .98, .98),
        frameShade:    rgb(.88, .82, .88),
        glassSheen:    rgb(1, 1, 1, .12),
        curtain:       rgb(.84, .76, 1),
        curtainLight:  rgb(.92, .87, 1),
        curtainDark:   rgb(.68, .58, .90),
        curtainHeart:  rgb(1, .72, .86),
        tie:           rgb(1, .55, .72),

        // Toys and decor
        bricks:        [rgb(.96, .30, .36), rgb(1, .80, .25), rgb(.30, .60, .96), rgb(.36, .80, .44), rgb(1, .56, .78), rgb(.98, .97, .95)],
        books:         [rgb(.96, .42, .55), rgb(.55, .48, .90), rgb(.38, .78, .74), rgb(1, .78, .36), rgb(.98, .60, .40), rgb(.62, .82, .40), rgb(.80, .56, .92)],
        paper:         rgb(1, .98, .92),
        tape:          [rgb(.60, .90, .82, .85), rgb(1, .75, .85, .85), rgb(1, .90, .55, .85)],
        rug:           [rgb(.80, .72, 1), rgb(1, .72, .84), rgb(.70, .92, .86), rgb(1, .96, .90)],
        rugEdge:       rgb(.66, .52, .86),
        flags:         [rgb(1, .55, .70), rgb(.70, .62, 1), rgb(.55, .88, .80), rgb(1, .86, .45)],
        string:        rgb(.55, .40, .55),
        bulbs:         [rgb(1, .86, .50), rgb(1, .66, .78), rgb(.70, .86, 1), rgb(.76, 1, .74)],
        plant:         rgb(.42, .74, .48),
        plantLight:    rgb(.60, .88, .58),
        pot:           rgb(.98, .66, .52),

        // Plushies
        plush: {
            bunny: { body: rgb(1, .98, .97), shade: rgb(.90, .86, .92), inner: rgb(1, .70, .80) },
            bear:  { body: rgb(.78, .56, .40), shade: rgb(.64, .44, .30), inner: rgb(.96, .82, .66) },
            cat:   { body: rgb(.24, .23, .30), shade: rgb(.16, .15, .22), inner: rgb(.98, .97, 1) },
            frog:  { body: rgb(.52, .86, .50), shade: rgb(.38, .70, .40), inner: rgb(.90, 1, .80) },
            jelly: { body: rgb(.98, .62, .82), shade: rgb(.86, .46, .68), inner: rgb(1, .86, .94) },
        },
        face:          rgb(.20, .10, .18),
        blush:         rgb(1, .45, .60, .55),

        // Storage bins in the cubby (pixel patterns, see roomPixelArt.js)
        bins: {
            grass:   { top: rgb(.44, .80, .36), side: rgb(.62, .42, .28), speck: rgb(.50, .33, .22), topSpeck: rgb(.34, .66, .28) },
            gem:     { top: rgb(.55, .90, .96), side: rgb(.40, .74, .88), speck: rgb(.80, 1, 1), topSpeck: rgb(.30, .62, .80) },
            heart:   { top: rgb(1, .70, .82), side: rgb(1, .58, .74), speck: rgb(1, .88, .92), topSpeck: rgb(.92, .44, .62) },
            star:    { top: rgb(1, .92, .55), side: rgb(1, .84, .42), speck: rgb(1, 1, .85), topSpeck: rgb(.96, .70, .30) },
        },

        // Outside the window: the neighbor's house and the garden fence (the sky, hills and trees
        // use the outdoor backdrop palettes, palettes.js)
        view: {
            night: { houseWall: rgb(.42, .36, .62), houseShade: rgb(.32, .27, .50), roof: rgb(.36, .22, .44),
                houseWindow: rgb(1, .86, .50), windowGlow: rgb(1, .80, .45, .45), door: rgb(.26, .20, .38),
                fence: rgb(.36, .34, .58), fenceShade: rgb(.24, .22, .42) },
            day: { houseWall: rgb(1, .94, .84), houseShade: rgb(.90, .80, .72), roof: rgb(.94, .48, .44),
                houseWindow: rgb(.70, .88, 1), windowGlow: rgb(1, 1, 1, 0), door: rgb(.62, .42, .30),
                fence: rgb(1, 1, 1), fenceShade: rgb(.82, .84, .90) },
        },

        // The nightlight (a little mushroom that plugs into the wall)
        nightlight: {
            plate:     rgb(1, .98, .97),
            plateShade:rgb(.86, .82, .88),
            stem:      rgb(1, .95, .86),
            stemShade: rgb(.90, .80, .72),
            capOff:    rgb(.96, .52, .62),
            capOn:     rgb(1, .78, .62),
            dotOff:    rgb(1, .92, .92),
            dotOn:     rgb(1, 1, .92),
            glow:      rgb(1, .82, .50),
        },
    },
};
