/**
 * CONVERSATION CINEMA — short scenes played out by two speakers, with captions
 * you can switch off one layer at a time until you are listening on your own.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Empty, TopBar } from '../components/ui';
import {
  Avatar,
  CaptionBar,
  LineBlock,
  PlaybackError,
  SceneCard,
  SceneLoading,
  SceneQuiz,
  SoundWave,
  Transport,
  useScene,
  useScenePlayer,
} from '../components/scene';
import { CONVERSATION_INDEX, getWord } from '../data';
import { pushBackHandler } from '../services/platform';
import { mandarinConfirmed } from '../services/speech';
import { useStore } from '../store';
import type { CaptionSettings, SceneLine } from '../types';

/**
 * The loop the learner walks: watch it, watch it again, dig into the words,
 * then take one support layer away at a time until only the sound is left.
 */
const STAGES: {
  key: string;
  label: string;
  blurb: string;
  captions: CaptionSettings;
}[] = [
  {
    key: 'watch',
    label: 'Watch',
    blurb: 'Everything on. Just follow the scene.',
    captions: { hanzi: true, pinyin: true, english: true, highlightTargets: true },
  },
  {
    key: 'replay',
    label: 'Replay',
    blurb: 'Same scene again — this time listen to the rhythm.',
    captions: { hanzi: true, pinyin: true, english: true, highlightTargets: true },
  },
  {
    key: 'words',
    label: 'Tap words',
    blurb: 'Tap any highlighted word to see its pinyin and meaning.',
    captions: { hanzi: true, pinyin: true, english: false, highlightTargets: true },
  },
  {
    key: 'no-english',
    label: 'No English',
    blurb: 'Understand from the Chinese. Reveal a line only if you are stuck.',
    captions: { hanzi: true, pinyin: true, english: false, highlightTargets: true },
  },
  {
    key: 'no-pinyin',
    label: 'No pinyin',
    blurb: 'Characters only. Your eyes do the work now.',
    captions: { hanzi: true, pinyin: false, english: false, highlightTargets: false },
  },
  {
    key: 'audio-only',
    label: 'Audio only',
    blurb: 'No captions at all. Listen, then check yourself.',
    captions: { hanzi: false, pinyin: false, english: false, highlightTargets: false },
  },
  {
    key: 'quiz',
    label: 'Quiz',
    blurb: 'Show what stayed with you.',
    captions: { hanzi: true, pinyin: true, english: false, highlightTargets: true },
  },
];

/* ------------------------------------------------------------------ list */

export default function CinemaList() {
  const { state } = useStore();
  const [topic, setTopic] = useState('All');
  const done = new Set(state.conversations.completed);
  const topics = useMemo(
    () => ['All', ...Array.from(new Set(CONVERSATION_INDEX.map((c) => c.topic))).sort()],
    [],
  );
  const shown = CONVERSATION_INDEX.filter((c) => topic === 'All' || c.topic === topic);

  return (
    <div className="page">
      <TopBar
        title="Conversation Cinema"
        sub={`${done.size} of ${CONVERSATION_INDEX.length} episodes watched`}
        back="/"
      />
      <div className="card card--hero stack--sm">
        <h2>Hear your words in real conversations</h2>
        <p className="small">
          Two speakers, one short scene. Watch with captions, then take them away one layer at a
          time until you are listening on your own.
        </p>
        <div className="progressline" aria-hidden>
          <i style={{ width: `${(done.size / CONVERSATION_INDEX.length) * 100}%` }} />
        </div>
      </div>

      <div className="chipstrip" role="group" aria-label="Topics">
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            className={`chip chip--button${topic === t ? ' chip--on' : ''}`}
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="stack--sm">
        {shown.map((c) => (
          <SceneCard
            key={c.id}
            scene={c}
            to={`/cinema/${c.id}`}
            done={done.has(c.id)}
            score={state.conversations.scores[c.id]}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- player */

function speakerOf(line: SceneLine): 'a' | 'b' {
  return line.speaker === 'B' ? 'b' : 'a';
}

export function CinemaPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, setSettings, markScene, toggleSaved, record } = useStore();
  const { scene, loading } = useScene('conversation', id);

  // Cinema keeps its own caption defaults, separate from Story Mode.
  const captions = state.settings.cinemaCaptions;
  const [stageIdx, setStageIdx] = useState(0);
  const [rate, setRate] = useState(state.settings.audio.rate);
  const [score, setScore] = useState<number | null>(null);
  const [helped, setHelped] = useState<Set<number>>(new Set());
  const [reachedEnd, setReachedEnd] = useState(false);
  const credited = useRef(false);

  const stage = STAGES[stageIdx]!;
  const lines = scene?.lines ?? [];
  const targets = useMemo(() => new Set(scene?.targets ?? []), [scene]);
  const player = useScenePlayer(lines, { rate, speakerOf, onFinish: () => setReachedEnd(true) });

  useEffect(
    () =>
      pushBackHandler(() => {
        if (stage.key === 'quiz') {
          setStageIdx(STAGES.length - 2);
          return true;
        }
        return false;
      }),
    [stage.key],
  );

  useEffect(() => {
    // Only start by itself when a Chinese voice is actually there; otherwise
    // the learner would open a scene into an error they did not ask for.
    if (scene && state.settings.audio.autoConversation && mandarinConfirmed()) {
      const t = setTimeout(() => player.playFrom(0), 350);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id]);

  if (!scene) {
    return (
      <div className="page">
        <TopBar title={loading ? 'Episode' : 'Episode not found'} back="/cinema" backLabel="Cinema" />
        {loading ? (
          <SceneLoading />
        ) : (
          <Empty title="That episode has moved" body="Pick another one from the list." />
        )}
      </div>
    );
  }

  const saved = state.saved.conversations.includes(scene.id);
  const active = lines[player.index];

  const goStage = (i: number) => {
    const next = STAGES[i]!;
    setStageIdx(i);
    setSettings({ cinemaCaptions: next.captions });
    setReachedEnd(false);
    player.reset();
    if (i > 0) markScene('conversations', scene.id, { replay: true });
    if (next.key === 'audio-only') {
      markScene('conversations', scene.id, { listening: true });
    }
    if (next.key === 'no-english') {
      markScene('conversations', scene.id, { hiddenEnglish: true });
    }
    if (next.key === 'quiz' && !credited.current) {
      credited.current = true;
      for (const wid of scene.targets) {
        if (helped.has(wid)) continue;
        record({
          wordId: wid,
          dimension: 'listening',
          correct: true,
          ms: 9000,
          mode: 'cinema-watch',
          schedule: false,
        });
      }
      markScene('conversations', scene.id, { completed: true });
    }
  };

  return (
    <div className="page">
      <TopBar
        title={scene.title}
        sub={`${scene.topic} · ${scene.targets.length} of your words`}
        back="/cinema"
        backLabel="Cinema"
        right={
          <button
            type="button"
            className="btn btn--icon btn--soft"
            aria-label={saved ? 'Remove from saved scenes' : 'Save this episode'}
            aria-pressed={saved}
            onClick={() => toggleSaved('conversations', scene.id)}
          >
            {saved ? '★' : '☆'}
          </button>
        }
      />

      {/* the stage strip */}
      <div className="chipstrip">
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`chip chip--button${i === stageIdx ? ' chip--on' : ''}`}
            aria-pressed={i === stageIdx}
            aria-label={`Stage ${i + 1}: ${s.label}`}
            onClick={() => goStage(i)}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>
      <p className="tiny muted">{stage.blurb}</p>

      {stage.key !== 'quiz' && (
        <>
          {/* the stage itself: whoever is talking is lit */}
          <div className="card card--hero stage">
            {(['a', 'b'] as const).map((who) => {
              const talking = player.speaking && active !== undefined && speakerOf(active) === who;
              return (
                <div key={who} className="stage__side">
                  <Avatar who={who} talking={talking} />
                  <div className="stage__name">Speaker {who.toUpperCase()}</div>
                  <div className="stage__wave">{talking && <SoundWave />}</div>
                </div>
              );
            })}
          </div>

          <CaptionBar
            captions={captions}
            onChange={(patch) => setSettings({ cinemaCaptions: { ...captions, ...patch } })}
            autoLabel="Auto play"
            auto={state.settings.audio.autoConversation}
            onAuto={(v) =>
              setSettings({ audio: { ...state.settings.audio, autoConversation: v } })
            }
          />

          <div className="stack--sm">
            {lines.map((l, i) => {
              const who = speakerOf(l);
              return (
                <div key={i} className={`speaker-row${who === 'b' ? ' speaker-row--b' : ''}`}>
                  <Avatar who={who} talking={player.index === i && player.speaking} />
                  <div className={`bubble${player.index === i ? ' bubble--active' : ''}`}>
                    <LineBlock
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
                  </div>
                </div>
              );
            })}
          </div>

          <PlaybackError message={player.error} />

          <Transport player={player} total={lines.length} rate={rate} onRate={setRate} />

          <button
            className="btn btn--primary btn--block btn--lg"
            type="button"
            onClick={() => goStage(Math.min(stageIdx + 1, STAGES.length - 1))}
          >
            {reachedEnd ? `Next: ${STAGES[stageIdx + 1]?.label ?? 'Quiz'}` : 'Skip ahead'}
          </button>
        </>
      )}

      {stage.key === 'quiz' && score === null && (
        <div className="card">
          <SceneQuiz
            scene={scene}
            difficulty={state.settings.storyDifficulty}
            mode="cinema-quiz"
            onDone={(s) => {
              setScore(s);
              markScene('conversations', scene.id, { score: s, completed: true });
            }}
          />
        </div>
      )}

      {stage.key === 'quiz' && score !== null && (
        <div className="card center stack">
          <div style={{ fontSize: '2.6rem' }} aria-hidden>
            {score >= 80 ? '🎬' : '🎧'}
          </div>
          <h2>{score}% understood</h2>
          <p className="small muted">
            {score >= 80
              ? 'You followed that scene. Try the audio-only stage once more to lock it in.'
              : 'Watch it again from stage one — the second viewing is where it sticks.'}
          </p>
          <div className="row row--wrap center">
            <button
              className="btn btn--soft"
              type="button"
              onClick={() => {
                setScore(null);
                setHelped(new Set());
                goStage(0);
              }}
            >
              Watch again
            </button>
            <button className="btn btn--primary" type="button" onClick={() => navigate('/cinema')}>
              Next episode
            </button>
          </div>
          <div className="section-title">Words in this episode</div>
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
