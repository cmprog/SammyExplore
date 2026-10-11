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
};
