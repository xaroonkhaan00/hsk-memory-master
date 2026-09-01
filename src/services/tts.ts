/**
 * Mandarin speech through the device's own SpeechSynthesis engine.
 *
 * No audio files are shipped and no network service is called. Voices differ
 * wildly between Android builds, browsers and desktop OSes, so the module
 * DETECTS what is actually installed rather than assuming a particular voice
 * exists — and it never claims a voice is male unless the platform says so.
 */

export interface VoiceInfo {
  /** voiceURI, stable enough to persist as a preference */
  id: string;
  name: string;
  lang: string;
  localService: boolean;
  /** Only set when the platform's own metadata says so. */
  gender: 'male' | 'female' | null;
  /** True for zh-CN / zh-Hans, which is what this app teaches. */
  mainland: boolean;
}

let all: SpeechSynthesisVoice[] = [];
let mandarin: VoiceInfo[] = [];
const listeners = new Set<() => void>();

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Gender is only reported when the voice's own name says it. Android and
 * Chrome expose no gender field, so for most devices this is honestly null and
 * the UI must not pretend otherwise.
 */
function genderOf(v: SpeechSynthesisVoice): 'male' | 'female' | null {
  const n = v.name.toLowerCase();
  if (/\bmale\b|\bman\b|男/.test(n) && !/female/.test(n)) return 'male';
  if (/\bfemale\b|\bwoman\b|女/.test(n)) return 'female';
  // Names that are conventionally gendered in the vendor's own catalogue.
  if (/\b(yunxi|yunyang|yunjian|yunye|kangkang|liang|hanhan|daniel|alex)\b/.test(n)) return 'male';
  if (/\b(xiaoxiao|xiaoyi|xiaohan|huihui|yaoyao|tingting|sinji|meijia|li-?mu)\b/.test(n)) return 'female';
  return null;
}

function isMandarin(v: SpeechSynthesisVoice): boolean {
  return /^zh/i.test(v.lang) || /chinese|mandarin|putonghua|普通话|中文|国语/i.test(v.name);
}

function describe(v: SpeechSynthesisVoice): VoiceInfo {
  return {
    id: v.voiceURI || v.name,
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    gender: genderOf(v),
    mainland: /zh[-_](cn|hans)/i.test(v.lang) || /^cmn/i.test(v.lang),
  };
}

function refresh(): void {
  if (!ttsSupported()) return;
  all = window.speechSynthesis.getVoices();
  const zh = all.filter(isMandarin).map(describe);
  // Mainland Mandarin first, then anything the platform calls male, then local
  // (offline) voices, then the rest.
  zh.sort((a, b) => {
    if (a.mainland !== b.mainland) return a.mainland ? -1 : 1;
    if ((a.gender === 'male') !== (b.gender === 'male')) return a.gender === 'male' ? -1 : 1;
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  mandarin = zh;
  listeners.forEach((fn) => fn());
}

if (ttsSupported()) {
  refresh();
  window.speechSynthesis.onvoiceschanged = refresh;
  // Several engines populate the list a beat after load.
  setTimeout(refresh, 300);
  setTimeout(refresh, 1200);
  setTimeout(refresh, 3000);
}

export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function mandarinVoices(): VoiceInfo[] {
  return mandarin;
}

export function mandarinAvailable(): boolean {
  return ttsSupported() && mandarin.length > 0;
}

/** The default when the learner has not chosen: best mainland voice we can see. */
export function defaultVoiceId(): string | null {
  return mandarin[0]?.id ?? null;
}

/**
 * A second voice for the other speaker in a dialogue. Returns null when the
 * device only has one Mandarin voice — the UI then distinguishes speakers
 * visually instead of faking variety.
 */
export function secondVoiceId(firstId: string | null): string | null {
  const other = mandarin.find((v) => v.id !== firstId);
  return other?.id ?? null;
}

function resolve(id: string | null | undefined): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  if (id) {
    const hit = all.find((v) => (v.voiceURI || v.name) === id);
    if (hit) return hit;
  }
  const fallback = mandarin[0];
  if (!fallback) return null;
  return all.find((v) => (v.voiceURI || v.name) === fallback.id) ?? null;
}

export interface SpeakOptions {
  voiceId?: string | null;
  rate?: number;
  pitch?: number;
  repeat?: number;
  /** Gap between repeats, ms. */
  gap?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

let activeToken = 0;

/**
 * Speak Chinese text. Callers must pass Hanzi — never pinyin, English or a
 * mnemonic hook (see audioText() in services/audio.ts, which enforces this).
 */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported()) return false;
  const voice = resolve(opts.voiceId);
  if (!voice) return false;
  const clean = text.trim();
  if (!clean) return false;

  const synth = window.speechSynthesis;
  synth.cancel();
  const token = ++activeToken;
  const repeat = Math.max(1, Math.min(5, opts.repeat ?? 1));
  const gap = opts.gap ?? 320;

  let done = 0;
  const sayOnce = () => {
    if (token !== activeToken) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = voice;
    u.lang = voice.lang || 'zh-CN';
    u.rate = Math.max(0.4, Math.min(1.6, opts.rate ?? 0.85));
    u.pitch = opts.pitch ?? 1;
    u.onstart = () => {
      if (token === activeToken && done === 0) opts.onStart?.();
    };
    const next = () => {
      if (token !== activeToken) return;
      done += 1;
      if (done < repeat) setTimeout(sayOnce, gap);
      else opts.onEnd?.();
    };
    u.onend = next;
    u.onerror = () => {
      if (token !== activeToken) return;
      opts.onError?.();
      next();
    };
    synth.speak(u);
  };
  sayOnce();
  return true;
}

export function stopSpeaking(): void {
  activeToken += 1;
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking;
}
