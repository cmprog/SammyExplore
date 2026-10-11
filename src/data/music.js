// Music tracks in ZzFXM format: [instruments, patterns, sequence, bpm].
//
// ZzFXM quick reference (LittleJS 1.18.29 renderer):
//  - Each pattern is a list of channels: [instrumentIndex, pan(-1..1), ...rows].
//    Every channel in a pattern must have the same number of rows.
//  - A row is a note number: 12 = the instrument's base frequency, +1 per semitone.
//    0 = keep ringing, negative = cut. A fractional part lowers volume (x.4 = 60% loud).
//  - One row lasts a quarter of a "beat", so bpm 36 gives eighth notes at 72 quarter notes/min.
//  - Instruments are ZzFX arrays; randomness must be 0 or the notes drift out of tune.

// "Owl Lullaby": a slow 3/4 music-box tune in C major, 16 bars (about 40 s), loops cleanly.
// Rows are eighth notes, six per bar.

// Instruments
const MUSIC_BOX = [.5, 0, 440, .002, .04, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .35, .18];   // melody
const HARP      = [.45, 0, 220, .004, .08, .7, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .25, .15, 0, -1600];
const SOFT_BASS = [.6, 0, 110, .04, .5, 1.2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, .6, .2, 0, -700];

// Note numbers relative to each instrument's base (12 = base):
// melody (A4 base): C5=15 D5=17 E5=19 F5=20 G5=22 A5=24 B5=26 C6=27 D6=29
// harp (A3 base):   G3=10 A3=12 B3=14 C4=15 D4=17 E4=19 F4=20 G4=22
// bass (A2 base):   F2=8  G2=10 A2=12 C3=15 D3=17

const ARP_SOFTNESS = .45;   // harp sits well under the melody

// Broken chord across beats 2-3: rest on the downbeat (the bass has it), then up and back.
function arp(low, mid, high)
{
    return [0, low, mid, high, mid, low].map(n => n ? n + ARP_SOFTNESS : 0);
}

const bar = (root) => [root, 0, 0, 0, 0, 0];

const MELODY_A = [
    19, 0, 0, 17, 15, 0,     // C   E . . D C .
    19, 0, 0, 22, 24, 0,     // Am  E . . G A .
    24, 0, 22, 0, 20, 0,     // F   A . G . F .
    17, 0, 0, 0, 0, 0,       // G   D . . . . .
    19, 0, 0, 17, 15, 0,     // C   E . . D C .
    19, 0, 22, 0, 27, 0,     // Am  E . G . C .
    29, 0, 27, 0, 26, 0,     // Dm G  D . C . B .
    27, 0, 0, 0, 0, 0,       // C   C . . . . .
];
const MELODY_B = [
    24, 0, 0, 22, 20, 0,     // F   A . . G F .
    22, 0, 0, 19, 15, 0,     // C   G . . E C .
    20, 0, 24, 0, 27, 0,     // F   F . A . C .
    29, 0, 0, 27, 26, 0,     // G   D . . C B .
    27, 0, 0, 24, 19, 0,     // Am  C . . A E .
    20, 0, 0, 19, 17, 0,     // F   F . . E D .
    22, 0, 0, 20, 17, 0,     // G7  G . . F D .
    15, 0, 0, 0, 0, 0,       // C   C . . . . .
];

const C = arp(15, 19, 22), AM = arp(12, 15, 19), F = arp(12, 15, 20), G = arp(10, 14, 17);
const DM_G = [0, 12 + ARP_SOFTNESS, 17 + ARP_SOFTNESS, 14 + ARP_SOFTNESS, 17 + ARP_SOFTNESS, 14 + ARP_SOFTNESS];

const HARP_A = [...C, ...AM, ...F, ...G, ...C, ...AM, ...DM_G, ...C];
const HARP_B = [...F, ...C, ...F, ...G, ...AM, ...F, ...G, ...C];

const BASS_A = [...bar(15), ...bar(12), ...bar(8), ...bar(10), ...bar(15), ...bar(12), 17, 0, 0, 10, 0, 0, ...bar(15)];
const BASS_B = [...bar(8), ...bar(15), ...bar(8), ...bar(10), ...bar(12), ...bar(8), ...bar(10), ...bar(15)];

// Slight stereo spread: melody centre, harp a little right, bass a little left.
const OWL_LULLABY = [
    [MUSIC_BOX, HARP, SOFT_BASS],
    [
        [[0, 0, ...MELODY_A], [1, .3, ...HARP_A], [2, -.2, ...BASS_A]],
        [[0, 0, ...MELODY_B], [1, .3, ...HARP_B], [2, -.2, ...BASS_B]],
    ],
    [0, 1],
    36,
];

export const MUSIC_TRACKS = {
    owlLullaby: OWL_LULLABY,
};

export const DEFAULT_MUSIC_TRACK = 'owlLullaby';
