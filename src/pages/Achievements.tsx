import { useStore } from '../store';
import { ACHIEVEMENTS } from '../services/achievements';
import { TopBar } from '../components/ui';

export default function Achievements() {
  const { state } = useStore();
  const earned = new Map(state.achievements.map((a) => [a.key, a.at]));
  return (
    <>
      <TopBar
        title="Achievements"
        sub={`${earned.size} of ${ACHIEVEMENTS.length}`}
        back="/dashboard"
      />
      <div className="page stack">
        <div className="grid grid--auto">
          {ACHIEVEMENTS.map((a) => {
            const at = earned.get(a.key);
            return (
              <div className="card" key={a.key} style={{ opacity: at ? 1 : 0.5 }}>
                <div className="row">
                  <span style={{ fontSize: '1.7rem' }} aria-hidden>
                    {at ? a.icon : '🔒'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <b>{a.title}</b>
                    <div className="small muted">{a.blurb}</div>
                  </div>
                </div>
                {at && (
                  <div className="tiny muted" style={{ marginTop: 6 }}>
                    Earned {new Date(at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
