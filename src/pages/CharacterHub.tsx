import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCharHub, getWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { Speaker, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

export default function CharacterHub() {
  const { char = '' } = useParams();
  const decoded = decodeURIComponent(char);
  const hub = getCharHub(decoded);
  const { state } = useStore();
  const [drill, setDrill] = useState(false);

  const items = useMemo<QuizItem[]>(() => {
    if (!hub) return [];
    const out: QuizItem[] = [];
    for (const id of hub.words) {
      const a = buildItem('char-family', id, { state, pool: hub.words });
      if (a) out.push(a);
      const b = buildItem('hanzi-meaning', id, { state, pool: hub.words });
      if (b) out.push(b);
    }
    return out.sort(() => Math.random() - 0.5).slice(0, 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub, drill]);

  if (!hub) {
    return (
      <>
        <TopBar title="Character not found" back="/families" />
        <div className="page">
          <Link className="btn" to="/families">
            Back to families
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={`Character hub · ${hub.char}`} back="/families" />
      <div className="page stack">
        <div className="card center stack--sm stack">
          <div className="hanzi" style={{ fontSize: '5rem', lineHeight: 1.05 }}>
            {hub.char}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 640 }}>{hub.pinyin}</div>
          <div className="muted">{hub.gloss}</div>
          <Speaker text={hub.char} label="Listen" />
          <p className="tiny muted">
            This is the character's basic meaning. Inside a word it can shift — the word entry
            always shows what the whole word means.
          </p>
        </div>

        <div className="section-title">
          Words built on {hub.char}
          <span className="chip">{hub.words.length}</span>
        </div>
        <div className="card">
          <div className="list">
            {hub.words.map((id) => {
              const w = getWord(id);
              return (
                <Link className="list__item" to={`/word/${id}`} key={id}>
                  <span className="list__hz hanzi">{w.hanzi}</span>
                  <span className="list__mid">
                    <span className="py">{w.pinyin}</span>
                    <div className="mn">{w.primaryMeaning}</div>
                  </span>
                  <span className="list__id">#{id}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {hub.words.length >= 3 && !drill && (
          <button className="btn btn--primary btn--lg btn--block" onClick={() => setDrill(true)}>
            Drill this family · {Math.min(16, hub.words.length * 2)} questions
          </button>
        )}
        {drill && (
          <QuizRunner
            items={items}
            title={`Family ${hub.char}`}
            onFinish={(r) => {
              if (!r.length) setDrill(false);
            }}
            finishLabel="Back to the hub"
          />
        )}
      </div>
    </>
  );
}
