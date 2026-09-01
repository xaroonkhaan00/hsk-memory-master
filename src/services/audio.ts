/**
 * The app's single audio entry point.
 *
 * Everything that plays Mandarin goes through here so that two rules hold
 * everywhere: only Hanzi is ever sent to a Mandarin voice, and the learner's
 * saved speed / repeat / voice preferences are always applied.
 */
import type { AudioSettings, Word } from '../types';
import { mandarinAvailable, secondVoiceId, speak, stopSpeaking } from './tts';

const HANZI = /[㐀-鿿豈-﫿]/;

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
  onStart?: () => void;
  onEnd?: () => void;
}

function voiceFor(audio: AudioSettings, speaker?: 'a' | 'b'): string | null {
  if (speaker === 'a') return audio.speakerAVoiceId ?? audio.voiceId;
  if (speaker === 'b') {
    // Fall back to a genuinely different voice if the device has one; if it
    // does not, both speakers share the accurate voice and the UI separates
    // them visually instead.
    return audio.speakerBVoiceId ?? secondVoiceId(audio.voiceId) ?? audio.voiceId;
  }
  return audio.voiceId;
}

/** Speak any Chinese text. Returns false when nothing speakable was supplied. */
export function play(text: string, audio: AudioSettings, opts: PlayOptions = {}): boolean {
  const clean = audioText(text);
  if (!clean || !mandarinAvailable()) return false;
  return speak(clean, {
    voiceId: voiceFor(audio, opts.speaker),
    rate: opts.rate ?? audio.rate,
    repeat: opts.repeat ?? audio.repeat,
    onStart: opts.onStart,
    onEnd: opts.onEnd,
  });
}

/** A headword. Uses `plain` so bracketed variants never reach the engine. */
export function playWord(word: Word, audio: AudioSettings, opts: PlayOptions = {}): boolean {
  return play(word.plain, audio, opts);
}

export function stop(): void {
  stopSpeaking();
}

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
