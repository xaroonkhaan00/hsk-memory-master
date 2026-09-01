import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useStore } from '../store';
import {
  FINGERPRINT_MIN,
  dailyNewGoal,
  fingerprint,
  overview,
  weakWords,
} from '../services/progress';
import { DIMENSIONS } from '../types';
import { Meter, Ring, Stat, TopBar } from '../components/ui';
import { META, TOTAL } from '../data';

const DIM_LABEL: Record<string, string> = {
  character: 'Character recognition',
  meaning: 'Meaning recall',
  pinyin: 'Pinyin recall',
  tone: 'Tone recall',
  listening: 'Listening',
  usage: 'Usage in sentences',
};

export default function Home() {
  const { state } = useStore();
  const ov = useMemo(() => overview(state), [state]);
  const fp = useMemo(() => fingerprint(state), [state]);
  const weak = useMemo(() => weakWords(state), [state]);
  const goal = dailyNewGoal(state);

  const mastered = ov.mastered + ov.strong;

  return (
    <>
      <TopBar
        title="HSK Memory System"
        sub={`${META.totalWords} words · local-first`}
        right={
          <Link className="btn btn--icon btn--ghost" to="/settings" aria-label="Settings">
            ⚙️
          </Link>
        }
      />
      <div className="page stack">
        <div className="card row" style={{ gap: 16 }}>
          <Ring value={mastered / TOTAL} label="strong+" />
          <div className="stack--sm stack" style={{ flex: 1 }}>
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {mastered} <span className="muted" style={{ fontSize: '1rem' }}>/ {TOTAL}</span>
              </div>
              <div className="small muted">words at strong or mastered level</div>
            </div>
            <div className="row row--wrap">
              <span className="chip chip--accent">{ov.due} due</span>
              <span className="chip">{ov.seen} seen</span>
              <span className="chip chip--bad">{weak.length} weak</span>
              {ov.streak > 0 && <span className="chip chip--warn">🔥 {ov.streak}-day streak</span>}
            </div>
          </div>
        </div>

        <Link className="btn btn--primary btn--lg btn--block" to="/today">
          Start today's session · {state.settings.dailyMinutes} min
        </Link>

        <div className="grid grid--2">
          <Link className="btn btn--soft btn--lg" to="/map">
            ✨ Magic 20
          </Link>
          <Link className="btn btn--soft btn--lg" to="/games/rescue">
            🛟 Weak words
          </Link>
          <Link className="btn btn--soft btn--lg" to="/palace">
            🏛️ Memory palace
          </Link>
          <Link className="btn btn--soft btn--lg" to="/boss">
            ⚔️ Boss test
          </Link>
        </div>

        <div className="section-title">Today's memory goal</div>
        <div className="card grid grid--3">
          <Stat value={ov.due} label="reviews due" />
          <Stat value={goal} label="new words" />
          <Stat value={`${Math.round(ov.accuracy * 100)}%`} label="accuracy" />
        </div>

        <div className="section-title">
          Memory fingerprint
          {!fp.ready && <span className="chip">{fp.sample}/{FINGERPRINT_MIN} answers</span>}
        </div>
        <div className="card stack--sm stack">
          {!fp.ready && (
            <p className="small muted">
              After about {FINGERPRINT_MIN} answers this becomes your real profile and the app
              starts re-weighting practice toward whatever you actually forget. Until then it uses
              the bias you chose at setup.
            </p>
          )}
          {DIMENSIONS.map((d) => {
            const row = fp.byDimension[d];
            const tone = row.n < 5 ? 'accent' : row.accuracy < 0.6 ? 'bad' : row.accuracy < 0.8 ? 'warn' : 'good';
            return (
              <Meter
                key={d}
                label={DIM_LABEL[d] ?? d}
                value={row.n >= 1 ? row.accuracy : 0}
                right={row.n >= 1 ? `${Math.round(row.accuracy * 100)}% · ${row.n}` : 'no data'}
                tone={tone}
              />
            );
          })}
          {fp.ready && fp.weakest.length > 0 && (
            <div className="fact">
              <span className="label">What the coach is doing about it</span>
              Practice is now weighted toward <b>{fp.weakest.map((d) => DIM_LABEL[d]).join(' and ')}</b>.
              Your strongest is {DIM_LABEL[fp.strongest[0] ?? ''] ?? '—'}, so it will come up less often.
            </div>
          )}
          <Link className="btn btn--soft btn--block" to="/dashboard">
            Full dashboard
          </Link>
        </div>

        <div className="section-title">Jump in</div>
        <div className="grid grid--2">
          <Link className="btn btn--soft" to="/tone">📈 Tone trainer</Link>
          <Link className="btn btn--soft" to="/pinyin">🔤 Pinyin trainer</Link>
          <Link className="btn btn--soft" to="/confusion">⚔️ Confusion battles</Link>
          <Link className="btn btn--soft" to="/families">🌳 Families</Link>
          <Link className="btn btn--soft" to="/measure-words">📏 Measure words</Link>
          <Link className="btn btn--soft" to="/journey">🚶 Memory journey</Link>
          <Link className="btn btn--soft" to="/story">🎬 Story chains</Link>
          <Link className="btn btn--soft" to="/dialogues">💬 Mini dialogues</Link>
          <Link className="btn btn--soft" to="/cram">🔥 Cram mode</Link>
          <Link className="btn btn--soft" to="/notebook">📓 Mistake notebook</Link>
          <Link className="btn btn--soft" to="/heatmap">🟩 600 heatmap</Link>
        </div>
      </div>
    </>
  );
}
