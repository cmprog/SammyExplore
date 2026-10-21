// Chapters (T-017): which chapters are unlocked and finished, and which one the bedroom portal
// points at. One instance for the game (main.js); the playing scene hands a read-only view of it
// to the level's entities (the portal) and restores it on Continue / New Game, the way the
// Companion keeps its cat. SaveSystem keeps the saved copy from chapter:complete.
//
// Finishing a chapter = level:complete in its end level (data/chapters.js chapterEndingAt): it is
// marked completed, the chapters its data `unlock`s open up (and the portal turns to the newest
// one), and chapter:complete {chapterId, unlocked} goes out. Also on a replay of a finished chapter.
// The selection is not saved: each story session starts on the newest unlocked chapter.
//
// Events consumed: level:complete {levelId}, portal:select {chapterId}
// Events emitted: chapter:complete {chapterId, unlocked}
import { on, emit } from '../core/events.js';
import { allChapters, chapterDef, chapterEndingAt, startingChapterIds } from '../data/chapters.js';

export class Chapters
{
    constructor()
    {
        this.unlocked = new Set();
        this.completed = new Set();
        this.selected = null;
        this.restore();
        this.unsubscribers = [
            on('level:complete', ({ levelId } = {}) => this.onLevelComplete(levelId)),
            on('portal:select', ({ chapterId } = {}) =>
            {
                if (this.unlocked.has(chapterId))
                    this.selected = chapterId;
            }),
        ];
    }

    /** Continue passes the saved lists; New Game (or nothing) starts fresh. Unknown ids are dropped. */
    restore({ unlockedChapters = [], completedChapters = [] } = {})
    {
        const known = ids => ids.filter(id => chapterDef(id));
        this.completed = new Set(known(completedChapters));
        this.unlocked = new Set([...startingChapterIds(), ...known(unlockedChapters), ...this.completed]);
        this.selected = this.newestUnlocked();
    }

    /** Unlocked chapter entries, in portal order. */
    list()
    {
        return allChapters().filter(chapter => this.unlocked.has(chapter.id));
    }

    newestUnlocked()
    {
        return this.list().at(-1)?.id ?? null;
    }

    /** The read-only view entities get (entities/registry.js context.chapters). */
    view()
    {
        return { list: () => this.list(), selected: () => this.selected };
    }

    onLevelComplete(levelId)
    {
        const chapter = chapterEndingAt(levelId);
        if (!chapter)
            return;
        this.completed.add(chapter.id);
        this.unlocked.add(chapter.id);
        const unlocked = chapter.unlock.filter(id => chapterDef(id) && !this.unlocked.has(id));
        unlocked.forEach(id => this.unlocked.add(id));
        if (unlocked.length)
            this.selected = this.newestUnlocked();
        emit('chapter:complete', { chapterId: chapter.id, unlocked });
    }

    /** Debug: unlock a chapter (real or test) for this session. Not saved. */
    unlock(id)
    {
        if (!chapterDef(id))
            return false;
        this.unlocked.add(id);
        return true;
    }

    /** Plain data for window.__sammy.chapters. */
    debugState()
    {
        const order = allChapters().map(chapter => chapter.id);
        const sorted = set => order.filter(id => set.has(id));
        return { unlocked: sorted(this.unlocked), completed: sorted(this.completed), selected: this.selected };
    }
}
