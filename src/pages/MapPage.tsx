import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { PACKS, TOTAL, getWord } from '../data';
import { useStore } from '../store';
import { packProgress } from '../services/session';
import { overview } from '../services/progress';
import { Meter, TopBar } from '../components/ui';
import { Credit } from '../brand/Logo';

const MILESTONES = [0, 20, 40, 100, 200, 300, 400, 500, 600];

export default function MapPage() {
  const { state } = useStore();
  const ov = useMemo(() => overview(state), [state]);
  const byLevel = useMemo(() => {
    const map: Record<number, typeof PACKS> = { 1: [], 2: [], 3: [] };
    for (const p of PACKS) map[p.level]!.push(p);
    return map;
  }, []);

  return (
    <>
      <TopBar title="The 600-word map" sub={`${ov.seen} of ${TOTAL} words met`} back="/" backLabel="Home" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <Meter label="Words met" value={ov.seen / TOTAL} right={`${ov.seen} / ${TOTAL}`} />
          <div className="row row--wrap tiny muted">
            {MILESTONES.map((m) => (
              <span key={m} className={`chip${ov.seen >= m ? ' chip--good' : ''}`}>
                {m}
              </span>
            ))}
          </div>
          <p className="small muted">
            Each pack is one level. Finish a pack's ten stages and the words move into spaced
            repetition automatically.
          </p>
        </div>

        {[1, 2, 3].map((lvl) => (
          <div key={lvl}>
            <div className="section-title">
              HSK {lvl}
              <span className="chip">{byLevel[lvl]!.length} packs</span>
            </div>
            <div className="grid grid--auto">
              {byLevel[lvl]!.map((p) => {
                const prog = packProgress(state, p.id);
                return (
                  <Link className="card pack-card" to={`/learn/${p.id}`} key={p.id}>
                    <div className="n">Pack {p.index + 1}</div>
                    <div className="t">{p.label}</div>
                    <div className="hz hanzi">
                      {p.words.slice(0, 6).map((id) => getWord(id).hanzi).join(' ')}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Meter
                        label={`${prog.introduced}/${prog.total}`}
                        value={prog.introduced / Math.max(1, prog.total)}
                        right={`${prog.strong} strong`}
                        tone={prog.strong === prog.total ? 'good' : 'accent'}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <Credit />
      </div>
    </>
  );
}
