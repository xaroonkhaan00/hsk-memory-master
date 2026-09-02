/* ---------------------------------------------------------------- source data */

/** A syllable of the headword's pinyin, aligned 1:1 with its hanzi. */
export interface Syllable {
  raw: string;
  base: string;
  tone: number;
}

export interface ExampleToken {
  z: string;
  p?: string;
  /** id of the vocabulary entry this token is, when it is one of the 600. */
  w?: number;
}

/** An example sentence. `cloze` keeps the PDF's original ～ placeholder. */
export interface Example {
  zh: string;
  cloze: string;
  tokens: ExampleToken[];
  pinyin: string;
  en: string;
}

export interface Sense {
  pos: string;
  meaning: string;
  meanings: string[];
  examples: Example[];
}

export interface CharInfo {
  char: string;
  gloss: string;
  pinyin: string;
}

export interface SoundHook {
  syllable: string;
  base: string;
  tone: number;
  hook: string;
}

export interface Word {
  id: number;
  level: 1 | 2 | 3;
  hanzi: string;
  plain: string;
  pinyin: string;
  pinyinPlain: string;
  syllables: Syllable[];
  tones: number[];
  senses: Sense[];
  chars: CharInfo[];
  category: string;
  room: string;
  story: string;
  soundHooks: SoundHook[];
  charLogic: string | null;
  primaryMeaning: string;
  allMeanings: string[];
  pos: string[];
  related: { id: number; via: string[] }[];
  /** Ids of the Story Mode episodes and Conversation Cinema episodes using it. */
  inStories: string[];
  inConversations: string[];
  matchForms: string[];
  /** Other entries in the PDF that print the same characters. */
  alsoListedAs: number[];
  confusable: number[];
  pack: string;
}

export interface CharHub {
  char: string;
  pinyin: string;
  gloss: string;
  words: number[];
}

export interface SoundFamily {
  base: string;
  hook: string;
  words: number[];
}

export interface SoundGroup {
  key: string;
  label: string;
  tip: string;
  syllables: string[];
  words: number[];
}

export interface Family {
  char: string;
  pinyin: string;
  gloss: string;
  words: number[];
}

export interface Pack {
  id: string;
  index: number;
  level: number;
  label: string;
  title: string;
  words: number[];
  categories: string[];
}

export interface ConfusionSet {
  key: string;
  words: number[];
  kind: string;
  title: string;
  rule: string;
}

export interface ToneTwin {
  base: string;
  variants: { pinyin: string; words: number[] }[];
}

export interface MeasureWord {
  mw: string;
  pinyin: string;
  wordId: number;
  counts: string;
  rule: string;
  examples: { zh: string; pinyin: string; en: string }[];
  trap: string;
}

export interface Room {
  key: string;
  label: string;
  icon: string;
  words: number[];
}

export interface JourneyStep extends Room {
  step: number;
  room: string;
  caption: string;
}

export interface DialogueLine {
  speaker: string;
  zh: string;
  en: string;
  pinyin: string;
  tokens: ExampleToken[];
}

export interface Dialogue {
  id: string;
  title: string;
  lines: DialogueLine[];
  targets: number[];
  allWords: number[];
}

export interface SceneLine {
  zh: string;
  en: string;
  pinyin: string;
  tokens: ExampleToken[];
  speaker?: string;
}

export interface Scene {
  id: string;
  title: string;
  emoji: string;
  topic: string;
  lines: SceneLine[];
  targets: number[];
  chars: number;
  level: 1 | 2 | 3;
}

/** The light record used by lists and word pages, without the scene text. */
export interface SceneRef {
  id: string;
  title: string;
  emoji: string;
  topic: string;
  lines: number;
  words: number;
  first: string;
}

export interface StoryChain {
  packId: string;
  title: string;
  words: number[];
}

export interface Meta {
  generatedFrom: string;
  totalWords: number;
  totalExamples: number;
  totalSenses: number;
  uniqueCharacters: number;
  uniqueSyllables: number;
  packs: number;
  confusionSets: number;
  toneTwins: number;
  measureWords: number;
  dialogues: number;
  storyEpisodes: number;
  conversationEpisodes: number;
  storyCoverage: number;
  conversationCoverage: number;
  storyMissing: number[];
  conversationMissing: number[];
  idsCovered: number;
  duplicateIds: number[];
  missingIds: number[];
  missingPinyin: number[];
  missingMeaning: number[];
  missingExample: number[];
  posAbsentInPdf: number[];
  repeatedHeadwords: { hanzi: string; words: number[] }[];
  charactersWithoutGloss: string[];
  syllablesWithoutHook: string[];
  syllableCountMismatch: number[];
  warnings: string[];
  levels: Record<string, number>;
  categories: Record<string, number>;
  categoryLabels: Record<string, string>;
}

/* ---------------------------------------------------------------- progress */

export const DIMENSIONS = [
  'character',
  'meaning',
  'pinyin',
  'tone',
  'listening',
  'usage',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const STATUSES = [
  'new',
  'fragile',
  'weak',
  'learning',
  'good',
  'strong',
  'mastered',
] as const;
export type Status = (typeof STATUSES)[number];

export type ErrorKind =
  | 'meaning'
  | 'pinyin'
  | 'tone'
  | 'character'
  | 'similar-word'
  | 'listening'
  | 'forgotten'
  | 'slow';

export interface ErrorLog {
  at: number;
  kind: ErrorKind;
  dimension: Dimension;
  given: string;
  expected: string;
  confusedWith?: number;
}

export interface WordProgress {
  id: number;
  scores: Record<Dimension, number>;
  attempts: number;
  correct: number;
  streak: number;
  lapses: number;
  ease: number;
  interval: number;
  due: number | null;
  last: number | null;
  avgMs: number;
  status: Status;
  starred: boolean;
  lists: string[];
  errors: ErrorLog[];
  introduced: boolean;
  /** The learner's own sentence or hook for this word — their words, not ours. */
  note: string;
}

export interface Attempt {
  at: number;
  wordId: number;
  dimension: Dimension;
  correct: boolean;
  ms: number;
  mode: string;
}

export interface DayLog {
  date: string;
  reviews: number;
  correct: number;
  newWords: number;
  ms: number;
}

export type CaptionMode = 'beginner' | 'intermediate' | 'recall' | 'listening';
export type StoryDifficulty = 'easy' | 'normal' | 'challenge';

export interface AudioSettings {
  /** voiceURI of the preferred Mandarin voice, or null to let the app choose. */
  voiceId: string | null;
  /** Voices for the two speakers in Conversation Cinema. */
  speakerAVoiceId: string | null;
  speakerBVoiceId: string | null;
  /** 0.65 | 0.75 | 0.85 | 1.0 — slower than conversation by default. */
  rate: number;
  /** 1, 2 or 3 plays per tap. */
  repeat: 1 | 2 | 3;
  autoWord: boolean;
  autoSentence: boolean;
  autoStory: boolean;
  autoConversation: boolean;
  autoListening: boolean;
}

export interface CaptionSettings {
  hanzi: boolean;
  pinyin: boolean;
  english: boolean;
  highlightTargets: boolean;
}

/** How a typed pinyin answer is graded, and how pinyin is shown. */
export type PinyinInputMode = 'lenient' | 'strict';
export type PinyinDisplay = 'marks' | 'plain' | 'hidden';

export interface Settings {
  dailyMinutes: 5 | 10 | 20 | 30;
  selfReportedWeakness: Dimension | 'all';
  theme: 'system' | 'light' | 'dark';
  /** Kept for backwards compatibility with v1 exports; audio.rate supersedes it. */
  audioRate: number;
  onboarded: boolean;
  showPinyinDefault: boolean;
  audio: AudioSettings;
  captions: CaptionSettings;
  /** Conversation Cinema keeps its own caption defaults. */
  cinemaCaptions: CaptionSettings;
  storyDifficulty: StoryDifficulty;
  /** 'lenient' accepts xuexi for xuéxí; tone marks are never required. */
  pinyinInput: PinyinInputMode;
  pinyinDisplay: PinyinDisplay;
  examStrict: boolean;
}

export interface Achievement {
  key: string;
  at: number;
}

export interface SceneProgress {
  /** ids of stories/episodes the learner has played to the end */
  completed: string[];
  /** times each has been replayed */
  replays: Record<string, number>;
  /** quiz accuracy per scene, most recent */
  scores: Record<string, number>;
  /** completions with English captions off */
  hiddenEnglish: string[];
  /** completions in listening-only mode */
  listening: string[];
}

/** One completed mock exam, kept so progress over time is visible. */
export interface ExamRecord {
  at: number;
  seed: number;
  mode: 'full' | 'quick' | 'listening' | 'reading' | 'writing';
  listening: number;
  reading: number;
  writing: number;
  total: number;
  passed: boolean;
  msUsed: number;
  questions: number;
  correct: number;
}

export interface ExamState {
  history: ExamRecord[];
  /** How often each word has been examined, so rarer words come up first. */
  seen: Record<number, number>;
}

export interface AppState {
  version: number;
  settings: Settings;
  progress: Record<number, WordProgress>;
  attempts: Attempt[];
  days: Record<string, DayLog>;
  packDone: Record<string, number>;
  bossScores: Record<string, BossResult>;
  achievements: Achievement[];
  customLists: Record<string, number[]>;
  confusionLosses: Record<string, number>;
  stories: SceneProgress;
  conversations: SceneProgress;
  /** Saved stories, episodes and individual lines. */
  saved: { stories: string[]; conversations: string[]; lines: string[] };
  exams: ExamState;
  createdAt: number;
}

export interface BossResult {
  at: number;
  overall: number;
  byDimension: Record<Dimension, number>;
  total: number;
}

/* ---------------------------------------------------------------- quiz */

export type QuizKind = 'mcq' | 'type' | 'tone' | 'match' | 'cloze';

export type Face =
  | 'hanzi'
  | 'pinyin'
  | 'meaning'
  | 'audio'
  | 'sentence'
  | 'tone'
  | 'char-pick';

export interface QuizOption {
  key: string;
  label: string;
  sub?: string;
  wordId?: number;
}

export interface QuizItem {
  key: string;
  wordId: number;
  dimension: Dimension;
  kind: QuizKind;
  mode: string;
  promptFace: Face;
  answerFace: Face;
  instruction: string;
  prompt: string;
  promptSub?: string;
  options?: QuizOption[];
  answerKey: string;
  accept?: string[];
  reveal: string;
  hint?: string;
  pairs?: { left: QuizOption; right: QuizOption }[];
  audioText?: string;
  supports?: ('hanzi' | 'pinyin' | 'meaning')[];
  timeLimitMs?: number;
}

export interface QuizResult {
  item: QuizItem;
  correct: boolean;
  ms: number;
  given: string;
  errorKind?: ErrorKind;
  confusedWith?: number;
}
