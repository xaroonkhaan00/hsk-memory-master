import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BOSS_BANDS } from '../data';
import { useStore } from '../store';
import { buildBoss } from '../services/session';
import { mandarinAvailable } from '../services/tts';
import QuizRunner from '../components/QuizRunner';
import { Meter, Ring, TopBar } from '../components/ui';
import { DIMENSIONS, type Dimension, type QuizResult } from '../types';

const DIM_LABEL: Record<Dimension, string> = {
  character: 'Character',
  meaning: 'Meaning',
  pinyin: 'Pinyin',
  tone: 'Tones',
  listening: 'Listening',
  usage: 'Sentence usage',
};

export default function Boss() {
  const { band } = useParams();
  const { state, update } = useStore();
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(0);
  const [result, setResult] = useState<QuizResult[] | null>(null);
  const audio = mandarinAvailable();

  const current = BOSS_BANDS.find((b) => b.key === band);

  const items = useMemo(
    () => (current ? buildBoss(state, current.key, audio) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current?.key, seed, audio],
  );

  if (!current) {
    return (
      <>
        <TopBar title="Boss battles" back="/games" />
        <div className="page stack">
          <div className="card">
            <p className="small muted">
              A boss is an adaptive checkpoint, not a 100-question slog. It samples the band and
              weights the sample toward the words and the skills you are shakiest on, then tells you
              exactly what still needs work.
            </p>
          </div>
          {BOSS_BANDS.map((b) => {
            const seen = b.words.filter((id) => state.progress[id]?.introduced).length;
            const prev = state.bossScores[b.key];
            const unlocked = seen >= Math.min(40, b.words.length * 0.4);
            return (
              <div className="card stack--sm stack" key={b.key}>
                <div className="row">
                  <b style={{ flex: 1 }}>{b.title}</b>
                  {prev && (
                    <span className={`chip ${prev.overall >= 0.8 ? 'chip--good' : 'chip--warn'}`}>
                      best {Math.round(prev.overall * 100)}%
                    </span>
                  )}
                </div>
                <Meter
                  label={`Words met in this band`}
                  value={seen / b.words.length}
                  right={`${seen}/${b.words.length}`}
                />
                {unlocked ? (
                  <Link className="btn btn--primary btn--block" to={`/boss/${b.key}`}>
                    Fight · {b.n === 6 ? 60 : 30} questions
                  </Link>
                ) : (
                  <button className="btn btn--block" disabled>
                    Meet at least {Math.min(40, Math.round(b.words.length * 0.4))} of these words
                    first
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  if (result) {
    const byDim = {} as Record<Dimension, { n: number; right: number }>;
    for (const d of DIMENSIONS) byDim[d] = { n: 0, right: 0 };
    for (const r of result) {
      const row = byDim[r.item.dimension];
      row.n += 1;
      if (r.correct) row.right += 1;
    }
    const overall = result.length ? result.filter((r) => r.correct).length / result.length : 0;
    const needsWork = DIMENSIONS.filter((d) => byDim[d].n >= 3 && byDim[d].right / byDim[d].n < 0.75);
    return (
      <>
        <TopBar title={current.title} back="/boss" />
        <div className="page stack">
          <div className="card center stack">
            <Ring value={overall} size={120} label="overall" />
            <h2>
              {overall >= 0.8 ? 'Boss defeated' : overall >= 0.6 ? 'Close — not yet' : 'Not this time'}
            </h2>
            <p className="muted small">
              {result.filter((r) => r.correct).length} of {result.length} correct.
            </p>
          </div>
          <div className="card stack--sm stack">
            <h3>HSK vocabulary readiness by skill</h3>
            {DIMENSIONS.map((d) => {
              const row = byDim[d];
              if (row.n === 0) return null;
              const v = row.right / row.n;
              return (
                <Meter
                  key={d}
                  label={DIM_LABEL[d]}
                  value={v}
                  right={`${Math.round(v * 100)}% of ${row.n}`}
                  tone={v < 0.6 ? 'bad' : v < 0.8 ? 'warn' : 'good'}
                />
              );
            })}
          </div>
          <div className="card stack--sm stack">
            <h3>What to fix before moving on</h3>
            {needsWork.length === 0 ? (
              <p className="small muted">
                Nothing stands out — every skill in this band is above 75%. Move on to the next
                band.
              </p>
            ) : (
              needsWork.map((d) => (
                <div className="fact" key={d}>
                  <span className="label">{DIM_LABEL[d]}</span>
                  Below 75% in this test.{' '}
                  <Link to={d === 'tone' ? '/tone' : d === 'pinyin' ? '/pinyin' : '/games'}>
                    Open the {d === 'tone' ? 'tone trainer' : d === 'pinyin' ? 'pinyin trainer' : 'training modes'}
                  </Link>
                  .
                </div>
              ))
            )}
          </div>
          <button
            className="btn btn--primary btn--block"
            onClick={() => {
              setResult(null);
              setRunning(false);
              setSeed((s) => s + 1);
            }}
          >
            Fight again
          </button>
          <Link className="btn btn--soft btn--block" to="/boss">
            Back to the bosses
          </Link>
        </div>
      </>
    );
  }

  if (running) {
    return (
      <>
        <TopBar title={current.title} back="/boss" />
        <div className="page">
          <QuizRunner
            items={items}
            title={current.title}
            retestMistakes={false}
            showResults={false}
            onFinish={(r) => {
              if (!r.length) return;
              setResult(r);
              const byDim = {} as Record<Dimension, number>;
              for (const d of DIMENSIONS) {
                const rows = r.filter((x) => x.item.dimension === d);
                byDim[d] = rows.length ? rows.filter((x) => x.correct).length / rows.length : 0;
              }
              const overall = r.filter((x) => x.correct).length / r.length;
              update((s) => {
                const prev = s.bossScores[current.key];
                if (prev && prev.overall >= overall) return s;
                return {
                  ...s,
                  bossScores: {
                    ...s.bossScores,
                    [current.key]: { at: Date.now(), overall, byDimension: byDim, total: r.length },
                  },
                };
              });
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={current.title} back="/boss" />
      <div className="page stack">
        <div className="card center stack">
          <div style={{ fontSize: '3rem' }}>{current.n === 6 ? '👑' : '⚔️'}</div>
          <h2>{current.title}</h2>
          <p className="muted small">
            {items.length} questions sampled from words 1–{current.to}, mixing characters, meaning,
            pinyin, tones, sentence context{audio ? ' and listening' : ''}. Sixty percent of the
            sample is drawn from your weakest words in the band.
          </p>
        </div>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setRunning(true)}>
          Begin
        </button>
      </div>
    </>
  );
}
