import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MEASURE_WORDS, tryWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { Speaker, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

export default function MeasureWordsPage() {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [drilling, setDrilling] = useState(false);
  const [seed, setSeed] = useState(0);

  const items = useMemo<QuizItem[]>(() => {
    const ids = MEASURE_WORDS.map((m) => m.wordId).filter((id) => id > 0 && !!tryWord(id));
    const out: QuizItem[] = [];
    for (const id of ids) {
      for (const mode of ['hanzi-meaning', 'cloze', 'hanzi-pinyin'] as const) {
        const item = buildItem(mode, id, { state, pool: ids });
        if (item) out.push(item);
      }
    }
    return out.sort(() => Math.random() - 0.5).slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  if (drilling) {
    return (
      <>
        <TopBar title="Measure word drill" back="/measure-words" />
        <div className="page">
          <QuizRunner
            items={items}
            title="Measure words"
            onFinish={(r) => {
              if (!r.length) {
                setDrilling(false);
                setSeed((s) => s + 1);
              }
            }}
            finishLabel="Back to the guide"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Measure words" sub={`${MEASURE_WORDS.length} in your 600`} back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <h3>The whole idea in one line</h3>
          <div className="fact">
            <span className="label">Fact</span>
            In Chinese you never put a number straight in front of a noun. It is always{' '}
            <b>number + measure word + noun</b>: 三<b>个</b>人, 一<b>本</b>书, 两<b>张</b>纸. The
            measure word tells you what SHAPE or KIND of thing is being counted.
          </div>
          <div className="trick">
            <span className="label">Survival rule</span>
            If you blank on the right one, say 个. It is understood everywhere. Then learn the eight
            that come up constantly: 个 本 张 条 件 双 只 位.
          </div>
        </div>

        <button className="btn btn--primary btn--lg btn--block" onClick={() => setDrilling(true)}>
          Drill the measure words · {items.length} questions
        </button>

        <div className="section-title">Every measure word in your list</div>
        {MEASURE_WORDS.map((m) => {
          const isOpen = open === m.mw;
          const word = m.wordId ? tryWord(m.wordId) : undefined;
          return (
            <div className="card stack--sm stack" key={m.mw}>
              <button
                className="row"
                onClick={() => setOpen(isOpen ? null : m.mw)}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                aria-expanded={isOpen}
              >
                <span className="hanzi" style={{ fontSize: '2.2rem', minWidth: '2ch' }}>
                  {m.mw}
                </span>
                <span style={{ flex: 1 }}>
                  <b>{m.pinyin}</b>
                  <div className="small muted">{m.counts}</div>
                </span>
                <span className="chip">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <>
                  <div className="fact">
                    <span className="label">The easy rule</span>
                    {m.rule}
                  </div>
                  <div className="stack--sm stack">
                    {m.examples.map((ex, i) => (
                      <div key={i}>
                        <div className="row">
                          <span className="hanzi" style={{ fontSize: '1.2rem' }}>
                            {ex.zh}
                          </span>
                          <Speaker text={ex.zh} compact />
                        </div>
                        <div className="tiny muted">
                          {ex.pinyin} — {ex.en}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="trick">
                    <span className="label">Common trap</span>
                    {m.trap}
                  </div>
                  {word && (
                    <Link className="btn btn--soft btn--sm" to={`/word/${word.id}`}>
                      Open #{word.id} {word.hanzi} in full
                    </Link>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
