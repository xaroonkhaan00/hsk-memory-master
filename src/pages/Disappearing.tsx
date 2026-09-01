import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { Speaker, TopBar } from '../components/ui';
import { tryWord } from '../data';
import type { QuizItem, Word } from '../types';

/**
 * Progressive removal of support. The same small set of words is asked five
 * times, and each round takes one more clue away, until the word has to be
 * produced from nothing but its meaning.
 */
const ROUNDS = [
  { key: 'study', title: 'Round 1 · everything on screen', blurb: 'Characters, pinyin and meaning together. Read each one out loud.' },
  { key: 'no-meaning', title: 'Round 2 · the meaning goes', blurb: 'Characters and pinyin remain. Recall what it means.' },
  { key: 'hanzi-only', title: 'Round 3 · the pinyin goes', blurb: 'Only the characters are left.' },
  { key: 'meaning-only', title: 'Round 4 · the characters go', blurb: 'From the English alone, find the word.' },
  { key: 'produce', title: 'Round 5 · nothing is left', blurb: 'Type it out from memory.' },
] as const;

export default function Disappearing({ ids }: { ids: number[] }) {
  const { state, record } = useStore();
  const [round, setRound] = useState(0);
  const [cursor, setCursor] = useState(0);
  // Frozen once: the word set must not shift as answers change the store.
  const [frozen] = useState(() => ids);

  const words = useMemo(
    () => frozen.map(tryWord).filter((w): w is Word => !!w).slice(0, 8),
    [frozen],
  );

  const items = useMemo<QuizItem[]>(() => {
    const list = words.map((w) => w.id);
    const opts = { state, pool: list.length >= 4 ? list : undefined };
    const make = (mode: Parameters<typeof buildItem>[0]) =>
      list.map((id) => buildItem(mode, id, opts)).filter((x): x is QuizItem => !!x);
    switch (ROUNDS[round]!.key) {
      case 'no-meaning':
        return make('hanzi-meaning').map((i) => ({ ...i, promptSub: tryWord(i.wordId)?.pinyin }));
      case 'hanzi-only':
        return make('hanzi-meaning').map((i) => ({ ...i, promptSub: undefined }));
      case 'meaning-only':
        return make('meaning-hanzi').map((i) => ({ ...i, promptSub: undefined }));
      case 'produce':
        return make('reverse');
      default:
        return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, words]);

  const stage = ROUNDS[round]!;
  const w = words[cursor];

  return (
    <>
      <TopBar title="Disappearing support" sub={stage.title} back="/games" />
      <div className="page stack">
        <div className="row row--wrap tiny">
          {ROUNDS.map((r, i) => (
            <span key={r.key} className={`chip${i === round ? ' chip--accent' : i < round ? ' chip--good' : ''}`}>
              {i + 1}
            </span>
          ))}
          <span className="spacer" />
          <span className="muted">{words.length} words</span>
        </div>
        <div className="card">
          <h3>{stage.title}</h3>
          <p className="small muted">{stage.blurb}</p>
        </div>

        {stage.key === 'study' ? (
          w ? (
            <>
              <div className="card">
                <div className="word-hero">
                  <div className="hz hanzi">{w.hanzi}</div>
                  <div className="py">{w.syllables.map((s) => s.raw).join(' · ')}</div>
                  <div className="mn">{w.primaryMeaning}</div>
                </div>
                <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                  <Speaker text={w.plain} label="Listen" />
                </div>
                <div className="trick" style={{ marginTop: 12 }}>
                  <span className="label">Memory trick — not historical origin</span>
                  {w.story}
                </div>
              </div>
              <button
                className="btn btn--primary btn--lg btn--block"
                onClick={() => {
                  record({
                    wordId: w.id,
                    dimension: 'meaning',
                    correct: true,
                    ms: 4000,
                    mode: 'disappearing:study',
                    schedule: false,
                  });
                  if (cursor + 1 >= words.length) {
                    setCursor(0);
                    setRound(1);
                  } else setCursor(cursor + 1);
                }}
              >
                {cursor + 1 >= words.length ? 'Start round 2' : `Next (${cursor + 1}/${words.length})`}
              </button>
            </>
          ) : null
        ) : (
          <QuizRunner
            key={stage.key}
            items={items}
            title={stage.title}
            retestMistakes={false}
            onFinish={(r) => {
              if (r.length) return;
              if (round + 1 < ROUNDS.length) {
                setRound(round + 1);
                setCursor(0);
              } else {
                setRound(0);
                setCursor(0);
              }
            }}
            finishLabel={round + 1 < ROUNDS.length ? `Start round ${round + 2}` : 'Start again with new clues'}
          />
        )}
      </div>
    </>
  );
}
