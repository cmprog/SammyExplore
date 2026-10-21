// Pixel art for the room: poster pictures and wallpaper motifs. Each picture is rows of
// characters (top row first); '.' is empty and every other character names a color in `colors`.
// Blocky on purpose: the kid's room is full of things from blocky pixel-art games, but nothing
// here is a logo or a character from one.
import { rgb } from 'littlejs';

export const POSTERS = {
    // A tuxedo cat, green eyes: someone in this room loves Twyx.
    cat: {
        paper: rgb(.80, .96, .90),
        colors: { B: rgb(.20, .19, .26), P: rgb(1, .62, .74), G: rgb(.55, .86, .30), K: rgb(.07, .07, .10), W: rgb(.98, .97, 1), N: rgb(1, .52, .66) },
        rows: [
            'B..........B',
            'BB........BB',
            'BPB......BPB',
            'BBBBBBBBBBBB',
            'BBBBBBBBBBBB',
            'BGGBBBBBBGGB',
            'BGKBBBBBBGKB',
            'BBBBBWWBBBBB',
            'BBBBWNNWBBBB',
            '.BBWWWWWWBB.',
            '..BBWWWWBB..',
            '...BBBBBB...',
        ],
    },
    heart: {
        paper: rgb(.90, .86, 1),
        colors: { R: rgb(.96, .34, .52), L: rgb(1, .74, .82), D: rgb(.80, .22, .42) },
        rows: [
            '.RR...RR.',
            'RLRR.RRRR',
            'RLRRRRRRR',
            'RRRRRRRRD',
            '.RRRRRRD.',
            '..RRRRD..',
            '...RRD...',
            '....D....',
        ],
    },
    gem: {
        paper: rgb(1, .88, .92),
        colors: { L: rgb(.16, .45, .55), C: rgb(.45, .88, .94), D: rgb(.26, .66, .80), W: rgb(1, 1, 1) },
        rows: [
            '...LLL...',
            '..LCCCL..',
            '.LCWCCDL.',
            'LCWCCCCDL',
            'LCCCCCDDL',
            '.LCCCDDL.',
            '..LCDDL..',
            '...LDL...',
            '....L....',
        ],
    },
    // A blocky little world: square sun, square cloud, square tree, grass blocks.
    landscape: {
        paper: rgb(1, .97, .88),
        colors: {
            S: rgb(.62, .84, 1), Y: rgb(1, .86, .30), W: rgb(1, 1, 1), L: rgb(.34, .70, .36),
            T: rgb(.58, .40, .26), G: rgb(.44, .80, .36), D: rgb(.66, .46, .30), d: rgb(.52, .35, .24),
        },
        rows: [
            'SSSSSSSSSSSS',
            'SYYSSSSSWWSS',
            'SYYSSSSWWWWS',
            'SSSSSSSSSSSS',
            'SSSSSSSLLLSS',
            'SSSSSSLLLLLS',
            'SSSSSSLLLLLS',
            'SSSSSSSSTSSS',
            'GGGGGGGGTGGG',
            'DDdDDDDDDdDD',
            'DDDDdDDDDDDd',
        ],
    },
};

/** Little motifs repeated across the wallpaper and the curtains (one color, 'X' = filled). */
export const MOTIFS = {
    heart: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
    sparkle: ['.X.', 'XXX', '.X.'],
};
