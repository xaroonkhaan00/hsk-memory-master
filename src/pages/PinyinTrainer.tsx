import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SOUNDS, SOUND_GROUPS, tryWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { Speaker, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

export default function PinyinTrainer() {
  const { state } = useStore();
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(0);

  const group = SOUND_GROUPS.find((g) => g.key === groupKey);

  const misheard = useMemo(() => {
    // Words whose losses came from listening or pinyin errors.
    const counts = new Map<number, number>();
    for (const p of Object.values(state.progress)) {
      const n = p.errors.filter((e) => e.kind === 'listening' || e.kind === 'pinyin').length;
      if (n) counts.set(p.id, n);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, n]) => ({ word: tryWord(id), n }))
      .filter((x) => !!x.word);
  }, [state.progress]);

  const items = useMemo<QuizItem[]>(() => {
    const pool = group ? group.words : Object.values(state.progress).filter((p) => p.introduced).map((p) => p.id);
    const use = pool.length >= 8 ? pool : SOUNDS.slice(0, 30).flatMap((s) => s.words).slice(0, 60);
    const shuffled = [...new Set(use)].sort(() => Math.random() - 0.5).slice(0, 14);
    return shuffled
      .map((id) => buildItem('sound-family', id, { state, pool: use }))
      .filter((x): x is QuizItem => !!x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey, seed]);

  if (started) {
    return (
      <>
        <TopBar title={group ? group.label : 'Pinyin trainer'} back="/pinyin" />
        <div className="page">
          <QuizRunner
            items={items}
            title="Sounds"
            onFinish={(r) => {
              if (!r.length) {
                setStarted(false);
                setSeed((s) => s + 1);
              }
            }}
            finishLabel="Back"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Pinyin trainer" back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <h3>The groups that trip everyone up</h3>
          {SOUND_GROUPS.map((g) => (
            <button
              key={g.key}
              className={`option${groupKey === g.key ? ' option--picked' : ''}`}
              onClick={() => setGroupKey(g.key === groupKey ? null : g.key)}
              type="button"
            >
              <span className="option__label">
                <b>{g.label}</b>
                <div className="option__sub">{g.tip}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {g.syllables.slice(0, 14).join(' · ')}
                  {g.syllables.length > 14 ? ' …' : ''} — {g.words.length} words
                </div>
              </span>
            </button>
          ))}
        </div>

        {misheard.length > 0 && (
          <div className="card stack--sm stack">
            <h3>Words I keep mishearing</h3>
            <div className="list">
              {misheard.map(({ word, n }) =>
                word ? (
                  <Link className="list__item" to={`/word/${word.id}`} key={word.id}>
                    <span className="list__hz hanzi">{word.hanzi}</span>
                    <span className="list__mid">
                      <span className="py">{word.pinyin}</span>
                      <div className="mn">{word.primaryMeaning}</div>
                    </span>
                    <span className="chip chip--bad">{n}×</span>
                    <Speaker text={word.plain} compact />
                  </Link>
                ) : null,
              )}
            </div>
          </div>
        )}

        <div className="card stack--sm stack">
          <h3>Most common syllables in your 600 words</h3>
          <div className="row row--wrap">
            {SOUNDS.slice(0, 28).map((s) => (
              <span className="chip" key={s.base}>
                {s.base} <b className="mono">{s.words.length}</b>
              </span>
            ))}
          </div>
          <p className="tiny muted">
            Learn one syllable and you have a hook for every word that uses it.
          </p>
        </div>

        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={() => setStarted(true)}
          disabled={items.length === 0}
        >
          {group ? `Drill ${group.label}` : 'Mixed sound drill'} · {items.length} questions
        </button>
      </div>
    </>
  );
}
