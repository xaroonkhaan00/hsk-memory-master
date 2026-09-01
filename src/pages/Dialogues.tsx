import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DIALOGUES, tryWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { AudioRow, Sentence, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

export default function Dialogues() {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(DIALOGUES[0]?.id ?? null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showEnglish, setShowEnglish] = useState(true);
  const [seed, setSeed] = useState(0);

  const active = DIALOGUES.find((d) => d.id === testing);

  const items = useMemo<QuizItem[]>(() => {
    if (!active) return [];
    const ids = active.targets;
    const out: QuizItem[] = [];
    for (const id of ids) {
      for (const mode of ['hanzi-meaning', 'cloze', 'hanzi-pinyin'] as const) {
        const item = buildItem(mode, id, { state, pool: active.allWords });
        if (item) out.push(item);
      }
    }
    return out.sort(() => Math.random() - 0.5).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testing, seed]);

  if (active) {
    return (
      <>
        <TopBar title={active.title} back="/dialogues" />
        <div className="page">
          <QuizRunner
            items={items}
            title="Dialogue recall"
            onFinish={(r) => {
              if (!r.length) {
                setTesting(null);
                setSeed((s) => s + 1);
              }
            }}
            finishLabel="Back to the dialogues"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Mini dialogues"
        sub={`${DIALOGUES.length} short conversations`}
        back="/games"
        right={
          <button
            className="btn btn--sm btn--ghost"
            onClick={() => setShowEnglish((v) => !v)}
          >
            {showEnglish ? 'Hide English' : 'Show English'}
          </button>
        }
      />
      <div className="page stack">
        <div className="card">
          <p className="small muted">
            Two- to four-line conversations at HSK-3 level, built from words in your list. Read
            each one aloud, cover the English, then let the app test you on the words it used.
          </p>
        </div>

        {DIALOGUES.map((d) => {
          const open = openId === d.id;
          return (
            <div className="card stack--sm stack" key={d.id}>
              <button
                className="row"
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                onClick={() => setOpenId(open ? null : d.id)}
                aria-expanded={open}
              >
                <b style={{ flex: 1 }}>{d.title}</b>
                <span className="chip">{d.targets.length} words</span>
                <span className="chip">{open ? '−' : '+'}</span>
              </button>
              {open && (
                <>
                  {d.lines.map((line, i) => (
                    <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                      <span className="chip chip--accent">{line.speaker}</span>
                      <div style={{ flex: 1 }}>
                        <Sentence tokens={line.tokens} />
                        {showEnglish && <div className="small muted">{line.en}</div>}
                      </div>
                    </div>
                  ))}
                  <AudioRow text={d.lines.map((l) => l.zh).join(' ')} />
                  <div className="row row--wrap">
                    {d.targets.map((id) => {
                      const w = tryWord(id);
                      return w ? (
                        <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                          <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                        </Link>
                      ) : null;
                    })}
                  </div>
                  <button className="btn btn--primary btn--block" onClick={() => setTesting(d.id)}>
                    Cover it up — test me on these words
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
