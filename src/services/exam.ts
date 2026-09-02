/**
 * The HSK 3 mock exam.
 *
 * Structure follows the official paper: 40 listening, 30 reading and 10 writing
 * questions, 80 in all, scored out of 300 with 180 to pass. The questions are
 * ORIGINAL — nothing is copied from a real exam paper. Every sentence, dialogue
 * and passage is drawn from this app's own vetted corpus (the 600 headwords,
 * their example sentences, the 40 stories and the 41 conversation episodes), so
 * the Chinese in a mock is always grammatical and always at level.
 *
 * A paper is generated from a seed, so the same seed reproduces the same paper
 * exactly — which is what makes the shuffling testable and the answer keys
 * safe: options are shuffled first and the key is then looked up by value.
 */
import { CONVERSATION_INDEX, WORDS, getWord, loadConversations, loadStories } from '../data';
import type { Scene, Word } from '../types';

export type Section = 'listening' | 'reading' | 'writing';
export type Part = 'L1' | 'L2' | 'L3' | 'L4' | 'R1' | 'R2' | 'R3' | 'W1' | 'W2';

export interface ExamQuestion {
  id: string;
  part: Part;
  section: Section;
  /** Spoken in listening questions. Hanzi only — never shown during the exam. */
  audio?: { text: string; speaker?: 'a' | 'b' }[];
  /** The written question. Chinese. */
  prompt: string;
  /** Extra line under the prompt (a sentence to judge, a passage). */
  passage?: string;
  /** Study aids: shown in practice and in the post-exam review, never in a mock. */
  pinyin?: string;
  english?: string;
  kind: 'choice' | 'truefalse' | 'order' | 'blank';
  options: string[];
  /** Index into `options`. Resolved after shuffling, so it cannot drift. */
  answer: number;
  /** Word-order questions: the shuffled tiles and the sentence they build. */
  tiles?: string[];
  answerText?: string;
  /** Vocabulary this question assesses, for the weakness report. */
  wordIds: number[];
  explain: string;
}

export interface ExamPaper {
  seed: number;
  createdAt: number;
  questions: ExamQuestion[];
  counts: Record<Section, number>;
}

export type AnswerMap = Record<string, string>;

export interface SectionScore {
  raw: number;
  total: number;
  score: number;
}

export interface ExamResult {
  seed: number;
  finishedAt: number;
  msUsed: number;
  listening: SectionScore;
  reading: SectionScore;
  writing: SectionScore;
  total: number;
  passed: boolean;
  wrongIds: string[];
  weakWordIds: number[];
}

export const PASS_MARK = 180;
export const SECTION_MAX = 100;

/** Official-style timing, in minutes. */
export const TIMING: Record<Section, number> = { listening: 35, reading: 30, writing: 15 };
export const FULL_MINUTES = TIMING.listening + TIMING.reading + TIMING.writing;

export const PART_LABEL: Record<Part, string> = {
  L1: 'Listening · Part 1',
  L2: 'Listening · Part 2',
  L3: 'Listening · Part 3',
  L4: 'Listening · Part 4',
  R1: 'Reading · Part 1',
  R2: 'Reading · Part 2',
  R3: 'Reading · Part 3',
  W1: 'Writing · Part 1',
  W2: 'Writing · Part 2',
};

/* ------------------------------------------------------------------- rng */

/** Small deterministic generator: the same seed always rebuilds the same paper. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function take<T>(items: T[], n: number): T[] {
  return items.slice(0, n);
}

/* ----------------------------------------------------------------- corpus */

interface ExampleRef {
  word: Word;
  zh: string;
  cloze: string;
  en: string;
  pinyin: string;
  tokens: string[];
}

/** Topic names in Chinese, so a comprehension question never leaks English. */
const TOPIC_ZH: Record<string, string> = {
  Animals: '动物',
  Celebration: '节日',
  City: '城市',
  Clothes: '衣服',
  'Daily communication': '日常交流',
  'Daily life': '日常生活',
  'Daily routine': '每天的生活',
  Directions: '问路',
  Entertainment: '休息和玩',
  Family: '家人',
  Food: '吃饭',
  Friends: '朋友',
  Health: '身体',
  Holidays: '假期',
  Home: '家里',
  Introductions: '介绍自己',
  Memories: '以前的事',
  Nature: '自然',
  People: '人',
  Plans: '打算',
  Problems: '遇到问题',
  Restaurant: '饭馆',
  School: '学校',
  Shopping: '买东西',
  Society: '社会',
  Sport: '运动',
  Study: '学习',
  Time: '时间',
  Transport: '坐车',
  Travel: '旅行',
  Weather: '天气',
  Weekends: '周末',
  Work: '工作',
};

export function topicZh(topic: string): string {
  return TOPIC_ZH[topic] ?? topic;
}

interface Corpus {
  examples: ExampleRef[];
  stories: Scene[];
  conversations: Scene[];
}

let corpusPromise: Promise<Corpus> | null = null;

/** Everything a paper is built from. Loaded once, then reused. */
export function loadCorpus(): Promise<Corpus> {
  corpusPromise ??= (async () => {
    const [storyMap, convMap] = await Promise.all([loadStories(), loadConversations()]);
    const examples: ExampleRef[] = [];
    for (const w of WORDS) {
      for (const sense of w.senses) {
        for (const ex of sense.examples) {
          const tokens = ex.tokens.filter((t) => /[一-鿿]/.test(t.z)).map((t) => t.z);
          examples.push({
            word: w,
            zh: ex.zh,
            cloze: ex.cloze,
            en: ex.en,
            pinyin: ex.pinyin,
            tokens,
          });
        }
      }
    }
    return {
      examples,
      stories: [...storyMap.values()],
      conversations: [...convMap.values()],
    };
  })();
  return corpusPromise;
}

/* ------------------------------------------------------------- generation */

/** Words the learner has been tested on least come up first. */
function orderByNeed(weights: Record<number, number>, rand: () => number): Word[] {
  const scored = WORDS.map((w) => ({ w, seen: weights[w.id] ?? 0, jitter: rand() }));
  scored.sort((a, b) => (a.seen === b.seen ? a.jitter - b.jitter : a.seen - b.seen));
  return scored.map((s) => s.w);
}

/** Build a 3- or 4-option question, shuffling first and keying by value. */
function choiceQuestion(
  base: Omit<ExamQuestion, 'options' | 'answer'>,
  correct: string,
  distractors: string[],
  rand: () => number,
): ExamQuestion | null {
  const pool = [correct, ...distractors.filter((d) => d !== correct)];
  const unique = Array.from(new Set(pool));
  if (unique.length < 3 || !unique.includes(correct)) return null;
  const options = shuffle(unique, rand);
  const answer = options.indexOf(correct);
  if (answer < 0) return null;
  return { ...base, options, answer };
}

function sentenceHasWord(sentence: string, word: Word): boolean {
  return word.matchForms.every((f) => sentence.includes(f));
}

/* --- listening ----------------------------------------------------------- */

function buildL1(c: Corpus, words: Word[], rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const used = new Set<string>();
  const candidates = shuffle(
    c.examples.filter((e) => e.zh.length >= 6 && e.tokens.length >= 3),
    rand,
  );
  for (const ex of candidates) {
    if (out.length >= n) break;
    if (used.has(ex.zh)) continue;
    const distractors = take(
      words.filter((w) => w.id !== ex.word.id && !sentenceHasWord(ex.zh, w) && w.plain.length <= 3),
      24,
    );
    const picks = take(shuffle(distractors, rand), 2).map((w) => w.hanzi);
    const q = choiceQuestion(
      {
        id: `L1-${out.length + 1}`,
        part: 'L1',
        section: 'listening',
        audio: [{ text: ex.zh, speaker: 'a' }],
        prompt: '听录音，选出你听到的词。',
        pinyin: ex.pinyin,
        english: ex.en,
        kind: 'choice',
        wordIds: [ex.word.id],
        explain: `You heard 「${ex.zh}」, which contains ${ex.word.hanzi} (${ex.word.pinyin}) — ${ex.word.primaryMeaning}.`,
      },
      ex.word.hanzi,
      picks,
      rand,
    );
    if (!q) continue;
    used.add(ex.zh);
    out.push(q);
  }
  return out;
}

function buildL2(c: Corpus, rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const pool = shuffle(
    c.examples.filter((e) => e.zh.length >= 6),
    rand,
  );
  for (let i = 0; i < pool.length && out.length < n; i += 1) {
    const heard = pool[i]!;
    // Half the items really do match; the rest show a different real sentence.
    const isTrue = rand() < 0.5;
    const other = pool[(i + 7 + Math.floor(rand() * 40)) % pool.length]!;
    if (!isTrue && other.zh === heard.zh) continue;
    const shown = isTrue ? heard.zh : other.zh;
    out.push({
      id: `L2-${out.length + 1}`,
      part: 'L2',
      section: 'listening',
      audio: [{ text: heard.zh, speaker: 'a' }],
      prompt: '听录音，判断下面的句子和录音是不是一样。',
      passage: shown,
      pinyin: heard.pinyin,
      english: heard.en,
      kind: 'truefalse',
      options: ['对', '错'],
      answer: isTrue ? 0 : 1,
      wordIds: [heard.word.id],
      explain: isTrue
        ? `The sentence shown is the one you heard: 「${heard.zh}」`
        : `You heard 「${heard.zh}」 but the sentence shown was 「${shown}」.`,
    });
  }
  return out;
}

function dialogueQuestion(
  scene: Scene,
  from: number,
  turns: number,
  part: 'L3' | 'L4',
  index: number,
  words: Word[],
  rand: () => number,
): ExamQuestion | null {
  const lines = scene.lines.slice(from, from + turns);
  if (lines.length < turns) return null;
  const audio = lines.map((l) => ({
    text: l.zh,
    speaker: (l.speaker === 'B' ? 'b' : 'a') as 'a' | 'b',
  }));
  const spoken = lines.map((l) => l.zh).join('');

  if (part === 'L3') {
    // Which of these words was actually said?
    const heard = scene.targets
      .map(getWord)
      .filter((w) => sentenceHasWord(spoken, w) && w.plain.length <= 3);
    const correct = heard[Math.floor(rand() * heard.length)];
    if (!correct) return null;
    const distractors = take(
      shuffle(
        words.filter((w) => !sentenceHasWord(spoken, w) && w.plain.length <= 3),
        rand,
      ),
      2,
    ).map((w) => w.hanzi);
    return choiceQuestion(
      {
        id: `L3-${index}`,
        part: 'L3',
        section: 'listening',
        audio,
        prompt: '听对话，选出对话里出现的词。',
        pinyin: lines.map((l) => l.pinyin).join(' / '),
        english: lines.map((l) => l.en).join(' '),
        kind: 'choice',
        wordIds: [correct.id],
        explain: `${correct.hanzi} (${correct.pinyin}) — ${correct.primaryMeaning} — was said in the dialogue.`,
      },
      correct.hanzi,
      distractors,
      rand,
    );
  }

  // L4: what is this longer exchange about?
  const correctTopic = topicZh(scene.topic);
  const others = shuffle(
    CONVERSATION_INDEX.filter((s) => s.topic !== scene.topic).map((s) => topicZh(s.topic)),
    rand,
  );
  return choiceQuestion(
    {
      id: `L4-${index}`,
      part: 'L4',
      section: 'listening',
      audio,
      prompt: '听对话，这段话最可能和什么有关？',
      pinyin: lines.map((l) => l.pinyin).join(' / '),
      english: lines.map((l) => l.en).join(' '),
      kind: 'choice',
      wordIds: scene.targets.slice(0, 6),
      explain: `The exchange is about ${correctTopic} — ${scene.title}.`,
    },
    correctTopic,
    take(Array.from(new Set(others)), 2),
    rand,
  );
}

/* --- reading ------------------------------------------------------------- */

function buildR1(c: Corpus, words: Word[], rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const pool = shuffle(
    c.examples.filter((e) => e.cloze.includes('～') && e.zh.length >= 6),
    rand,
  );
  for (const ex of pool) {
    if (out.length >= n) break;
    const distractors = take(
      shuffle(
        words.filter(
          (w) =>
            w.id !== ex.word.id &&
            !ex.zh.includes(w.plain) &&
            Math.abs(w.plain.length - ex.word.plain.length) <= 1,
        ),
        rand,
      ),
      3,
    ).map((w) => w.hanzi);
    const q = choiceQuestion(
      {
        id: `R1-${out.length + 1}`,
        part: 'R1',
        section: 'reading',
        prompt: '选词填空。',
        passage: ex.cloze.replace(/～/g, '＿＿'),
        pinyin: ex.pinyin,
        english: ex.en,
        kind: 'blank',
        wordIds: [ex.word.id],
        explain: `The full sentence is 「${ex.zh}」. ${ex.word.hanzi} (${ex.word.pinyin}) means ${ex.word.primaryMeaning}.`,
      },
      ex.word.hanzi,
      distractors,
      rand,
    );
    if (q) out.push(q);
  }
  return out;
}

function buildR2(c: Corpus, rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const scenes = shuffle(c.conversations, rand);
  const replies = c.conversations.flatMap((s) => s.lines.map((l) => l.zh));
  for (const scene of scenes) {
    if (out.length >= n) break;
    const at = Math.floor(rand() * Math.max(1, scene.lines.length - 1));
    const ask = scene.lines[at];
    const reply = scene.lines[at + 1];
    if (!ask || !reply) continue;
    const distractors = take(
      shuffle(
        replies.filter((r) => r !== reply.zh && r !== ask.zh && r.length >= 4),
        rand,
      ),
      2,
    );
    const q = choiceQuestion(
      {
        id: `R2-${out.length + 1}`,
        part: 'R2',
        section: 'reading',
        prompt: '选出合适的回答。',
        passage: ask.zh,
        pinyin: reply.pinyin,
        english: `${ask.en} — ${reply.en}`,
        kind: 'choice',
        wordIds: scene.targets.slice(0, 4),
        explain: `「${ask.zh}」 is answered by 「${reply.zh}」. ${reply.en}`,
      },
      reply.zh,
      distractors,
      rand,
    );
    if (q) out.push(q);
  }
  return out;
}

function buildR3(c: Corpus, rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const scenes = shuffle(c.stories, rand);
  const allLines = c.stories.flatMap((s) => s.lines.map((l) => ({ zh: l.zh, id: s.id })));
  for (const scene of scenes) {
    if (out.length >= n) break;
    const from = Math.floor(rand() * Math.max(1, scene.lines.length - 3));
    const passage = scene.lines.slice(from, from + 3);
    if (passage.length < 3) continue;
    const correct = passage[Math.floor(rand() * passage.length)]!;
    const distractors = take(
      shuffle(
        allLines.filter((l) => l.id !== scene.id && l.zh.length >= 6),
        rand,
      ),
      2,
    ).map((l) => l.zh);
    const q = choiceQuestion(
      {
        id: `R3-${out.length + 1}`,
        part: 'R3',
        section: 'reading',
        prompt: '读短文，选出短文里出现的句子。',
        passage: passage.map((l) => l.zh).join(''),
        pinyin: passage.map((l) => l.pinyin).join(' '),
        english: passage.map((l) => l.en).join(' '),
        kind: 'choice',
        wordIds: scene.targets.slice(0, 6),
        explain: `「${correct.zh}」 appears in the passage. ${correct.en}`,
      },
      correct.zh,
      distractors,
      rand,
    );
    if (q) out.push(q);
  }
  return out;
}

/* --- writing ------------------------------------------------------------- */

function buildW1(c: Corpus, rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const pool = shuffle(
    // Short sentences only: a four-to-six word sentence has one natural order,
    // which is what makes a single answer key fair.
    c.examples.filter((e) => e.tokens.length >= 4 && e.tokens.length <= 6),
    rand,
  );
  const seen = new Set<string>();
  for (const ex of pool) {
    if (out.length >= n) break;
    if (seen.has(ex.zh)) continue;
    const tiles = shuffle(ex.tokens, rand);
    if (tiles.join('') === ex.tokens.join('')) continue;
    seen.add(ex.zh);
    out.push({
      id: `W1-${out.length + 1}`,
      part: 'W1',
      section: 'writing',
      prompt: '连词成句。',
      pinyin: ex.pinyin,
      english: ex.en,
      kind: 'order',
      options: [],
      answer: 0,
      tiles,
      answerText: ex.tokens.join(''),
      wordIds: [ex.word.id],
      explain: `The sentence is 「${ex.tokens.join('')}」. ${ex.en}`,
    });
  }
  return out;
}

function buildW2(c: Corpus, words: Word[], rand: () => number, n: number): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const pool = shuffle(
    c.examples.filter((e) => e.cloze.includes('～') && e.word.plain.length <= 2),
    rand,
  );
  for (const ex of pool) {
    if (out.length >= n) break;
    const distractors = take(
      shuffle(
        words.filter(
          (w) =>
            w.id !== ex.word.id &&
            w.plain.length === ex.word.plain.length &&
            w.pinyinPlain !== ex.word.pinyinPlain,
        ),
        rand,
      ),
      3,
    ).map((w) => w.hanzi);
    const q = choiceQuestion(
      {
        id: `W2-${out.length + 1}`,
        part: 'W2',
        section: 'writing',
        prompt: `看拼音，写词语： ${ex.word.pinyin}`,
        passage: ex.cloze.replace(/～/g, '＿＿'),
        pinyin: ex.pinyin,
        english: ex.en,
        kind: 'blank',
        wordIds: [ex.word.id],
        explain: `${ex.word.pinyin} is written ${ex.word.hanzi} — ${ex.word.primaryMeaning}. The sentence is 「${ex.zh}」.`,
      },
      ex.word.hanzi,
      distractors,
      rand,
    );
    if (q) out.push(q);
  }
  return out;
}

/* --------------------------------------------------------------- assemble */

export interface GenerateOptions {
  seed?: number;
  /** How often each word has been examined already; rarer words come first. */
  weights?: Record<number, number>;
  /** A short paper for practice. Full exam by default. */
  quick?: boolean;
  /** Limit to one section for the practice modes. */
  only?: Section;
}

const FULL_PLAN: { part: Part; count: number }[] = [
  { part: 'L1', count: 10 },
  { part: 'L2', count: 10 },
  { part: 'L3', count: 10 },
  { part: 'L4', count: 10 },
  { part: 'R1', count: 10 },
  { part: 'R2', count: 10 },
  { part: 'R3', count: 10 },
  { part: 'W1', count: 5 },
  { part: 'W2', count: 5 },
];

function sectionOf(part: Part): Section {
  if (part.startsWith('L')) return 'listening';
  if (part.startsWith('R')) return 'reading';
  return 'writing';
}

/**
 * Build one paper. Every call with a fresh seed produces a different selection
 * and a different option order, while the section shape stays exact.
 */
export async function generateExam(opts: GenerateOptions = {}): Promise<ExamPaper> {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = rng(seed);
  const corpus = await loadCorpus();
  const words = orderByNeed(opts.weights ?? {}, rand);

  const plan = FULL_PLAN.filter((p) => !opts.only || sectionOf(p.part) === opts.only).map((p) => ({
    ...p,
    count: opts.quick ? Math.max(2, Math.round(p.count / 5)) : p.count,
  }));

  const questions: ExamQuestion[] = [];
  for (const step of plan) {
    let built: ExamQuestion[] = [];
    switch (step.part) {
      case 'L1':
        built = buildL1(corpus, words, rand, step.count);
        break;
      case 'L2':
        built = buildL2(corpus, rand, step.count);
        break;
      case 'L3':
      case 'L4': {
        const scenes = shuffle(corpus.conversations, rand);
        const turns = step.part === 'L3' ? 2 : 4;
        for (const scene of scenes) {
          if (built.length >= step.count) break;
          // Open on speaker A: an excerpt that starts mid-reply reads oddly.
          const starts = scene.lines
            .map((l, i) => (l.speaker === 'A' && i + turns <= scene.lines.length ? i : -1))
            .filter((i) => i >= 0);
          if (!starts.length) continue;
          const from = starts[Math.floor(rand() * starts.length)]!;
          const q = dialogueQuestion(
            scene,
            from,
            turns,
            step.part,
            built.length + 1,
            words,
            rand,
          );
          if (q) built.push(q);
        }
        break;
      }
      case 'R1':
        built = buildR1(corpus, words, rand, step.count);
        break;
      case 'R2':
        built = buildR2(corpus, rand, step.count);
        break;
      case 'R3':
        built = buildR3(corpus, rand, step.count);
        break;
      case 'W1':
        built = buildW1(corpus, rand, step.count);
        break;
      case 'W2':
        built = buildW2(corpus, words, rand, step.count);
        break;
    }
    // Ids are assigned after selection so they are always 1..n with no gaps.
    built.slice(0, step.count).forEach((q, i) => {
      questions.push({ ...q, id: `${step.part}-${i + 1}` });
    });
    if (built.length < step.count) {
      throw new Error(
        `Could not build ${step.count} ${step.part} questions (only ${built.length}).`,
      );
    }
  }

  const counts: Record<Section, number> = { listening: 0, reading: 0, writing: 0 };
  for (const q of questions) counts[q.section] += 1;

  return { seed, createdAt: Date.now(), questions, counts };
}

/* ---------------------------------------------------------------- scoring */

function isCorrect(q: ExamQuestion, given: string | undefined): boolean {
  if (given === undefined || given === '') return false;
  if (q.kind === 'order') return given === q.answerText;
  return given === q.options[q.answer];
}

function sectionScore(questions: ExamQuestion[], answers: AnswerMap, section: Section): SectionScore {
  const inSection = questions.filter((q) => q.section === section);
  const raw = inSection.filter((q) => isCorrect(q, answers[q.id])).length;
  const total = inSection.length;
  return {
    raw,
    total,
    score: total === 0 ? 0 : Math.round((raw / total) * SECTION_MAX),
  };
}

export function scorePaper(paper: ExamPaper, answers: AnswerMap, msUsed: number): ExamResult {
  const listening = sectionScore(paper.questions, answers, 'listening');
  const reading = sectionScore(paper.questions, answers, 'reading');
  const writing = sectionScore(paper.questions, answers, 'writing');
  const total = listening.score + reading.score + writing.score;
  const wrong = paper.questions.filter((q) => !isCorrect(q, answers[q.id]));
  const weak = new Set<number>();
  for (const q of wrong) for (const id of q.wordIds) weak.add(id);
  return {
    seed: paper.seed,
    finishedAt: Date.now(),
    msUsed,
    listening,
    reading,
    writing,
    total,
    passed: total >= PASS_MARK,
    wrongIds: wrong.map((q) => q.id),
    weakWordIds: [...weak],
  };
}

export function questionCorrect(q: ExamQuestion, given: string | undefined): boolean {
  return isCorrect(q, given);
}

export function correctAnswerText(q: ExamQuestion): string {
  return q.kind === 'order' ? (q.answerText ?? '') : (q.options[q.answer] ?? '');
}
