// Which level a brand-new story starts in: the first chapter that is open from the start
// (data/chapters.js), so the chapter list stays the one place that says so. Levels say what
// comes after them (`nextLevel` in level data).
import { CHAPTERS } from './chapters.js';

export const FIRST_LEVEL_ID = CHAPTERS.find(chapter => chapter.startsUnlocked).levelId;
// The home base (T-013). Finishing a level with no `nextLevel` (the end of a chapter) comes back
// here, and the chapter portal stands here (T-017; chapters are in data/chapters.js).
export const HOME_LEVEL_ID = 'bedroom';
