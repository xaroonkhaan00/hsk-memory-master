import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TONE_SHAPES } from '../services/pinyin';
import type { Status, Word } from '../types';
import { speechAvailable } from '../services/speech';
import { play, stop } from '../services/audio';
import { useStore } from '../store';

/** Chevron used by the back control. Drawn rather than typed so it never
    depends on a font that might not ship the glyph. */
function BackArrow() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The app bar. `back` gives every inner screen the same large, labelled back
 * control in the same place, so leaving a screen is never a hunt for a small
 * glyph among unrelated icons.
 */
export function TopBar({
  title,
  sub,
  back,
  backLabel = 'Back',
  right,
}: {
  title: string;
  sub?: string;
  back?: string | true;
  backLabel?: string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="appbar">
      {back && (
        <button
          className="backbtn"
          type="button"
          aria-label={`Back to ${backLabel === 'Back' ? 'the previous screen' : backLabel}`}
          onClick={() => {
            stop();
            if (typeof back === 'string') navigate(back);
            else navigate(-1);
          }}
        >
          <BackArrow />
          <span className="backbtn__label">{backLabel}</span>
        </button>
      )}
      <div className="appbar__title">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
      {right}
    </header>
  );
}

export const AppBar = TopBar;

export function Meter({
  label,
  value,
  right,
  tone = 'accent',
}: {
  label: string;
  value: number;
  right?: string;
  tone?: 'accent' | 'good' | 'bad' | 'warn';
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="meter">
      <div className="meter__top">
        <span>{label}</span>
        <span className="mono muted">{right ?? `${pct}%`}</span>
      </div>
      <div className="meter__track">
        <div
          className={`meter__fill${tone === 'accent' ? '' : ` meter__fill--${tone}`}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat__value mono">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function Ring({ value, size = 92, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="ring__text">
        <b>{Math.round(pct * 100)}%</b>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

export function ToneMark({ tone, size = 24 }: { tone: number; size?: number }) {
  const shape = TONE_SHAPES[tone] ?? TONE_SHAPES[5]!;
  return (
    <svg
      className={`tone-svg tone-${tone}`}
      width={size}
      height={(size * 22) / 24}
      viewBox="0 0 24 22"
      role="img"
      aria-label={`tone ${tone === 5 ? 'neutral' : tone}: ${shape.name}`}
    >
      <path d={shape.path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Syllables({ word, size = 24 }: { word: Word; size?: number }) {
  return (
    <div className="syllables">
      {word.syllables.map((s, i) => (
        <div className="syl" key={`${s.raw}-${i}`}>
          <ToneMark tone={s.tone} size={size} />
          <span className="syl__raw">{s.raw}</span>
          <span className="syl__tone">{s.tone === 5 ? 'neutral' : `tone ${s.tone}`}</span>
        </div>
      ))}
    </div>
  );
}

export function Speaker({
  text,
  label = 'Play',
  rate,
  repeat,
  speaker,
  compact,
}: {
  text: string;
  label?: string;
  rate?: number;
  repeat?: 1 | 2 | 3;
  speaker?: 'a' | 'b';
  compact?: boolean;
}) {
  const { state } = useStore();
  const [on, setOn] = useState(false);
  // Nothing at all when there is no Mandarin voice: a row of identical "audio
  // off" badges is noise. `NoVoiceNote` says it once, where it belongs.
  if (!speechAvailable()) return null;
  return (
    <button
      className={`btn ${compact ? 'btn--icon btn--soft' : 'btn--soft btn--sm'}${on ? ' is-playing' : ''}`}
      onClick={() =>
        play(text, state.settings.audio, {
          rate,
          repeat,
          speaker,
          onStart: () => setOn(true),
          onEnd: () => setOn(false),
        })
      }
      aria-label={`${label} — listen`}
      type="button"
    >
      <SpeakerIcon active={on} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

/** A speaker glyph with three sound arcs that animate only while speaking. */
export function SpeakerIcon({ active }: { active?: boolean }) {
  return (
    <svg
      className={`spk${active ? ' spk--on' : ''}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z"
        fill="currentColor"
      />
      <path className="spk__a1" d="M15 9.4a3.6 3.6 0 0 1 0 5.2" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <path className="spk__a2" d="M17.6 7a7.2 7.2 0 0 1 0 10" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Said once per screen, not once per button. */
export function NoVoiceNote() {
  if (speechAvailable()) return null;
  return (
    <Link className="chip chip--warn" to="/settings">
      Add a Chinese voice to hear this
    </Link>
  );
}

export function AudioRow({ text }: { text: string }) {
  const { state } = useStore();
  if (!speechAvailable()) {
    return (
      <div className="fact">
        <span className="label">Listening</span>
        This device has no Mandarin voice installed yet, so listening practice is hidden. Add a
        Chinese voice in your system speech settings and it will appear here.
      </div>
    );
  }
  return (
    <div className="row row--wrap">
      <Speaker text={text} label="Listen" />
      <Speaker text={text} label="Slower" rate={0.65} />
      <Speaker text={text} label="Repeat ×3" rate={state.settings.audio.rate} repeat={3} />
    </div>
  );
}

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  fragile: 'Fragile',
  weak: 'Weak',
  learning: 'Learning',
  good: 'Good',
  strong: 'Strong',
  mastered: 'Mastered',
};

export function StatusChip({ status }: { status: Status }) {
  const tone =
    status === 'mastered' || status === 'strong'
      ? 'chip--good'
      : status === 'weak' || status === 'fragile'
        ? 'chip--bad'
        : status === 'new'
          ? ''
          : 'chip--warn';
  return <span className={`chip ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function WordRow({ word, right }: { word: Word; right?: ReactNode }) {
  return (
    <Link className="list__item" to={`/word/${word.id}`}>
      <span className="list__hz hanzi" lang="zh">{word.hanzi}</span>
      <span className="list__mid">
        <span className="py">{word.pinyin}</span>
        <div className="mn">{word.primaryMeaning}</div>
      </span>
      {right ?? <span className="list__id">#{word.id}</span>}
    </Link>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card center stack">
      <h3>{title}</h3>
      <p className="muted small">{body}</p>
      {action}
    </div>
  );
}

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
  return [node, show];
}

export function Sentence({
  tokens,
  target,
}: {
  tokens: { z: string; p?: string }[];
  target?: string;
}) {
  return (
    <div className="sentence hanzi" lang="zh">
      {tokens.map((t, i) => (
        <span
          key={i}
          className={`tok${target && t.z.includes(target) ? ' tok--target' : ''}`}
        >
          <span className="p">{t.p ?? ' '}</span>
          <span>{t.z}</span>
        </span>
      ))}
    </div>
  );
}
