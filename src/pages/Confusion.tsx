import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONFUSIONS, HOMOPHONES, tryWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { TopBar } from '../components/ui';
import type { ConfusionSet, QuizItem } from '../types';

export default function Confusion() {
  const { state } = useStore();
  const [active, setActive] = useState<ConfusionSet | null>(null);
  const [seed, setSeed] = useState(0);
  const [filter, setFilter] = useState<string>('all');

  const lossRank = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const [pairKey, n] of Object.entries(state.confusionLosses)) {
      const [a, b] = pairKey.split('-').map(Number);
      for (const set of CONFUSIONS) {
        if (set.words.includes(a!) && set.words.includes(b!)) {
          byKey.set(set.key, (byKey.get(set.key) ?? 0) + n);
        }
      }
    }
    return byKey;
  }, [state.confusionLosses]);

  const kinds = useMemo(() => ['all', ...new Set(CONFUSIONS.map((c) => c.kind))], []);

  const sets = useMemo(() => {
    const list = filter === 'all' ? CONFUSIONS : CONFUSIONS.filter((c) => c.kind === filter);
    return [...list].sort((a, b) => (lossRank.get(b.key) ?? 0) - (lossRank.get(a.key) ?? 0));
  }, [filter, lossRank]);

  const items = useMemo<QuizItem[]>(() => {
    if (!active) return [];
    const ids = active.words;
    const out: QuizItem[] = [];
    for (let round = 0; round < 3; round += 1) {
      for (const id of ids) {
        const item = buildItem('confusion', id, { state, pool: ids });
        if (item) out.push(item);
      }
    }
    return out.sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seed]);

  if (active) {
    return (
      <>
        <TopBar title={active.title} back="/confusion" right={<button className="btn btn--icon btn--ghost" onClick={() => setActive(null)}>✕</button>} />
        <div className="page stack">
          <div className="card">
            <div className="fact">
              <span className="label">The one rule</span>
              {active.rule}
            </div>
            <div className="row row--wrap" style={{ marginTop: 10 }}>
              {active.words.map((id) => {
                const w = tryWord(id);
                return w ? (
                  <Link className="chip chip--button" to={`/word/${w.id}`} key={id}>
                    <span className="hanzi">{w.hanzi}</span> {w.pinyin} — {w.primaryMeaning}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
          <QuizRunner
            key={active.key + seed}
            items={items}
            title="Confusion battle"
            onFinish={(r) => {
              if (!r.length) setSeed((s) => s + 1);
            }}
            finishLabel="Fight again"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Confusion battles" sub={`${CONFUSIONS.length} sets`} back="/games" />
      <div className="page stack">
        <div className="card">
          <p className="small muted">
            Every set below is built only from words that are actually in your 600. Each one gives
            you a single rule that separates them, then quizzes you on it straight away. Sets you
            keep losing rise to the top.
          </p>
        </div>
        <div className="row row--wrap">
          {kinds.map((k) => (
            <button
              key={k}
              className={`chip chip--button${filter === k ? ' chip--on' : ''}`}
              onClick={() => setFilter(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="grid grid--auto">
          {sets.map((c) => {
            const losses = lossRank.get(c.key) ?? 0;
            return (
              <button className="card pack-card" key={c.key} onClick={() => setActive(c)} type="button">
                <div className="row">
                  <b style={{ flex: 1 }}>{c.title}</b>
                  {losses > 0 && <span className="chip chip--bad">{losses} losses</span>}
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {c.rule}
                </div>
                <div className="row row--wrap" style={{ marginTop: 8 }}>
                  <span className="chip">{c.kind}</span>
                  <span className="chip">{c.words.length} words</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="section-title">Exact sound twins in your list</div>
        <div className="card stack--sm stack">
          <p className="small muted">
            These share identical pinyin including the tone, so only the character or the context
            tells them apart.
          </p>
          {HOMOPHONES.map((h) => (
            <div className="row row--wrap" key={h.pinyin}>
              <span className="chip chip--accent mono">{h.pinyin}</span>
              {h.words.map((id) => {
                const w = tryWord(id);
                return w ? (
                  <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                    <span className="hanzi">{w.hanzi}</span> {w.primaryMeaning}
                  </Link>
                ) : null;
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
