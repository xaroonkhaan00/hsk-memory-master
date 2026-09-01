import { Link } from 'react-router-dom';
import { APP_NAME, BrandLockup, CREATOR, Credit, MONOGRAM } from '../brand/Logo';
import { TopBar } from '../components/ui';
import { CONVERSATION_INDEX, META, STORY_INDEX, TOTAL } from '../data';

export default function About() {
  return (
    <div className="page">
      <TopBar title="About" back="/settings" backLabel="Settings" />

      <div className="card card--hero center stack">
        <BrandLockup size={72} stacked />
        <p className="small">
          A calm, offline place to learn {TOTAL} Chinese words — see them, hear them, and meet them
          again in stories and conversations until they stay.
        </p>
      </div>

      <div className="card stack--sm">
        <div className="section-title">The name</div>
        <p className="small">
          <b>{APP_NAME}</b> is the app. <b>{MONOGRAM}</b> is the monogram on the icon, and it stands
          for <b>{CREATOR}</b>.
        </p>
        <p className="small muted">
          The mark is three brush strokes — M, F and B — resting on a single horizontal sweep, the
          same stroke that writes 一, “one”.
        </p>
      </div>

      <div className="card stack--sm">
        <div className="section-title">What is inside</div>
        <div className="grid grid--2">
          <div className="stat">
            <div className="stat__value mono">{TOTAL}</div>
            <div className="stat__label">words</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{META.totalExamples}</div>
            <div className="stat__label">example sentences</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{STORY_INDEX.length}</div>
            <div className="stat__label">stories</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{CONVERSATION_INDEX.length}</div>
            <div className="stat__label">conversation episodes</div>
          </div>
        </div>
        <p className="tiny muted">
          Every word appears in at least one story and at least one conversation, so nothing on your
          list is ever left as a flashcard alone.
        </p>
      </div>

      <div className="card stack--sm">
        <div className="section-title">Privacy</div>
        <p className="small">
          Everything stays on this device. There is no account, no sign-in and no server: your
          progress lives in this app's own storage and leaves only when you export a backup
          yourself.
        </p>
        <Link className="btn btn--soft" to="/settings">
          Back up my progress
        </Link>
      </div>

      <Credit />
    </div>
  );
}
