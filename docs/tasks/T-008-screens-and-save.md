# T-008 Screens and autosave

## Acceptance criteria
- **Title scene:** game title, a cute idle Sammy drawing (use `drawSammy` if it exists, otherwise a placeholder), a night sky (use `drawBackdrop` if it exists), and the menu items **New Game** and **Continue**. Works with mouse (hover and click) and keyboard (W/S or arrows, Enter or Space). Continue is greyed out when there's no save. The title scene becomes the startup scene, replacing `boot`.
- **New Game with an existing save** shows a confirmation panel ("This will start a brand-new story. Your old one will be... forgotten. Sure?"), with Yes and No. Only Yes overwrites the save.
- **Pause scene (Esc during gameplay):** Resume, Sound on/off, Volume, Quit to Title. The game freezes underneath, dimmed.
- **Level complete scene:** a short celebration (particles and a narrator remark slot), then continue to the next level named in level data (`nextLevel`), or back to title if there is none.
- `src/systems/SaveSystem.js`: localStorage key `sammyexplore.save`, with the shape `{ schemaVersion: 1, levelId, checkpointId, flags: {}, catsRescued: [], updatedAt }`. It **autosaves** on `checkpoint:reached` and `level:complete`, shows a small "saved" feather icon in a corner when it saves, and has a migration hook for later schema versions. Settings (volume, mute) are stored separately under `sammyexplore.settings`.
- Continue loads the saved level and checkpoint.
- Everything is wrapped in try/catch, so blocked storage doesn't break the game.
- `__sammy.save` reports the current save. `__sammy.commands.clearSave()` deletes it.
