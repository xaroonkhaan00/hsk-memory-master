import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TONE_SHAPES } from '../services/pinyin';
import type { Status, Word } from '../types';
import { mandarinAvailable, speak } from '../services/tts';
import { useStore } from '../store';

export function TopBar({
  title,
  sub,
  back,
  right,
}: {
  title: string;
  sub?: string;
  back?: string | true;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button
          className="btn btn--icon btn--ghost"
          aria-label="Go back"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          ←
        </button>
      )}
      <div className="topbar__title">
        {title}
        {sub && <div className="topbar__sub">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

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
  compact,
}: {
  text: string;
  label?: string;
  rate?: number;
  compact?: boolean;
}) {
  const { state } = useStore();
  const available = mandarinAvailable();
  if (!available) {
    return (
      <span className="chip chip--warn" title="No Mandarin voice found in this browser">
        🔇 no audio
      </span>
    );
  }
  return (
    <button
      className={`btn ${compact ? 'btn--icon btn--soft' : 'btn--soft btn--sm'}`}
      onClick={() => speak(text, { rate: rate ?? state.settings.audioRate })}
      aria-label={`${label} ${text}`}
      type="button"
    >
      🔊{compact ? '' : ` ${label}`}
    </button>
  );
}

export function AudioRow({ text }: { text: string }) {
  if (!mandarinAvailable()) {
    return (
      <div className="fact">
        <span className="label">Audio</span>
        This browser has no Mandarin voice installed, so listening exercises are hidden. On most
        systems you can add one in the operating system's speech settings.
      </div>
    );
  }
  return (
    <div className="row row--wrap">
      <Speaker text={text} label="Normal" rate={1} />
      <Speaker text={text} label="Slow 0.7×" rate={0.7} />
      <button
        className="btn btn--soft btn--sm"
        type="button"
        onClick={() => speak(text, { rate: 0.85, repeat: 3 })}
      >
        🔁 Repeat ×3
      </button>
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
