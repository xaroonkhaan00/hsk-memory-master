import { BOSS_BANDS, PACKS, STORIES, WORDS, tryWord } from '../data';
import type { AppState, Dimension, QuizItem } from '../types';
import { DIMENSIONS } from '../types';
import {
  dailyNewGoal,
  difficulty,
  dueWords,
  fingerprint,
  newWordCandidates,
  progressOf,
  weakWords,
} from './progress';
import { MODES, type ModeKey, buildItem } from './quiz';

const DIMENSION_MODES: Record<Dimension, ModeKey[]> = {
  character: ['meaning-hanzi', 'pinyin-hanzi', 'char-spot', 'char-family', 'rapid'],
  meaning: ['hanzi-meaning', 'story-recall', 'blur', 'disappearing'],
  pinyin: ['hanzi-pinyin', 'typing', 'reverse', 'sound-family'],
  tone: ['tone'],
  listening: ['listen-meaning', 'listen-hanzi'],
  usage: ['cloze'],
};

function weightedPick(weights: Record<Dimension, number>, allowed: Dimension[]): Dimension {
  const total = allowed.reduce((s, d) => s + weights[d], 0);
  let r = Math.random() * total;
  for (const d of allowed) {
    r -= weights[d];
    if (r <= 0) return d;
  }
  return allowed[allowed.length - 1]!;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface SessionOptions {
  state: AppState;
  wordIds: number[];
  length: number;
  /** Restrict to these dimensions; otherwise the fingerprint decides. */
  dimensions?: Dimension[];
  audioAvailable: boolean;
  pool?: number[];
}

/**
 * Build a mixed quiz over the given words, weighted toward whatever the
 * learner's Memory Fingerprint says is weakest.
 */
export function buildMixedSession(opts: SessionOptions): QuizItem[] {
  const { state, wordIds, length } = opts;
  if (wordIds.length === 0) return [];
  const fp = fingerprint(state);
  const audio = opts.audioAvailable;
  const allowed = (opts.dimensions ?? [...DIMENSIONS]).filter(
    (d) => d !== 'listening' || audio,
  );
  const items: QuizItem[] = [];
  const queue = shuffle(wordIds);
  let guard = 0;
  while (items.length < length && guard < length * 12) {
    guard += 1;
    const wordId = queue[items.length % queue.length]!;
    const dim = weightedPick(fp.weights, allowed);
    const modes = DIMENSION_MODES[dim].filter((m) => {
      const info = MODES.find((x) => x.key === m);
      return !info?.needsAudio || audio;
    });
    const mode = modes[Math.floor(Math.random() * modes.length)];
    if (!mode) continue;
    const item = buildItem(mode, wordId, { state, pool: opts.pool ?? wordIds });
    if (item) items.push(item);
  }
  return items;
}

export type SessionBlockKind = 'new' | 'review' | 'weak' | 'sound' | 'mixed';

export interface SessionBlock {
  kind: SessionBlockKind;
  title: string;
  items: QuizItem[];
}

export interface DailySession {
  blocks: SessionBlock[];
  items: QuizItem[];
  newWordIds: number[];
  reviewIds: number[];
  minutes: number;
}

const ITEMS_PER_MINUTE = 6;

/**
 * The daily session. Composition shifts with the fingerprint: whichever
 * dimension is weakest gets its own block and more of the mixed block.
 */
export function buildDailySession(state: AppState, minutes: number, audio: boolean): DailySession {
  const now = Date.now();
  const budget = minutes * ITEMS_PER_MINUTE;
  const fp = fingerprint(state);
  const due = dueWords(state, now);
  const weak = weakWords(state, now, 40);
  const goal = dailyNewGoal(state);
  const fresh = newWordCandidates(state, Math.min(goal, Math.ceil(minutes * 1.2)));

  const blocks: SessionBlock[] = [];
  const share = {
    review: due.length ? 0.4 : 0,
    weak: weak.length ? 0.22 : 0,
    fresh: fresh.length ? 0.25 : 0,
  };
  const used = share.review + share.weak + share.fresh;
  const mixedShare = Math.max(0.15, 1 - used);

  if (fresh.length) {
    const ids = fresh.slice(0, Math.max(3, Math.round(budget * share.fresh) / 2));
    blocks.push({
      kind: 'new',
      title: 'New words',
      items: buildMixedSession({
        state,
        wordIds: ids,
        length: Math.max(4, Math.round(budget * share.fresh)),
        dimensions: ['meaning', 'character', 'pinyin'],
        audioAvailable: audio,
      }),
    });
  }
  if (due.length) {
    const ids = due.slice(0, 30);
    blocks.push({
      kind: 'review',
      title: 'Reviews due',
      items: buildMixedSession({
        state,
        wordIds: ids,
        length: Math.max(4, Math.round(budget * share.review)),
        audioAvailable: audio,
      }),
    });
  }
  if (weak.length) {
    blocks.push({
      kind: 'weak',
      title: 'Weak words',
      items: buildMixedSession({
        state,
        wordIds: weak.slice(0, 20),
        length: Math.max(3, Math.round(budget * share.weak)),
        audioAvailable: audio,
      }),
    });
  }
  const seen = Object.values(state.progress)
    .filter((p) => p.introduced)
    .map((p) => p.id);
  const mixedPool = seen.length >= 8 ? seen : WORDS.slice(0, 40).map((w) => w.id);
  const focus = fp.weakest.length ? fp.weakest : (['tone', 'listening'] as Dimension[]);
  blocks.push({
    kind: 'mixed',
    title: fp.ready ? `Targeting your weakest: ${focus.join(' + ')}` : 'Mixed recall',
    items: buildMixedSession({
      state,
      wordIds: shuffle(mixedPool).slice(0, 30),
      length: Math.max(4, Math.round(budget * mixedShare)),
      dimensions: fp.ready ? focus : undefined,
      audioAvailable: audio,
    }),
  });

  const items = blocks.flatMap((b) => b.items);
  return {
    blocks,
    items,
    newWordIds: fresh,
    reviewIds: due,
    minutes,
  };
}

/** Cram: weakest, most overdue, most confused — nothing else. */
export function buildCram(state: AppState, size: number, audio: boolean): QuizItem[] {
  const now = Date.now();
  const seen = Object.values(state.progress).filter((p) => p.introduced);
  const ranked = seen
    .map((p) => ({ id: p.id, d: difficulty(p, now) }))
    .sort((a, b) => b.d - a.d)
    .map((x) => x.id);
  const ids = ranked.slice(0, size);
  if (ids.length < size) {
    for (const w of WORDS) {
      if (ids.length >= size) break;
      if (!ids.includes(w.id)) ids.push(w.id);
    }
  }
  return buildMixedSession({
    state,
    wordIds: ids,
    length: size,
    audioAvailable: audio,
  });
}

/**
 * Boss battles sample the band rather than asking all N questions, and weight
 * the sample toward whatever the fingerprint says is shaky.
 */
export function buildBoss(state: AppState, bandKey: string, audio: boolean): QuizItem[] {
  const band = BOSS_BANDS.find((b) => b.key === bandKey);
  if (!band) return [];
  const now = Date.now();
  const size = band.n === 6 ? 60 : 30;
  const scored = band.words
    .map((id) => ({ id, d: difficulty(progressOf(state, id), now) }))
    .sort((a, b) => b.d - a.d);
  const weakHalf = scored.slice(0, Math.floor(size * 0.6)).map((x) => x.id);
  const rest = shuffle(scored.slice(Math.floor(size * 0.6)).map((x) => x.id)).slice(
    0,
    size - weakHalf.length,
  );
  const ids = shuffle([...weakHalf, ...rest]).slice(0, size);
  return buildMixedSession({
    state,
    wordIds: ids,
    length: size,
    audioAvailable: audio,
    pool: band.words,
  });
}

/** The ten stages of a Magic 20 pack. */
export const MAGIC_STAGES = [
  { key: 'preview', title: 'Preview', blurb: 'Meet the twenty. No pressure, no answers needed.' },
  { key: 'understand', title: 'Understand', blurb: 'Break every word into its characters.' },
  { key: 'connect', title: 'Connect', blurb: 'See what these words share with each other.' },
  { key: 'visualise', title: 'Visualise', blurb: 'One absurd scene per word.' },
  { key: 'pronounce', title: 'Pronounce', blurb: 'Tones and sounds, out loud.' },
  { key: 'recognise', title: 'Recognise', blurb: 'Can you pick it out of a line-up?' },
  { key: 'recall', title: 'Recall', blurb: 'No options. Produce it.' },
  { key: 'use', title: 'Use', blurb: 'Real sentences with the word cut out.' },
  { key: 'test', title: 'Test', blurb: 'Mixed, no clues.' },
  { key: 'retest', title: 'Retest mistakes', blurb: 'Only what you got wrong.' },
] as const;

export type MagicStage = (typeof MAGIC_STAGES)[number]['key'];

export function buildStageItems(
  stage: MagicStage,
  state: AppState,
  ids: number[],
  audio: boolean,
): QuizItem[] {
  const opts = { state, pool: ids };
  const make = (mode: ModeKey, list = ids) =>
    list.map((id) => buildItem(mode, id, opts)).filter((x): x is QuizItem => !!x);
  switch (stage) {
    case 'recognise':
      return shuffle([...make('hanzi-meaning'), ...make('meaning-hanzi')]).slice(0, ids.length + 6);
    case 'recall':
      return shuffle([...make('typing'), ...make('reverse')]).slice(0, ids.length);
    case 'use':
      return make('cloze');
    case 'test': {
      const listening = audio ? make('listen-meaning').slice(0, 4) : [];
      return shuffle([
        ...make('hanzi-pinyin'),
        ...make('tone').slice(0, 6),
        ...listening,
        ...make('hanzi-meaning').slice(0, 6),
      ]).slice(0, ids.length + 8);
    }
    case 'pronounce':
      return make('tone');
    default:
      return [];
  }
}

export function packProgress(state: AppState, packId: string): {
  total: number;
  introduced: number;
  strong: number;
  percent: number;
} {
  const pack = PACKS.find((p) => p.id === packId);
  if (!pack) return { total: 0, introduced: 0, strong: 0, percent: 0 };
  let introduced = 0;
  let strong = 0;
  for (const id of pack.words) {
    const p = state.progress[id];
    if (p?.introduced) introduced += 1;
    if (p && (p.status === 'strong' || p.status === 'mastered')) strong += 1;
  }
  return {
    total: pack.words.length,
    introduced,
    strong,
    percent: pack.words.length ? Math.round((introduced / pack.words.length) * 100) : 0,
  };
}

export function storyFor(packId: string): { words: number[]; title: string } | null {
  const s = STORIES.find((x) => x.packId === packId);
  if (!s) return null;
  return { words: s.words.filter((id) => !!tryWord(id)), title: s.title };
}

/**
 * Smart stopping: if the last stretch of a session has gone badly, stop
 * introducing new words and swap in review instead.
 */
export function shouldSlowDown(recent: { correct: boolean }[]): boolean {
  if (recent.length < 8) return false;
  const tail = recent.slice(-8);
  return tail.filter((r) => r.correct).length <= 4;
}
