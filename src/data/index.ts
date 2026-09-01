import vocabJson from './generated/vocab.json';
import charsJson from './generated/characters.json';
import soundsJson from './generated/sounds.json';
import familiesJson from './generated/families.json';
import packsJson from './generated/packs.json';
import confusionsJson from './generated/confusions.json';
import measureJson from './generated/measurewords.json';
import palaceJson from './generated/palace.json';
import dialoguesJson from './generated/dialogues.json';
import storiesJson from './generated/stories.json';
import metaJson from './generated/meta.json';

import type {
  CharHub,
  Dialogue,
  ConfusionSet,
  Family,
  JourneyStep,
  MeasureWord,
  Meta,
  Pack,
  Room,
  SoundFamily,
  SoundGroup,
  StoryChain,
  ToneTwin,
  Word,
} from '../types';

export const WORDS = vocabJson as unknown as Word[];
export const CHAR_HUBS = charsJson as unknown as CharHub[];
export const SOUNDS = (soundsJson as unknown as {
  syllables: SoundFamily[];
  groups: SoundGroup[];
}).syllables;
export const SOUND_GROUPS = (soundsJson as unknown as {
  syllables: SoundFamily[];
  groups: SoundGroup[];
}).groups;
export const FAMILIES = familiesJson as unknown as Family[];
export const PACKS = packsJson as unknown as Pack[];
export const CONFUSIONS = (confusionsJson as unknown as {
  sets: ConfusionSet[];
  homophones: { pinyin: string; words: number[] }[];
}).sets;
export const HOMOPHONES = (confusionsJson as unknown as {
  sets: ConfusionSet[];
  homophones: { pinyin: string; words: number[] }[];
}).homophones;
export const TONE_TWINS = (confusionsJson as unknown as { toneTwins: ToneTwin[] }).toneTwins;
export const MEASURE_WORDS = measureJson as unknown as MeasureWord[];
export const ROOMS = (palaceJson as unknown as { rooms: Room[]; journey: JourneyStep[] }).rooms;
export const JOURNEY = (palaceJson as unknown as { rooms: Room[]; journey: JourneyStep[] })
  .journey;
export const DIALOGUES = dialoguesJson as unknown as Dialogue[];
export const STORIES = storiesJson as unknown as StoryChain[];
export const META = metaJson as unknown as Meta;

export const TOTAL = WORDS.length;

const byId = new Map<number, Word>();
for (const w of WORDS) byId.set(w.id, w);

export function getWord(id: number): Word {
  const w = byId.get(id);
  if (!w) throw new Error(`unknown word id ${id}`);
  return w;
}

export function tryWord(id: number): Word | undefined {
  return byId.get(id);
}

export function getWords(ids: number[]): Word[] {
  return ids.map(getWord);
}

const packById = new Map<string, Pack>();
for (const p of PACKS) packById.set(p.id, p);
export function getPack(id: string): Pack | undefined {
  return packById.get(id);
}

const charHubByChar = new Map<string, CharHub>();
for (const h of CHAR_HUBS) charHubByChar.set(h.char, h);
export function getCharHub(c: string): CharHub | undefined {
  return charHubByChar.get(c);
}

const soundByBase = new Map<string, SoundFamily>();
for (const s of SOUNDS) soundByBase.set(s.base, s);
export function getSound(base: string): SoundFamily | undefined {
  return soundByBase.get(base);
}

export const CATEGORY_LABELS = META.categoryLabels;
export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Confusion sets that a given word takes part in. */
const confusionsByWord = new Map<number, ConfusionSet[]>();
for (const set of CONFUSIONS) {
  for (const id of set.words) {
    const list = confusionsByWord.get(id) ?? [];
    list.push(set);
    confusionsByWord.set(id, list);
  }
}
export function confusionsFor(id: number): ConfusionSet[] {
  return confusionsByWord.get(id) ?? [];
}

/** Words that contain a given character. */
export function wordsWithChar(c: string): number[] {
  return charHubByChar.get(c)?.words ?? [];
}

/** The 100-word boss bands. */
export const BOSS_BANDS = [1, 2, 3, 4, 5, 6].map((n) => ({
  key: `boss-${n * 100}`,
  n,
  title: n === 6 ? 'Final Boss · 600 words' : `${n * 100}-Word Boss`,
  from: (n - 1) * 100 + 1,
  to: n * 100,
  words: WORDS.filter((w) => w.id <= n * 100).map((w) => w.id),
  gate: WORDS.filter((w) => w.id > (n - 1) * 100 && w.id <= n * 100).map((w) => w.id),
}));
