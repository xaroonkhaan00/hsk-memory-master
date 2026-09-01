/**
 * The MFB monogram — M, F and B written as one continuous brush-flow figure.
 *
 * The mark is built from three strokes that share a single vertical spine, the
 * way a Chinese character shares a stem: the M rises on the left, the F crosses
 * the spine, and the B closes the right side. It stays legible at 24px, which
 * is what a launcher icon and a favicon actually need.
 */
export function MfbMark({
  size = 40,
  tone = 'auto',
  title = 'MFB',
}: {
  size?: number;
  /** 'auto' inherits currentColor; 'brand' paints the gradient roundel. */
  tone?: 'auto' | 'brand' | 'mono';
  title?: string;
}) {
  const id = `mfb-${tone}`;
  const stroke = tone === 'brand' ? 'var(--brand-ink)' : 'currentColor';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className="mfb-mark"
    >
      {tone === 'brand' && (
        <>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand-1)" />
              <stop offset="55%" stopColor="var(--brand-2)" />
              <stop offset="100%" stopColor="var(--brand-3)" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="17" fill={`url(#${id}-g)`} />
        </>
      )}
      <g fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* M — the two peaks are drawn as one lifted brush turn */}
        <path d="M9 43.5V23.6c0-1.7 2.1-2.4 3.1-1.1l5.2 7.2c.5.7 1.5.7 2 0l5.2-7.2c1-1.3 3.1-.6 3.1 1.1V43.5" />
        {/* F */}
        <path d="M31.4 43.5V23.6c0-.8.7-1.5 1.5-1.5H42.6" />
        <path d="M31.4 33.2h8.7" />
        {/* B */}
        <path d="M47.6 22.1v21.4" />
        <path d="M47.6 22.1h4.8c3.1 0 5.6 2.5 5.6 5.5s-2.5 5.6-5.6 5.6H47.6" />
        <path d="M47.6 33.2h5.8c3.2 0 5.8 2.3 5.8 5.1s-2.6 5.2-5.8 5.2H47.6" />
      </g>
      {/* the 一 stroke: one tapered brush sweep holding the three letters down */}
      <path
        fill={stroke}
        opacity="0.85"
        d="M7.5 50.4c9-2.6 34-4.2 49.6-1.6.9.15.8 1.5-.1 1.6C41 52.2 20 52.6 8.2 52.4c-1 0-1.4-1.7-.7-2z"
      />
    </svg>
  );
}

/** Logo plus wordmark, for headers and the About page. */
export function BrandLockup({
  size = 34,
  stacked = false,
}: {
  size?: number;
  stacked?: boolean;
}) {
  return (
    <span className={`brand-lockup${stacked ? ' brand-lockup--stacked' : ''}`}>
      <MfbMark size={size} tone="brand" />
      <span className="brand-lockup__text">
        <b>Learn HSK 3</b>
        {stacked && <i>MFB · Mian Fazli Basit</i>}
      </span>
    </span>
  );
}

export const APP_NAME = 'Learn HSK 3';
export const CREATOR = 'MIAN FAZLI BASIT';
export const MONOGRAM = 'MFB';

/** The creator line. Quiet by design — it sits under the content, never over it. */
export function Credit() {
  return (
    <div className="credit">
      Created by
      <b>{CREATOR}</b>
    </div>
  );
}
