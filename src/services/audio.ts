/**
 * The app's single audio entry point.
 *
 * Everything that plays Mandarin goes through here, so three rules hold
 * everywhere: only Hanzi is ever sent to a voice, the learner's saved speed,
 * repeat and voice preferences are always applied, and every caller can await
 * the phrase actually finishing.
 */
import type { AudioSettings, Word } from '../types';
import {
  initSpeech,
  mandarinVoices,
  secondVoiceId,
  speakOnce,
  speechAvailable,
  stopSpeech,
  type SpeakResult,
} from './speech';

const HANZI = /[㐀-鿿豈-﫿]/;

/**
 * Strip a string down to what a Mandarin voice should receive.
 *
 * Latin letters and pinyin are removed: sending "tú·shū·guǎn" or a memory hook
 * like "TOO-SHOO-GWAHN" to a Chinese voice produces nonsense, and sending
 * English produces a Chinese-accented English reading. Chinese punctuation is
 * kept because it drives the engine's prosody.
 */
export function audioText(input: string): string {
  const cleaned = input
    .replace(/[A-Za-z]+/g, ' ')
    .replace(/[·~～_*|<>[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return HANZI.test(cleaned) ? cleaned : '';
}

/** True when this string is safe to hand to a Mandarin voice. */
export function isSpeakable(input: string): boolean {
  return audioText(input).length > 0;
}

export interface PlayOptions {
  /** 'a' and 'b' pick the two conversation speaker voices. */
  speaker?: 'a' | 'b';
  rate?: number;
  repeat?: 1 | 2 | 3;
  /** Set `cancelled` to stop a queued repeat or an awaited sequence. */
  signal?: { cancelled: boolean };
  onStart?: () => void;
  onEnd?: () => void;
}

function voiceFor(audio: AudioSettings, speaker?: 'a' | 'b'): string | null {
  if (speaker === 'a') return audio.speakerAVoiceId ?? audio.voiceId;
  if (speaker === 'b') {
    // A genuinely different voice when the device has one; when it does not,
    // both speakers share the accurate voice and the scene separates them
    // visually instead of faking variety.
    return audio.speakerBVoiceId ?? secondVoiceId(audio.voiceId) ?? audio.voiceId;
  }
  return audio.voiceId;
}

/**
 * Speak Chinese and resolve when the engine reports it has finished.
 *
 * This is what Story Mode and Conversation Cinema await: no timers, no guessed
 * durations. Non-Chinese input resolves immediately as "not spoken" rather than
 * being read aloud in the wrong language.
 */
export async function speakChinese(
  text: string,
  audio: AudioSettings,
  opts: PlayOptions = {},
): Promise<SpeakResult> {
  const clean = audioText(text);
  if (!clean) return { completed: false, cancelled: false, error: 'no Chinese in this text' };

  const repeat = opts.repeat ?? audio.repeat ?? 1;
  const rate = opts.rate ?? audio.rate;
  const voiceId = voiceFor(audio, opts.speaker);

  opts.onStart?.();
  let last: SpeakResult = { completed: false, cancelled: false };
  for (let i = 0; i < Math.max(1, Math.min(3, repeat)); i += 1) {
    if (opts.signal?.cancelled) {
      opts.onEnd?.();
      return { completed: false, cancelled: true };
    }
    last = await speakOnce(clean, { voiceId, rate, signal: opts.signal });
    if (!last.completed) break;
    if (i + 1 < repeat) await pause(280, opts.signal);
  }
  opts.onEnd?.();
  return last;
}

function pause(ms: number, signal?: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal?.cancelled) {
      clearTimeout(t);
      resolve();
    }
  });
}

/**
 * Fire-and-forget speech for taps on a speaker button.
 * Returns false only when there was nothing speakable to say.
 */
export function play(text: string, audio: AudioSettings, opts: PlayOptions = {}): boolean {
  const clean = audioText(text);
  if (!clean) return false;
  void speakChinese(clean, audio, opts);
  return true;
}

/** A headword. Uses `plain` so bracketed variants never reach the engine. */
export function playWord(word: Word, audio: AudioSettings, opts: PlayOptions = {}): boolean {
  return play(word.plain, audio, opts);
}

export function stop(): void {
  stopSpeech();
}

export { initSpeech, mandarinVoices, speechAvailable };

export const SPEED_OPTIONS = [
  { value: 0.65, label: '0.65×', hint: 'Very slow' },
  { value: 0.75, label: '0.75×', hint: 'Slow' },
  { value: 0.85, label: '0.85×', hint: 'Natural for learning' },
  { value: 1.0, label: '1.0×', hint: 'Conversation speed' },
] as const;

export const REPEAT_OPTIONS = [
  { value: 1 as const, label: 'Once' },
  { value: 2 as const, label: 'Twice' },
  { value: 3 as const, label: '3 times' },
];
