// Stakeholder-defined controls. Keys are KeyboardEvent.code strings (what LittleJS uses).
// Arrow keys are aliases so either hand position works.
export const ACTION_KEYS = {
    left:     ['KeyA', 'ArrowLeft'],
    right:    ['KeyD', 'ArrowRight'],
    up:       ['KeyW', 'ArrowUp'],
    down:     ['KeyS', 'ArrowDown'],
    jump:     ['Space'],
    interact: ['KeyE'],
    pause:    ['Escape'],
    confirm:  ['Enter', 'NumpadEnter', 'Space'],   // menus only
    // Menu navigation. Same keys as movement, but separate actions so a gameplay lock
    // (e.g. a correction running when Esc is pressed) never freezes the pause menu.
    menuUp:    ['KeyW', 'ArrowUp'],
    menuDown:  ['KeyS', 'ArrowDown'],
    menuLeft:  ['KeyA', 'ArrowLeft'],
    menuRight: ['KeyD', 'ArrowRight'],
    // Narrator text box: finish the typewriter reveal / dismiss the line.
    // Not Space, so jumping never skips narration.
    advance:  ['KeyE', 'Enter', 'NumpadEnter'],
};

// Actions that move or act as Sammy. lockGameplay() masks these (e.g. during a correction);
// pause, menus, and the narrator's advance stay live.
export const GAMEPLAY_ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'interact'];

// Actions menus use. Opening or closing an overlay masks only the keys these use that are NOT
// also gameplay keys (Esc, Enter), so a held Space or direction carries straight back into play.
export const MENU_ACTIONS = ['pause', 'confirm', 'menuUp', 'menuDown', 'menuLeft', 'menuRight'];
