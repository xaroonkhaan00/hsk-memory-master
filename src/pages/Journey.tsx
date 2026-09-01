import { Link } from 'react-router-dom';
import { JOURNEY, getWord } from '../data';
import { useStore } from '../store';
import { TopBar } from '../components/ui';

export default function Journey() {
  const { state } = useStore();
  return (
    <>
      <TopBar title="Memory journey" sub="One ordinary day, in order" back="/palace" />
      <div className="page stack">
        <div className="card">
          <p className="small muted">
            The palace gives you places; the journey gives you an <b>order</b>. Walk this route in
            your head from waking up to flying away, and the words come back in sequence rather
            than at random.
          </p>
        </div>
        <div className="journey">
          {JOURNEY.map((s, i) => {
            const known = s.words.filter((id) => state.progress[id]?.introduced).length;
            return (
              <div className="journey__step" key={s.room}>
                <div className="journey__rail">
                  <div className="journey__dot" aria-hidden>
                    {s.icon}
                  </div>
                  {i < JOURNEY.length - 1 && <div className="journey__line" />}
                </div>
                <div className="journey__body">
                  <div className="row">
                    <b style={{ flex: 1 }}>
                      {s.step}. {s.caption}
                    </b>
                    <span className="chip">
                      {known}/{s.words.length}
                    </span>
                  </div>
                  <div className="row row--wrap" style={{ marginTop: 6 }}>
                    {s.words.slice(0, 12).map((id) => {
                      const w = getWord(id);
                      return (
                        <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                          <span className="hanzi">{w.hanzi}</span> {w.pinyin}
                        </Link>
                      );
                    })}
                    {s.words.length > 12 && (
                      <Link className="chip chip--button" to={`/palace/${s.room}`}>
                        +{s.words.length - 12} more
                      </Link>
                    )}
                  </div>
                  <Link
                    className="btn btn--soft btn--sm"
                    style={{ marginTop: 8 }}
                    to={`/games/hanzi-meaning?ids=${s.words.slice(0, 30).join(',')}`}
                  >
                    Drill this stop
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
