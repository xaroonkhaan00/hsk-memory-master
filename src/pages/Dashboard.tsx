import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TOTAL, tryWord } from '../data';
import { useStore } from '../store';
import {
  dangerWords,
  dateKey,
  fingerprint,
  improvingWords,
  overview,
  strongestWords,
  FINGERPRINT_MIN,
} from '../services/progress';
import { DIMENSIONS, STATUSES, type Dimension } from '../types';
import { Meter, Ring, Stat, TopBar } from '../components/ui';

const DIM_LABEL: Record<Dimension, string> = {
  character: 'Character recognition',
  meaning: 'Meaning recall',
  pinyin: 'Pinyin recall',
  tone: 'Tone recall',
  listening: 'Listening',
  usage: 'Sentence usage',
};

export default function Dashboard() {
  const { state } = useStore();
  const ov = useMemo(() => overview(state), [state]);
  const fp = useMemo(() => fingerprint(state), [state]);
  const danger = useMemo(() => dangerWords(state), [state]);
  const improving = useMemo(() => improvingWords(state), [state]);
  const strongest = useMemo(() => strongestWords(state), [state]);

  const last30 = useMemo(() => {
    const out: { key: string; reviews: number; accuracy: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const key = dateKey(Date.now() - i * 86_400_000);
      const d = state.days[key];
      out.push({
        key,
        reviews: d?.reviews ?? 0,
        accuracy: d && d.reviews ? d.correct / d.reviews : 0,
      });
    }
    return out;
  }, [state.days]);

  const maxReviews = Math.max(1, ...last30.map((d) => d.reviews));

  return (
    <>
      <TopBar title="Progress dashboard" sub={`${ov.seen} of ${TOTAL} words met`} />
      <div className="page stack">
        <div className="card row" style={{ gap: 16 }}>
          <Ring value={(ov.strong + ov.mastered) / TOTAL} label="strong+" />
          <div className="grid grid--2" style={{ flex: 1 }}>
            <Stat value={ov.seen} label="seen" />
            <Stat value={ov.learning} label="learning" />
            <Stat value={ov.strong} label="strong" />
            <Stat value={ov.mastered} label="mastered" />
          </div>
        </div>

        <div className="card grid grid--3">
          <Stat value={ov.due} label="due now" />
          <Stat value={`${Math.round(ov.accuracy * 100)}%`} label="accuracy" />
          <Stat value={ov.avgMs ? `${(ov.avgMs / 1000).toFixed(1)}s` : '—'} label="avg answer" />
          <Stat value={ov.streak} label="day streak" />
          <Stat value={state.attempts.length} label="answers logged" />
          <Stat value={Object.keys(state.days).length} label="study days" />
        </div>

        <div className="section-title">
          Memory fingerprint
          {!fp.ready && (
            <span className="chip">
              {fp.sample}/{FINGERPRINT_MIN}
            </span>
          )}
        </div>
        <div className="card stack--sm stack">
          {DIMENSIONS.map((d) => {
            const row = fp.byDimension[d];
            const tone = row.n < 5 ? 'accent' : row.accuracy < 0.6 ? 'bad' : row.accuracy < 0.8 ? 'warn' : 'good';
            return (
              <Meter
                key={d}
                label={DIM_LABEL[d]}
                value={row.n ? row.accuracy : 0}
                right={row.n ? `${Math.round(row.accuracy * 100)}% · ${row.n} answers` : 'no data yet'}
                tone={tone}
              />
            );
          })}
          {fp.ready && (
            <p className="small muted">
              Weakest: <b>{fp.weakest.map((d) => DIM_LABEL[d]).join(', ')}</b>. Practice weights have
              been shifted toward these; strongest skills come up less often.
            </p>
          )}
        </div>

        <div className="section-title">Last 30 days</div>
        <div className="card stack--sm stack">
          <div className="spark" aria-hidden>
            {last30.map((d) => (
              <i
                key={d.key}
                className={d.reviews ? '' : 'empty'}
                style={{ height: `${Math.max(4, (d.reviews / maxReviews) * 100)}%` }}
                title={`${d.key}: ${d.reviews} answers`}
              />
            ))}
          </div>
          <div className="row tiny muted">
            <span>30 days ago</span>
            <span className="spacer" />
            <span>today</span>
          </div>
          <div className="row tiny muted">
            <span>
              {last30.reduce((s, d) => s + d.reviews, 0)} answers in the last 30 days
            </span>
          </div>
        </div>

        <div className="section-title">Word status spread</div>
        <div className="card stack--sm stack">
          {STATUSES.map((s) => (
            <Meter
              key={s}
              label={s}
              value={ov.byStatus[s] / TOTAL}
              right={String(ov.byStatus[s])}
              tone={s === 'mastered' || s === 'strong' ? 'good' : s === 'weak' || s === 'fragile' ? 'bad' : 'accent'}
            />
          ))}
          <Link className="btn btn--soft btn--block" to="/heatmap">
            Open the 600-word heatmap
          </Link>
        </div>

        <WordStrip title="My 10 most dangerous words" ids={danger} tone="bad" empty="No repeated failures yet — good." />
        <WordStrip title="Top 10 improving" ids={improving} tone="warn" empty="Get a few wrong then fix them, and they show up here." />
        <WordStrip title="Top 10 strongest" ids={strongest} tone="good" empty="Answer a few more questions to rank your strongest words." />

        <div className="grid grid--2">
          <Link className="btn btn--soft" to="/notebook">📓 Mistake notebook</Link>
          <Link className="btn btn--soft" to="/achievements">🏅 Achievements</Link>
          <Link className="btn btn--soft" to="/qa">🧪 Data validation</Link>
          <Link className="btn btn--soft" to="/settings">⚙️ Settings & backup</Link>
        </div>
      </div>
    </>
  );
}

function WordStrip({
  title,
  ids,
  tone,
  empty,
}: {
  title: string;
  ids: number[];
  tone: 'good' | 'bad' | 'warn';
  empty: string;
}) {
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="card">
        {ids.length === 0 ? (
          <p className="small muted">{empty}</p>
        ) : (
          <div className="row row--wrap">
            {ids.map((id) => {
              const w = tryWord(id);
              return w ? (
                <Link className={`chip chip--button chip--${tone}`} to={`/word/${id}`} key={id}>
                  <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                </Link>
              ) : null;
            })}
          </div>
        )}
      </div>
    </>
  );
}
