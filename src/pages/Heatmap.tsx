import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WORDS } from '../data';
import { useStore } from '../store';
import { STATUSES, type Status } from '../types';
import { STATUS_LABEL, TopBar } from '../components/ui';

export default function Heatmap() {
  const { state } = useStore();
  const [hover, setHover] = useState<number | null>(null);

  const statuses = useMemo(() => {
    const map = new Map<number, Status>();
    for (const w of WORDS) {
      const p = state.progress[w.id];
      map.set(w.id, p?.introduced ? p.status : 'new');
    }
    return map;
  }, [state.progress]);

  const counts = useMemo(() => {
    const c = {} as Record<Status, number>;
    for (const s of STATUSES) c[s] = 0;
    for (const s of statuses.values()) c[s] += 1;
    return c;
  }, [statuses]);

  const hovered = hover ? WORDS.find((w) => w.id === hover) : null;

  return (
    <>
      <TopBar title="600-word heatmap" back="/dashboard" />
      <div className="page page--wide stack">
        <div className="card">
          <div className="row row--wrap">
            {STATUSES.map((s) => (
              <span className="chip" key={s}>
                <b className={`s-${s}`} style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block' }} />
                {STATUS_LABEL[s]} {counts[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="heat">
            {WORDS.map((w) => (
              <Link
                key={w.id}
                to={`/word/${w.id}`}
                className={`s-${statuses.get(w.id)}`}
                style={{ aspectRatio: '1', borderRadius: 3, display: 'block' }}
                title={`#${w.id} ${w.hanzi} ${w.pinyin} — ${w.primaryMeaning} (${STATUS_LABEL[statuses.get(w.id)!]})`}
                onMouseEnter={() => setHover(w.id)}
                onFocus={() => setHover(w.id)}
                aria-label={`${w.hanzi} ${w.pinyin}, ${STATUS_LABEL[statuses.get(w.id)!]}`}
              />
            ))}
          </div>
        </div>

        <div className="card center" style={{ minHeight: 96 }}>
          {hovered ? (
            <>
              <div className="hanzi" style={{ fontSize: '2.4rem' }}>
                {hovered.hanzi}
              </div>
              <div>
                <b>{hovered.pinyin}</b> — {hovered.primaryMeaning}
              </div>
              <div className="tiny muted">
                #{hovered.id} · {STATUS_LABEL[statuses.get(hovered.id)!]}
              </div>
            </>
          ) : (
            <p className="small muted">Hover or focus a tile to preview it; tap to open the word.</p>
          )}
        </div>
      </div>
    </>
  );
}
