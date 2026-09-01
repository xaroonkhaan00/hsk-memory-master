import type { AppState } from '../types';
import { overview, studyStreak } from './progress';

export interface AchievementDef {
  key: string;
  title: string;
  blurb: string;
  icon: string;
  test: (state: AppState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first-20', title: 'First 20', blurb: 'Twenty words introduced.', icon: '🌱',
    test: (s) => overview(s).seen >= 20 },
  { key: 'first-100', title: 'First 100', blurb: 'A hundred words met.', icon: '💯',
    test: (s) => overview(s).seen >= 100 },
  { key: 'words-300', title: '300 Words', blurb: 'Halfway through the list.', icon: '🏔️',
    test: (s) => overview(s).seen >= 300 },
  { key: 'words-600', title: '600 Words', blurb: 'Every word in the book has been met.', icon: '🎓',
    test: (s) => overview(s).seen >= 600 },
  { key: 'tone-survivor', title: 'Tone Survivor', blurb: '50 tone questions answered.', icon: '📈',
    test: (s) => s.attempts.filter((a) => a.dimension === 'tone').length >= 50 },
  { key: 'tone-master', title: 'Tone Master', blurb: 'Tone accuracy above 85% over 60 answers.', icon: '🎯',
    test: (s) => {
      const t = s.attempts.filter((a) => a.dimension === 'tone');
      return t.length >= 60 && t.filter((a) => a.correct).length / t.length >= 0.85;
    } },
  { key: 'character-hunter', title: 'Character Hunter', blurb: '200 character questions answered.', icon: '🔍',
    test: (s) => s.attempts.filter((a) => a.dimension === 'character').length >= 200 },
  { key: 'clean-20', title: 'No Mistakes ×20', blurb: 'Twenty correct answers in a row.', icon: '✨',
    test: (s) => {
      let run = 0;
      for (const a of s.attempts) {
        run = a.correct ? run + 1 : 0;
        if (run >= 20) return true;
      }
      return false;
    } },
  { key: 'streak-7', title: 'Seven Days', blurb: 'A week of study days.', icon: '🔥',
    test: (s) => studyStreak(s) >= 7 },
  { key: 'streak-30', title: 'Thirty Days', blurb: 'A month of study days.', icon: '🏅',
    test: (s) => studyStreak(s) >= 30 },
  { key: 'mastered-100', title: '100 Mastered', blurb: 'A hundred words at mastered level.', icon: '🧠',
    test: (s) => overview(s).mastered >= 100 },
  { key: 'listener', title: 'Good Ear', blurb: '100 listening questions answered.', icon: '👂',
    test: (s) => s.attempts.filter((a) => a.dimension === 'listening').length >= 100 },
  { key: 'boss-100', title: '100-Word Boss down', blurb: 'Scored 80%+ on the first boss.', icon: '⚔️',
    test: (s) => (s.bossScores['boss-100']?.overall ?? 0) >= 0.8 },
  { key: 'boss-300', title: '300-Word Boss down', blurb: 'Scored 80%+ on the 300 boss.', icon: '🛡️',
    test: (s) => (s.bossScores['boss-300']?.overall ?? 0) >= 0.8 },
  { key: 'final-boss', title: 'Final Boss Defeated', blurb: 'Scored 80%+ on the 600-word Final Boss.', icon: '👑',
    test: (s) => (s.bossScores['boss-600']?.overall ?? 0) >= 0.8 },
];

export function checkAchievements(state: AppState): AppState {
  const have = new Set(state.achievements.map((a) => a.key));
  const gained = ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.test(state));
  if (gained.length === 0) return state;
  return {
    ...state,
    achievements: [...state.achievements, ...gained.map((a) => ({ key: a.key, at: Date.now() }))],
  };
}
