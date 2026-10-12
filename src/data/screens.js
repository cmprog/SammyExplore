// Text shown on the menu screens (title, pause, level complete). Kept as data so wording can
// change without touching the scenes.
export const TITLE_TEXT = {
    title: 'Sammy Explore',
    newGame: 'New Game',
    continue: 'Continue',
    confirmOverwrite: 'This will start a brand-new story. Your old one will be... forgotten. Sure?',
    yes: 'Yes',
    no: 'No',
    // Shown on the title when a level couldn't be loaded (e.g. a save pointing at a missing level).
    loadFailed: "Oh dear, that page of the story has gone missing! Back to the cover we go.",
};

export const PAUSE_TEXT = {
    heading: 'Paused',
    resume: 'Resume',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',
    volume: 'Volume',
    quit: 'Quit to Title',
};

export const LEVEL_COMPLETE_TEXT = {
    banner: 'Level Complete!',
    prompt: 'Press Space or click to continue',
    toBeContinued: 'To be continued...',
};

export const SAVE_TEXT = {
    saved: 'Saved',
};
