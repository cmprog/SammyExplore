// Audio system: turns bus events into sounds, plays the music loop, and owns audio settings.
// Everything it plays is defined in src/data/sounds.js and src/data/music.js.
//
// Browsers keep the AudioContext suspended until a user gesture. LittleJS resumes it on mouse
// and touch, but not on keys, so we resume it ourselves on the first input of any kind and only
// then start the music. Sounds requested before that are skipped, not queued.
import {
    Sound, ZzFXMusic, audioContext, audioIsRunning, setSoundVolume, clamp, lerp,
} from 'littlejs';
import { on, emit } from '../core/events.js';
import {
    SOUNDS, SOUND_EVENTS, GLIDE_START_EVENTS, GLIDE_STOP_EVENTS, AUDIO_DEFAULTS, AUDIO_TUNING,
} from '../data/sounds.js';
import { MUSIC_TRACKS, DEFAULT_MUSIC_TRACK } from '../data/music.js';

const SETTINGS_KEY = 'sammyexplore.settings';
const UNLOCK_EVENTS = ['keydown', 'mousedown', 'pointerdown', 'touchstart'];

let settings = { ...AUDIO_DEFAULTS };
let library = new Map();        // name -> { layers: [{ sound, at, pitch, volume }], minInterval, loop }
let lastPlayedAt = new Map();   // name -> performance.now() ms, for minInterval
let lastSound = null;
let soundCount = 0;
let unlocked = false;           // a user input has happened (audio is allowed to start)
let music = null;               // ZzFXMusic, built shortly after init (it takes a moment)
let musicInstance = null;
let glideInstances = [];
let initialized = false;

/** Call once after engineInit has set up audio (main.js does this from gameInit). */
export function initAudio()
{
    if (initialized)
        return;
    initialized = true;

    settings = loadSettings();
    applyMasterVolume();
    library = buildLibrary();

    for (const [eventName, soundName] of Object.entries(SOUND_EVENTS))
        on(eventName, data => playSound(soundName, eventVolume(eventName, data)));
    for (const eventName of GLIDE_START_EVENTS)
        on(eventName, startGlide);
    for (const eventName of GLIDE_STOP_EVENTS)
        on(eventName, stopGlide);
    on('scene:change', onSceneChange);

    // Contract payloads are bare values; {volume} / {muted} objects are accepted too.
    on('audio:setVolume', data => setVolume(isObject(data) ? data.volume : data));
    on('audio:setMuted', data => setMuted(isObject(data) ? data.muted : data));
    on('audio:toggleMute', () => setMuted(!settings.muted));

    for (const type of UNLOCK_EVENTS)
        document.addEventListener(type, onFirstInput, { capture: true });

    // Rendering the song blocks for a moment; let the first frame paint before doing it.
    requestAnimationFrame(() => setTimeout(buildMusic, 0));
    registerDebugHook();
}

/** Play a named sound from the catalog, volume scaled by `volumeScale`. Returns true if triggered. */
export function playSound(name, volumeScale = 1)
{
    const entry = library.get(name);
    if (!entry)
    {
        console.warn(`audio: unknown sound "${name}"`);
        return false;
    }
    const now = performance.now();
    if (now - (lastPlayedAt.get(name) ?? -Infinity) < entry.minInterval * 1000)
        return false;
    lastPlayedAt.set(name, now);

    // Recorded even before unlock or while muted, so tests can check the event -> sound mapping;
    // __sammy.audio.unlocked tells whether it was actually audible.
    lastSound = name;
    soundCount++;
    if (!canPlay())
        return true;
    playLayers(entry, settings.sfxVolume * volumeScale, false);
    return true;
}

/** Per-event volume tweaks driven by the payload. */
function eventVolume(eventName, data)
{
    if (eventName === 'player:land' && Number.isFinite(data?.impact))
        return lerp(AUDIO_TUNING.LAND_IMPACT_FLOOR, 1, clamp(data.impact, 0, 1));
    if (eventName === 'portal:select' && data?.changed === false)
        return AUDIO_TUNING.PORTAL_SAME_VOLUME;
    return 1;
}

function isObject(value)
{
    return value !== null && typeof value === 'object';
}

export function setVolume(volume)
{
    const value = Number(volume);
    if (!Number.isFinite(value))
        return;
    settings.volume = clamp(value, 0, 1);
    settingsChanged();
}

export function setMuted(muted)
{
    settings.muted = !!muted;
    settingsChanged();
}

/** Plain copy of the current audio settings (for menus that want to show them). */
export function getAudioSettings()
{
    return { ...settings };
}

function settingsChanged()
{
    applyMasterVolume();
    saveSettings();
    emit('audio:changed', getAudioSettings());
}

function applyMasterVolume()
{
    // Mute is a master gain of 0, so music keeps its place and unmuting is instant.
    setSoundVolume(settings.muted ? 0 : settings.volume);
}

function canPlay()
{
    return unlocked && audioIsRunning();
}

// -- sound effects -------------------------------------------------------------------------

function buildLibrary()
{
    const sounds = new Map();   // share one Sound per ZzFX array (chimes reuse the same bell)
    const soundFor = zzfx =>
    {
        if (!sounds.has(zzfx))
            sounds.set(zzfx, new Sound(zzfx));
        return sounds.get(zzfx);
    };

    const result = new Map();
    for (const [name, definition] of Object.entries(SOUNDS))
    {
        const entry = Array.isArray(definition) ? { layers: [{ zzfx: definition }] } : definition;
        result.set(name, {
            minInterval: entry.minInterval ?? AUDIO_TUNING.DEFAULT_MIN_INTERVAL,
            loop: !!entry.loop,
            layers: entry.layers.map(layer => ({
                sound: soundFor(layer.zzfx),
                at: layer.at ?? 0,
                pitch: 2 ** ((layer.semitones ?? 0) / 12),
                volume: layer.volume ?? 1,
            })),
        });
    }
    return result;
}

/** Play every layer of an entry. Returns the SoundInstances started right away (for loops). */
function playLayers(entry, volume, loop)
{
    const started = [];
    for (const layer of entry.layers)
    {
        const play = () => layer.sound.play(undefined, volume * layer.volume, layer.pitch, 1, loop);
        if (layer.at > 0)
            setTimeout(() => canPlay() && play(), layer.at * 1000);
        else
        {
            const instance = play();
            if (instance)
                started.push(instance);
        }
    }
    return started;
}

// -- glide loop ----------------------------------------------------------------------------

function startGlide()
{
    lastSound = 'glide';
    soundCount++;
    if (!canPlay() || glideInstances.some(instance => instance.isPlaying()))
        return;
    stopGlide();   // drop a loop left paused by an overlay
    const entry = library.get('glide');
    glideInstances = playLayers(entry, settings.sfxVolume, entry.loop);
    for (const instance of glideInstances)
        fadeIn(instance, AUDIO_TUNING.GLIDE_FADE_IN);
}

function stopGlide()
{
    for (const instance of glideInstances)
        fadeOutAndStop(instance, AUDIO_TUNING.GLIDE_FADE_OUT);
    glideInstances = [];
}

function onSceneChange({ kind } = {})
{
    if (kind === 'push')
        glideInstances.forEach(instance => instance.pause());
    else if (kind === 'pop')
        glideInstances.forEach(instance => instance.resume());
    else
        stopGlide();
}

// SoundInstance.stop(fade) restarts its ramp from full volume, which pops if we're still
// fading in. Ramp from wherever the gain is right now instead.
function fadeOutAndStop(instance, seconds)
{
    const gain = instance.gainNode?.gain;
    if (!instance.isPlaying() || !gain)
        return instance.stop();
    const now = audioContext.currentTime;
    const current = gain.value;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(current, now);
    gain.linearRampToValueAtTime(0, now + seconds);
    instance.source.stop(now + seconds);
    instance.source = undefined;   // mark stopped, like SoundInstance.stop does
}

function fadeIn(instance, seconds)
{
    const gain = instance.gainNode?.gain;
    if (!gain)
        return;
    const now = audioContext.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(instance.volume, now + seconds);
}

// -- music ---------------------------------------------------------------------------------

function buildMusic()
{
    try
    {
        music = new ZzFXMusic(MUSIC_TRACKS[DEFAULT_MUSIC_TRACK]);
    }
    catch (error)
    {
        // No music is better than a broken game.
        console.error('audio: failed to build music', error);
        return;
    }
    startMusicIfReady();
}

function startMusicIfReady()
{
    if (!music || !canPlay() || musicInstance?.isPlaying())
        return;
    musicInstance = music.playMusic(settings.musicVolume * AUDIO_TUNING.MUSIC_LEVEL);
    if (musicInstance)
        fadeIn(musicInstance, AUDIO_TUNING.MUSIC_FADE_IN);
}

// -- unlock on first input -----------------------------------------------------------------

function onFirstInput()
{
    unlocked = true;
    // resume() must be called inside the gesture handler to count as user-initiated.
    const resumed = audioIsRunning() ? Promise.resolve() : audioContext.resume();
    Promise.resolve(resumed)
        .then(() =>
        {
            if (!audioIsRunning())
                return;   // keep listening; a later gesture may succeed
            for (const type of UNLOCK_EVENTS)
                document.removeEventListener(type, onFirstInput, { capture: true });
            startMusicIfReady();
        })
        .catch(error => console.warn('audio: could not resume audio context', error));
}

// -- settings storage ----------------------------------------------------------------------

function loadSettings()
{
    const loaded = { ...AUDIO_DEFAULTS };
    try
    {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
        if (stored && typeof stored === 'object')
        {
            for (const key of ['volume', 'musicVolume', 'sfxVolume'])
                if (Number.isFinite(stored[key]))
                    loaded[key] = clamp(stored[key], 0, 1);
            if (typeof stored.muted === 'boolean')
                loaded.muted = stored.muted;
        }
    }
    catch (error)
    {
        console.warn('audio: could not read settings, using defaults', error);
    }
    return loaded;
}

function saveSettings()
{
    const base = readStoredSettings();
    try
    {
        // Merge, so settings owned by other systems in the same key survive.
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...base, ...settings }));
    }
    catch (error)
    {
        console.warn('audio: could not save settings', error);
    }
}

/** The raw stored settings object, or {} if missing, corrupt, or unreadable. */
function readStoredSettings()
{
    try
    {
        const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
        return isObject(stored) && !Array.isArray(stored) ? stored : {};
    }
    catch
    {
        return {};
    }
}

// -- test hook -----------------------------------------------------------------------------

function registerDebugHook()
{
    const hook = window.__sammy;
    if (!hook)
        return;
    hook.register('audio', () => ({
        muted: settings.muted,
        volume: settings.volume,
        musicVolume: settings.musicVolume,
        sfxVolume: settings.sfxVolume,
        musicPlaying: !!musicInstance?.isPlaying(),
        musicReady: !!music,
        lastSound,
        soundCount,
        unlocked,
        contextRunning: audioIsRunning(),
        glidePlaying: glideInstances.some(instance => instance.isPlaying()),
    }));
    hook.commands.play = name => playSound(name);
}
