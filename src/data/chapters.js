// The chapters (T-017), entered through the portal in the bedroom. Adding a chapter is one entry
// here (plus its level file): the portal lists it once it is unlocked, and finishing it unlocks
// whatever its `unlock` names.
//   id              save key (completedChapters / unlockedChapters) and event payload
//   title           painted on the sign above the portal
//   levelId         the level the portal opens onto (the chapter's first level)
//   endLevelId?     the level whose level:complete finishes the chapter (default: levelId), for a
//                   chapter that runs over several levels via `nextLevel`
//   portalColor     the swirl's color while the portal points at this chapter
//   unlock          chapter ids this one unlocks when it is finished
//   startsUnlocked? open from the very start of a story (Chapter One)
// Order matters: the portal lever steps through the unlocked chapters in this order.
import { rgb } from 'littlejs';

export const CHAPTERS = [
    {
        id: 'chapter-one',
        title: 'Chapter One',
        levelId: 'sandbox',
        portalColor: rgb(.22, .78, .92),   // moonlit aqua: Chapter One is a night meadow
        unlock: [],                         // Chapter Two (M3) goes here
        startsUnlocked: true,
    },
];

// The swirl home from a level that isn't any chapter's end (debug and test levels). A finished
// chapter swirls home in its own portalColor.
export const HOME_SWIRL_COLOR = rgb(1, .55, .78);

const byId = Object.fromEntries(CHAPTERS.map(chapter => [chapter.id, chapter]));

// Test-only chapters, added at runtime by __sammy.commands.addTestChapter. Never saved.
const testChapters = [];

/** Whether `id` is a real chapter (one a save may record). */
export function isRealChapter(id)
{
    return typeof id === 'string' && Object.hasOwn(byId, id);
}

/** The entry for a chapter id (real or test), or null. */
export function chapterDef(id)
{
    return (typeof id === 'string' && (byId[id] ?? testChapters.find(chapter => chapter.id === id))) || null;
}

/** Every chapter in portal order: the real ones, then any test ones. */
export function allChapters()
{
    return [...CHAPTERS, ...testChapters];
}

/** The chapter that a level:complete in `levelId` finishes, or null. */
export function chapterEndingAt(levelId)
{
    return allChapters().find(chapter => (chapter.endLevelId ?? chapter.levelId) === levelId) ?? null;
}

/** The ids a brand-new story starts with unlocked. */
export function startingChapterIds()
{
    return CHAPTERS.filter(chapter => chapter.startsUnlocked).map(chapter => chapter.id);
}

/** Debug: a pretend chapter (e.g. one pointing at the `test` level). False if the id is real or taken. */
export function registerTestChapter(id, { levelId = 'test', title = 'Test Chapter', portalColor = rgb(1, .62, .22) } = {})
{
    if (typeof id !== 'string' || !id || chapterDef(id))
        return false;
    testChapters.push({ id, title, levelId, portalColor, unlock: [], test: true });
    return true;
}
