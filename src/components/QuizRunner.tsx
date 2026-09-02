import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuizItem, QuizResult } from '../types';
import { judge } from '../services/quiz';
import { useStore } from '../store';
import { tryWord } from '../data';
import { Speaker, Sentence, ToneMark } from './ui';
import { speechAvailable } from '../services/speech';
import { play } from '../services/audio';
import { stripTones } from '../services/pinyin';
import { shouldSlowDown } from '../services/session';

interface Props {
  items: QuizItem[];
  title?: string;
  /**
   * Called once with the full result list when the run ends, and again with an
   * empty array when the learner dismisses the results screen — that second
   * call is the "what next" signal for the page that owns the runner.
   */
  onFinish?: (results: QuizResult[]) => void;
  finishLabel?: string;
  /** Automatically re-ask everything answered wrong once, at the end. */
  retestMistakes?: boolean;
  /** Progressive support removal for the "disappearing" mode. */
  roundStyle?: 'none' | 'disappearing' | 'blur' | 'flash';
  showResults?: boolean;
  /**
   * Smart stopping. If accuracy collapses part-way through, every question
   * still ahead that matches this predicate is dropped from the queue — used to
   * stop feeding new vocabulary to someone who is clearly saturated.
   */
  smartStop?: (item: QuizItem) => boolean;
  onSlowDown?: () => void;
}

interface Answered {
  item: QuizItem;
  given: string;
  correct: boolean;
  ms: number;
  note?: string;
}

export default function QuizRunner({
  items,
  title,
  onFinish,
  finishLabel = 'Finish',
  retestMistakes = true,
  roundStyle = 'none',
  showResults = true,
  smartStop,
  onSlowDown,
}: Props) {
  const { record, state } = useStore();
  const audio = state.settings.audio;
  const [queue, setQueue] = useState<QuizItem[]>(items);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [given, setGiven] = useState<string>('');
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [correct, setCorrect] = useState(false);
  const [matchPicked, setMatchPicked] = useState<string | null>(null);
  const [matchDone, setMatchDone] = useState<string[]>([]);
  const [matchWrong, setMatchWrong] = useState<string | null>(null);
  const [retested, setRetested] = useState(false);
  const [expired, setExpired] = useState(false);
  const slowedRef = useRef(false);
  const startRef = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);

  // Reset only when the question list genuinely changes. Callers sometimes
  // rebuild an equivalent array while the run is in progress; restarting the
  // quiz underneath the learner would be far worse than ignoring it.
  const appliedRef = useRef<string>('');
  useEffect(() => {
    const signature = items.map((i) => i.key).join('|');
    if (signature === appliedRef.current) return;
    appliedRef.current = signature;
    setQueue(items);
    setIndex(0);
    setAnswered([]);
    setRetested(false);
    slowedRef.current = false;
    finishedRef.current = false;
  }, [items]);

  const item = queue[index];
  const done = index >= queue.length;

  const resetForItem = useCallback(() => {
    setGiven('');
    setTyped('');
    setRevealed(false);
    setNote(undefined);
    setCorrect(false);
    setMatchPicked(null);
    setMatchDone([]);
    setMatchWrong(null);
    setExpired(false);
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    resetForItem();
  }, [index, queue, resetForItem]);

  // Auto-play audio prompts.
  useEffect(() => {
    if (item?.promptFace === 'audio' && item.audioText && speechAvailable()) {
      // Listening prompts go through the shared audio service, so they use the
      // learner's chosen voice and speed and can only ever receive Hanzi.
      const t = setTimeout(() => play(item.audioText!, audio, { repeat: 1 }), 220);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [item, audio]);

  useEffect(() => {
    if (item?.kind === 'type' && !revealed) inputRef.current?.focus();
  }, [item, revealed]);

  // Once an answer is revealed, keyboard focus follows to the Next button so
  // the flow keeps working without a mouse — but with preventScroll, because
  // a plain focus() yanks the page down on a phone just as the feedback
  // panel appears.
  useEffect(() => {
    if (revealed) nextRef.current?.focus({ preventScroll: true });
  }, [revealed]);

  const submit = useCallback(
    (value: string) => {
      if (!item || revealed) return;
      const ms = Date.now() - startRef.current;
      const verdict = judge(item, value, ms, {
        lenientPinyin: state.settings.pinyinInput !== 'strict',
      });
      setGiven(value);
      setCorrect(verdict.correct);
      setNote(verdict.note);
      setRevealed(true);
      record({
        wordId: item.wordId,
        dimension: item.dimension,
        correct: verdict.correct,
        ms,
        mode: item.mode,
        errorKind: verdict.errorKind,
        given: value,
        expected: item.answerKey,
        confusedWith: verdict.confusedWith,
      });
      setAnswered((prev) => {
        const next = [...prev, { item, given: value, correct: verdict.correct, ms, note: verdict.note }];
        if (smartStop && !slowedRef.current && shouldSlowDown(next)) {
          slowedRef.current = true;
          setQueue((q) => {
            const cut = q.findIndex((x) => x.key === item.key);
            const head = q.slice(0, cut + 1);
            const tail = q.slice(cut + 1).filter((x) => !smartStop(x));
            return [...head, ...tail];
          });
          onSlowDown?.();
        }
        return next;
      });
    },
    [item, revealed, record, smartStop, onSlowDown],
  );

  // Countdown for timed modes.
  useEffect(() => {
    if (!item?.timeLimitMs || revealed) return undefined;
    const t = setTimeout(() => {
      setExpired(true);
      submit('');
    }, item.timeLimitMs);
    return () => clearTimeout(t);
  }, [item, revealed, submit]);

  const next = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  useEffect(() => {
    if (!done || finishedRef.current) return;
    const wrong = answered.filter((a) => !a.correct).map((a) => a.item);
    if (retestMistakes && !retested && wrong.length > 0) {
      setRetested(true);
      setQueue((q) => [...q, ...wrong.map((w) => ({ ...w, key: `${w.key}:retest` }))]);
      return;
    }
    finishedRef.current = true;
    onFinish?.(
      answered.map((a) => ({ item: a.item, correct: a.correct, ms: a.ms, given: a.given })),
    );
  }, [done, answered, retestMistakes, retested, onFinish]);

  // Keyboard: 1-4 choose, Enter next, Space reveal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
        return;
      }
      if (typing) return;
      if (item.options && /^[1-9]$/.test(e.key)) {
        const opt = item.options[Number(e.key) - 1];
        if (opt) {
          e.preventDefault();
          submit(opt.key);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, revealed, submit, next]);

  const stats = useMemo(() => {
    const total = answered.length;
    const right = answered.filter((a) => a.correct).length;
    return { total, right, pct: total ? Math.round((right / total) * 100) : 0 };
  }, [answered]);

  if (done && showResults) {
    const wrong = answered.filter((a) => !a.correct);
    return (
      <div className="stack">
        <div className="card center stack">
          <h2>{stats.pct}% correct</h2>
          <p className="muted small">
            {stats.right} of {stats.total} answers right{retested ? ' (mistakes were re-asked)' : ''}.
          </p>
        </div>
        {wrong.length > 0 && (
          <div className="card stack">
            <h3>What slipped</h3>
            <div className="list">
              {wrong.map((a, i) => {
                const w = tryWord(a.item.wordId);
                return (
                  <Link className="list__item" key={i} to={`/word/${a.item.wordId}`}>
                    <span className="list__hz hanzi">{w?.hanzi}</span>
                    <span className="list__mid">
                      <span className="py">{w?.pinyin}</span>
                      <div className="mn">{w?.primaryMeaning}</div>
                    </span>
                    <span className="chip chip--bad">{a.item.dimension}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <button className="btn btn--primary btn--block btn--lg" onClick={() => onFinish?.([])}>
          {finishLabel}
        </button>
      </div>
    );
  }

  if (!item) return null;

  const progress = queue.length ? index / queue.length : 0;
  const wordForItem = tryWord(item.wordId);
  const ownNote = state.progress[item.wordId]?.note ?? '';

  const promptClass =
    roundStyle === 'flash' && !revealed
      ? 'flash'
      : roundStyle === 'blur' && !revealed
        ? 'blurring'
        : '';

  return (
    <div className="quiz">
      <div className="quiz__bar" aria-hidden>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="row tiny muted">
        <span>{title ?? item.mode}</span>
        <span className="spacer" />
        <span className="mono">
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
        {stats.total > 0 && <span className="mono">· {stats.pct}%</span>}
      </div>

      <div className="quiz__instruction">{item.instruction}</div>

      <div className="quiz__prompt">
        {item.promptFace === 'audio' ? (
          <>
            <div style={{ fontSize: '3rem' }}>🔊</div>
            <Speaker text={item.audioText ?? ''} label="Play again" />
            <div className="tiny muted">You will not see the word until you answer.</div>
          </>
        ) : item.promptFace === 'sentence' ? (
          <>
            <div className="hanzi" style={{ fontSize: '1.5rem', lineHeight: 1.7 }}>
              {item.prompt}
            </div>
            {item.promptSub && <div className="small muted">{item.promptSub}</div>}
          </>
        ) : item.kind === 'tone' ? (
          <>
            <div className={`big hanzi ${promptClass}`} lang="zh">{item.prompt}</div>
            <div className="mid">{wordForItem ? stripTones(wordForItem.pinyin) : ''}</div>
            {item.promptSub && <div className="small muted">{item.promptSub}</div>}
          </>
        ) : item.promptFace === 'meaning' && item.mode === 'story-recall' ? (
          <div className="txt">{item.prompt}</div>
        ) : item.promptFace === 'hanzi' || item.promptFace === 'char-pick' ? (
          <>
            <div className={`big hanzi ${promptClass}`} lang="zh">{item.prompt}</div>
            {item.promptSub && <div className="small muted">{item.promptSub}</div>}
          </>
        ) : (
          <>
            <div className="mid">{item.prompt}</div>
            {item.promptSub && <div className="small muted">{item.promptSub}</div>}
          </>
        )}
        {item.timeLimitMs && !revealed && <TimerBar ms={item.timeLimitMs} />}
      </div>

      {item.kind === 'match' && item.pairs ? (
        <MatchBoard
          item={item}
          picked={matchPicked}
          doneKeys={matchDone}
          wrongKey={matchWrong}
          onPickLeft={(k) => setMatchPicked(k)}
          onPickRight={(k) => {
            if (!matchPicked) return;
            const ms = Date.now() - startRef.current;
            const ok = matchPicked === k;
            record({
              wordId: Number(matchPicked),
              dimension: 'meaning',
              correct: ok,
              ms,
              mode: 'match',
              errorKind: ok ? undefined : 'meaning',
              given: k,
              expected: matchPicked,
              confusedWith: ok ? undefined : Number(k),
            });
            if (ok) {
              const nextDone = [...matchDone, k];
              setMatchDone(nextDone);
              setMatchPicked(null);
              setMatchWrong(null);
              if (nextDone.length === item.pairs!.length) {
                setAnswered((prev) => [...prev, { item, given: 'matched', correct: true, ms }]);
                setRevealed(true);
                setCorrect(true);
                setNote('All pairs matched.');
              }
            } else {
              setMatchWrong(k);
              setMatchPicked(null);
              setTimeout(() => setMatchWrong(null), 700);
            }
          }}
        />
      ) : item.kind === 'type' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (revealed) next();
            else submit(typed);
          }}
          className="stack--sm stack"
        >
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={item.answerFace === 'pinyin' ? 'e.g. xuéxí or xue2xi2' : 'type the meaning'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={revealed}
            aria-label={item.instruction}
          />
          {item.hint && !revealed && <div className="tiny muted">{item.hint}</div>}
          {!revealed && (
            <div className="row">
              <button className="btn btn--primary" type="submit" disabled={!typed.trim()}>
                Check
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => submit('')}>
                I don't know
              </button>
            </div>
          )}
        </form>
      ) : (
        <div className={`options${(item.options?.length ?? 0) > 2 ? ' options--2col' : ''}`}>
          {item.options?.map((o, i) => {
            const isAnswer = o.key === item.answerKey;
            const isGiven = o.key === given;
            let cls = 'option';
            if (revealed) {
              if (isAnswer) cls += ' option--correct';
              else if (isGiven) cls += ' option--wrong';
              else cls += ' option--muted';
            }
            const isHanziOption =
              item.answerFace === 'hanzi' || item.mode === 'char-spot' || item.mode === 'story-recall';
            return (
              <button
                key={o.key}
                className={cls}
                onClick={() => submit(o.key)}
                disabled={revealed}
                type="button"
              >
                <span className="option__num">{i + 1}</span>
                <span className="option__label">
                  {item.kind === 'tone' ? (
                    <span className="row" style={{ gap: 6 }}>
                      {o.key.split('-').map((t, j) => (
                        <ToneMark key={j} tone={Number(t)} size={22} />
                      ))}
                      <span className="mono small muted">{o.label}</span>
                    </span>
                  ) : isHanziOption ? (
                    <span className="hz hanzi" lang="zh">{o.label}</span>
                  ) : (
                    o.label
                  )}
                  {o.sub && <div className="option__sub">{o.sub}</div>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {revealed && (
        <div className={`verdict ${correct ? 'verdict--good' : 'verdict--bad'}`}>
          <h3>{correct ? '✓ Correct' : expired ? '⏱ Out of time' : '✕ Not quite'}</h3>
          <div className="body">
            {note && <p>{note}</p>}
            {!correct && item.kind === 'type' && (
              <p>
                Answer: <b>{item.answerKey}</b>
                {given.trim() ? <> — you typed “{given}”.</> : null}
              </p>
            )}
            {wordForItem && (
              <p className="row row--wrap" style={{ gap: 8 }}>
                <Link to={`/word/${wordForItem.id}`} className="hanzi" style={{ fontSize: '1.4rem' }}>
                  {wordForItem.hanzi}
                </Link>
                <span>
                  {wordForItem.pinyin} — {wordForItem.primaryMeaning}
                </span>
                {speechAvailable() && <Speaker text={wordForItem.plain} compact />}
              </p>
            )}
            {!correct && wordForItem && ownNote && (
              <div className="fact" style={{ marginTop: 6 }}>
                <span className="label">Your own note</span>
                {ownNote}
              </div>
            )}
            {!correct && wordForItem && (
              <div className="trick" style={{ marginTop: 6 }}>
                <span className="label">Memory trick — not historical origin</span>
                {wordForItem.story}
              </div>
            )}
            {item.mode === 'cloze' && wordForItem && (
              <div style={{ marginTop: 8 }}>
                {wordForItem.senses
                  .flatMap((s) => s.examples)
                  .slice(0, 1)
                  .map((ex, i) => (
                    <div key={i}>
                      <Sentence tokens={ex.tokens} target={wordForItem.plain} />
                      <div className="small muted">{ex.en}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {revealed && (
        <button ref={nextRef} className="btn btn--primary btn--block btn--lg" onClick={next}>
          {index + 1 >= queue.length ? 'See results' : 'Next'} <span className="kbd">↵</span>
        </button>
      )}
    </div>
  );
}

function TimerBar({ ms }: { ms: number }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    setLeft(ms);
    const started = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, ms - (Date.now() - started))), 90);
    return () => clearInterval(t);
  }, [ms]);
  return (
    <div className="quiz__bar" style={{ width: '70%', marginTop: 8 }} aria-hidden>
      <i style={{ width: `${(left / ms) * 100}%`, background: left < ms * 0.3 ? 'var(--bad)' : 'var(--accent)' }} />
    </div>
  );
}

function MatchBoard({
  item,
  picked,
  doneKeys,
  wrongKey,
  onPickLeft,
  onPickRight,
}: {
  item: QuizItem;
  picked: string | null;
  doneKeys: string[];
  wrongKey: string | null;
  onPickLeft: (k: string) => void;
  onPickRight: (k: string) => void;
}) {
  const pairs = item.pairs ?? [];
  const rights = useMemo(() => {
    const arr = pairs.map((p) => p.right);
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);
  return (
    <div className="match">
      <div className="options">
        {pairs.map((p) => (
          <button
            key={p.left.key}
            type="button"
            className={`option${doneKeys.includes(p.left.key) ? ' option--correct' : ''}${picked === p.left.key ? ' option--picked' : ''}`}
            onClick={() => onPickLeft(p.left.key)}
            disabled={doneKeys.includes(p.left.key)}
          >
            <span className="option__label">
              <span className="hz hanzi">{p.left.label}</span>
              {p.left.sub && <div className="option__sub">{p.left.sub}</div>}
            </span>
          </button>
        ))}
      </div>
      <div className="options">
        {rights.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`option${doneKeys.includes(r.key) ? ' option--correct' : ''}${wrongKey === r.key ? ' option--wrong' : ''}`}
            onClick={() => onPickRight(r.key)}
            disabled={doneKeys.includes(r.key)}
          >
            <span className="option__label">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
