const TONE_ROWS = ['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'];
const TONE_MAP = new Map<string, number>();
const BASE_MAP = new Map<string, string>();
const PLAIN = 'aeiouü';
TONE_ROWS.forEach((row, i) => {
  [...row].forEach((ch, j) => {
    TONE_MAP.set(ch, i + 1);
    BASE_MAP.set(ch, PLAIN[j]);
  });
});

export function toneOf(syllable: string): number {
  for (const ch of syllable) {
    const t = TONE_MAP.get(ch);
    if (t) return t;
  }
  return 5;
}

/** Strip tone marks: "xuéxí" -> "xuexi". Keeps ü as v-free "ü". */
export function stripTones(s: string): string {
  let out = '';
  for (const ch of s) out += BASE_MAP.get(ch) ?? ch;
  return out;
}

/** Normalise typed pinyin so harmless differences never count as wrong. */
export function normalisePinyin(s: string): string {
  return stripTones(s.trim().toLowerCase())
    .replace(/[’'`]/g, '')
    .replace(/v/g, 'ü')
    .replace(/[^a-zü0-9]/g, '');
}

/** Same, but keeping any typed tone digits so tones can be compared. */
export function normaliseWithTones(s: string): string {
  const lowered = s.trim().toLowerCase().replace(/[’'`\s·-]/g, '');
  let out = '';
  for (const ch of lowered) {
    const tone = TONE_MAP.get(ch);
    if (tone) out += (BASE_MAP.get(ch) ?? ch) + String(tone);
    else out += ch;
  }
  return out.replace(/v/g, 'ü').replace(/[^a-zü0-9]/g, '');
}

/**
 * Turn tone-numbered pinyin into the comparable form used above, so that
 * "xue2xi2" and "xuéxí" both reduce to the same key.
 */
export function toneKey(s: string): string {
  const withTones = normaliseWithTones(s);
  // Move digits so they always follow their syllable's vowel cluster.
  const digits = withTones.match(/\d/g) ?? [];
  const letters = withTones.replace(/\d/g, '');
  return letters + '|' + digits.join('');
}

export function accepted(input: string, target: string): 'exact' | 'toneless' | 'no' {
  if (!input.trim()) return 'no';
  if (toneKey(input) === toneKey(target)) return 'exact';
  if (normalisePinyin(input) === normalisePinyin(target)) return 'toneless';
  return 'no';
}

export const TONE_SHAPES: Record<number, { path: string; name: string; motion: string }> = {
  1: { path: 'M2 6 L22 6', name: 'high & flat', motion: '✈️ aeroplane flying level' },
  2: { path: 'M2 16 L22 4', name: 'rising', motion: '🚀 rocket lifting off' },
  3: { path: 'M2 6 Q6 18 12 18 Q18 18 22 4', name: 'dip then rise', motion: '🎢 roller-coaster dipping' },
  4: { path: 'M2 4 L22 18', name: 'sharp fall', motion: '🔨 hammer falling' },
  5: { path: 'M8 11 L16 11', name: 'light & short', motion: '🪶 feather drifting' },
};

export function toneName(t: number): string {
  return TONE_SHAPES[t]?.name ?? '';
}

/** "tú·shū·guǎn" style separator for display. */
export function splitSyllables(raws: string[]): string {
  return raws.join(' · ');
}

export function normaliseEnglish(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?"'’()]/g, '')
    .replace(/\b(to|a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function englishMatches(input: string, targets: string[]): boolean {
  const got = normaliseEnglish(input);
  if (!got) return false;
  return targets.some((target) => {
    // Split before normalising — normalisation strips the separators.
    const parts = [target, ...target.split(/[;/]/)]
      .map((x) => normaliseEnglish(x))
      .filter(Boolean);
    return parts.includes(got);
  });
}
