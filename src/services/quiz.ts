import {
  CONFUSIONS,
  SOUNDS,
  WORDS,
  tryWord,
  wordsWithChar,
} from '../data';
import type {
  AppState,
  Dimension,
  ErrorKind,
  QuizItem,
  QuizOption,
  Status,
  Word,
} from '../types';
import { accepted, englishMatches, stripTones } from './pinyin';
import { avgScore, progressOf } from './progress';
import { speechAvailable } from './speech';

export type ModeKey =
  | 'hanzi-meaning'
  | 'meaning-hanzi'
  | 'hanzi-pinyin'
  | 'pinyin-hanzi'
  | 'tone'
  | 'listen-meaning'
  | 'listen-hanzi'
  | 'cloze'
  | 'match'
  | 'speed'
  | 'rescue'
  | 'confusion'
  | 'char-family'
  | 'sound-family'
  | 'story-recall'
  | 'reverse'
  | 'typing'
  | 'rapid'
  | 'char-spot'
  | 'disappearing'
  | 'blur';

export interface ModeInfo {
  key: ModeKey;
  title: string;
  blurb: string;
  icon: string;
  dimension: Dimension;
  needsAudio?: boolean;
}

export const MODES: ModeInfo[] = [
  { key: 'hanzi-meaning', title: 'Hanzi → Meaning', blurb: 'See the characters, recall what they mean.', icon: '汉', dimension: 'meaning' },
  { key: 'meaning-hanzi', title: 'Meaning → Hanzi', blurb: 'See the English, pick the right characters.', icon: '🔤', dimension: 'character' },
  { key: 'hanzi-pinyin', title: 'Hanzi → Pinyin', blurb: 'Read the characters out in your head, then check.', icon: '🔊', dimension: 'pinyin' },
  { key: 'pinyin-hanzi', title: 'Pinyin → Hanzi', blurb: 'Hear it in your head, find the characters.', icon: '🅿️', dimension: 'character' },
  { key: 'tone', title: 'Tone Challenge', blurb: 'The meaning is free — the tones are the test.', icon: '📈', dimension: 'tone' },
  { key: 'listen-meaning', title: 'Listening → Meaning', blurb: 'No characters. Just the sound.', icon: '👂', dimension: 'listening', needsAudio: true },
  { key: 'listen-hanzi', title: 'Listening → Hanzi', blurb: 'Hear it, then find it in writing.', icon: '🎧', dimension: 'listening', needsAudio: true },
  { key: 'cloze', title: 'Sentence Gap', blurb: 'Real sentences with the word cut out.', icon: '✂️', dimension: 'usage' },
  { key: 'match', title: 'Match Pairs', blurb: 'Five words, five meanings, one grid.', icon: '🃏', dimension: 'meaning' },
  { key: 'speed', title: 'Speed Round', blurb: 'Six seconds a question. No thinking time.', icon: '⚡', dimension: 'meaning' },
  { key: 'rescue', title: 'Weak Word Rescue', blurb: 'Only the words that keep beating you.', icon: '🛟', dimension: 'meaning' },
  { key: 'confusion', title: 'Confusion Battle', blurb: 'Look-alikes and sound-alikes, head to head.', icon: '⚔️', dimension: 'character' },
  { key: 'char-family', title: 'Character Family', blurb: 'One character, many words built from it.', icon: '🌳', dimension: 'character' },
  { key: 'sound-family', title: 'Pinyin Family', blurb: 'zh/z, ch/c, sh/s, j/q/x and friends.', icon: '🎵', dimension: 'pinyin' },
  { key: 'story-recall', title: 'Memory Story Recall', blurb: 'Recall the words your memory scene was built from.', icon: '🎬', dimension: 'meaning' },
  { key: 'reverse', title: 'Reverse Recall', blurb: 'English in, pinyin out — from memory, typed.', icon: '🔁', dimension: 'pinyin' },
  { key: 'typing', title: 'Typing Challenge', blurb: 'Type the pinyin. Tone marks or tone numbers.', icon: '⌨️', dimension: 'pinyin' },
  { key: 'rapid', title: 'Rapid Recognition', blurb: 'The word flashes for three seconds, then it is gone.', icon: '⏱️', dimension: 'character' },
  { key: 'char-spot', title: 'Spot the Character', blurb: 'Four near-identical characters. One is right.', icon: '🔍', dimension: 'character' },
  { key: 'disappearing', title: 'Disappearing Support', blurb: 'Five rounds, and the clues fall away one by one.', icon: '🫥', dimension: 'meaning' },
  { key: 'blur', title: 'Blur to Recall', blurb: 'The word fades. Finish it in your head.', icon: '🌫️', dimension: 'meaning' },
];

export const MODE_BY_KEY: Record<ModeKey, ModeInfo> = Object.fromEntries(
  MODES.map((m) => [m.key, m]),
) as Record<ModeKey, ModeInfo>;

export function availableModes(): ModeInfo[] {
  const audio = speechAvailable();
  return MODES.filter((m) => !m.needsAudio || audio);
}

/* ------------------------------------------------------------- similarity */

function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** How easy would it be to mistake `other` for `word`? Higher = more confusing. */
export function similarity(word: Word, other: Word): number {
  if (word.id === other.id) return -1;
  let score = 0;
  if (word.confusable.includes(other.id)) score += 8;
  if (word.pinyinPlain === other.pinyinPlain) score += 6;
  const sharedChars = word.chars.filter((c) => other.chars.some((o) => o.char === c.char)).length;
  score += sharedChars * 3;
  const bases = new Set(word.syllables.map((s) => s.base));
  const shared = other.syllables.filter((s) => bases.has(s.base)).length;
  score += shared * 2;
  if (word.category === other.category) score += 1.2;
  if (word.chars.length === other.chars.length) score += 0.4;
  if (word.syllables[0] && other.syllables[0]) {
    if (stripTones(word.syllables[0].base) === stripTones(other.syllables[0].base)) score += 1.5;
  }
  return score;
}

export interface DistractorOptions {
  count?: number;
  pool?: number[];
}

/**
 * Distractors that are plausible: near-misses teach, random noise does not.
 *
 * A supplied pool is honoured whenever it can supply enough alternatives — the
 * whole point of the family and confusion modes is that the wrong answers come
 * from inside the family.
 */
export function distractors(word: Word, opts: DistractorOptions = {}): Word[] {
  const count = opts.count ?? 3;
  const poolIds = opts.pool && opts.pool.length >= 4 ? opts.pool : WORDS.map((w) => w.id);
  const scored: { w: Word; s: number }[] = [];
  for (const id of poolIds) {
    if (id === word.id) continue;
    const other = tryWord(id);
    if (!other) continue;
    if (other.primaryMeaning === word.primaryMeaning) continue;
    scored.push({ w: other, s: similarity(word, other) });
  }
  scored.sort((a, b) => b.s - a.s);
  const near = scored.slice(0, Math.max(count * 4, 12));
  const chosen = shuffle(near).slice(0, count);
  if (chosen.length < count) {
    const rest = shuffle(scored.slice(near.length)).slice(0, count - chosen.length);
    chosen.push(...rest);
  }
  return chosen.map((x) => x.w);
}

/* --------------------------------------------------------- support levels */

/** Desirable difficulty: the stronger the word, the fewer clues it gets. */
export function supportsFor(status: Status): ('hanzi' | 'pinyin' | 'meaning')[] {
  switch (status) {
    case 'new':
    case 'fragile':
      return ['hanzi', 'pinyin', 'meaning'];
    case 'weak':
    case 'learning':
      return ['hanzi', 'pinyin'];
    case 'good':
      return ['hanzi'];
    default:
      return [];
  }
}

/** Multiple choice early, free recall later. */
export function preferTyping(state: AppState, id: number): boolean {
  const p = progressOf(state, id);
  return p.attempts >= 6 && avgScore(p) >= 0.6;
}

/* ------------------------------------------------------------- item makers */

let counter = 0;
function key(mode: string, id: number): string {
  counter += 1;
  return `${mode}:${id}:${counter}`;
}

function meaningLabel(w: Word): string {
  return w.primaryMeaning || w.allMeanings[0] || w.senses[0]?.meaning || '';
}

function optionFor(w: Word, face: 'hanzi' | 'pinyin' | 'meaning'): QuizOption {
  if (face === 'hanzi') return { key: String(w.id), label: w.hanzi, wordId: w.id };
  if (face === 'pinyin') return { key: String(w.id), label: w.pinyin, wordId: w.id };
  return { key: String(w.id), label: meaningLabel(w), wordId: w.id };
}

/**
 * Build the option list, guaranteeing that no two options carry the same
 * visible label. The PDF lists a handful of characters twice with different
 * readings (只 zhī / 只 zhǐ, 长 cháng, 对, 过, 还, 花), so a naive distractor
 * pick can produce a question with two identical-looking answers.
 */
function buildOptions(
  w: Word,
  face: 'hanzi' | 'pinyin' | 'meaning',
  pool: number[] | undefined,
  count: number,
): QuizOption[] {
  const correct = optionFor(w, face);
  const chosen: QuizOption[] = [correct];
  const seen = new Set([correct.label]);
  const candidates = distractors(w, { count: count * 6, pool });
  for (const other of candidates) {
    if (chosen.length > count) break;
    const opt = optionFor(other, face);
    if (seen.has(opt.label)) continue;
    seen.add(opt.label);
    chosen.push(opt);
  }
  if (chosen.length <= count) {
    // Last resort: widen to the whole corpus rather than ship a short question.
    for (const other of distractors(w, { count: count * 8 })) {
      if (chosen.length > count) break;
      const opt = optionFor(other, face);
      if (seen.has(opt.label)) continue;
      seen.add(opt.label);
      chosen.push(opt);
    }
  }
  return shuffle(chosen);
}

function mcq(
  mode: ModeKey,
  w: Word,
  cfg: {
    dimension: Dimension;
    instruction: string;
    prompt: string;
    promptSub?: string;
    optionFace: 'hanzi' | 'pinyin' | 'meaning';
    promptFace: QuizItem['promptFace'];
    pool?: number[];
    audioText?: string;
    reveal?: string;
    timeLimitMs?: number;
    hint?: string;
  },
): QuizItem {
  const options = buildOptions(w, cfg.optionFace, cfg.pool, 3);
  return {
    key: key(mode, w.id),
    wordId: w.id,
    dimension: cfg.dimension,
    kind: 'mcq',
    mode,
    promptFace: cfg.promptFace,
    answerFace: cfg.optionFace === 'meaning' ? 'meaning' : cfg.optionFace,
    instruction: cfg.instruction,
    prompt: cfg.prompt,
    promptSub: cfg.promptSub,
    options,
    answerKey: String(w.id),
    reveal: cfg.reveal ?? `${w.hanzi} · ${w.pinyin} · ${meaningLabel(w)}`,
    audioText: cfg.audioText,
    timeLimitMs: cfg.timeLimitMs,
    hint: cfg.hint,
  };
}

function toneSignature(w: Word): string {
  return w.tones.join('-');
}

function toneItem(w: Word, pool?: number[]): QuizItem {
  const target = toneSignature(w);
  const alt = new Set<string>([target]);
  const candidates = (pool ?? WORDS.map((x) => x.id))
    .map(tryWord)
    .filter((x): x is Word => !!x && x.syllables.length === w.syllables.length);
  for (const c of shuffle(candidates)) {
    if (alt.size >= 4) break;
    alt.add(toneSignature(c));
  }
  // Fall back to synthetic tone patterns if the corpus doesn't supply enough.
  while (alt.size < 4) {
    const made = w.tones.map(() => 1 + Math.floor(Math.random() * 4)).join('-');
    alt.add(made);
  }
  const options: QuizOption[] = shuffle([...alt]).map((sig) => ({
    key: sig,
    label: sig
      .split('-')
      .map((t) => (t === '5' ? '·' : t))
      .join(' '),
  }));
  return {
    key: key('tone', w.id),
    wordId: w.id,
    dimension: 'tone',
    kind: 'tone',
    mode: 'tone',
    promptFace: 'hanzi',
    answerFace: 'tone',
    instruction: 'Which tone pattern is it?',
    prompt: w.hanzi,
    promptSub: meaningLabel(w),
    options,
    answerKey: target,
    reveal: `${w.hanzi} ${w.pinyin} — ${target.split('-').join(' · ')}`,
  };
}

function typingItem(
  mode: ModeKey,
  w: Word,
  what: 'pinyin' | 'meaning',
  promptText: string,
  promptFace: QuizItem['promptFace'],
  instruction: string,
): QuizItem {
  return {
    key: key(mode, w.id),
    wordId: w.id,
    dimension: what === 'pinyin' ? 'pinyin' : 'meaning',
    kind: 'type',
    mode,
    promptFace,
    answerFace: what,
    instruction,
    prompt: promptText,
    promptSub: what === 'pinyin' ? undefined : w.pinyin,
    answerKey: what === 'pinyin' ? w.pinyin : meaningLabel(w),
    accept: what === 'pinyin' ? [w.pinyin] : w.allMeanings,
    reveal: `${w.hanzi} · ${w.pinyin} · ${meaningLabel(w)}`,
    hint:
      what === 'pinyin'
        ? 'Tone marks (xuéxí) or tone numbers (xue2xi2) both count.'
        : 'Any of the listed meanings is accepted.',
  };
}

function clozeItem(w: Word, pool?: number[]): QuizItem | null {
  const withGap = w.senses
    .flatMap((s) => s.examples)
    .filter((ex) => /[～~]/.test(ex.cloze));
  const ex = pick(withGap);
  if (!ex) return null;
  const options = buildOptions(w, 'hanzi', pool, 3);
  return {
    key: key('cloze', w.id),
    wordId: w.id,
    dimension: 'usage',
    kind: 'cloze',
    mode: 'cloze',
    promptFace: 'sentence',
    answerFace: 'hanzi',
    instruction: 'Which word fills the gap?',
    prompt: ex.cloze.replace(/[～~]/g, '＿＿'),
    promptSub: ex.en,
    options,
    answerKey: String(w.id),
    reveal: `${ex.zh}\n${ex.pinyin}\n${ex.en}`,
  };
}

function matchItem(ids: number[]): QuizItem | null {
  const seenHanzi = new Set<string>();
  const seenMeaning = new Set<string>();
  const words: Word[] = [];
  for (const w of ids.map(tryWord).filter((x): x is Word => !!x)) {
    if (words.length >= 5) break;
    const meaning = meaningLabel(w);
    if (seenHanzi.has(w.hanzi) || seenMeaning.has(meaning)) continue;
    seenHanzi.add(w.hanzi);
    seenMeaning.add(meaning);
    words.push(w);
  }
  if (words.length < 3) return null;
  return {
    key: key('match', words[0]!.id),
    wordId: words[0]!.id,
    dimension: 'meaning',
    kind: 'match',
    mode: 'match',
    promptFace: 'hanzi',
    answerFace: 'meaning',
    instruction: 'Tap a word, then tap its meaning.',
    prompt: '',
    answerKey: '',
    reveal: '',
    pairs: words.map((w) => ({
      left: { key: String(w.id), label: w.hanzi, sub: w.pinyin, wordId: w.id },
      right: { key: String(w.id), label: meaningLabel(w), wordId: w.id },
    })),
  };
}

function charSpotItem(w: Word): QuizItem | null {
  const target = pick(w.chars);
  if (!target) return null;
  // Characters that share a word-neighbourhood with the target: the ones a
  // learner actually mixes up, not random glyphs.
  const neighbourWords = wordsWithChar(target.char).flatMap((id) => tryWord(id)?.chars ?? []);
  const candidates = new Set<string>();
  for (const c of neighbourWords) if (c.char !== target.char) candidates.add(c.char);
  for (const other of distractors(w, { count: 8 })) {
    for (const c of other.chars) if (c.char !== target.char) candidates.add(c.char);
  }
  const wrong = shuffle([...candidates]).slice(0, 3);
  if (wrong.length < 3) return null;
  const options = shuffle([target.char, ...wrong]).map((c) => ({ key: c, label: c }));
  return {
    key: key('char-spot', w.id),
    wordId: w.id,
    dimension: 'character',
    kind: 'mcq',
    mode: 'char-spot',
    promptFace: 'char-pick',
    answerFace: 'hanzi',
    instruction: `Which character means “${target.gloss.split(';')[0]!.trim()}” (${target.pinyin})?`,
    prompt: w.hanzi.replace(target.char, '◻'),
    promptSub: `from ${w.hanzi} — ${meaningLabel(w)}`,
    options,
    answerKey: target.char,
    reveal: `${target.char} ${target.pinyin} — ${target.gloss}`,
  };
}

function confusionItem(w: Word): QuizItem | null {
  const sets = CONFUSIONS.filter((s) => s.words.includes(w.id));
  const set = pick(sets);
  if (!set) return null;
  const seen = new Set([w.hanzi]);
  const others: Word[] = [];
  for (const id of set.words) {
    if (id === w.id) continue;
    const other = tryWord(id);
    if (!other || seen.has(other.hanzi)) continue;
    seen.add(other.hanzi);
    others.push(other);
  }
  if (others.length === 0) return null;
  const options = shuffle([w, ...others]).map((x) => optionFor(x, 'hanzi'));
  return {
    key: key('confusion', w.id),
    wordId: w.id,
    dimension: 'character',
    kind: 'mcq',
    mode: 'confusion',
    promptFace: 'meaning',
    answerFace: 'hanzi',
    instruction: set.title,
    prompt: meaningLabel(w),
    promptSub: w.pinyin,
    options,
    answerKey: String(w.id),
    reveal: set.rule,
    hint: set.rule,
  };
}

function soundFamilyItem(w: Word): QuizItem | null {
  const syl = pick(w.syllables);
  if (!syl) return null;
  const family = SOUNDS.find((s) => s.base === syl.base);
  if (!family) return null;
  const pool = family.words;
  return mcq('sound-family', w, {
    dimension: 'pinyin',
    instruction: `Which word is pronounced ${w.pinyin}?`,
    prompt: w.pinyin,
    promptSub: meaningLabel(w),
    optionFace: 'hanzi',
    promptFace: 'pinyin',
    pool: pool.length > 6 ? pool : undefined,
    hint: `Sound family “${syl.base}”: ${family.hook}`,
  });
}

function charFamilyItem(w: Word): QuizItem | null {
  // Only characters with a big enough family can support the claim the
  // instruction makes, namely that every option contains this character.
  const candidates = w.chars.filter((c) => wordsWithChar(c.char).length >= 4);
  const c = pick(candidates);
  if (!c) return null;
  const family = wordsWithChar(c.char);
  const item = mcq('char-family', w, {
    dimension: 'character',
    instruction: `Every option contains 「${c.char}」. Which one means “${meaningLabel(w)}”?`,
    prompt: meaningLabel(w),
    promptSub: w.pinyin,
    optionFace: 'hanzi',
    promptFace: 'meaning',
    pool: family,
    hint: `${c.char} ${c.pinyin} — ${c.gloss}`,
  });
  // Distinct-label filtering can still leave a gap; never ship the claim unless
  // it actually holds.
  if (item.options?.some((o) => !o.label.includes(c.char))) return null;
  return item;
}

export interface BuildOptions {
  state: AppState;
  pool?: number[];
  timeLimitMs?: number;
}

export function buildItem(mode: ModeKey, wordId: number, opts: BuildOptions): QuizItem | null {
  const w = tryWord(wordId);
  if (!w) return null;
  const pool = opts.pool;
  const status = progressOf(opts.state, wordId).status;
  switch (mode) {
    case 'hanzi-meaning':
      return mcq('hanzi-meaning', w, {
        dimension: 'meaning',
        instruction: 'What does this word mean?',
        prompt: w.hanzi,
        promptSub: supportsFor(status).includes('pinyin') ? w.pinyin : undefined,
        optionFace: 'meaning',
        promptFace: 'hanzi',
        pool,
      });
    case 'meaning-hanzi':
      return mcq('meaning-hanzi', w, {
        dimension: 'character',
        instruction: 'Which characters write this?',
        prompt: meaningLabel(w),
        promptSub: supportsFor(status).includes('pinyin') ? w.pinyin : undefined,
        optionFace: 'hanzi',
        promptFace: 'meaning',
        pool,
      });
    case 'hanzi-pinyin':
      if (preferTyping(opts.state, wordId)) {
        return typingItem('hanzi-pinyin', w, 'pinyin', w.hanzi, 'hanzi', 'Type the pinyin.');
      }
      return mcq('hanzi-pinyin', w, {
        dimension: 'pinyin',
        instruction: 'How is it pronounced?',
        prompt: w.hanzi,
        promptSub: supportsFor(status).includes('meaning') ? meaningLabel(w) : undefined,
        optionFace: 'pinyin',
        promptFace: 'hanzi',
        pool,
      });
    case 'pinyin-hanzi':
      return mcq('pinyin-hanzi', w, {
        dimension: 'character',
        instruction: 'Which characters make this sound?',
        prompt: w.pinyin,
        promptSub: supportsFor(status).includes('meaning') ? meaningLabel(w) : undefined,
        optionFace: 'hanzi',
        promptFace: 'pinyin',
        pool,
      });
    case 'tone':
      return toneItem(w, pool);
    case 'listen-meaning':
      if (!speechAvailable()) return null;
      return mcq('listen-meaning', w, {
        dimension: 'listening',
        instruction: 'Listen, then choose the meaning.',
        prompt: '🔊',
        optionFace: 'meaning',
        promptFace: 'audio',
        audioText: w.plain,
        pool,
      });
    case 'listen-hanzi':
      if (!speechAvailable()) return null;
      return mcq('listen-hanzi', w, {
        dimension: 'listening',
        instruction: 'Listen, then choose the characters.',
        prompt: '🔊',
        optionFace: 'hanzi',
        promptFace: 'audio',
        audioText: w.plain,
        pool,
      });
    case 'cloze':
      return clozeItem(w, pool);
    case 'match':
      return matchItem(pool && pool.length >= 3 ? pool : [wordId]);
    case 'speed':
      return mcq('speed', w, {
        dimension: 'meaning',
        instruction: 'Quick! What does it mean?',
        prompt: w.hanzi,
        optionFace: 'meaning',
        promptFace: 'hanzi',
        pool,
        timeLimitMs: opts.timeLimitMs ?? 6000,
      });
    case 'rescue':
      return mcq('rescue', w, {
        dimension: 'meaning',
        instruction: 'Rescue this word — what does it mean?',
        prompt: w.hanzi,
        promptSub: w.pinyin,
        optionFace: 'meaning',
        promptFace: 'hanzi',
        pool,
        hint: w.story,
      });
    case 'confusion':
      return confusionItem(w);
    case 'char-family':
      return charFamilyItem(w);
    case 'sound-family':
      return soundFamilyItem(w);
    case 'story-recall':
      return mcq('story-recall', w, {
        dimension: 'meaning',
        instruction: 'Which word does this memory scene belong to?',
        prompt: w.story,
        optionFace: 'hanzi',
        promptFace: 'meaning',
        pool,
      });
    case 'reverse':
      return typingItem(
        'reverse',
        w,
        'pinyin',
        meaningLabel(w),
        'meaning',
        'Type the pinyin for this meaning.',
      );
    case 'typing':
      return typingItem('typing', w, 'pinyin', w.hanzi, 'hanzi', 'Type the pinyin.');
    case 'rapid':
      return {
        ...mcq('rapid', w, {
          dimension: 'character',
          instruction: 'It flashes for 3 seconds. Then answer from memory.',
          prompt: w.hanzi,
          optionFace: 'meaning',
          promptFace: 'hanzi',
          pool,
        }),
        kind: 'mcq',
      };
    case 'char-spot':
      return charSpotItem(w);
    case 'disappearing':
      return mcq('disappearing', w, {
        dimension: 'meaning',
        instruction: 'Round by round the clues fall away.',
        prompt: w.hanzi,
        optionFace: 'meaning',
        promptFace: 'hanzi',
        pool,
      });
    case 'blur':
      return mcq('blur', w, {
        dimension: 'meaning',
        instruction: 'The characters are fading. Finish it in your head.',
        prompt: w.hanzi,
        optionFace: 'meaning',
        promptFace: 'hanzi',
        pool,
      });
    default:
      return null;
  }
}

/* -------------------------------------------------------------- answering */

export interface Judgement {
  correct: boolean;
  errorKind?: ErrorKind;
  confusedWith?: number;
  note?: string;
}

/**
 * Never just "wrong": work out WHY it was wrong so the notebook and the error
 * engine can say something useful.
 */
export function judge(
  item: QuizItem,
  given: string,
  ms: number,
  opts: { lenientPinyin?: boolean } = {},
): Judgement {
  if (item.kind === 'type') {
    const target = item.answerKey;
    if (item.answerFace === 'pinyin') {
      const verdict = accepted(given, target);
      if (verdict === 'exact') {
        return {
          correct: true,
          note: ms > 12000 ? 'Right — but that took a while. Speed is part of memory.' : undefined,
        };
      }
      if (verdict === 'toneless') {
        // Typing tone marks on a phone keyboard is a typing test, not a
        // language test. By default the syllables are what counts, and the
        // tone-marked form is shown so the tone is still learned.
        if (opts.lenientPinyin !== false) {
          return { correct: true, note: `Correct. With tones: ${target}` };
        }
        return {
          correct: false,
          errorKind: 'tone',
          note: `The syllables were right — the tones were not. It is ${target}.`,
        };
      }
      if (!given.trim()) return { correct: false, errorKind: 'forgotten' };
      return { correct: false, errorKind: 'pinyin', note: 'The syllables themselves were off.' };
    }
    const ok = englishMatches(given, item.accept ?? [item.answerKey]);
    return ok
      ? { correct: true }
      : { correct: false, errorKind: given.trim() ? 'meaning' : 'forgotten' };
  }

  if (item.kind === 'tone') {
    if (given === item.answerKey) return { correct: true };
    const got = given.split('-');
    const want = item.answerKey.split('-');
    const wrongCount = got.filter((t, i) => t !== want[i]).length;
    return {
      correct: false,
      errorKind: 'tone',
      note:
        wrongCount === 1
          ? 'You knew the shape — one syllable was off.'
          : 'More than one tone slipped. Say it out loud with the shapes.',
    };
  }

  const correct = given === item.answerKey;
  if (correct) {
    return {
      correct: true,
      note: ms > 15000 ? 'Correct, but slow — this one still needs work.' : undefined,
    };
  }
  if (!given) return { correct: false, errorKind: 'forgotten', note: 'Time ran out.' };
  const chosenWordId = item.options?.find((o) => o.key === given)?.wordId;
  const target = tryWord(item.wordId);
  if (chosenWordId && target) {
    const other = tryWord(chosenWordId);
    if (other) {
      if (target.confusable.includes(other.id)) {
        return {
          correct: false,
          errorKind: 'similar-word',
          confusedWith: other.id,
          note: `You picked ${other.hanzi} (${other.pinyin}) — a known look-alike.`,
        };
      }
      if (other.pinyinPlain === target.pinyinPlain) {
        return {
          correct: false,
          errorKind: 'tone',
          confusedWith: other.id,
          note: `${other.hanzi} and ${target.hanzi} share the syllables — only the tones differ.`,
        };
      }
      if (other.chars.some((c) => target.chars.some((t) => t.char === c.char))) {
        return {
          correct: false,
          errorKind: 'character',
          confusedWith: other.id,
          note: `${other.hanzi} shares a character with ${target.hanzi}.`,
        };
      }
    }
  }
  const map: Record<string, ErrorKind> = {
    audio: 'listening',
    hanzi: 'character',
    pinyin: 'pinyin',
    meaning: 'meaning',
    sentence: 'meaning',
  };
  return {
    correct: false,
    errorKind: map[item.promptFace] ?? 'meaning',
    confusedWith: chosenWordId,
  };
}
