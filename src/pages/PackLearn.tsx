import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CHAR_HUBS, getPack, getWord } from '../data';
import { useStore } from '../store';
import { MAGIC_STAGES, buildStageItems, packProgress, type MagicStage } from '../services/session';
import { buildItem } from '../services/quiz';
import { speechAvailable } from '../services/speech';
import QuizRunner from '../components/QuizRunner';
import { Meter, Speaker, Syllables, TopBar } from '../components/ui';
import type { QuizItem, Word } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export default function PackLearn() {
  const { packId = '' } = useParams();
  const { state, record } = useStore();
  const navigate = useNavigate();
  const pack = getPack(packId);
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<'study' | 'gate'>('study');
  const [cursor, setCursor] = useState(0);
  // Held in a ref, not state: updating it must not re-run the gate memo, or
  // finishing a stage would rebuild that stage's questions and restart the quiz
  // instead of showing the results.
  const wrongIdsRef = useRef<number[]>([]);
  const audio = speechAvailable();

  const words = useMemo(() => (pack ? pack.words.map(getWord) : []), [pack]);
  const stage = MAGIC_STAGES[stageIndex];

  const gateItems = useMemo<QuizItem[]>(() => {
    if (!pack || !stage) return [];
    const ids = pack.words;
    const opts = { state, pool: ids };
    const make = (mode: Parameters<typeof buildItem>[0], list = ids) =>
      list.map((id) => buildItem(mode, id, opts)).filter((x): x is QuizItem => !!x);
    switch (stage.key) {
      case 'preview': {
        const groups: QuizItem[] = [];
        const chunks = shuffle(ids);
        for (let i = 0; i < chunks.length; i += 5) {
          const item = buildItem('match', chunks[i]!, { state, pool: chunks.slice(i, i + 5) });
          if (item) groups.push(item);
        }
        return groups;
      }
      case 'understand':
        return shuffle(make('char-spot')).slice(0, 10);
      case 'connect':
        return shuffle([...make('char-family'), ...make('sound-family')]).slice(0, 10);
      case 'visualise':
        return shuffle(make('story-recall')).slice(0, 10);
      case 'retest': {
        const wrong = wrongIdsRef.current;
        return wrong.length
          ? shuffle([...make('hanzi-meaning', wrong), ...make('hanzi-pinyin', wrong)])
          : [];
      }
      default:
        return buildStageItems(stage.key as MagicStage, state, ids, audio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, stageIndex, phase, audio]);

  if (!pack || !stage) {
    return (
      <>
        <TopBar title="Pack not found" back="/map" />
        <div className="page">
          <Link className="btn" to="/map">
            Back to the map
          </Link>
        </div>
      </>
    );
  }

  const prog = packProgress(state, pack.id);
  const hasStudy = ['preview', 'understand', 'connect', 'visualise', 'pronounce'].includes(stage.key);

  const goNextStage = () => {
    setPhase('study');
    setCursor(0);
    setStageIndex((i) => Math.min(i + 1, MAGIC_STAGES.length - 1));
  };

  // The final stage has no study half, so completion is decided by the stage
  // index alone — otherwise the finish button loops back on itself.
  const finished = stageIndex === MAGIC_STAGES.length - 1;

  return (
    <>
      <TopBar
        title={pack.title}
        sub={`Stage ${stageIndex + 1} of ${MAGIC_STAGES.length} · ${stage.title}`}
        back="/map"
      />
      <div className="page stack">
        <div className="quiz__bar" aria-hidden>
          <i style={{ width: `${((stageIndex + (phase === 'gate' ? 0.5 : 0)) / MAGIC_STAGES.length) * 100}%` }} />
        </div>
        <div className="row row--wrap tiny">
          {MAGIC_STAGES.map((s, i) => (
            <span
              key={s.key}
              className={`chip${i === stageIndex ? ' chip--accent' : i < stageIndex ? ' chip--good' : ''}`}
            >
              {i + 1}. {s.title}
            </span>
          ))}
        </div>

        {phase === 'study' && hasStudy ? (
          <StudyStage
            stage={stage.key}
            words={words}
            cursor={cursor}
            onCursor={setCursor}
            onDone={() => setPhase('gate')}
            onSeen={(w) =>
              record({
                wordId: w.id,
                dimension: 'meaning',
                correct: true,
                ms: 4000,
                mode: `magic:${stage.key}`,
                schedule: stage.key === 'preview',
              })
            }
          />
        ) : gateItems.length === 0 ? (
          <div className="card stack center">
            <h3>{stage.title}</h3>
            <p className="muted small">
              {stage.key === 'retest'
                ? 'Nothing to retest — you did not get anything wrong. That is the best possible outcome.'
                : 'Nothing to practise in this stage for this pack.'}
            </p>
            {finished ? (
              <Link className="btn btn--primary btn--lg btn--block" to="/map">
                Pack complete · back to the map
              </Link>
            ) : (
              <button className="btn btn--primary btn--block" onClick={goNextStage}>
                Continue
              </button>
            )}
          </div>
        ) : (
          <QuizRunner
            key={`${stage.key}-${stageIndex}`}
            items={gateItems}
            title={`${stageIndex + 1}. ${stage.title}`}
            retestMistakes={stage.key !== 'retest'}
            roundStyle={stage.key === 'test' ? 'none' : 'none'}
            onFinish={(results) => {
              if (results.length) {
                const missed = results.filter((r) => !r.correct).map((r) => r.item.wordId);
                wrongIdsRef.current = [...new Set([...wrongIdsRef.current, ...missed])];
              } else if (finished) navigate('/map');
              else goNextStage();
            }}
            finishLabel={
              finished ? 'Finish pack · back to the map' : `Continue to ${MAGIC_STAGES[stageIndex + 1]?.title ?? 'the end'}`
            }
          />
        )}

        <div className="card stack--sm stack">
          <Meter
            label="Pack progress"
            value={prog.introduced / Math.max(1, prog.total)}
            right={`${prog.introduced}/${prog.total} met · ${prog.strong} strong`}
          />
          <Link className="btn btn--soft btn--sm" to={`/story/${pack.id}`}>
            🎬 Story chain for this pack
          </Link>
        </div>
      </div>
    </>
  );
}

function StudyStage({
  stage,
  words,
  cursor,
  onCursor,
  onDone,
  onSeen,
}: {
  stage: string;
  words: Word[];
  cursor: number;
  onCursor: (n: number) => void;
  onDone: () => void;
  onSeen: (w: Word) => void;
}) {
  const sharedChars = useMemo(() => {
    const counts = new Map<string, number[]>();
    for (const x of words) {
      for (const c of x.chars) {
        const list = counts.get(c.char) ?? [];
        if (!list.includes(x.id)) list.push(x.id);
        counts.set(c.char, list);
      }
    }
    return [...counts.entries()].filter(([, ids]) => ids.length > 1);
  }, [words]);

  const w = words[cursor];
  const last = cursor >= words.length - 1;

  if (stage !== 'connect' && !w) return null;

  if (stage === 'connect') {
    return (
      <div className="stack">
        <div className="card stack--sm stack">
          <h3>What these twenty share</h3>
          {sharedChars.length === 0 ? (
            <p className="small muted">
              This pack has no repeated characters — it is a genuinely mixed set, so the connections
              to lean on are the sounds and the meanings rather than the shapes.
            </p>
          ) : (
            sharedChars.map(([c, ids]) => {
              const hub = CHAR_HUBS.find((h) => h.char === c);
              return (
                <div className="fact" key={c}>
                  <span className="label">Shared character</span>
                  <div className="row row--wrap">
                    <Link to={`/families/char/${encodeURIComponent(c)}`} className="hanzi" style={{ fontSize: '1.8rem' }}>
                      {c}
                    </Link>
                    <div style={{ flex: 1 }}>
                      <b>{hub?.pinyin}</b> — {hub?.gloss}
                      <div className="small">
                        {ids.map((id) => getWord(id)).map((x) => `${x.hanzi} ${x.pinyin}`).join(' · ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <button className="btn btn--primary btn--lg btn--block" onClick={onDone}>
          I see the connections — test me
        </button>
      </div>
    );
  }

  if (!w) return null;

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row tiny muted">
          <span>
            {cursor + 1} / {words.length}
          </span>
          <span className="spacer" />
          <span>#{w.id}</span>
        </div>
        <div className="word-hero">
          <div className="hz hanzi">{w.hanzi}</div>
          <div className="py">{w.syllables.map((s) => s.raw).join(' · ')}</div>
          <div className="mn">{w.primaryMeaning}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Speaker text={w.plain} label="Listen" />
          <Speaker text={w.plain} label="Slow" rate={0.7} />
        </div>

        {stage === 'pronounce' && <Syllables word={w} size={30} />}

        {stage === 'understand' && (
          <>
            <div className="chars">
              {w.chars.map((c, i) => (
                <Link
                  className="charbox"
                  key={i}
                  to={`/families/char/${encodeURIComponent(c.char)}`}
                >
                  <div className="c hanzi">{c.char}</div>
                  <div className="p">{c.pinyin}</div>
                  <div className="g">{c.gloss}</div>
                </Link>
              ))}
            </div>
            {w.charLogic && (
              <div className="fact">
                <span className="label">Fact · what each character means</span>
                {w.charLogic}
              </div>
            )}
          </>
        )}

        {stage === 'visualise' && (
          <div className="trick">
            <span className="label">Memory trick — not historical origin</span>
            {w.story}
          </div>
        )}

        {stage === 'preview' && (
          <div className="small muted">
            {w.senses[0]?.pos && <span className="chip">{w.senses[0].pos}</span>}{' '}
            {w.allMeanings.slice(0, 4).join(' · ')}
          </div>
        )}
      </div>

      <div className="row">
        <button
          className="btn btn--soft"
          onClick={() => onCursor(Math.max(0, cursor - 1))}
          disabled={cursor === 0}
        >
          ←
        </button>
        <button
          className="btn btn--primary"
          style={{ flex: 1 }}
          onClick={() => {
            onSeen(w);
            if (last) onDone();
            else onCursor(cursor + 1);
          }}
        >
          {last ? 'Done — now test me' : 'Got it, next word'}
        </button>
      </div>
    </div>
  );
}
