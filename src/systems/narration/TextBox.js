// Timing state of the narrator's text box: ease in, typewriter reveal, reading hold, ease out.
// Drawing lives in src/art/drawStoryBox.js; this only decides what is visible when.
import { NARRATOR } from '../../data/tuning.js';

export class TextBox
{
    /** callbacks: { onBlip(), onRevealed(line) } */
    constructor(callbacks)
    {
        this.callbacks = callbacks;
        this.line = null;
        this.appear = 0;   // 0 hidden .. 1 fully shown; survives line swaps so interrupts don't flicker
    }

    get busy() { return !!this.line; }
    get revealed() { return !!this.line && this.chars >= this.line.text.length; }

    show(line)
    {
        this.line = line;
        this.age = 0;
        this.chars = 0;
        this.holdLeft = holdSeconds(line.text);
        this.leaving = false;
    }

    clear()
    {
        this.line = null;
        this.appear = 0;
    }

    /** Returns true on the step the line has fully left the screen. */
    update(dt)
    {
        const target = this.line && !this.leaving ? 1 : 0;
        const ease = target ? NARRATOR.EASE_IN : NARRATOR.EASE_OUT;
        this.appear = approach(this.appear, target, dt / ease);
        if (!this.line)
            return false;

        this.age += dt;
        if (this.leaving)
            return this.appear <= 0 && this.finish();
        if (!this.revealed)
            this.reveal(this.chars + NARRATOR.CHARS_PER_SECOND * dt);
        else if ((this.holdLeft -= dt) <= 0)
            this.leaving = true;
        return false;
    }

    /** A skip press: the first finishes the reveal, the next dismisses the line.
     *  Returns false if the press wasn't used (nothing showing, already leaving, or so soon
     *  after the line started that it's the same press that caused the line). */
    tryAdvance()
    {
        if (!this.line || this.leaving || this.age < NARRATOR.MIN_SHOW_BEFORE_SKIP)
            return false;
        if (this.revealed)
            this.leaving = true;
        else
            this.reveal(this.line.text.length, false);
        return true;
    }

    reveal(chars, withBlip = true)
    {
        const text = this.line.text;
        const from = Math.floor(this.chars), to = Math.min(text.length, Math.floor(chars));
        this.chars = Math.min(text.length, chars);
        // One soft blip per word keeps it chatty without being a buzz.
        if (withBlip && startsWordBetween(text, from, to))
            this.callbacks.onBlip(this.line);
        if (this.revealed)
            this.callbacks.onRevealed(this.line);
    }

    finish()
    {
        this.line = null;
        return true;
    }

    visibleChars()
    {
        return Math.floor(this.chars ?? 0);
    }
}

function holdSeconds(text)
{
    const words = text.trim().split(/\s+/).length;
    return NARRATOR.HOLD_BASE + words * NARRATOR.HOLD_PER_WORD;
}

function startsWordBetween(text, from, to)
{
    for (let i = from; i < to; i++)
        if (text[i] !== ' ' && (i === 0 || text[i - 1] === ' '))
            return true;
    return false;
}

function approach(value, target, step)
{
    return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
