/**
 * STORY MODE — read a short story built from words you are learning, with the
 * English hidden until you ask for it.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Empty, Segmented, TopBar } from '../components/ui';
import {
  CaptionBar,
  LineBlock,
  SceneCard,
  SceneLoading,
  PlaybackError,
  SceneQuiz,
  Transport,
  VIEWS,
  VIEW_CAPTIONS,
  useScene,
  useScenePlayer,
  viewOf,
} from '../components/scene';
import { STORY_INDEX, getWord } from '../data';
import { pushBackHandler } from '../services/platform';
import { mandarinConfirmed } from '../services/speech';
import { useStore } from '../store';
import type { CaptionMode, StoryDifficulty } from '../types';

const DIFFICULTY: { value: StoryDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'challenge', label: 'Challenge' },
];

const DIFFICULTY_RATE: Record<StoryDifficulty, number> = {
  easy: 0.65,
  normal: 0.85,
  challenge: 1.0,
};

/* ------------------------------------------------------------------ list */

export default function StoryList() {
  const { state } = useStore();
  const [filter, setFilter] = useState<'all' | 'new' | 'done' | 'saved'>('all');
  const done = new Set(state.stories.completed);
  const saved = new Set(state.saved.stories);

  const shown = STORY_INDEX.filter((s) => {
    if (filter === 'new') return !done.has(s.id);
    if (filter === 'done') return done.has(s.id);
    if (filter === 'saved') return saved.has(s.id);
    return true;
  });

  return (
    <div className="page">
      <TopBar title="Story Mode" sub={`${done.size} of ${STORY_INDEX.length} stories read`} back="/" />
      <div className="card card--hero stack--sm">
        <h2>Meet your words in a story</h2>
        <p className="small">
          Every story is written from words on your list. Read the Chinese first, tap a word only
          when you need it, and reveal the English at the end of each line.
        </p>
        <div className="progressline" aria-hidden>
          <i style={{ width: `${(done.size / STORY_INDEX.length) * 100}%` }} />
        </div>
      </div>

      <Segmented
        ariaLabel="Filter stories"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all' as const, label: 'All' },
          { value: 'new' as const, label: 'To read' },
          { value: 'done' as const, label: 'Read' },
          { value: 'saved' as const, label: 'Saved' },
        ]}
      />

      {shown.length === 0 ? (
        <Empty
          title="Nothing here yet"
          body={
            filter === 'saved'
              ? 'Tap the star on a story to keep it here for later.'
              : 'Every story in this list has been read. Try one again with the English hidden.'
          }
          action={
            <button className="btn btn--soft" type="button" onClick={() => setFilter('all')}>
              Show every story
            </button>
          }
        />
      ) : (
        <div className="stack--sm">
          {shown.map((s) => (
            <SceneCard
              key={s.id}
              scene={s}
              to={`/stories/${s.id}`}
              done={done.has(s.id)}
              score={state.stories.scores[s.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- player */

export function StoryPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, setCaptions, setSettings, markScene, toggleSaved, record } = useStore();
  const { scene, loading } = useScene('story', id);

  const captions = state.settings.captions;
  const difficulty = state.settings.storyDifficulty;
  const [rate, setRate] = useState(DIFFICULTY_RATE[difficulty]);
  const [stage, setStage] = useState<'read' | 'quiz' | 'done'>('read');
  const [score, setScore] = useState<number | null>(null);
  const [helped, setHelped] = useState<Set<number>>(new Set());
  const [reachedEnd, setReachedEnd] = useState(false);

  const lines = scene?.lines ?? [];
  const targets = useMemo(() => new Set(scene?.targets ?? []), [scene]);
  const player = useScenePlayer(lines, { rate, onFinish: () => setReachedEnd(true) });

  useEffect(() => setRate(DIFFICULTY_RATE[difficulty]), [difficulty]);

  // Android back leaves the quiz before it leaves the story, so a hardware
  // press never throws away a session by accident.
  useEffect(
    () =>
      pushBackHandler(() => {
        if (stage === 'quiz') {
          setStage('read');
          return true;
        }
        return false;
      }),
    [stage],
  );

  useEffect(() => {
    // Only start by itself when a Chinese voice is actually there; otherwise
    // the learner would open a scene into an error they did not ask for.
    if (scene && state.settings.audio.autoStory && mandarinConfirmed()) {
      const t = setTimeout(() => player.playFrom(0), 350);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  if (!scene) {
    return (
      <div className="page">
        <TopBar title={loading ? 'Story' : 'Story not found'} back="/stories" backLabel="Stories" />
        {loading ? (
          <SceneLoading />
        ) : (
          <Empty title="That story has moved" body="Pick another one from the list." />
        )}
      </div>
    );
  }

  const saved = state.saved.stories.includes(scene.id);
  const view = viewOf(captions);

  /** Credit the words the learner read without asking for help. */
  const creditReading = () => {
    for (const wid of scene.targets) {
      if (helped.has(wid)) continue;
      record({
        wordId: wid,
        dimension: 'usage',
        correct: true,
        ms: 9000,
        mode: 'story-read',
        schedule: false,
      });
    }
  };

  const finish = () => {
    creditReading();
    markScene('stories', scene.id, {
      completed: true,
      replay: state.stories.completed.includes(scene.id),
      hiddenEnglish: !captions.english,
      listening: !captions.hanzi,
    });
    setStage('quiz');
  };

  return (
    <div className="page">
      <TopBar
        title={scene.title}
        sub={`${scene.topic} · ${scene.targets.length} of your words`}
        back="/stories"
        backLabel="Stories"
        right={
          <button
            type="button"
            className="btn btn--icon btn--soft"
            aria-label={saved ? 'Remove from saved scenes' : 'Save this story'}
            aria-pressed={saved}
            onClick={() => toggleSaved('stories', scene.id)}
          >
            {saved ? '★' : '☆'}
          </button>
        }
      />

      {stage === 'read' && (
        <>
          {/* The caption switches stay in reach — a learner flips those every
              few lines. The rest folds away so the story is what you land on. */}
          <CaptionBar
            captions={captions}
            onChange={setCaptions}
            autoLabel="Auto play"
            auto={state.settings.audio.autoStory}
            onAuto={(v) => setSettings({ audio: { ...state.settings.audio, autoStory: v } })}
          />

          <details className="disclosure">
            <summary>
              Reading options
              <span className="hint">
                {VIEWS.find((v) => v.value === view)?.label ?? 'Custom'} ·{' '}
                {DIFFICULTY.find((d) => d.value === difficulty)?.label}
              </span>
            </summary>
            <div className="disclosure__body">
              <Segmented
                ariaLabel="Learning view"
                value={(view ?? '') as CaptionMode}
                onChange={(v) => setCaptions(VIEW_CAPTIONS[v])}
                options={VIEWS.map((v) => ({ value: v.value, label: v.label }))}
              />
              <p className="tiny muted">
                {view
                  ? VIEWS.find((v) => v.value === view)?.blurb
                  : 'Your own mix of captions — pick a view above to reset it.'}
              </p>
              <div className="section-title" style={{ marginTop: 0 }}>
                Difficulty
              </div>
              <Segmented
                ariaLabel="Difficulty"
                value={difficulty}
                onChange={(v) => setSettings({ storyDifficulty: v })}
                options={DIFFICULTY}
              />
            </div>
          </details>

          <div className="card card--quiet" style={{ padding: 4 }}>
            {lines.map((l, i) => (
              <LineBlock
                key={i}
                line={l}
                index={i}
                targets={targets}
                captions={captions}
                active={player.index === i}
                speaking={player.index === i && player.speaking}
                saved={state.saved.lines.includes(`${scene.id}:${i}`)}
                onSave={() => toggleSaved('lines', `${scene.id}:${i}`)}
                onPlay={() => player.playLine(i)}
                onWordTapped={(wid) => setHelped((s) => new Set(s).add(wid))}
              />
            ))}
          </div>

          <PlaybackError message={player.error} />

          <Transport player={player} total={lines.length} rate={rate} onRate={setRate} />

          <button className="btn btn--primary btn--block btn--lg" type="button" onClick={finish}>
            {reachedEnd ? 'Check what you remember' : 'I have read it — check me'}
          </button>
        </>
      )}

      {stage === 'quiz' && (
        <div className="card">
          <SceneQuiz
            scene={scene}
            difficulty={difficulty}
            mode="story-quiz"
            onDone={(s) => {
              setScore(s);
              markScene('stories', scene.id, { score: s });
              setStage('done');
            }}
          />
        </div>
      )}

      {stage === 'done' && (
        <div className="card center stack">
          <div style={{ fontSize: '2.6rem' }} aria-hidden>
            {score !== null && score >= 80 ? '🌟' : '📖'}
          </div>
          <h2>{score}% remembered</h2>
          <p className="small muted">
            {score !== null && score >= 80
              ? 'Strong reading. Try it again with the English hidden.'
              : 'Read it once more — the words you missed are easier the second time.'}
          </p>
          <div className="row row--wrap center">
            <button
              className="btn btn--soft"
              type="button"
              onClick={() => {
                setStage('read');
                setScore(null);
                setReachedEnd(false);
                setHelped(new Set());
                player.reset();
                markScene('stories', scene.id, { replay: true });
              }}
            >
              Read again
            </button>
            <button className="btn btn--primary" type="button" onClick={() => navigate('/stories')}>
              Next story
            </button>
          </div>
          <div className="section-title">Words in this story</div>
          <div className="row row--wrap">
            {scene.targets.slice(0, 24).map((wid) => (
              <Link key={wid} className="chip chip--button" to={`/word/${wid}`}>
                <span className="hanzi" lang="zh">
                  {getWord(wid).hanzi}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
