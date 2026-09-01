import { Link, useParams } from 'react-router-dom';
import { ROOMS, getWord } from '../data';
import { useStore } from '../store';
import { progressOf } from '../services/progress';
import { Speaker, StatusChip, TopBar } from '../components/ui';

export default function Palace() {
  const { room } = useParams();
  const { state } = useStore();
  const current = ROOMS.find((r) => r.key === room);

  if (current) {
    return (
      <>
        <TopBar title={`${current.icon} ${current.label}`} sub={`${current.words.length} words`} back="/palace" />
        <div className="page stack">
          <div className="card">
            <p className="small muted">
              Put yourself in this room. Every word below has a place in it — the fridge in the
              corner, the doctor by the door. When you need the word later, walk back into the room
              and look at where you left it.
            </p>
          </div>
          <div className="card">
            <div className="list">
              {current.words.map((id) => {
                const w = getWord(id);
                const p = progressOf(state, id);
                return (
                  <Link className="list__item" to={`/word/${id}`} key={id}>
                    <span className="list__hz hanzi">{w.hanzi}</span>
                    <span className="list__mid">
                      <span className="py">{w.pinyin}</span>
                      <div className="mn">{w.primaryMeaning}</div>
                    </span>
                    <Speaker text={w.plain} compact />
                    <StatusChip status={p.introduced ? p.status : 'new'} />
                  </Link>
                );
              })}
            </div>
          </div>
          <Link
            className="btn btn--primary btn--lg btn--block"
            to={`/games/hanzi-meaning?ids=${current.words.join(',')}`}
          >
            Drill this room
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Memory palace" sub="Fourteen rooms, 600 words" />
      <div className="page stack">
        <div className="card">
          <p className="small muted">
            Every word in your list has been placed in a room where it would plausibly live. The
            room is the retrieval cue: you remember 冰箱 because you remember walking into the
            kitchen, not because you drilled it in isolation.
          </p>
        </div>
        <div className="grid grid--3">
          {ROOMS.map((r) => {
            const known = r.words.filter((id) => state.progress[id]?.introduced).length;
            return (
              <Link className="card room-tile" to={`/palace/${r.key}`} key={r.key}>
                <div className="ico" aria-hidden>
                  {r.icon}
                </div>
                <div className="lb">{r.label}</div>
                <div className="ct">
                  {known}/{r.words.length}
                </div>
              </Link>
            );
          })}
        </div>
        <Link className="btn btn--soft btn--lg btn--block" to="/journey">
          🚶 Walk the memory journey instead
        </Link>
      </div>
    </>
  );
}
