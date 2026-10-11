// Tuning constants (movement, camera, flaps, timings) live here so feel can be adjusted
// without touching system code. Filled in by T-003 / T-004 and later tasks.
export const TUNING_VERSION = 1;

// Narrator text box: reveal speed and how long a line stays up. Reading speed is aimed at a
// 9-year-old reading on their own, so holds are generous.
export const NARRATOR = {
    CHARS_PER_SECOND: 40,      // typewriter reveal speed
    HOLD_BASE: 1.6,            // seconds a fully revealed line stays up...
    HOLD_PER_WORD: 0.33,       // ...plus this per word
    MIN_SHOW_BEFORE_SKIP: 0.2, // a press this soon after a line starts is the same press that caused it
    EASE_IN: 0.22,             // box slide/fade in
    EASE_OUT: 0.18,            // box slide/fade out
    GAP_BETWEEN_LINES: 0.25,   // breath between queued lines
    QUEUE_MAX: 3,              // older low-priority lines are dropped beyond this
    QUEUE_STALE: 8,            // seconds a queued reaction stays relevant
    DEFAULT_PRIORITY: 10,
    DEFAULT_SPAM: { count: 6, seconds: 3 },
};

// Correction ("rewrite the page") sequence timings, in seconds. The reset happens at the
// end of SCRIBBLE_IN, while the page is fully covered.
export const CORRECTION = {
    SCRIBBLE_IN: 0.75,
    HOLD: 0.35,
    SCRIBBLE_OUT: 0.8,
};
