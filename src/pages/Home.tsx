import { Link } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useStore } from '../store';
import {
  FINGERPRINT_MIN,
  dailyNewGoal,
  fingerprint,
  overview,
  weakWords,
} from '../services/progress';
import { packProgress } from '../services/session';
import { DIMENSIONS } from '../types';
import { Meter, Ring, Stat, TopBar } from '../components/ui';
import { CONVERSATION_INDEX, PACKS, STORY_INDEX, TOTAL, getWord } from '../data';
import { APP_NAME, Credit, MfbMark } from '../brand/Logo';
import { Icon, type IconName } from '../brand/icons';

const DIM_LABEL: Record<string, string> = {
  character: 'Character recognition',
  meaning: 'Meaning recall',
  pinyin: 'Pinyin recall',
  tone: 'Tone recall',
  listening: 'Listening',
  usage: 'Usage in sentences',
};

function Tile({
  to,
  icon,
  title,
  sub,
  wide,
}: {
  to: string;
  icon: IconName;
  title: string;
  sub: string;
  wide?: boolean;
}): ReactNode {
  return (
    <Link className={`tile${wide ? ' tile--wide' : ''}`} to={to}>
      <span className="tile__ico">
        <Icon name={icon} size={20} />
      </span>
      <span className="tile__body">
        <b>{title}</b>
      </span>
      <span className="tile__sub">{sub}</span>
    </Link>
  );
}

export default function Home() {
  const { state } = useStore();
  const ov = useMemo(() => overview(state), [state]);
  const fp = useMemo(() => fingerprint(state), [state]);
  const weak = useMemo(() => weakWords(state), [state]);
  const goal = dailyNewGoal(state);

  /** The pack the learner is in the middle of, or the next one to open. */
  const current = useMemo(() => {
    for (const p of PACKS) {
      const prog = packProgress(state, p.id);
      if (prog.introduced < prog.total) return { pack: p, prog };
    }
    const last = PACKS[PACKS.length - 1]!;
    return { pack: last, prog: packProgress(state, last.id) };
  }, [state]);

  const strong = ov.mastered + ov.strong;
  const storiesRead = state.stories.completed.length;
  const episodesWatched = state.conversations.completed.length;

  return (
    <>
      <TopBar
        title={APP_NAME}
        sub={`${ov.seen} of ${TOTAL} words met`}
        right={
          <Link className="btn btn--icon btn--soft" to="/settings" aria-label="Settings">
            ⚙
          </Link>
        }
      />
      <div className="page stack">
        {/* --------------------------------------------------------- brand */}
        <div className="hero-brand">
          <MfbMark size={44} tone="brand" title="Learn HSK 3 — MFB" />
          <span className="hero-brand__meta">
            <b>{APP_NAME}</b>
            <span>
              {ov.streak > 0 ? `${ov.streak}-day streak · ` : ''}
              {state.settings.dailyMinutes} minutes a day
            </span>
          </span>
        </div>

        {/* ------------------------------------------ today's learning goal */}
        <div className="card card--hero stack--sm">
          <div className="section-title" style={{ marginTop: 0 }}>
            Today's learning goal
          </div>
          <div className="grid grid--3">
            <Stat value={ov.due} label="reviews due" />
            <Stat value={goal} label="new words" />
            <Stat value={`${Math.round(ov.accuracy * 100)}%`} label="accuracy" />
          </div>
          <Link className="btn btn--primary btn--lg btn--block" to="/today">
            Start today's session · {state.settings.dailyMinutes} min
          </Link>
        </div>

        {/* ----------------------------------------------- continue learning */}
        <div className="section-title">Continue learning</div>
        <Link className="card card--tap pack-card" to={`/learn/${current.pack.id}`}>
          <div className="n">
            HSK {current.pack.level} · Pack {current.pack.index + 1} of {PACKS.length}
          </div>
          <div className="t">{current.pack.label}</div>
          <div className="hz hanzi" lang="zh">
            {current.pack.words
              .slice(0, 6)
              .map((id) => getWord(id).hanzi)
              .join('  ')}
          </div>
          <div style={{ marginTop: 10 }}>
            <Meter
              label="Words introduced"
              value={current.prog.introduced / Math.max(1, current.prog.total)}
              right={`${current.prog.introduced} / ${current.prog.total}`}
            />
          </div>
        </Link>

        {/* -------------------------------------------------------- reviews */}
        <div className="grid grid--2">
          <Tile
            to="/today"
            icon="repeat"
            title="Reviews due"
            sub={ov.due > 0 ? `${ov.due} waiting for you` : 'Nothing due — you are clear'}
          />
          <Tile
            to="/games/rescue"
            icon="lifebuoy"
            title="Weak words"
            sub={weak.length > 0 ? `${weak.length} need rescuing` : 'No weak words right now'}
          />
          <Tile to="/map" icon="spark" title="Magic 20" sub="Ten stages, twenty words" />
          <Tile to="/cram" icon="bolt" title="Quick review" sub="A fast pass before you stop" />
          <Tile
            to="/stories"
            icon="book"
            title="Story Mode"
            sub={`${storiesRead} of ${STORY_INDEX.length} stories read`}
            wide
          />
          <Tile
            to="/cinema"
            icon="film"
            title="Conversation Cinema"
            sub={`${episodesWatched} of ${CONVERSATION_INDEX.length} episodes watched`}
            wide
          />
        </div>

        {/* --------------------------------------------- memory strength */}
        <div className="section-title">Memory strength</div>
        <div className="card row" style={{ gap: 16 }}>
          <Ring value={strong / TOTAL} label="strong+" />
          <div className="stack--sm" style={{ flex: 1, minWidth: 0 }}>
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {strong}{' '}
                <span className="muted" style={{ fontSize: '1rem' }}>
                  / {TOTAL}
                </span>
              </div>
              <div className="small muted">words held at strong or mastered</div>
            </div>
            <div className="row row--wrap">
              <span className="chip chip--accent">{ov.due} due</span>
              <span className="chip">{ov.seen} met</span>
              <span className="chip chip--bad">{weak.length} weak</span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------- progress toward 600 */}
        <div className="section-title">Progress toward 600</div>
        <div className="card stack--sm">
          <Meter label="Words met" value={ov.seen / TOTAL} right={`${ov.seen} / ${TOTAL}`} />
          <Meter
            label="Strong or mastered"
            value={strong / TOTAL}
            right={`${strong} / ${TOTAL}`}
            tone="good"
          />
          <Meter
            label="Seen in a story"
            value={storiesRead / STORY_INDEX.length}
            right={`${storiesRead} / ${STORY_INDEX.length} stories`}
          />
          <Meter
            label="Heard in a conversation"
            value={episodesWatched / CONVERSATION_INDEX.length}
            right={`${episodesWatched} / ${CONVERSATION_INDEX.length} episodes`}
          />
          <Link className="btn btn--soft btn--block" to="/heatmap">
            See all 600 at a glance
          </Link>
        </div>

        {/* --------------------------------------------- memory fingerprint */}
        <div className="section-title">
          Memory Fingerprint
          {!fp.ready && (
            <span className="chip">
              {fp.sample}/{FINGERPRINT_MIN} answers
            </span>
          )}
        </div>
        <div className="card stack--sm">
          {!fp.ready && (
            <p className="small muted">
              After about {FINGERPRINT_MIN} answers this becomes your real profile, and practice
              starts leaning toward whatever you actually forget.
            </p>
          )}
          {DIMENSIONS.map((d) => {
            const row = fp.byDimension[d];
            const tone =
              row.n < 5
                ? 'accent'
                : row.accuracy < 0.6
                  ? 'bad'
                  : row.accuracy < 0.8
                    ? 'warn'
                    : 'good';
            return (
              <Meter
                key={d}
                label={DIM_LABEL[d] ?? d}
                value={row.n >= 1 ? row.accuracy : 0}
                right={row.n >= 1 ? `${Math.round(row.accuracy * 100)}%` : 'not yet'}
                tone={tone}
              />
            );
          })}
          {fp.ready && fp.weakest.length > 0 && (
            <div className="fact">
              <span className="label">What happens next</span>
              Practice is leaning toward{' '}
              <b>{fp.weakest.map((d) => DIM_LABEL[d]).join(' and ')}</b>. Your strongest is{' '}
              {DIM_LABEL[fp.strongest[0] ?? ''] ?? '—'}, so it will come up less often.
            </div>
          )}
          <Link className="btn btn--soft btn--block" to="/dashboard">
            Full progress dashboard
          </Link>
        </div>

        {/* ----------------------------------------------------- everything */}
        <div className="section-title">More ways to practise</div>
        <div className="grid grid--2">
          <Tile to="/browse" icon="search" title="All words" sub={`Search the ${TOTAL}`} />
          <Tile to="/saved" icon="star" title="Saved scenes" sub="Your own collection" />
          <Tile to="/tone" icon="wave" title="Tone trainer" sub="Hear the four tones apart" />
          <Tile to="/pinyin" icon="letters" title="Pinyin trainer" sub="Sounds and spellings" />
          <Tile to="/confusion" icon="swords" title="Confusion battles" sub="Words that look alike" />
          <Tile to="/families" icon="tree" title="Word families" sub="Learn one, get the rest" />
          <Tile to="/measure-words" icon="ruler" title="Measure words" sub="Which one, and when" />
          <Tile to="/palace" icon="palace" title="Memory palace" sub="Place words in rooms" />
          <Tile to="/journey" icon="walk" title="Memory journey" sub="Walk a route of words" />
          <Tile to="/story" icon="link" title="Story chains" sub="Link twenty words in a row" />
          <Tile to="/dialogues" icon="chat" title="Mini dialogues" sub="Short everyday exchanges" />
          <Tile to="/notebook" icon="notebook" title="Mistake notebook" sub="Everything you missed" />
          <Tile to="/games" icon="grid" title="All training modes" sub="Every game in one place" />
          <Tile to="/boss" icon="trophy" title="Boss test" sub="Prove a hundred at a time" />
        </div>

        <Credit />
      </div>
    </>
  );
}
