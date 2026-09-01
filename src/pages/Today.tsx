import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { buildDailySession } from '../services/session';
import { mandarinAvailable } from '../services/tts';
import QuizRunner from '../components/QuizRunner';
import { Segmented, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

const OPTIONS = [5, 10, 20, 30] as const;

export default function Today() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState<number>(state.settings.dailyMinutes);
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(0);
  const audio = mandarinAvailable();

  const session = useMemo(
    () => buildDailySession(state, minutes, audio),
    // Rebuilt only when the learner asks for it, so answering doesn't reshuffle
    // the questions underneath them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minutes, seed, audio],
  );

  const [slowing, setSlowing] = useState(false);
  const newIds = useMemo(() => new Set(session.newWordIds), [session]);

  if (started) {
    return (
      <>
        <TopBar title={`${minutes}-minute session`} back="/" />
        <div className="page">
          {slowing && (
            <div className="verdict verdict--bad" style={{ marginBottom: 12 }}>
              <h3>Slowing down</h3>
              <div className="body">
                Accuracy dropped over the last few answers, so the remaining new words have been
                pulled out of this session. It is repair work from here — that is deliberate.
              </div>
            </div>
          )}
          <QuizRunner
            items={session.items}
            title="Today"
            smartStop={(item: QuizItem) => newIds.has(item.wordId)}
            onSlowDown={() => setSlowing(true)}
            onFinish={(r) => {
              if (!r.length) navigate('/');
            }}
            finishLabel="Back to home"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Today's session" back="/" />
      <div className="page stack">
        <div className="card stack">
          <h2>Pick a length</h2>
          <Segmented
            value={minutes}
            onChange={(v) => {
              setMinutes(v);
              setSeed((s) => s + 1);
            }}
            options={OPTIONS.map((m) => ({ value: m as number, label: `${m} min` }))}
            ariaLabel="Session length"
          />
          <p className="small muted">
            The composition below is generated from your Memory Fingerprint, your due reviews and
            how well the last few sessions went.
          </p>
        </div>

        <div className="card stack--sm stack">
          <h3>What's in this session</h3>
          {session.blocks.map((b) => (
            <div className="row" key={b.kind}>
              <span className="chip chip--accent">{b.items.length}</span>
              <span style={{ flex: 1 }}>{b.title}</span>
            </div>
          ))}
          <div className="row muted small">
            <span>{session.items.length} questions</span>
            <span className="spacer" />
            <span>{session.reviewIds.length} due · {session.newWordIds.length} new available</span>
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={() => setStarted(true)}
          disabled={session.items.length === 0}
        >
          Start · {session.items.length} questions
        </button>
        <button className="btn btn--ghost btn--block" onClick={() => setSeed((s) => s + 1)}>
          Shuffle the session
        </button>
      </div>
    </>
  );
}
