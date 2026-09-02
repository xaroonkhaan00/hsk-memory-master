import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { WORDS, tryWord } from '../data';
import { useStore } from '../store';
import { MODE_BY_KEY, buildItem, type ModeKey } from '../services/quiz';
import { dueWords, difficulty, progressOf, weakWords } from '../services/progress';
import { speechAvailable } from '../services/speech';
import QuizRunner from '../components/QuizRunner';
import { Segmented, TopBar } from '../components/ui';
import Disappearing from './Disappearing';
import type { QuizItem } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

type Source = 'smart' | 'weak' | 'due' | 'starred' | 'all' | 'unseen';

export default function GamePlay() {
  const { mode = '' } = useParams();
  const [params] = useSearchParams();
  const { state } = useStore();
  const info = MODE_BY_KEY[mode as ModeKey];
  const [source, setSource] = useState<Source>((params.get('source') as Source) ?? 'smart');
  const [length, setLength] = useState(12);
  const [started, setStarted] = useState(false);
  const [runIds, setRunIds] = useState<number[]>([]);
  const audio = speechAvailable();

  const listParam = params.get('list');
  const idsParam = params.get('ids');

  const pool = useMemo(() => {
    if (idsParam) return idsParam.split(',').map(Number).filter((n) => !!tryWord(n));
    if (listParam) return state.customLists[listParam] ?? [];
    const now = Date.now();
    const seen = Object.values(state.progress).filter((p) => p.introduced).map((p) => p.id);
    switch (source) {
      case 'weak': {
        const w = weakWords(state, now, 80);
        return w.length ? w : seen;
      }
      case 'due': {
        const d = dueWords(state, now);
        return d.length ? d : seen;
      }
      case 'starred':
        return Object.values(state.progress).filter((p) => p.starred).map((p) => p.id);
      case 'unseen':
        return WORDS.filter((w) => !state.progress[w.id]?.introduced).slice(0, 60).map((w) => w.id);
      case 'all':
        return WORDS.map((w) => w.id);
      default: {
        if (seen.length < 12) return WORDS.slice(0, 40).map((w) => w.id);
        return seen
          .map((id) => ({ id, d: difficulty(progressOf(state, id), now) }))
          .sort((a, b) => b.d - a.d)
          .slice(0, 60)
          .map((x) => x.id);
      }
    }
  }, [source, state, listParam, idsParam]);

  const build = useCallback((): QuizItem[] => {
    if (!info) return [];
    const ids = shuffle(pool);
    const out: QuizItem[] = [];
    for (const id of ids) {
      if (out.length >= length) break;
      const item = buildItem(info.key, id, { state, pool });
      if (item) out.push(item);
    }
    // Some modes (confusion, char-family) can't build for every word; top up.
    if (out.length < Math.min(length, 4)) {
      for (const w of shuffle(WORDS)) {
        if (out.length >= length) break;
        const item = buildItem(info.key, w.id, { state, pool: WORDS.map((x) => x.id) });
        if (item) out.push(item);
      }
    }
    return out;
  }, [info, pool, length, state]);

  // The preview count may be recomputed freely; the run itself is frozen the
  // moment it starts, so answering never reshuffles the questions underneath.
  const previewCount = useMemo(() => build().length, [build]);
  const [runItems, setRunItems] = useState<QuizItem[]>([]);

  if (!info) {
    return (
      <>
        <TopBar title="Unknown mode" back="/games" />
        <div className="page">
          <Link className="btn" to="/games">
            Back to training modes
          </Link>
        </div>
      </>
    );
  }

  if (info.needsAudio && !audio) {
    return (
      <>
        <TopBar title={info.title} back="/games" />
        <div className="page card">
          <p>
            This mode needs a Mandarin text-to-speech voice and none is installed in this browser.
            Rather than play the wrong accent, the mode stays off.
          </p>
        </div>
      </>
    );
  }

  if (started && info.key === 'disappearing') {
    return <Disappearing ids={runIds} />;
  }

  if (started) {
    return (
      <>
        <TopBar title={info.title} back="/games" />
        <div className="page">
          <QuizRunner
            items={runItems}
            title={info.title}
            roundStyle={info.key === 'rapid' ? 'flash' : info.key === 'blur' ? 'blur' : 'none'}
            onFinish={(r) => {
              if (!r.length) setStarted(false);
            }}
            finishLabel="Play again"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={info.title} back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <div className="row">
            <span style={{ fontSize: '2rem' }} aria-hidden>
              {info.icon}
            </span>
            <div style={{ flex: 1 }}>
              <h2>{info.title}</h2>
              <p className="small muted">{info.blurb}</p>
            </div>
          </div>
          <div className="row row--wrap">
            <span className="chip chip--accent">trains {info.dimension}</span>
            <span className="chip">{pool.length} words in pool</span>
          </div>
        </div>

        {!idsParam && !listParam && (
          <div className="card stack--sm stack">
            <h3>Which words?</h3>
            <div className="row row--wrap">
              {(['smart', 'weak', 'due', 'starred', 'unseen', 'all'] as Source[]).map((s) => (
                <button
                  key={s}
                  className={`chip chip--button${source === s ? ' chip--on' : ''}`}
                  onClick={() => setSource(s)}
                >
                  {s === 'smart' ? 'Coach picks' : s}
                </button>
              ))}
            </div>
            <Segmented
              value={length}
              onChange={setLength}
              options={[10, 12, 20, 30].map((n) => ({ value: n, label: `${n} q` }))}
              ariaLabel="Questions"
            />
          </div>
        )}

        <button
          className="btn btn--primary btn--lg btn--block"
          disabled={previewCount === 0}
          onClick={() => {
            setRunItems(build());
            setRunIds(pool.slice(0, 8));
            setStarted(true);
          }}
        >
          {previewCount ? `Start · ${previewCount} questions` : 'Not enough words yet'}
        </button>
        {previewCount === 0 && (
          <p className="small muted center">
            Learn a few words first — try a Magic 20 pack from the map.
          </p>
        )}
      </div>
    </>
  );
}
