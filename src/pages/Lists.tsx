import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tryWord } from '../data';
import { useStore } from '../store';
import { Empty, TopBar, useToast } from '../components/ui';

export default function Lists() {
  const { state, deleteList, setList, removeFromList } = useStore();
  const [name, setName] = useState('');
  const [toast, showToast] = useToast();

  const starred = useMemo(
    () => Object.values(state.progress).filter((p) => p.starred).map((p) => p.id),
    [state.progress],
  );
  const names = Object.keys(state.customLists);

  return (
    <>
      <TopBar title="Lists" back="/browse" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <div className="row">
            <h3 style={{ flex: 1 }}>★ Starred</h3>
            <span className="chip">{starred.length}</span>
          </div>
          {starred.length === 0 ? (
            <p className="small muted">Star a word from its page to keep it in extra rotation.</p>
          ) : (
            <>
              <div className="row row--wrap">
                {starred.map((id) => {
                  const w = tryWord(id);
                  return w ? (
                    <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                      <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                    </Link>
                  ) : null;
                })}
              </div>
              <Link className="btn btn--soft btn--sm" to={`/games/hanzi-meaning?ids=${starred.join(',')}`}>
                Drill starred words
              </Link>
            </>
          )}
        </div>

        <form
          className="card stack--sm stack"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            setList(n, state.customLists[n] ?? []);
            setName('');
            showToast(`List “${n}” created`);
          }}
        >
          <h3>Create a list</h3>
          <div className="row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Very difficult / Exam tomorrow / Travel…"
            />
            <button className="btn btn--soft" type="submit">
              Create
            </button>
          </div>
          <p className="tiny muted">Add words to a list from any word page.</p>
        </form>

        {names.length === 0 ? (
          <Empty title="No custom lists yet" body="Create one above, then add words from their pages." />
        ) : (
          names.map((n) => {
            const ids = state.customLists[n] ?? [];
            return (
              <div className="card stack--sm stack" key={n}>
                <div className="row">
                  <h3 style={{ flex: 1 }}>{n}</h3>
                  <span className="chip">{ids.length}</span>
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => {
                      deleteList(n);
                      showToast(`List “${n}” deleted`);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="row row--wrap">
                  {ids.map((id) => {
                    const w = tryWord(id);
                    return w ? (
                      <span className="chip" key={id}>
                        <Link to={`/word/${id}`}>
                          <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                        </Link>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ minHeight: 20, padding: '0 4px' }}
                          onClick={() => removeFromList(n, id)}
                          aria-label={`Remove ${w.hanzi} from ${n}`}
                        >
                          ✕
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
                {ids.length > 0 && (
                  <Link className="btn btn--soft btn--sm" to={`/games/hanzi-meaning?list=${encodeURIComponent(n)}`}>
                    Drill this list
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
      {toast}
    </>
  );
}
