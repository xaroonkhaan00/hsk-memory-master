import {
  DIMENSIONS,
  type AppState,
  type AudioSettings,
  type CaptionSettings,
  type SceneProgress,
  type Attempt,
  type Dimension,
  type ErrorKind,
  type Settings,
  type Status,
  type WordProgress,
} from '../types';
import { TOTAL, WORDS } from '../data';

export const MINUTE = 60_000;
export const DAY = 86_400_000;

export const STATE_VERSION = 2;

export const DEFAULT_AUDIO: AudioSettings = {
  voiceId: null,
  speakerAVoiceId: null,
  speakerBVoiceId: null,
  // Slightly slower than natural conversation: easier to follow, still natural.
  rate: 0.85,
  repeat: 1,
  autoWord: true,
  autoSentence: false,
  autoStory: true,
  autoConversation: true,
};

export const DEFAULT_CAPTIONS: CaptionSettings = {
  hanzi: true,
  pinyin: true,
  // English stays off so the learner reaches for meaning before the translation.
  english: false,
  highlightTargets: true,
};

export const DEFAULT_SETTINGS: Settings = {
  dailyMinutes: 10,
  selfReportedWeakness: 'all',
  theme: 'system',
  audioRate: 0.85,
  onboarded: false,
  showPinyinDefault: true,
  audio: { ...DEFAULT_AUDIO },
  captions: { ...DEFAULT_CAPTIONS },
  storyDifficulty: 'normal',
};

export function emptyScenes(): SceneProgress {
  return { completed: [], replays: {}, scores: {}, hiddenEnglish: [], listening: [] };
}

export function emptyProgress(id: number): WordProgress {
  return {
    id,
    scores: { character: 0, meaning: 0, pinyin: 0, tone: 0, listening: 0, usage: 0 },
    attempts: 0,
    correct: 0,
    streak: 0,
    lapses: 0,
    ease: 2.5,
    interval: 0,
    due: null,
    last: null,
    avgMs: 0,
    status: 'new',
    starred: false,
    lists: [],
    errors: [],
    introduced: false,
    note: '',
  };
}

export function defaultSettings(): Settings {
  // Nested objects are copied too: a shallow spread would hand every caller the
  // same audio and caption objects, so one screen's edit would leak into the
  // defaults a reset restores.
  return {
    ...DEFAULT_SETTINGS,
    audio: { ...DEFAULT_AUDIO },
    captions: { ...DEFAULT_CAPTIONS },
  };
}

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    settings: defaultSettings(),
    progress: {},
    attempts: [],
    days: {},
    packDone: {},
    bossScores: {},
    achievements: [],
    customLists: {},
    confusionLosses: {},
    stories: emptyScenes(),
    conversations: emptyScenes(),
    saved: { stories: [], conversations: [], lines: [] },
    createdAt: Date.now(),
  };
}

export function progressOf(state: AppState, id: number): WordProgress {
  return state.progress[id] ?? emptyProgress(id);
}

export function dateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ grading */

/**
 * A four-point grade in the SM-2 tradition, but derived from what actually
 * happened rather than asked of the learner: speed matters, so a correct answer
 * that took 15 seconds is worth less than an instant one.
 */
export type Grade = 0 | 1 | 2 | 3;

export function gradeFor(correct: boolean, ms: number): Grade {
  if (!correct) return 0;
  if (ms <= 3500) return 3;
  if (ms <= 8000) return 2;
  return 1;
}

const SCORE_GAIN: Record<Grade, number> = { 0: 0, 1: 0.35, 2: 0.65, 3: 1 };

/** Exponential moving average, faster to fall than to rise. */
function nextScore(prev: number, grade: Grade): number {
  const target = SCORE_GAIN[grade];
  const alpha = grade === 0 ? 0.55 : 0.32;
  return Math.max(0, Math.min(1, prev + (target - prev) * alpha));
}

export function scheduleNext(p: WordProgress, grade: Grade, now: number): WordProgress {
  let { ease, interval, lapses, streak } = p;
  if (grade === 0) {
    lapses += 1;
    streak = 0;
    ease = Math.max(1.3, ease - 0.24);
    // Straight back into the session, and the next real interval is short.
    interval = 0;
  } else {
    streak += 1;
    if (grade === 1) ease = Math.max(1.3, ease - 0.14);
    else if (grade === 3) ease = Math.min(2.8, ease + 0.1);
    if (interval === 0) interval = grade === 1 ? 0.4 : grade === 2 ? 1 : 2;
    else if (interval < 1) interval = grade === 1 ? 1 : 2;
    else {
      const mult = grade === 1 ? 1.25 : grade === 2 ? ease : ease * 1.25;
      // Repeated lapses permanently shorten this word's intervals.
      const penalty = 1 / (1 + lapses * 0.18);
      interval = Math.max(1, interval * mult * penalty);
    }
    interval = Math.min(interval, 240);
  }
  const fuzz = 0.95 + Math.random() * 0.1;
  const due = grade === 0 ? now + 8 * MINUTE : now + interval * DAY * fuzz;
  return { ...p, ease, interval, lapses, streak, due };
}

export function classify(p: WordProgress): Status {
  if (!p.introduced && p.attempts === 0) return 'new';
  const dims = DIMENSIONS.map((d) => p.scores[d]);
  const avg = dims.reduce((a, b) => a + b, 0) / dims.length;
  const worst = Math.min(...dims);
  if (p.attempts < 3) return 'fragile';
  if (p.lapses >= 3 && avg < 0.55) return 'weak';
  if (avg < 0.35) return 'weak';
  if (avg < 0.6) return 'learning';
  if (avg < 0.78 || worst < 0.45) return 'good';
  if (p.interval >= 21 && avg >= 0.88 && worst >= 0.7) return 'mastered';
  return 'strong';
}

/**
 * How urgently this word needs work right now. Combines lapses, overdueness,
 * per-dimension weakness and response speed.
 */
export function difficulty(p: WordProgress, now: number): number {
  const dims = DIMENSIONS.map((d) => p.scores[d]);
  const avg = dims.reduce((a, b) => a + b, 0) / dims.length;
  const worst = Math.min(...dims);
  const overdue = p.due ? Math.max(0, (now - p.due) / DAY) : 0;
  const slow = p.avgMs > 0 ? Math.min(1, p.avgMs / 12000) : 0.3;
  const errorRate = p.attempts ? 1 - p.correct / p.attempts : 0.5;
  return (
    (1 - avg) * 3 +
    (1 - worst) * 1.5 +
    errorRate * 2 +
    Math.min(overdue, 14) * 0.22 +
    p.lapses * 0.35 +
    slow * 0.6
  );
}

/* ------------------------------------------------------------- recording */

export interface RecordInput {
  wordId: number;
  dimension: Dimension;
  correct: boolean;
  ms: number;
  mode: string;
  errorKind?: ErrorKind;
  given?: string;
  expected?: string;
  confusedWith?: number;
  schedule?: boolean;
}

const MAX_ATTEMPTS = 4000;
const MAX_ERRORS = 30;

export function recordAnswer(state: AppState, input: RecordInput, now = Date.now()): AppState {
  const prev = progressOf(state, input.wordId);
  const grade = gradeFor(input.correct, input.ms);
  const scores = { ...prev.scores };
  scores[input.dimension] = nextScore(scores[input.dimension], grade);
  // A correct answer nudges neighbouring dimensions a little: seeing the hanzi
  // and producing the meaning is partial evidence for the other faces too.
  if (input.correct) {
    for (const d of DIMENSIONS) {
      if (d !== input.dimension) scores[d] = Math.min(1, scores[d] + 0.02);
    }
  }
  const attempts = prev.attempts + 1;
  const correct = prev.correct + (input.correct ? 1 : 0);
  const avgMs = prev.avgMs === 0 ? input.ms : prev.avgMs * 0.8 + input.ms * 0.2;
  let next: WordProgress = {
    ...prev,
    scores,
    attempts,
    correct,
    avgMs,
    last: now,
    introduced: true,
  };
  if (input.schedule !== false) next = scheduleNext(next, grade, now);
  else {
    next.streak = input.correct ? next.streak + 1 : 0;
    if (!input.correct) next.lapses += 1;
  }
  if (!input.correct && input.errorKind) {
    next.errors = [
      {
        at: now,
        kind: input.errorKind,
        dimension: input.dimension,
        given: input.given ?? '',
        expected: input.expected ?? '',
        confusedWith: input.confusedWith,
      },
      ...prev.errors,
    ].slice(0, MAX_ERRORS);
  }
  next.status = classify(next);

  const attempt: Attempt = {
    at: now,
    wordId: input.wordId,
    dimension: input.dimension,
    correct: input.correct,
    ms: input.ms,
    mode: input.mode,
  };
  const key = dateKey(now);
  const day = state.days[key] ?? { date: key, reviews: 0, correct: 0, newWords: 0, ms: 0 };
  const isNewToday = !prev.introduced;

  const confusionLosses = { ...state.confusionLosses };
  if (!input.correct && input.confusedWith) {
    const pairKey = [input.wordId, input.confusedWith].sort((a, b) => a - b).join('-');
    confusionLosses[pairKey] = (confusionLosses[pairKey] ?? 0) + 1;
  }

  return {
    ...state,
    progress: { ...state.progress, [input.wordId]: next },
    attempts: [...state.attempts, attempt].slice(-MAX_ATTEMPTS),
    confusionLosses,
    days: {
      ...state.days,
      [key]: {
        ...day,
        reviews: day.reviews + 1,
        correct: day.correct + (input.correct ? 1 : 0),
        newWords: day.newWords + (isNewToday ? 1 : 0),
        ms: day.ms + input.ms,
      },
    },
  };
}

/* ------------------------------------------------------- memory fingerprint */

export interface Fingerprint {
  ready: boolean;
  sample: number;
  byDimension: Record<Dimension, { accuracy: number; n: number; avgMs: number }>;
  weakest: Dimension[];
  strongest: Dimension[];
  weights: Record<Dimension, number>;
}

const FINGERPRINT_WINDOW = 400;
export const FINGERPRINT_MIN = 30;

export function fingerprint(state: AppState): Fingerprint {
  const recent = state.attempts.slice(-FINGERPRINT_WINDOW);
  const byDimension = {} as Fingerprint['byDimension'];
  for (const d of DIMENSIONS) byDimension[d] = { accuracy: 0, n: 0, avgMs: 0 };
  for (const a of recent) {
    const row = byDimension[a.dimension];
    if (!row) continue;
    row.n += 1;
    row.accuracy += a.correct ? 1 : 0;
    row.avgMs += a.ms;
  }
  for (const d of DIMENSIONS) {
    const row = byDimension[d];
    if (row.n > 0) {
      row.accuracy = row.accuracy / row.n;
      row.avgMs = row.avgMs / row.n;
    }
  }
  const measured = DIMENSIONS.filter((d) => byDimension[d].n >= 5);
  const ranked = [...measured].sort((a, b) => byDimension[a].accuracy - byDimension[b].accuracy);
  const bias = state.settings.selfReportedWeakness;
  const weights = {} as Record<Dimension, number>;
  for (const d of DIMENSIONS) {
    const row = byDimension[d];
    // Unmeasured dimensions sit at 1; measured weak ones climb toward 2.5.
    let w = row.n >= 5 ? 0.6 + (1 - row.accuracy) * 2 : 1;
    if (recent.length < FINGERPRINT_MIN && (bias === d || bias === 'all')) w += 0.5;
    weights[d] = Math.max(0.35, w);
  }
  return {
    ready: recent.length >= FINGERPRINT_MIN,
    sample: recent.length,
    byDimension,
    weakest: ranked.slice(0, 2),
    strongest: ranked.slice(-2).reverse(),
    weights,
  };
}

/* ------------------------------------------------------------- collections */

export function dueWords(state: AppState, now = Date.now()): number[] {
  return WORDS.filter((w) => {
    const p = state.progress[w.id];
    return p && p.introduced && p.due !== null && p.due <= now;
  })
    .map((w) => w.id)
    .sort((a, b) => (state.progress[a]!.due ?? 0) - (state.progress[b]!.due ?? 0));
}

export function introducedIds(state: AppState): number[] {
  return Object.values(state.progress)
    .filter((p) => p.introduced)
    .map((p) => p.id);
}

export function weakWords(state: AppState, now = Date.now(), limit = 60): number[] {
  return introducedIds(state)
    .map((id) => ({ id, d: difficulty(state.progress[id]!, now) }))
    .filter((x) => {
      const st = state.progress[x.id]!.status;
      return st === 'weak' || st === 'fragile' || st === 'learning';
    })
    .sort((a, b) => b.d - a.d)
    .slice(0, limit)
    .map((x) => x.id);
}

export function dangerWords(state: AppState, limit = 10): number[] {
  return introducedIds(state)
    .map((id) => state.progress[id]!)
    .filter((p) => p.errors.length > 0 || p.lapses > 0)
    .sort(
      (a, b) =>
        b.lapses * 2 + b.errors.length - (a.lapses * 2 + a.errors.length) ||
        a.correct / Math.max(1, a.attempts) - b.correct / Math.max(1, b.attempts),
    )
    .slice(0, limit)
    .map((p) => p.id);
}

export function strongestWords(state: AppState, limit = 10): number[] {
  return introducedIds(state)
    .map((id) => state.progress[id]!)
    .filter((p) => p.attempts >= 3)
    .sort((a, b) => avgScore(b) - avgScore(a) || b.interval - a.interval)
    .slice(0, limit)
    .map((p) => p.id);
}

export function improvingWords(state: AppState, limit = 10): number[] {
  // Words that used to go wrong but are now on a run of correct answers.
  return introducedIds(state)
    .map((id) => state.progress[id]!)
    .filter((p) => p.lapses > 0 && p.streak >= 2)
    .sort((a, b) => b.streak * b.lapses - a.streak * a.lapses)
    .slice(0, limit)
    .map((p) => p.id);
}

export function avgScore(p: WordProgress): number {
  return DIMENSIONS.reduce((sum, d) => sum + p.scores[d], 0) / DIMENSIONS.length;
}

export function newWordCandidates(state: AppState, limit = 40): number[] {
  const out: number[] = [];
  for (const w of WORDS) {
    const p = state.progress[w.id];
    if (!p || !p.introduced) out.push(w.id);
    if (out.length >= limit) break;
  }
  return out;
}

export interface Overview {
  seen: number;
  learning: number;
  strong: number;
  mastered: number;
  due: number;
  accuracy: number;
  avgMs: number;
  streak: number;
  total: number;
  byStatus: Record<Status, number>;
}

export function overview(state: AppState, now = Date.now()): Overview {
  const byStatus = {
    new: 0,
    fragile: 0,
    weak: 0,
    learning: 0,
    good: 0,
    strong: 0,
    mastered: 0,
  } as Record<Status, number>;
  let seen = 0;
  for (const w of WORDS) {
    const p = state.progress[w.id];
    const status = p && p.introduced ? p.status : 'new';
    byStatus[status] += 1;
    if (p?.introduced) seen += 1;
  }
  const recent = state.attempts.slice(-500);
  const accuracy = recent.length
    ? recent.filter((a) => a.correct).length / recent.length
    : 0;
  const avgMs = recent.length ? recent.reduce((s, a) => s + a.ms, 0) / recent.length : 0;
  return {
    seen,
    learning: byStatus.fragile + byStatus.weak + byStatus.learning + byStatus.good,
    strong: byStatus.strong,
    mastered: byStatus.mastered,
    due: dueWords(state, now).length,
    accuracy,
    avgMs,
    streak: studyStreak(state, now),
    total: TOTAL,
    byStatus,
  };
}

/**
 * Study streak. One missed day does not reset it — improvement matters more
 * than streak addiction — but two in a row does.
 */
export function studyStreak(state: AppState, now = Date.now()): number {
  const days = new Set(Object.keys(state.days).filter((k) => state.days[k]!.reviews > 0));
  if (days.size === 0) return 0;
  let streak = 0;
  let misses = 0;
  for (let i = 0; i < 400; i += 1) {
    const key = dateKey(now - i * DAY);
    if (days.has(key)) {
      streak += 1;
      misses = 0;
    } else if (i === 0) {
      // today not studied yet: doesn't break anything
      continue;
    } else {
      misses += 1;
      if (misses >= 2) break;
    }
  }
  return streak;
}

/** Adaptive daily goal: shrinks when accuracy drops, grows when it is high. */
export function dailyNewGoal(state: AppState): number {
  const recent = state.attempts.slice(-60);
  const base = { 5: 5, 10: 10, 20: 20, 30: 25 }[state.settings.dailyMinutes];
  if (recent.length < 20) return base;
  const acc = recent.filter((a) => a.correct).length / recent.length;
  if (acc < 0.6) return Math.max(4, Math.round(base * 0.5));
  if (acc < 0.75) return Math.max(5, Math.round(base * 0.75));
  if (acc > 0.9) return Math.round(base * 1.2);
  return base;
}

/**
 * Bring a state loaded from storage — including a v1 backup that predates
 * stories, conversations and audio settings — up to the current shape. New
 * blocks are filled with defaults; nothing the learner earned is discarded.
 */
export function migrate(loaded: AppState): AppState {
  const base = emptyState();
  const state: AppState = {
    ...base,
    ...loaded,
    version: STATE_VERSION,
    // A v1 backup has no audio/caption blocks; fill them in rather than
    // dropping the learner's progress or resetting their preferences.
    settings: {
      ...base.settings,
      ...loaded.settings,
      audio: { ...DEFAULT_AUDIO, ...(loaded.settings?.audio ?? {}) },
      captions: { ...DEFAULT_CAPTIONS, ...(loaded.settings?.captions ?? {}) },
      storyDifficulty: loaded.settings?.storyDifficulty ?? base.settings.storyDifficulty,
    },
    stories: { ...emptyScenes(), ...(loaded.stories ?? {}) },
    conversations: { ...emptyScenes(), ...(loaded.conversations ?? {}) },
    saved: {
      stories: loaded.saved?.stories ?? [],
      conversations: loaded.saved?.conversations ?? [],
      lines: loaded.saved?.lines ?? [],
    },
    progress: loaded.progress ?? {},
    attempts: loaded.attempts ?? [],
    days: loaded.days ?? {},
    packDone: loaded.packDone ?? {},
    bossScores: loaded.bossScores ?? {},
    achievements: loaded.achievements ?? [],
    customLists: loaded.customLists ?? {},
    confusionLosses: loaded.confusionLosses ?? {},
  };
  for (const [id, p] of Object.entries(state.progress)) {
    state.progress[Number(id)] = { ...emptyProgress(Number(id)), ...(p as WordProgress) };
  }
  return state;
}
