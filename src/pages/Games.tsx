import { Link } from 'react-router-dom';
import { MODES } from '../services/quiz';
import { mandarinAvailable } from '../services/tts';
import { TopBar } from '../components/ui';

export default function Games() {
  const audio = mandarinAvailable();
  return (
    <>
      <TopBar title="Training modes" sub={`${MODES.length} modes`} />
      <div className="page stack">
        {!audio && (
          <div className="card">
            <p className="small muted">
              No Mandarin voice was found in this browser, so the two listening modes are shown as
              unavailable rather than played with the wrong accent. Everything else works.
            </p>
          </div>
        )}
        <div className="grid grid--auto">
          {MODES.map((m) => {
            const disabled = m.needsAudio && !audio;
            const inner = (
              <>
                <div className="row">
                  <span style={{ fontSize: '1.4rem' }} aria-hidden>
                    {m.icon}
                  </span>
                  <b style={{ flex: 1 }}>{m.title}</b>
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {m.blurb}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <span className="chip">{m.dimension}</span>
                  {disabled && <span className="chip chip--warn">needs audio</span>}
                </div>
              </>
            );
            return disabled ? (
              <div className="card" key={m.key} style={{ opacity: 0.5 }}>
                {inner}
              </div>
            ) : (
              <Link className="card pack-card" to={`/games/${m.key}`} key={m.key}>
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="section-title">Focused trainers</div>
        <div className="grid grid--2">
          <Link className="btn btn--soft btn--lg" to="/tone">📈 Tone trainer</Link>
          <Link className="btn btn--soft btn--lg" to="/pinyin">🔤 Pinyin trainer</Link>
          <Link className="btn btn--soft btn--lg" to="/confusion">⚔️ Confusion battles</Link>
          <Link className="btn btn--soft btn--lg" to="/cram">🔥 Cram mode</Link>
          <Link className="btn btn--soft btn--lg" to="/boss">👑 Boss battles</Link>
          <Link className="btn btn--soft btn--lg" to="/story">🎬 Story chains</Link>
          <Link className="btn btn--soft btn--lg" to="/dialogues">💬 Mini dialogues</Link>
          <Link className="btn btn--soft btn--lg" to="/measure-words">📏 Measure words</Link>
        </div>
      </div>
    </>
  );
}
