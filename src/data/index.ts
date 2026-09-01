import vocabJson from './generated/vocab.json';
import charsJson from './generated/characters.json';
import soundsJson from './generated/sounds.json';
import familiesJson from './generated/families.json';
import packsJson from './generated/packs.json';
import confusionsJson from './generated/confusions.json';
import measureJson from './generated/measurewords.json';
import palaceJson from './generated/palace.json';
import dialoguesJson from './generated/dialogues.json';
import sceneIndexJson from './generated/scene-index.json';
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
  Scene,
  SceneRef,
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

/* ------------------------------------------------------- stories & cinema */

/**
 * Scene text is the largest thing in the app, and the home screen never shows
 * it. Only the light index ships in the first chunk; the full stories and
 * episodes are fetched the moment a player or a word page actually needs them.
 */
export const STORY_INDEX = (sceneIndexJson as unknown as {
  stories: SceneRef[];
  conversations: SceneRef[];
}).stories;
export const CONVERSATION_INDEX = (sceneIndexJson as unknown as {
  stories: SceneRef[];
  conversations: SceneRef[];
}).conversations;

const refById = new Map<string, SceneRef>();
for (const r of STORY_INDEX) refById.set(`story:${r.id}`, r);
for (const r of CONVERSATION_INDEX) refById.set(`conv:${r.id}`, r);

export function storyRef(id: string): SceneRef | undefined {
  return refById.get(`story:${id}`);
}
export function conversationRef(id: string): SceneRef | undefined {
  return refById.get(`conv:${id}`);
}

let storyLoad: Promise<Map<string, Scene>> | null = null;
let convLoad: Promise<Map<string, Scene>> | null = null;

function index(list: Scene[]): Map<string, Scene> {
  const m = new Map<string, Scene>();
  for (const s of list) m.set(s.id, s);
  return m;
}

export function loadStories(): Promise<Map<string, Scene>> {
  storyLoad ??= import('./generated/story-mode.json').then((m) =>
    index(m.default as unknown as Scene[]),
  );
  return storyLoad;
}

export function loadConversations(): Promise<Map<string, Scene>> {
  convLoad ??= import('./generated/conversations.json').then((m) =>
    index(m.default as unknown as Scene[]),
  );
  return convLoad;
}

export async function loadStory(id: string): Promise<Scene | undefined> {
  return (await loadStories()).get(id);
}
export async function loadConversation(id: string): Promise<Scene | undefined> {
  return (await loadConversations()).get(id);
}

/** Stories a word appears in, as light references. */
export function storiesWith(wordId: number): SceneRef[] {
  return (tryWord(wordId)?.inStories ?? [])
    .map(storyRef)
    .filter((s): s is SceneRef => !!s);
}
export function conversationsWith(wordId: number): SceneRef[] {
  return (tryWord(wordId)?.inConversations ?? [])
    .map(conversationRef)
    .filter((s): s is SceneRef => !!s);
}

/** Word ids a scene teaches, in the order they first appear in its text. */
export function sceneWords(scene: Scene): number[] {
  return scene.targets;
}
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
