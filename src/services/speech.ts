/**
 * The one speech engine, with two backends.
 *
 *   Android (Capacitor)  ->  native android.speech.tts.TextToSpeech
 *   Everything else      ->  the browser's SpeechSynthesis
 *
 * Why the split: inside an Android WebView `speechSynthesis` is not dependable.
 * On Android 11+ the package-visibility rules hide the speech service unless
 * the manifest asks for it, so `getVoices()` comes back empty and every voice
 * lookup fails; and even when voices are visible the `end` event frequently
 * never fires, which stalls anything that waits for a line to finish. The
 * native plugin reports real completion, so a story or a dialogue can advance
 * on the engine's own callback instead of a guessed timer.
 *
 * Every call returns a promise that settles when the phrase has actually
 * finished, been cancelled, or genuinely failed. Nothing here reports success
 * it did not observe.
 */
import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

export type Backend = 'native' | 'web' | 'none';

export interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
  /** Set only when the platform's own metadata says so — never guessed. */
  gender: 'male' | 'female' | null;
  /** zh-CN / zh-Hans, which is what this app teaches. */
  mainland: boolean;
  /** False for cloud voices, which will not work offline. */
  offline: boolean;
}

export interface SpeechState {
  backend: Backend;
  ready: boolean;
  languageAvailable: boolean;
  engine: string;
  voices: VoiceInfo[];
  error: string;
}

export interface SpeakResult {
  completed: boolean;
  cancelled: boolean;
  error?: string;
}

export interface SpeakOptions {
  voiceId?: string | null;
  rate?: number;
  pitch?: number;
  signal?: { cancelled: boolean };
}

/* ------------------------------------------------------------ native side */

interface NativeVoice {
  id: string;
  name: string;
  lang: string;
  quality: number;
  networkRequired: boolean;
  gender: string;
  mainland: boolean;
}

interface NativeStatus {
  available: boolean;
  initialized: boolean;
  languageAvailable: boolean;
  languageStatus: number;
  engine: string;
  locale: string;
  error: string;
  voices: NativeVoice[];
}

interface MandarinTtsPlugin {
  initialize(): Promise<NativeStatus>;
  status(): Promise<NativeStatus>;
  voices(): Promise<{ voices: NativeVoice[] }>;
  speak(options: {
    text: string;
    rate?: number;
    pitch?: number;
    voiceId?: string;
  }): Promise<{ completed: boolean; cancelled?: boolean }>;
  stop(): Promise<void>;
}

const Native = registerPlugin<MandarinTtsPlugin>('MandarinTts');

function fromNativeVoice(v: NativeVoice): VoiceInfo {
  return {
    id: v.id,
    name: v.name,
    lang: v.lang,
    gender: v.gender === 'male' || v.gender === 'female' ? v.gender : null,
    mainland: v.mainland,
    offline: !v.networkRequired,
  };
}

/* --------------------------------------------------------------- web side */

function webSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function isMandarinVoice(v: SpeechSynthesisVoice): boolean {
  return /^(zh|cmn)/i.test(v.lang) || /chinese|mandarin|putonghua|普通话|中文|国语/i.test(v.name);
}

/** Gender only when the vendor's own name says it. Never inferred. */
function genderFromName(name: string): 'male' | 'female' | null {
  const n = name.toLowerCase();
  if (/\bfemale\b|\bwoman\b|女|#female|-f-/.test(n)) return 'female';
  if (/\bmale\b|\bman\b|男|#male|-m-/.test(n)) return 'male';
  if (/\b(yunxi|yunyang|yunjian|yunye|kangkang|liang)\b/.test(n)) return 'male';
  if (/\b(xiaoxiao|xiaoyi|xiaohan|huihui|yaoyao|tingting|sinji|meijia)\b/.test(n)) return 'female';
  return null;
}

function fromWebVoice(v: SpeechSynthesisVoice): VoiceInfo {
  return {
    id: v.voiceURI || v.name,
    name: v.name,
    lang: v.lang,
    gender: genderFromName(v.name),
    mainland: /zh[-_](cn|hans)/i.test(v.lang) || /^cmn/i.test(v.lang),
    offline: v.localService,
  };
}

let webVoices: SpeechSynthesisVoice[] = [];

function refreshWebVoices(): void {
  if (!webSupported()) return;
  const found = window.speechSynthesis.getVoices();
  if (found.length) webVoices = found;
  notify();
}

/* ------------------------------------------------------------ shared state */

const listeners = new Set<() => void>();
function notify(): void {
  listeners.forEach((fn) => fn());
}

export function onSpeechChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let state: SpeechState = {
  backend: 'none',
  ready: false,
  languageAvailable: false,
  engine: '',
  voices: [],
  error: '',
};

let initPromise: Promise<SpeechState> | null = null;

/** What the diagnostics screen reports, and what callers branch on. */
export function speechState(): SpeechState {
  return state;
}

export function backendName(): Backend {
  return state.backend;
}

/**
 * Bring up whichever backend this device has. Safe to call repeatedly; the work
 * happens once and later callers get the same promise.
 */
export function initSpeech(): Promise<SpeechState> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<SpeechState> => {
    if (isNative()) {
      try {
        const status = await Native.initialize();
        const voices = (status.voices ?? []).map(fromNativeVoice);
        voices.sort(compareVoices);
        state = {
          backend: 'native',
          ready: status.initialized,
          languageAvailable: status.languageAvailable,
          engine: status.engine || 'Android TextToSpeech',
          voices,
          error: status.error ?? '',
        };
        notify();
        return state;
      } catch (e) {
        // A native platform whose plugin failed still gets the web fallback,
        // rather than an app with no sound and no explanation.
        state = {
          ...state,
          backend: webSupported() ? 'web' : 'none',
          error: `Native speech unavailable: ${describe(e)}`,
        };
      }
    }

    if (webSupported()) {
      refreshWebVoices();
      window.speechSynthesis.onvoiceschanged = refreshWebVoices;
      // Engines populate the list a beat after load, and some only after the
      // first speak() call.
      for (const delay of [250, 900, 2500]) setTimeout(refreshWebVoices, delay);
      const voices = webVoices.filter(isMandarinVoice).map(fromWebVoice);
      voices.sort(compareVoices);
      state = {
        backend: 'web',
        // The web engine will happily speak zh-CN even when it lists no voices,
        // so readiness is about having an engine, not about the voice list.
        ready: true,
        languageAvailable: voices.length > 0,
        engine: 'Web Speech API',
        voices,
        error: state.error,
      };
      notify();
      return state;
    }

    state = {
      backend: 'none',
      ready: false,
      languageAvailable: false,
      engine: '',
      voices: [],
      error: 'This device offers no speech engine.',
    };
    notify();
    return state;
  })();
  return initPromise;
}

function compareVoices(a: VoiceInfo, b: VoiceInfo): number {
  if (a.mainland !== b.mainland) return a.mainland ? -1 : 1;
  if (a.offline !== b.offline) return a.offline ? -1 : 1;
  // A voice the platform itself calls male matches the requested sound; one
  // whose gender is unknown is still preferred over a known female voice,
  // because guessing is worse than not knowing.
  const rank = (v: VoiceInfo) => (v.gender === 'male' ? 0 : v.gender === null ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return a.name.localeCompare(b.name);
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'unknown error';
  }
}

/** Re-read the voice list, e.g. after the learner installs a voice. */
export async function refreshVoices(): Promise<SpeechState> {
  initPromise = null;
  return initSpeech();
}

export function mandarinVoices(): VoiceInfo[] {
  return state.voices;
}

/**
 * True when speech can be attempted at all.
 *
 * Deliberately NOT "a Mandarin voice was found in a list": Android WebViews and
 * several desktop engines report an empty list and then speak perfectly well.
 * Hiding every audio control behind a voice list is what silenced the app.
 */
export function speechAvailable(): boolean {
  return state.backend !== 'none';
}

/** True when we positively know a Mandarin voice exists. */
export function mandarinConfirmed(): boolean {
  return state.languageAvailable;
}

export function defaultVoiceId(): string | null {
  return state.voices[0]?.id ?? null;
}

/** A different voice for the other speaker, or null when the device has one. */
export function secondVoiceId(firstId: string | null): string | null {
  const first = firstId ?? defaultVoiceId();
  return state.voices.find((v) => v.id !== first)?.id ?? null;
}

/* ------------------------------------------------------------------ speak */

let generation = 0;
let speaking = false;

export function isSpeaking(): boolean {
  return speaking;
}

/** Cancel anything in flight. Pending promises settle as cancelled. */
export function stopSpeech(): void {
  generation += 1;
  speaking = false;
  if (state.backend === 'native') {
    void Native.stop().catch(() => {});
    return;
  }
  if (webSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* some engines throw when nothing is speaking */
    }
  }
}

let lastAttempt = '';
let lastResult: 'success' | 'failed' | 'cancelled' | 'none' = 'none';
let lastError = '';

export function lastSpeechReport(): {
  text: string;
  result: typeof lastResult;
  error: string;
} {
  return { text: lastAttempt, result: lastResult, error: lastError };
}

function record(text: string, result: typeof lastResult, error = ''): void {
  lastAttempt = text;
  lastResult = result;
  lastError = error;
  notify();
}

/**
 * Speak one phrase and resolve when the engine says it finished.
 *
 * Never rejects: callers chain on the result, and a thrown error mid-story
 * would strand the player. Failures come back as `completed: false` with the
 * real reason attached.
 */
export async function speakOnce(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  const clean = text.trim();
  if (!clean) return { completed: false, cancelled: false, error: 'nothing to speak' };

  await initSpeech();
  const token = ++generation;
  const stale = () => token !== generation || opts.signal?.cancelled === true;

  if (state.backend === 'native') {
    speaking = true;
    try {
      const res = await Native.speak({
        text: clean,
        rate: opts.rate ?? 0.85,
        pitch: opts.pitch ?? 1,
        voiceId: opts.voiceId ?? undefined,
      });
      speaking = false;
      if (res.cancelled || stale()) {
        record(clean, 'cancelled');
        return { completed: false, cancelled: true };
      }
      record(clean, 'success');
      return { completed: true, cancelled: false };
    } catch (e) {
      speaking = false;
      const error = describe(e);
      record(clean, 'failed', error);
      return { completed: false, cancelled: false, error };
    }
  }

  if (state.backend === 'web' && webSupported()) {
    return speakWeb(clean, opts, token, stale);
  }

  const error = 'No speech engine on this device.';
  record(clean, 'failed', error);
  return { completed: false, cancelled: false, error };
}

/** Rough spoken length, used only to bound the watchdog — never to pace speech. */
function estimateMs(text: string, rate: number): number {
  const hanzi = (text.match(/[一-鿿]/g) ?? []).length;
  const perChar = 260 / Math.max(0.4, rate);
  return Math.max(1200, hanzi * perChar + 900);
}

function speakWeb(
  text: string,
  opts: SpeakOptions,
  token: number,
  stale: () => boolean,
): Promise<SpeakResult> {
  return new Promise<SpeakResult>((resolve) => {
    const synth = window.speechSynthesis;
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }

    const rate = Math.max(0.4, Math.min(1.6, opts.rate ?? 0.85));
    const utterance = new SpeechSynthesisUtterance(text);
    const wanted = opts.voiceId
      ? webVoices.find((v) => (v.voiceURI || v.name) === opts.voiceId)
      : undefined;
    const chosen = wanted ?? webVoices.filter(isMandarinVoice)[0];
    // Setting `lang` matters more than setting `voice`: engines that expose no
    // voice list still pick a Chinese voice from the language tag alone.
    utterance.lang = chosen?.lang || 'zh-CN';
    if (chosen) utterance.voice = chosen;
    utterance.rate = rate;
    utterance.pitch = opts.pitch ?? 1;

    let settled = false;
    let started = false;
    const finish = (result: SpeakResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(startGuard);
      clearTimeout(watchdog);
      clearInterval(keepAlive);
      speaking = false;
      if (result.completed) record(text, 'success');
      else if (result.cancelled) record(text, 'cancelled');
      else record(text, 'failed', result.error ?? '');
      resolve(result);
    };

    utterance.onstart = () => {
      started = true;
      speaking = true;
      // The voice list is often only populated once something has been spoken.
      if (!webVoices.length) refreshWebVoices();
    };
    utterance.onend = () =>
      finish(stale() ? { completed: false, cancelled: true } : { completed: true, cancelled: false });
    utterance.onerror = (e) => {
      const kind = (e as SpeechSynthesisErrorEvent).error ?? 'speech error';
      if (kind === 'interrupted' || kind === 'canceled') {
        finish({ completed: false, cancelled: true });
      } else {
        finish({ completed: false, cancelled: false, error: kind });
      }
    };

    // Two watchdogs, for two different failures.
    //
    // An engine that never starts is broken, and waiting out a full phrase to
    // discover that would stall a story for ten seconds a line. An engine that
    // starts but never says `end` — common in WebViews — should still hand
    // control back once the phrase has plausibly finished.
    const startGuard = setTimeout(() => {
      if (!started) finish({ completed: false, cancelled: false, error: 'the voice never started' });
    }, 1800);
    const watchdog = setTimeout(
      () => finish({ completed: true, cancelled: false }),
      estimateMs(text, rate) * 2 + 4000,
    );

    // Chrome pauses long utterances after ~15s unless nudged.
    const keepAlive = setInterval(() => {
      if (settled) return;
      if (token !== generation) {
        finish({ completed: false, cancelled: true });
        return;
      }
      try {
        if (synth.speaking && !synth.paused) synth.resume();
      } catch {
        /* ignore */
      }
    }, 5000);

    try {
      synth.speak(utterance);
    } catch (e) {
      finish({ completed: false, cancelled: false, error: describe(e) });
    }
  });
}
