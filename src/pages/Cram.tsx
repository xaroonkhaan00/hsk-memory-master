import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { buildCram } from '../services/session';
import { mandarinAvailable } from '../services/tts';
import QuizRunner from '../components/QuizRunner';
import { Segmented, TopBar } from '../components/ui';

const SIZES = [10, 20, 30, 50, 100];

export default function Cram() {
  const { state } = useStore();
  const [size, setSize] = useState(20);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(0);
  const audio = mandarinAvailable();

  const items = useMemo(
    () => buildCram(state, size, audio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, seed, audio],
  );

  if (running) {
    return (
      <>
        <TopBar title={`Cram · ${size}`} back="/cram" />
        <div className="page">
          <QuizRunner
            items={items}
            title="Cram"
            onFinish={(r) => {
              if (!r.length) {
                setRunning(false);
                setSeed((s) => s + 1);
              }
            }}
            finishLabel="Back to cram"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Cram mode" sub="Exam tomorrow" back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <h3>How many words?</h3>
          <Segmented
            value={size}
            onChange={setSize}
            options={SIZES.map((n) => ({ value: n, label: String(n) }))}
            ariaLabel="Cram size"
          />
          <p className="small muted">
            Cram picks your weakest, most overdue and most-confused words, and stays quiet unless
            you get something wrong — then it shows the memory hook.
          </p>
        </div>
        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={() => setRunning(true)}
          disabled={items.length === 0}
        >
          Start · {items.length} questions
        </button>
      </div>
    </>
  );
}
