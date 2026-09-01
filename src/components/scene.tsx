/**
 * Shared machinery for Story Mode and Conversation Cinema.
 *
 * Both modes show the same thing — Chinese with optional pinyin, optional
 * English, tappable words and sequential audio — so the caption rules, the
 * tap-to-reveal behaviour and the transport all live here once.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CaptionMode, CaptionSettings, ExampleToken, Scene, SceneLine, SceneRef } from '../types';
import { getWord, loadConversation, loadStory, tryWord } from '../data';
import { play, stop } from '../services/audio';
import { mandarinAvailable } from '../services/tts';
import { useStore } from '../store';
import { SpeakerIcon } from './ui';

/* ------------------------------------------------------------ learning views */

export const VIEWS: { value: CaptionMode; label: string; blurb: string }[] = [
  { value: 'beginner', label: 'Beginner', blurb: 'Chinese, pinyin and English together' },
  { value: 'intermediate', label: 'Intermediate', blurb: 'Chinese and pinyin — English on tap' },
  { value: 'recall', label: 'Recall', blurb: 'Chinese only — everything else on tap' },
  { value: 'listening', label: 'Listening', blurb: 'Listen first, reveal when you need to' },
];

export const VIEW_CAPTIONS: Record<CaptionMode, CaptionSettings> = {
  beginner: { hanzi: true, pinyin: true, english: true, highlightTargets: true },
  intermediate: { hanzi: true, pinyin: true, english: false, highlightTargets: true },
  recall: { hanzi: true, pinyin: false, english: false, highlightTargets: false },
  listening: { hanzi: false, pinyin: false, english: false, highlightTargets: false },
};

/** The view whose preset matches the current toggles, if any. */
export function viewOf(c: CaptionSettings): CaptionMode | null {
  for (const v of VIEWS) {
    const p = VIEW_CAPTIONS[v.value];
    if (p.hanzi === c.hanzi && p.pinyin === c.pinyin && p.english === c.english) return v.value;
  }
  return null;
}

/* ----------------------------------------------------------------- toggles */

export function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switchrow">
      <span className="switchrow__label">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </span>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={on}
        aria-label={label}
        data-on={on}
        onClick={() => onChange(!on)}
      />
    </label>
  );
}

export function CaptionBar({
  captions,
  onChange,
  autoLabel,
  auto,
  onAuto,
}: {
  captions: CaptionSettings;
  onChange: (patch: Partial<CaptionSettings>) => void;
  autoLabel: string;
  auto: boolean;
  onAuto: (v: boolean) => void;
}) {
  const chips: { key: keyof CaptionSettings; label: string }[] = [
    { key: 'hanzi', label: '汉字 Chinese' },
    { key: 'pinyin', label: 'Pinyin' },
    { key: 'english', label: 'English' },
    { key: 'highlightTargets', label: 'Highlight words' },
  ];
  return (
    <div className="chipstrip" role="group" aria-label="Captions">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`chip chip--button${captions[c.key] ? ' chip--on' : ''}`}
          aria-pressed={captions[c.key]}
          onClick={() => onChange({ [c.key]: !captions[c.key] } as Partial<CaptionSettings>)}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        className={`chip chip--button${auto ? ' chip--on' : ''}`}
        aria-pressed={auto}
        onClick={() => onAuto(!auto)}
      >
        {autoLabel}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- one line */

function TokenRun({
  tokens,
  targets,
  highlight,
  showPinyin,
  openId,
  onOpen,
}: {
  tokens: ExampleToken[];
  targets: Set<number>;
  highlight: boolean;
  showPinyin: boolean;
  openId: string | null;
  onOpen: (key: string | null, wordId: number) => void;
}) {
  return (
    <>
      {tokens.map((t, i) => {
        const word = t.w ? tryWord(t.w) : undefined;
        const key = `${i}`;
        if (!word) {
          return (
            <span key={key} className="tok">
              {showPinyin && <span className="p">{t.p ?? ' '}</span>}
              <span>{t.z}</span>
            </span>
          );
        }
        const open = openId === key;
        return (
          <span key={key} className="tok">
            {showPinyin && <span className="p">{t.p ?? ' '}</span>}
            <button
              type="button"
              className={`tok-btn${highlight && targets.has(word.id) ? ' is-target' : ''}${
                open ? ' is-open' : ''
              }`}
              aria-expanded={open}
              aria-label={`${word.hanzi} — tap for pinyin and meaning`}
              onClick={() => onOpen(open ? null : key, word.id)}
            >
              {t.z}
            </button>
            {open && (
              <Link className="tok-gloss" to={`/word/${word.id}`}>
                <b>{word.pinyin}</b>
                <span>{word.primaryMeaning}</span>
              </Link>
            )}
          </span>
        );
      })}
    </>
  );
}

export function LineBlock({
  line,
  index,
  targets,
  captions,
  active,
  speaking,
  saved,
  onSave,
  onPlay,
  onWordTapped,
}: {
  line: SceneLine;
  index: number;
  targets: Set<number>;
  captions: CaptionSettings;
  active: boolean;
  speaking?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onPlay?: () => void;
  onWordTapped?: (wordId: number) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [revealEn, setRevealEn] = useState(false);
  const [revealZh, setRevealZh] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(null);
    setRevealEn(false);
    setRevealZh(false);
  }, [captions.english, captions.hanzi]);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [active]);

  const showZh = captions.hanzi || revealZh;
  const showEn = captions.english || revealEn;

  return (
    <div
      ref={ref}
      className={`line${active ? ' line--active' : ''}${saved ? ' line--saved' : ''}`}
      id={`line-${index}`}
    >
      {showZh ? (
        <div className="line__zh sentence hanzi" lang="zh">
          <TokenRun
            tokens={line.tokens}
            targets={targets}
            highlight={captions.highlightTargets}
            showPinyin={captions.pinyin}
            openId={open}
            onOpen={(k, id) => {
              setOpen(k);
              if (k !== null) onWordTapped?.(id);
            }}
          />
        </div>
      ) : (
        <button type="button" className="btn btn--soft btn--sm" onClick={() => setRevealZh(true)}>
          Show the Chinese
        </button>
      )}

      {showEn ? (
        <div className="line__en">{line.en}</div>
      ) : (
        <button type="button" className="line__reveal" onClick={() => setRevealEn(true)}>
          Show meaning
        </button>
      )}

      <div className="line__tools">
        {onPlay && mandarinAvailable() && (
          <button
            type="button"
            className={`btn btn--icon btn--ghost${speaking ? ' is-playing' : ''}`}
            aria-label="Listen to this line"
            onClick={onPlay}
          >
            <SpeakerIcon active={speaking} />
          </button>
        )}
        {onSave && (
          <button
            type="button"
            className={`btn btn--icon btn--ghost${saved ? ' is-on' : ''}`}
            aria-label={saved ? 'Remove from saved scenes' : 'Save this line'}
            aria-pressed={!!saved}
            onClick={onSave}
          >
            {saved ? '★' : '☆'}
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- speakers */

/** Two illustrated speakers, drawn rather than photographed so they stay
    crisp at any size and ship inside the offline bundle. */
export function Avatar({ who, talking }: { who: 'a' | 'b'; talking: boolean }) {
  return (
    <span className={`avatar avatar--${who}${talking ? ' avatar--talking' : ''}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="11.5" r="5.6" fill="#fff" opacity="0.95" />
        {who === 'a' ? (
          <path d="M5.5 28c0-5.4 4.7-8.6 10.5-8.6S26.5 22.6 26.5 28z" fill="#fff" opacity="0.95" />
        ) : (
          <path
            d="M5.5 28c0-5.4 4.7-8.6 10.5-8.6S26.5 22.6 26.5 28zM10.4 8.2c1.9 2.3 9.4 2.3 11.3 0"
            fill="#fff"
            opacity="0.95"
          />
        )}
      </svg>
    </span>
  );
}

export function SoundWave() {
  return (
    <span className="sound-wave" aria-hidden>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/* -------------------------------------------------------------- sequencer */

export interface Sequencer {
  index: number;
  playing: boolean;
  speaking: boolean;
  go: (i: number) => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  replayLine: () => void;
  reset: () => void;
}

/**
 * Plays the lines of a scene one after another. `onFinish` fires when the last
 * line ends during continuous playback, never when the learner steps manually.
 */
export function useSequencer(
  lines: SceneLine[],
  opts: { rate?: number; speakerOf?: (l: SceneLine) => 'a' | 'b' | undefined; onFinish?: () => void },
): Sequencer {
  const { state } = useStore();
  const audio = state.settings.audio;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const playingRef = useRef(false);
  const finish = useRef(opts.onFinish);
  finish.current = opts.onFinish;
  const rate = opts.rate ?? audio.rate;
  const speakerOf = opts.speakerOf;

  const speakLine = useCallback(
    (i: number, chain: boolean) => {
      const line = lines[i];
      if (!line) return;
      const ok = play(line.zh, audio, {
        rate,
        repeat: 1,
        speaker: speakerOf?.(line),
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          if (!chain || !playingRef.current) return;
          if (i + 1 < lines.length) {
            setIndex(i + 1);
            speakLine(i + 1, true);
          } else {
            playingRef.current = false;
            setPlaying(false);
            finish.current?.();
          }
        },
      });
      if (!ok) {
        // No Mandarin voice: still walk the scene so captions advance.
        setSpeaking(false);
        if (chain && playingRef.current) {
          playingRef.current = false;
          setPlaying(false);
        }
      }
    },
    [lines, audio, rate, speakerOf],
  );

  const stopAll = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setSpeaking(false);
    stop();
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  return {
    index,
    playing,
    speaking,
    go: (i) => {
      const clamped = Math.max(0, Math.min(lines.length - 1, i));
      stop();
      setIndex(clamped);
      if (playingRef.current) speakLine(clamped, true);
      else speakLine(clamped, false);
    },
    next: () => {
      if (index + 1 >= lines.length) {
        stopAll();
        finish.current?.();
        return;
      }
      const i = index + 1;
      stop();
      setIndex(i);
      speakLine(i, playingRef.current);
    },
    prev: () => {
      const i = Math.max(0, index - 1);
      stop();
      setIndex(i);
      speakLine(i, playingRef.current);
    },
    toggle: () => {
      if (playingRef.current) {
        stopAll();
        return;
      }
      playingRef.current = true;
      setPlaying(true);
      speakLine(index, true);
    },
    replayLine: () => {
      stop();
      speakLine(index, playingRef.current);
    },
    reset: () => {
      stopAll();
      setIndex(0);
    },
  };
}

export function Transport({
  seq,
  total,
  rate,
  onRate,
  extra,
}: {
  seq: Sequencer;
  total: number;
  rate: number;
  onRate: (r: number) => void;
  extra?: ReactNode;
}) {
  const rates = [0.65, 0.85, 1.0];
  return (
    <div className="player">
      <button type="button" className="btn btn--icon btn--soft" aria-label="Previous line" onClick={seq.prev}>
        ⏮
      </button>
      <button
        type="button"
        className="btn btn--icon player__play"
        aria-label={seq.playing ? 'Pause' : 'Play'}
        onClick={seq.toggle}
      >
        {seq.playing ? '❚❚' : '▶'}
      </button>
      <button type="button" className="btn btn--icon btn--soft" aria-label="Next line" onClick={seq.next}>
        ⏭
      </button>
      <button type="button" className="btn btn--icon btn--soft" aria-label="Repeat this line" onClick={seq.replayLine}>
        ↻
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="progressline" aria-hidden>
          <i style={{ width: `${total ? ((seq.index + 1) / total) * 100 : 0}%` }} />
        </div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          Line {seq.index + 1} of {total}
        </div>
      </div>
      <button
        type="button"
        className="chip chip--button"
        aria-label={`Playback speed ${rate}×`}
        onClick={() => onRate(rates[(rates.indexOf(rate) + 1) % rates.length]!)}
      >
        {rate}×
      </button>
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ quiz */

interface Q {
  wordId: number;
  prompt: string;
  sub?: string;
  answer: string;
  options: string[];
  kind: 'meaning' | 'listening' | 'cloze';
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Build the after-scene check. Questions come only from words the scene
    actually teaches, so it always tests what was just read or heard. */
export function buildQuiz(scene: Scene, difficulty: 'easy' | 'normal' | 'challenge'): Q[] {
  const count = difficulty === 'easy' ? 4 : difficulty === 'normal' ? 6 : 8;
  const seed = scene.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const picked = shuffle(scene.targets, seed).slice(0, Math.min(count, scene.targets.length));
  const pool = scene.targets.map((id) => getWord(id).primaryMeaning);
  return picked.map((id, i) => {
    const w = getWord(id);
    const wrong = shuffle(
      pool.filter((m) => m !== w.primaryMeaning),
      seed + i * 17,
    ).slice(0, 3);
    const kind: Q['kind'] = difficulty === 'challenge' && i % 2 === 1 ? 'listening' : 'meaning';
    return {
      wordId: id,
      prompt: kind === 'listening' ? '🔊' : w.hanzi,
      sub: kind === 'listening' ? 'Listen, then choose the meaning' : difficulty === 'easy' ? w.pinyin : undefined,
      answer: w.primaryMeaning,
      options: shuffle([w.primaryMeaning, ...wrong], seed + i),
      kind,
    };
  });
}

export function SceneQuiz({
  scene,
  difficulty,
  mode,
  onDone,
}: {
  scene: Scene;
  difficulty: 'easy' | 'normal' | 'challenge';
  mode: string;
  onDone: (score: number) => void;
}) {
  const { state, record } = useStore();
  const questions = useMemo(() => buildQuiz(scene, difficulty), [scene, difficulty]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const started = useRef(Date.now());
  const q = questions[i];

  useEffect(() => {
    started.current = Date.now();
    setPicked(null);
    if (q?.kind === 'listening') {
      play(getWord(q.wordId).plain, state.settings.audio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!q) return null;

  const choose = (opt: string) => {
    if (picked) return;
    setPicked(opt);
    const correct = opt === q.answer;
    if (correct) setRight((r) => r + 1);
    record({
      wordId: q.wordId,
      dimension: q.kind === 'listening' ? 'listening' : 'meaning',
      correct,
      ms: Date.now() - started.current,
      mode,
      errorKind: correct ? undefined : q.kind === 'listening' ? 'listening' : 'meaning',
      given: opt,
      expected: q.answer,
    });
    setTimeout(() => {
      if (i + 1 >= questions.length) {
        onDone(Math.round(((right + (correct ? 1 : 0)) / questions.length) * 100));
      } else {
        setI(i + 1);
      }
    }, 750);
  };

  return (
    <div className="quiz">
      <div className="quiz__bar" aria-hidden>
        <i style={{ width: `${((i + 1) / questions.length) * 100}%` }} />
      </div>
      <div className="tiny muted">
        Question {i + 1} of {questions.length}
      </div>
      <div className="quiz__prompt">
        {q.kind === 'listening' ? (
          <button
            type="button"
            className="btn btn--soft btn--lg"
            onClick={() => play(getWord(q.wordId).plain, state.settings.audio)}
          >
            <SpeakerIcon active={false} /> Play again
          </button>
        ) : (
          <span className="hanzi" lang="zh">
            {q.prompt}
          </span>
        )}
        {q.sub && <div className="quiz__instruction">{q.sub}</div>}
      </div>
      <div className="options">
        {q.options.map((o) => {
          const cls = !picked
            ? ''
            : o === q.answer
              ? ' option--correct'
              : o === picked
                ? ' option--wrong'
                : ' option--muted';
          return (
            <button key={o} type="button" className={`option${cls}`} onClick={() => choose(o)}>
              <span className="option__label">{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- cards */

export function SceneCard({
  scene,
  to,
  done,
  score,
}: {
  scene: SceneRef;
  to: string;
  done: boolean;
  score?: number;
}) {
  return (
    <Link className="card card--tap scene-card" to={to}>
      <div className="scene-card__top">
        <span className="scene-card__emoji" aria-hidden>
          {scene.emoji}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="scene-card__title">{scene.title}</div>
          <div className="scene-card__meta">
            {scene.topic} · {scene.words} words · {scene.lines} lines
          </div>
        </div>
        {done && <span className="chip chip--good">{score !== undefined ? `${score}%` : 'Done'}</span>}
      </div>
      <div className="scene-card__zh hanzi" lang="zh">
        {scene.first}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------ scene load */

/**
 * Fetch one scene's text on demand. Scene text is the biggest thing in the
 * app and only a player needs it, so it never sits in the first paint.
 */
export function useScene(
  kind: 'story' | 'conversation',
  id: string | undefined,
): { scene: Scene | null; loading: boolean } {
  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    if (!id) {
      setScene(null);
      setLoading(false);
      return () => {
        live = false;
      };
    }
    setLoading(true);
    const p = kind === 'story' ? loadStory(id) : loadConversation(id);
    void p.then((s) => {
      if (!live) return;
      setScene(s ?? null);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [kind, id]);
  return { scene, loading };
}

export function SceneLoading() {
  return (
    <div className="card center stack">
      <p className="muted small">Opening the scene…</p>
    </div>
  );
}
