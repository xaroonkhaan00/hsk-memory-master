/**
 * HSK 3 Mock Exam.
 *
 * Two postures share this file. STUDY (practice) shows pinyin, meanings and
 * lets a line be replayed. MOCK is an exam: no translations, no hints, no
 * tapping a word for its meaning, a running clock, and one submission.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Empty, TopBar, useToast } from '../components/ui';
import { Icon } from '../brand/icons';
import { useStore } from '../store';
import { getWord } from '../data';
import { speakChinese, stop } from '../services/audio';
import { speechAvailable, speechState } from '../services/speech';
import { pushBackHandler } from '../services/platform';
import {
  FULL_MINUTES,
  PART_LABEL,
  PASS_MARK,
  TIMING,
  correctAnswerText,
  generateExam,
  questionCorrect,
  scorePaper,
  type AnswerMap,
  type ExamPaper,
  type ExamQuestion,
  type ExamResult,
  type Section,
} from '../services/exam';
import type { ExamRecord } from '../types';

type Mode = 'full' | 'quick' | 'listening' | 'reading' | 'writing';

const MODE_LABEL: Record<Mode, string> = {
  full: 'Full HSK 3 mock exam',
  quick: 'Quick mock',
  listening: 'Listening practice',
  reading: 'Reading practice',
  writing: 'Writing practice',
};

function minutesFor(mode: Mode): number {
  if (mode === 'full') return FULL_MINUTES;
  if (mode === 'quick') return 20;
  return TIMING[mode as Section];
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------- hub */

export default function ExamHome() {
  const { state } = useStore();
  const history = state.exams.history;
  const best = history.reduce((m, r) => Math.max(m, r.total), 0);
  const latest = history[history.length - 1];
  const average = history.length
    ? Math.round(history.reduce((s, r) => s + r.total, 0) / history.length)
    : 0;

  return (
    <div className="page">
      <TopBar title="Mock exam" sub="HSK Level 3" back="/" backLabel="Home" />

      <div className="card card--hero stack--sm">
        <h2>Full HSK 3 mock test</h2>
        <div className="exam-shape">
          <div>
            <b>80</b>
            <span>questions</span>
          </div>
          <div>
            <b>40</b>
            <span>listening</span>
          </div>
          <div>
            <b>30</b>
            <span>reading</span>
          </div>
          <div>
            <b>10</b>
            <span>writing</span>
          </div>
        </div>
        <p className="small">
          {FULL_MINUTES} minutes of testing — about 90 with the setup an exam hall adds. Scored out
          of 300, with {PASS_MARK} to pass. Every attempt is a newly generated paper.
        </p>
        <Link className="btn btn--primary btn--lg btn--block" to="/exam/run?mode=full">
          Start full exam
        </Link>
      </div>

      <div className="section-title">Practise one part</div>
      <div className="grid grid--2">
        <Link className="tile" to="/exam/run?mode=listening&practice=1">
          <span className="tile__ico">
            <Icon name="wave" size={20} />
          </span>
          <span className="tile__body">
            <b>Listening practice</b>
          </span>
          <span className="tile__sub">40 questions, replay allowed</span>
        </Link>
        <Link className="tile" to="/exam/run?mode=reading&practice=1">
          <span className="tile__ico">
            <Icon name="book" size={20} />
          </span>
          <span className="tile__body">
            <b>Reading practice</b>
          </span>
          <span className="tile__sub">30 questions, pinyin on</span>
        </Link>
        <Link className="tile" to="/exam/run?mode=writing&practice=1">
          <span className="tile__ico">
            <Icon name="notebook" size={20} />
          </span>
          <span className="tile__body">
            <b>Writing practice</b>
          </span>
          <span className="tile__sub">10 questions, hints on</span>
        </Link>
        <Link className="tile" to="/exam/run?mode=quick">
          <span className="tile__ico">
            <Icon name="bolt" size={20} />
          </span>
          <span className="tile__body">
            <b>Quick mock</b>
          </span>
          <span className="tile__sub">A short paper, all three parts</span>
        </Link>
      </div>

      {history.length > 0 && (
        <>
          <div className="section-title">Your mock exams</div>
          <div className="card grid grid--3">
            <div className="stat">
              <div className="stat__value mono">{best}</div>
              <div className="stat__label">best</div>
            </div>
            <div className="stat">
              <div className="stat__value mono">{latest?.total ?? 0}</div>
              <div className="stat__label">latest</div>
            </div>
            <div className="stat">
              <div className="stat__value mono">{average}</div>
              <div className="stat__label">average</div>
            </div>
          </div>
          <div className="card">
            <div className="list">
              {[...history]
                .reverse()
                .slice(0, 12)
                .map((r) => (
                  <div className="list__item" key={r.at}>
                    <span className="list__mid">
                      <span className="py">
                        {new Date(r.at).toLocaleDateString()} · {MODE_LABEL[r.mode]}
                      </span>
                      <div className="mn">
                        Listening {r.listening} · Reading {r.reading} · Writing {r.writing} ·{' '}
                        {clock(r.msUsed)}
                      </div>
                    </span>
                    <span className={`chip ${r.passed ? 'chip--good' : 'chip--warn'}`}>
                      {r.total}/300
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {history.length === 0 && (
        <Empty
          title="No mock exams yet"
          body="Sit a full paper when you want to know where you stand, or practise one part at a time first."
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ runner */

export function ExamRunner() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { state, recordExam, record, toggleStar } = useStore();
  const [toast, showToast] = useToast();

  const mode = (params.get('mode') as Mode) ?? 'full';
  const practice = params.get('practice') === '1';

  const [attempt, setAttempt] = useState(0);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [buildError, setBuildError] = useState('');
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [audioReady, setAudioReady] = useState(() => speechAvailable());
  const [playedOnce, setPlayedOnce] = useState<Set<string>>(new Set());
  const [speaking, setSpeaking] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const submitted = result !== null;

  const limitMs = minutesFor(mode) * 60_000;
  const remaining = limitMs - (now - started);

  // Build the paper. A fresh seed every time means a different valid exam.
  useEffect(() => {
    let live = true;
    const only =
      mode === 'listening' || mode === 'reading' || mode === 'writing' ? (mode as Section) : undefined;
    void generateExam({ weights: state.exams.seen, quick: mode === 'quick', only })
      .then((p) => {
        if (live) setPaper(p);
      })
      .catch((e: unknown) => {
        if (live) setBuildError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attempt]);

  // The clock only runs in a real mock; practice is untimed.
  useEffect(() => {
    if (practice || submitted) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [practice, submitted]);

  const question = paper?.questions[at];

  const finish = useCallback(() => {
    if (!paper || result) return;
    stop();
    const scored = scorePaper(paper, answers, Date.now() - started);
    const correctCount = paper.questions.filter((q) => questionCorrect(q, answers[q.id])).length;
    const rec: ExamRecord = {
      at: Date.now(),
      seed: paper.seed,
      mode,
      listening: scored.listening.score,
      reading: scored.reading.score,
      writing: scored.writing.score,
      total: scored.total,
      passed: scored.passed,
      msUsed: scored.msUsed,
      questions: paper.questions.length,
      correct: correctCount,
    };
    const examined = new Set<number>();
    for (const q of paper.questions) for (const id of q.wordIds) examined.add(id);
    recordExam(rec, [...examined]);
    // A missed question is evidence, but one exam should not brand a word weak:
    // it is logged as a single unscheduled answer, the same weight as a tap.
    for (const q of paper.questions) {
      const ok = questionCorrect(q, answers[q.id]);
      const dimension = q.section === 'listening' ? 'listening' : 'usage';
      for (const id of q.wordIds.slice(0, 2)) {
        record({
          wordId: id,
          dimension,
          correct: ok,
          ms: 9000,
          mode: `exam-${q.part}`,
          schedule: false,
        });
      }
    }
    setResult(scored);
  }, [paper, answers, started, mode, recordExam, record, result]);

  // Time up ends the paper the way an exam does.
  useEffect(() => {
    if (!practice && !submitted && paper && remaining <= 0) finish();
  }, [practice, submitted, paper, remaining, finish]);

  // Leaving mid-exam asks first, so a hardware Back never bins an attempt.
  useEffect(
    () =>
      pushBackHandler(() => {
        if (submitted) return false;
        if (confirmLeave) {
          setConfirmLeave(false);
          return true;
        }
        setConfirmLeave(true);
        return true;
      }),
    [submitted, confirmLeave],
  );

  useEffect(() => {
    setOrder([]);
  }, [at]);

  useEffect(() => () => stop(), []);

  const playAudio = useCallback(
    async (q: ExamQuestion) => {
      if (!q.audio?.length) return;
      setSpeaking(true);
      for (const line of q.audio) {
        const res = await speakChinese(line.text, state.settings.audio, {
          speaker: line.speaker,
          repeat: 1,
        });
        if (!res.completed && !res.cancelled) {
          showToast(res.error ?? 'Audio could not play.');
          break;
        }
      }
      setSpeaking(false);
      setPlayedOnce((s) => new Set(s).add(q.id));
    },
    [state.settings.audio, showToast],
  );

  // In a real mock each listening item plays once, by itself, as it would in
  // the hall. Practice lets the learner press play as often as they like.
  useEffect(() => {
    if (!question?.audio?.length || submitted) return;
    if (!practice && playedOnce.has(question.id)) return;
    if (!speechAvailable()) return;
    const t = setTimeout(() => void playAudio(question), 400);
    return () => {
      clearTimeout(t);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, submitted]);

  if (buildError) {
    return (
      <div className="page">
        <TopBar title="Mock exam" back="/exam" backLabel="Exams" />
        <Empty title="The paper could not be built" body={buildError} />
      </div>
    );
  }

  if (!paper || !question) {
    return (
      <div className="page">
        <TopBar title={MODE_LABEL[mode]} back="/exam" backLabel="Exams" />
        <div className="card center">
          <p className="muted small">Generating a fresh paper…</p>
        </div>
      </div>
    );
  }

  const hasListening = paper.questions.some((q) => q.audio?.length);
  if (hasListening && !audioReady && !submitted) {
    const s = speechState();
    return (
      <div className="page">
        <TopBar title={MODE_LABEL[mode]} back="/exam" backLabel="Exams" />
        <div className="card stack--sm">
          <h2>Audio setup required</h2>
          <p className="small">
            This paper has listening questions, and no Mandarin speech is available yet on this
            device. Starting now would mean guessing 40 questions blind.
          </p>
          <div className="fact">
            <span className="label">What the app can see</span>
            Backend: {s.backend === 'none' ? 'none' : s.backend === 'native' ? 'Android speech' : 'browser speech'}
            {s.error ? ` · ${s.error}` : ''}
          </div>
          <div className="row row--wrap">
            <Link className="btn btn--primary" to="/settings/audio">
              Test audio
            </Link>
            <button
              className="btn btn--soft"
              type="button"
              onClick={() => setAudioReady(speechAvailable())}
            >
              Check again
            </button>
            <Link className="btn btn--ghost" to="/exam">
              Back to exams
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- the result */

  if (submitted && result) {
    const wrong = paper.questions.filter((q) => !questionCorrect(q, answers[q.id]));
    return (
      <div className="page">
        <TopBar title="Your result" back="/exam" backLabel="Exams" />
        <div className={`card card--hero center stack ${result.passed ? '' : ''}`}>
          <div className="exam-total">
            <b>{result.total}</b>
            <span>/ 300</span>
          </div>
          <span className={`chip ${result.passed ? 'chip--good' : 'chip--warn'}`}>
            {result.passed ? 'Pass' : 'Not yet'}
          </span>
          <p className="small muted">
            {result.passed
              ? `${PASS_MARK} is the pass mark, and you are above it.`
              : `${PASS_MARK} is the pass mark. You are ${PASS_MARK - result.total} away — the review below shows exactly where.`}
          </p>
        </div>

        <div className="card grid grid--3">
          {(['listening', 'reading', 'writing'] as const).map((s) => (
            <div className="stat" key={s}>
              <div className="stat__value mono">{result[s].score}</div>
              <div className="stat__label">
                {s} · {result[s].raw}/{result[s].total}
              </div>
            </div>
          ))}
        </div>

        <div className="card stack--sm">
          <div className="section-title" style={{ marginTop: 0 }}>
            Where to work next
          </div>
          {(['listening', 'reading', 'writing'] as const)
            .slice()
            .sort((a, b) => result[a].score - result[b].score)
            .map((s, i) => (
              <div className="fact" key={s}>
                <span className="label">
                  {i === 0 ? 'Weakest section' : i === 1 ? 'Middle' : 'Strongest'}
                </span>
                {s.charAt(0).toUpperCase() + s.slice(1)} — {result[s].score}/100 ({result[s].raw} of{' '}
                {result[s].total} right)
              </div>
            ))}
          <div className="tiny muted">Time used: {clock(result.msUsed)}</div>
        </div>

        <div className="section-title">
          Review <span className="chip">{wrong.length} to look at</span>
        </div>
        {wrong.length === 0 ? (
          <Empty title="Nothing missed" body="Every question was right. Try a full paper next." />
        ) : (
          wrong.map((q) => (
            <div className="card stack--sm" key={q.id}>
              <div className="tiny muted">{PART_LABEL[q.part]}</div>
              <div className="hanzi" lang="zh" style={{ fontSize: '1.05rem' }}>
                {q.prompt}
              </div>
              {q.passage && (
                <div className="hanzi" lang="zh" style={{ fontSize: '1.1rem' }}>
                  {q.passage}
                </div>
              )}
              {q.audio?.map((a, i) => (
                <div className="hanzi" lang="zh" key={i} style={{ fontSize: '1.05rem' }}>
                  {a.speaker === 'b' ? 'B: ' : 'A: '}
                  {a.text}
                </div>
              ))}
              {q.pinyin && <div className="tiny muted">{q.pinyin}</div>}
              <div className="row row--wrap">
                <span className="chip chip--bad">
                  You: {answers[q.id] || 'no answer'}
                </span>
                <span className="chip chip--good">Answer: {correctAnswerText(q)}</span>
              </div>
              <p className="small">{q.explain}</p>
              <div className="row row--wrap">
                {q.wordIds.slice(0, 4).map((id) => (
                  <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                    <span className="hanzi" lang="zh">
                      {getWord(id).hanzi}
                    </span>
                  </Link>
                ))}
                {q.wordIds[0] !== undefined && (
                  <button
                    className="chip chip--button"
                    type="button"
                    onClick={() => {
                      for (const id of q.wordIds.slice(0, 3)) toggleStar(id);
                      showToast('Added to weak words');
                    }}
                  >
                    Add to weak words
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        <div className="row row--wrap">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => {
              // A fresh attempt, not a page reload: same screen, new paper.
              setPaper(null);
              setAnswers({});
              setFlags(new Set());
              setPlayedOnce(new Set());
              setResult(null);
              setAt(0);
              setAttempt((n) => n + 1);
            }}
          >
            Sit another paper
          </button>
          <Link className="btn btn--soft" to="/exam">
            Back to exams
          </Link>
        </div>
        {toast}
      </div>
    );
  }

  /* ------------------------------------------------------------ the paper */

  const answered = Object.keys(answers).filter((k) => answers[k]).length;
  const showAids = practice;
  const setAnswer = (value: string) => setAnswers((a) => ({ ...a, [question.id]: value }));

  return (
    <div className="page exam">
      <header className="exam-bar">
        <button
          className="backbtn"
          type="button"
          onClick={() => setConfirmLeave(true)}
          aria-label="Leave the exam"
        >
          <span className="backbtn__label">Leave</span>
        </button>
        <div className="exam-bar__mid">
          <b>
            Question {at + 1} / {paper.questions.length}
          </b>
          <span>{PART_LABEL[question.part]}</span>
        </div>
        {!practice && (
          <span className={`exam-clock${remaining < 120_000 ? ' exam-clock--low' : ''}`}>
            {clock(remaining)}
          </span>
        )}
      </header>

      <div className="progressline" aria-hidden>
        <i style={{ width: `${((at + 1) / paper.questions.length) * 100}%` }} />
      </div>

      <div className="card stack--sm">
        {question.audio?.length ? (
          <div className="stack--sm center">
            <div className={`exam-audio${speaking ? ' is-on' : ''}`} aria-hidden>
              ((( )))
            </div>
            <div className="tiny muted">
              {speaking
                ? 'Playing…'
                : practice
                  ? 'You can replay this as often as you like.'
                  : 'This plays once, as in the exam.'}
            </div>
            {(practice || !playedOnce.has(question.id)) && (
              <button
                className="btn btn--soft"
                type="button"
                disabled={speaking}
                onClick={() => void playAudio(question)}
              >
                {playedOnce.has(question.id) ? 'Play again' : 'Play'}
              </button>
            )}
          </div>
        ) : null}

        <div className="hanzi" lang="zh" style={{ fontSize: '1.08rem', fontWeight: 600 }}>
          {question.prompt}
        </div>
        {question.passage && (
          <div className="exam-passage hanzi" lang="zh">
            {question.passage}
          </div>
        )}
        {showAids && question.pinyin && <div className="tiny muted">{question.pinyin}</div>}
        {showAids && question.english && <div className="small muted">{question.english}</div>}
      </div>

      {question.kind === 'order' ? (
        <div className="card stack--sm">
          <div className="tiny muted">Tap the words in order.</div>
          <div className="exam-answer hanzi" lang="zh">
            {order.length ? order.join('') : <span className="muted">…</span>}
          </div>
          <div className="row row--wrap">
            {question.tiles?.map((t, i) => {
              const usedAt = order.indexOf(t);
              const used = usedAt >= 0 && order.filter((x) => x === t).length >= (question.tiles ?? []).filter((x) => x === t).length;
              return (
                <button
                  key={`${t}-${i}`}
                  type="button"
                  className={`chip chip--button hanzi${used ? ' chip--muted' : ''}`}
                  disabled={used}
                  onClick={() => {
                    const next = [...order, t];
                    setOrder(next);
                    setAnswer(next.join(''));
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="row">
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                const next = order.slice(0, -1);
                setOrder(next);
                setAnswer(next.join(''));
              }}
            >
              Undo
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                setOrder([]);
                setAnswer('');
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="options">
          {question.options.map((o, i) => (
            <button
              key={o}
              type="button"
              className={`option${answers[question.id] === o ? ' option--picked' : ''}`}
              onClick={() => setAnswer(o)}
            >
              <span className="option__num">{i + 1}</span>
              <span className="option__label hanzi" lang="zh">
                {o}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="row row--wrap">
        <button
          className={`chip chip--button${flags.has(question.id) ? ' chip--on' : ''}`}
          type="button"
          aria-pressed={flags.has(question.id)}
          onClick={() =>
            setFlags((f) => {
              const next = new Set(f);
              if (next.has(question.id)) next.delete(question.id);
              else next.add(question.id);
              return next;
            })
          }
        >
          {flags.has(question.id) ? 'Flagged' : 'Flag for review'}
        </button>
        <span className="spacer" />
        <span className="tiny muted">
          {answered} of {paper.questions.length} answered
        </span>
      </div>

      <div className="row">
        <button
          className="btn btn--soft"
          type="button"
          disabled={at === 0}
          onClick={() => setAt((i) => Math.max(0, i - 1))}
        >
          Previous
        </button>
        <span className="spacer" />
        {at + 1 < paper.questions.length ? (
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => setAt((i) => i + 1)}
          >
            Next
          </button>
        ) : (
          <button className="btn btn--primary" type="button" onClick={() => setConfirmSubmit(true)}>
            Submit
          </button>
        )}
      </div>

      <button
        className="btn btn--ghost btn--block"
        type="button"
        onClick={() => setConfirmSubmit(true)}
      >
        Finish and submit
      </button>

      {confirmSubmit && (
        <div className="card verdict verdict--bad stack--sm">
          <h3>Submit the paper?</h3>
          <div className="body">
            {answered} of {paper.questions.length} answered.
            {answered < paper.questions.length
              ? ' Unanswered questions score nothing.'
              : ' Everything is answered.'}
          </div>
          <div className="row">
            <button className="btn btn--primary" type="button" onClick={finish}>
              Submit paper
            </button>
            <button
              className="btn btn--soft"
              type="button"
              onClick={() => setConfirmSubmit(false)}
            >
              Keep working
            </button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="card verdict verdict--bad stack--sm">
          <h3>Leave exam?</h3>
          <div className="body">Progress for this attempt may be lost.</div>
          <div className="row">
            <button
              className="btn btn--danger"
              type="button"
              onClick={() => {
                stop();
                navigate('/exam');
              }}
            >
              Leave
            </button>
            <button className="btn btn--soft" type="button" onClick={() => setConfirmLeave(false)}>
              Stay
            </button>
          </div>
        </div>
      )}
      {toast}
    </div>
  );
}
