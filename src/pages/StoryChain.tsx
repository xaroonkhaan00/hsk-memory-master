import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PACKS, ROOMS, getWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import QuizRunner from '../components/QuizRunner';
import { Speaker, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

const CONNECTORS = [
  'You push open the door and the first thing you see is',
  'Right behind it, impossible to miss, sits',
  'You trip over',
  'Something shouts at you from the corner — it is',
  'Hanging from the ceiling is',
  'You turn round and there, far too close, is',
  'Under all of that, squashed flat, you find',
  'Someone hands you',
  'The floor opens and out climbs',
  'On your way out you almost forget',
  'Finally, blocking the exit, stands',
  'And balanced on top of everything else,',
];

export default function StoryChainPage() {
  const { packId } = useParams();
  const { state } = useStore();
  const [selected, setSelected] = useState<string>(packId ?? PACKS[0]!.id);
  const [tested, setTested] = useState(false);
  const [seed, setSeed] = useState(0);

  const pack = PACKS.find((p) => p.id === selected) ?? PACKS[0]!;
  const words = useMemo(() => {
    // Prefer words that sit in the same imagined room — the scene holds together
    // better when everything happens in one place.
    const all = pack.words.map(getWord);
    const byRoom = new Map<string, typeof all>();
    for (const w of all) {
      const list = byRoom.get(w.room) ?? [];
      list.push(w);
      byRoom.set(w.room, list);
    }
    const ordered = [...byRoom.entries()].sort((a, b) => b[1].length - a[1].length).flatMap(([, v]) => v);
    return ordered.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.id, seed]);

  const room = ROOMS.find((r) => r.key === words[0]?.room);

  const items = useMemo<QuizItem[]>(() => {
    const ids = words.map((w) => w.id);
    const out: QuizItem[] = [];
    for (const id of ids) {
      const a = buildItem('story-recall', id, { state, pool: ids });
      if (a) out.push(a);
      const b = buildItem('hanzi-meaning', id, { state, pool: ids });
      if (b) out.push(b);
    }
    return out.sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, tested]);

  return (
    <>
      <TopBar title="Story chain" sub={pack.title} back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <label className="tiny muted" htmlFor="pack-select">
            Pack
          </label>
          <select
            id="pack-select"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setTested(false);
            }}
          >
            {PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        {!tested ? (
          <>
            <div className="card stack--sm stack">
              <h2>
                {room ? `${room.icon} ${room.label}` : 'One scene, ten words'}
              </h2>
              <p className="tiny muted">
                A chain, not a paragraph: each link is that word's own memory scene, hooked to the
                one before it. Read it once slowly, then close your eyes and walk it again.
              </p>
              {words.map((w, i) => (
                <div className="row" key={w.id} style={{ alignItems: 'flex-start', gap: 10 }}>
                  <span className="journey__dot">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <span className="small muted">{CONNECTORS[i % CONNECTORS.length]} </span>
                    <Link to={`/word/${w.id}`} className="hanzi" style={{ fontSize: '1.5rem' }}>
                      {w.hanzi}
                    </Link>{' '}
                    <span className="small">
                      ({w.pinyin} — {w.primaryMeaning})
                    </span>
                    <Speaker text={w.plain} compact />
                    <div className="trick" style={{ marginTop: 4 }}>
                      <span className="label">Memory trick — not historical origin</span>
                      {w.story}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn--primary btn--lg btn--block" onClick={() => setTested(true)}>
              Close the book — test me on the chain
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => setSeed((s) => s + 1)}>
              Rebuild the chain
            </button>
          </>
        ) : (
          <QuizRunner
            items={items}
            title="Story recall"
            onFinish={(r) => {
              if (!r.length) setTested(false);
            }}
            finishLabel="Back to the story"
          />
        )}
      </div>
    </>
  );
}
