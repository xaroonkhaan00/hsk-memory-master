import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PACKS, WORDS, categoryLabel } from '../data';
import { useStore } from '../store';
import { progressOf } from '../services/progress';
import { normalisePinyin } from '../services/pinyin';
import { STATUSES, type Status } from '../types';
import { Empty, Segmented, StatusChip, TopBar } from '../components/ui';

type Sort = 'id' | 'pinyin' | 'weakest';

export default function Browse() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [status, setStatus] = useState<Status | 'all' | 'starred'>('all');
  const [sort, setSort] = useState<Sort>('id');

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const pinyinQuery = normalisePinyin(query);
    let list = WORDS.filter((w) => {
      if (cat && w.category !== cat) return false;
      if (level && w.level !== level) return false;
      const p = progressOf(state, w.id);
      if (status === 'starred' && !p.starred) return false;
      if (status !== 'all' && status !== 'starred') {
        const st = p.introduced ? p.status : 'new';
        if (st !== status) return false;
      }
      if (!query) return true;
      if (String(w.id) === query) return true;
      if (w.hanzi.includes(query)) return true;
      if (w.pinyin.toLowerCase().includes(query)) return true;
      if (pinyinQuery && w.pinyinPlain.includes(pinyinQuery)) return true;
      if (w.allMeanings.some((m) => m.toLowerCase().includes(query))) return true;
      return false;
    });
    if (sort === 'pinyin') list = [...list].sort((a, b) => a.pinyinPlain.localeCompare(b.pinyinPlain));
    if (sort === 'weakest') {
      list = [...list].sort((a, b) => {
        const pa = progressOf(state, a.id);
        const pb = progressOf(state, b.id);
        const sa = pa.attempts ? pa.correct / pa.attempts : 1;
        const sb = pb.attempts ? pb.correct / pb.attempts : 1;
        return sa - sb;
      });
    }
    return list;
  }, [q, level, status, sort, state, cat]);

  return (
    <>
      <TopBar
        title="All 600 words"
        sub={`${results.length} shown`}
        right={
          <Link className="btn btn--icon btn--ghost" to="/lists" aria-label="Lists">
            ☰
          </Link>
        }
      />
      <div className="page stack">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search hanzi, pinyin, English or number…"
          aria-label="Search vocabulary"
        />
        {cat && (
          <div className="row">
            <span className="chip chip--accent">{categoryLabel(cat)}</span>
            <button className="btn btn--sm btn--ghost" onClick={() => setParams({})}>
              Clear theme filter
            </button>
          </div>
        )}
        <div className="row row--wrap">
          <Segmented
            value={level}
            onChange={(v) => setLevel(v as 0 | 1 | 2 | 3)}
            options={[
              { value: 0, label: 'All' },
              { value: 1, label: 'HSK 1' },
              { value: 2, label: 'HSK 2' },
              { value: 3, label: 'HSK 3' },
            ]}
            ariaLabel="Level filter"
          />
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: 'id' as Sort, label: '№' },
              { value: 'pinyin' as Sort, label: 'A–Z' },
              { value: 'weakest' as Sort, label: 'Weakest' },
            ]}
            ariaLabel="Sort"
          />
        </div>
        <div className="row row--wrap">
          {(['all', 'starred', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              className={`chip chip--button${status === s ? ' chip--on' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s === 'starred' ? '★ Starred' : s}
            </button>
          ))}
        </div>

        {results.length === 0 ? (
          <Empty
            title="No words match that"
            body="Try fewer filters, or search by the characters, the pinyin, the English meaning or the number."
            action={
              <button
                className="btn btn--soft"
                type="button"
                onClick={() => {
                  setQ('');
                  setLevel(0);
                  setStatus('all');
                  setParams({});
                }}
              >
                Show every word
              </button>
            }
          />
        ) : (
          <div className="card">
            <div className="list">
              {results.slice(0, 300).map((w) => {
                const p = progressOf(state, w.id);
                return (
                  <Link className="list__item" to={`/word/${w.id}`} key={w.id}>
                    <span className="list__hz hanzi">{w.hanzi}</span>
                    <span className="list__mid">
                      <span className="py">
                        {w.pinyin} {p.starred && '★'}
                      </span>
                      <div className="mn">{w.primaryMeaning}</div>
                      <div className="tiny muted">
                        #{w.id} · {categoryLabel(w.category)} ·{' '}
                        {PACKS.find((x) => x.id === w.pack)?.label}
                      </div>
                    </span>
                    <StatusChip status={p.introduced ? p.status : 'new'} />
                  </Link>
                );
              })}
            </div>
            {results.length > 300 && (
              <p className="tiny muted center" style={{ marginTop: 10 }}>
                Showing the first 300 of {results.length}. Narrow the search to see the rest.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
