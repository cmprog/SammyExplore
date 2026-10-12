// Sky and backdrop colors per time of day, picked by the level's `timeOfDay`.
// Terrain colors live in tilePalettes.js; the two are tuned together so the playable ground
// always reads brighter and warmer than the scenery behind it.
// Layers fade toward the horizon color the farther away they are (atmospheric depth).
import { rgb } from 'littlejs';

export const BACKDROP_PALETTES = {
    night: {
        skyTop:         rgb(.04, .04, .14),
        skyMid:         rgb(.11, .10, .30),
        skyHorizon:     rgb(.33, .25, .50),
        star:           rgb(1, .97, .88),
        starCool:       rgb(.78, .84, 1),
        moon:           rgb(1, .96, .84),
        moonShade:      rgb(.90, .84, .74),
        moonCrater:     rgb(.86, .79, .70),
        moonCraterRim:  rgb(1, .99, .93),
        moonHalo:       rgb(.78, .76, 1),
        ridgeFar:       rgb(.24, .20, .44),
        ridgeFarRim:    rgb(.36, .31, .58),
        hills:          rgb(.16, .14, .35),
        hillsRim:       rgb(.30, .27, .55),
        trees:          rgb(.10, .10, .26),
        treesRim:       rgb(.21, .21, .44),
        treesDetail:    rgb(.13, .13, .31),
        trunk:          rgb(.08, .07, .20),
        bushes:         rgb(.06, .10, .20),
        bushesRim:      rgb(.13, .23, .36),
        bushesDetail:   rgb(.08, .13, .24),
        mist:           rgb(.36, .29, .56),
        firefly:        rgb(1, .96, .55),
        fireflyGlow:    rgb(.85, 1, .45),
    },
    day: {
        skyTop:         rgb(.30, .58, .93),
        skyMid:         rgb(.52, .77, .98),
        skyHorizon:     rgb(.88, .95, .98),
        sun:            rgb(1, .93, .52),
        sunCore:        rgb(1, .99, .82),
        sunRim:         rgb(1, .80, .36),
        sunHalo:        rgb(1, .92, .62),
        cloud:          rgb(1, 1, 1),
        cloudShade:     rgb(.84, .90, .99),
        cloudOutline:   rgb(.70, .80, .95),
        ridgeFar:       rgb(.62, .78, .88),
        ridgeFarRim:    rgb(.78, .89, .95),
        hills:          rgb(.50, .74, .66),
        hillsRim:       rgb(.68, .87, .76),
        trees:          rgb(.30, .58, .46),
        treesRim:       rgb(.46, .74, .54),
        treesDetail:    rgb(.36, .65, .50),
        trunk:          rgb(.42, .34, .32),
        bushes:         rgb(.24, .50, .38),
        bushesRim:      rgb(.38, .66, .46),
        bushesDetail:   rgb(.29, .56, .41),
        mist:           rgb(.86, .94, .96),
    },
};

// Sammy the owl (T-005): warm browns, a cream belly and face, amber eyes, orange beak and feet.
// The title screen's original painted owl set this palette; keep the two in the same family.
export const SAMMY_PALETTE = {
    outline:     rgb(.16, .10, .20),
    body:        rgb(.56, .36, .24),
    bodyShade:   rgb(.43, .26, .18),
    bodyLight:   rgb(.70, .49, .33),
    rim:         rgb(.86, .72, .62),     // moonlight on the top edge, so Sammy pops off the night sky
    wing:        rgb(.47, .29, .19),
    wingLight:   rgb(.62, .42, .28),
    wingTip:     rgb(.38, .23, .16),
    belly:       rgb(.93, .82, .66),
    bellyMark:   rgb(.62, .44, .30),
    face:        rgb(.97, .90, .78),
    brow:        rgb(.43, .26, .18),
    eyeWhite:    rgb(1, .99, .95),
    iris:        rgb(.99, .72, .22),
    pupil:       rgb(.13, .08, .16),
    shine:       rgb(1, 1, 1),
    beak:        rgb(.98, .66, .23),
    beakShade:   rgb(.86, .48, .16),
    feet:        rgb(.98, .66, .23),
    cheek:       rgb(1, .52, .60, .45),
    shadow:      rgb(.02, .02, .08, .35),
    // Flap feathers above the head
    pipFull:     rgb(1, .93, .70),
    pipFullTip:  rgb(.98, .74, .36),
    pipEmpty:    rgb(.30, .27, .42, .55),
    pipOutline:  rgb(.16, .10, .20),
    // Effects
    feather:     rgb(.70, .49, .33),
    featherAlt:  rgb(.93, .82, .66),
    whoosh:      rgb(1, 1, 1, .5),
    dust:        rgb(.84, .80, .92),
};

// Twyx the tuxedo cat (T-011a): black with a white bib, paws and muzzle, green eyes, pink nose.
// "Black" is a soft charcoal with a cool moonlit rim, so Twyx never vanishes into the night sky;
// the outline is darker than the fur so the silhouette still reads against the darkest sky.
export const TWYX_PALETTE = {
    outline:     rgb(.05, .04, .10),
    fur:         rgb(.20, .19, .26),
    furShade:    rgb(.13, .12, .18),
    furLight:    rgb(.31, .30, .40),
    rim:         rgb(.60, .63, .86),     // moonlight on the top edge
    white:       rgb(.98, .97, 1),
    whiteShade:  rgb(.80, .80, .91),
    earInner:    rgb(.96, .62, .72),
    eyeWhite:    rgb(.95, .98, .86),
    iris:        rgb(.55, .86, .30),
    irisDark:    rgb(.32, .62, .20),
    pupil:       rgb(.06, .06, .10),
    shine:       rgb(1, 1, 1),
    nose:        rgb(1, .56, .70),
    tongue:      rgb(1, .48, .62),
    mouth:       rgb(.30, .22, .30),
    whisker:     rgb(.92, .92, 1, .75),
    cheek:       rgb(1, .52, .66, .5),
    shadow:      rgb(.02, .02, .08, .35),
    // Pet reaction
    heart:       rgb(1, .42, .58),
    heartShine:  rgb(1, .80, .86),
    note:        rgb(1, .93, .62),
};
