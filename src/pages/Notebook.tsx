import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tryWord } from '../data';
import { useStore } from '../store';
import type { Dimension, ErrorLog } from '../types';
import { Empty, TopBar } from '../components/ui';

const FILTERS: { key: Dimension | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'character', label: 'Character' },
  { key: 'pinyin', label: 'Pinyin' },
  { key: 'tone', label: 'Tones' },
  { key: 'meaning', label: 'Meaning' },
  { key: 'listening', label: 'Listening' },
  { key: 'usage', label: 'Usage' },
];

interface Row {
  wordId: number;
  error: ErrorLog;
  count: number;
}

export default function Notebook() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Dimension | 'all'>('all');

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const p of Object.values(state.progress)) {
      if (!p.errors.length) continue;
      const relevant = filter === 'all' ? p.errors : p.errors.filter((e) => e.dimension === filter);
      if (!relevant.length) continue;
      out.push({ wordId: p.id, error: relevant[0]!, count: relevant.length });
    }
    return out.sort((a, b) => b.count - a.count || b.error.at - a.error.at);
  }, [state.progress, filter]);

  return (
    <>
      <TopBar title="My mistake notebook" sub={`${rows.length} words`} back="/dashboard" />
      <div className="page stack">
        <div className="row row--wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip chip--button${filter === f.key ? ' chip--on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <Empty
            title="Nothing in the notebook"
            body="Every mistake you make is filed here automatically, with what you answered, what the answer was, the kind of error it was, and the memory hook for that word."
            action={
              <Link className="btn btn--primary" to="/today">
                Start a session
              </Link>
            }
          />
        ) : (
          <>
            <Link
              className="btn btn--primary btn--lg btn--block"
              to={`/games/rescue?ids=${rows.slice(0, 30).map((r) => r.wordId).join(',')}`}
            >
              Drill these {Math.min(30, rows.length)} words now
            </Link>
            {rows.map((r) => {
              const w = tryWord(r.wordId);
              if (!w) return null;
              return (
                <div className="card stack--sm stack" key={r.wordId}>
                  <div className="row">
                    <Link to={`/word/${w.id}`} className="hanzi" style={{ fontSize: '2rem' }}>
                      {w.hanzi}
                    </Link>
                    <div style={{ flex: 1 }}>
                      <b>{w.pinyin}</b>
                      <div className="small muted">{w.primaryMeaning}</div>
                    </div>
                    <span className="chip chip--bad">{r.count}×</span>
                  </div>
                  <table>
                    <tbody>
                      <tr>
                        <th>You answered</th>
                        <td>{r.error.given || <span className="muted">(nothing)</span>}</td>
                      </tr>
                      <tr>
                        <th>Correct</th>
                        <td>{r.error.expected}</td>
                      </tr>
                      <tr>
                        <th>Error type</th>
                        <td>
                          <span className="chip chip--bad">{r.error.kind}</span>{' '}
                          <span className="chip">{r.error.dimension}</span>
                        </td>
                      </tr>
                      <tr>
                        <th>Last mistake</th>
                        <td>{new Date(r.error.at).toLocaleString()}</td>
                      </tr>
                      {r.error.confusedWith && (
                        <tr>
                          <th>Confused with</th>
                          <td>
                            <Link to={`/word/${r.error.confusedWith}`}>
                              <span className="hanzi">{tryWord(r.error.confusedWith)?.hanzi}</span>{' '}
                              {tryWord(r.error.confusedWith)?.pinyin}
                            </Link>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="trick">
                    <span className="label">Memory trick — not historical origin</span>
                    {w.story}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
