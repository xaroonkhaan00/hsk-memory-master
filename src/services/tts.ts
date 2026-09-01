/**
 * Mandarin text-to-speech through the browser's own SpeechSynthesis engine.
 * No audio files are shipped and no network service is called: if the device
 * has no Chinese voice the app says so rather than playing something wrong.
 */

let voices: SpeechSynthesisVoice[] = [];
let chosen: SpeechSynthesisVoice | null = null;
let listeners: (() => void)[] = [];

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const zh = list.filter((v) => /^zh/i.test(v.lang) || /chinese|mandarin|普通话|中文/i.test(v.name));
  if (zh.length === 0) return null;
  const preferred =
    zh.find((v) => /zh[-_]cn/i.test(v.lang)) ??
    zh.find((v) => /zh[-_]hans/i.test(v.lang)) ??
    zh[0];
  return preferred ?? null;
}

function refresh(): void {
  if (!ttsSupported()) return;
  voices = window.speechSynthesis.getVoices();
  chosen = pickVoice(voices);
  listeners.forEach((fn) => fn());
}

if (ttsSupported()) {
  refresh();
  window.speechSynthesis.onvoiceschanged = refresh;
  // Some engines populate the list a beat late.
  setTimeout(refresh, 400);
  setTimeout(refresh, 1500);
}

export function onVoicesChanged(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function mandarinAvailable(): boolean {
  return ttsSupported() && chosen !== null;
}

export function voiceName(): string | null {
  return chosen?.name ?? null;
}

export interface SpeakOptions {
  rate?: number;
  repeat?: number;
  onEnd?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported() || !chosen) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const repeat = Math.max(1, opts.repeat ?? 1);
  let done = 0;
  for (let i = 0; i < repeat; i += 1) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = chosen;
    u.lang = chosen.lang || 'zh-CN';
    u.rate = opts.rate ?? 1;
    u.pitch = 1;
    u.onend = () => {
      done += 1;
      if (done === repeat) opts.onEnd?.();
    };
    u.onerror = () => {
      done += 1;
      if (done === repeat) opts.onEnd?.();
    };
    synth.speak(u);
  }
  return true;
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
