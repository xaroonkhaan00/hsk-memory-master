import { useMemo, useState } from 'react';
import { TONE_TWINS, WORDS, getWord, tryWord } from '../data';
import { useStore } from '../store';
import { buildItem } from '../services/quiz';
import { TONE_SHAPES } from '../services/pinyin';
import QuizRunner from '../components/QuizRunner';
import { Link } from 'react-router-dom';
import { Meter, Speaker, ToneMark, TopBar } from '../components/ui';
import type { QuizItem } from '../types';

export default function ToneTrainer() {
  const { state } = useStore();
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(0);

  const toneStats = useMemo(() => {
    // Which individual tones and which tone pairs go wrong most often.
    const perTone = [1, 2, 3, 4, 5].map(() => ({ n: 0, wrong: 0 }));
    const pairs = new Map<string, { n: number; wrong: number }>();
    for (const a of state.attempts) {
      if (a.dimension !== 'tone') continue;
      const w = tryWord(a.wordId);
      if (!w) continue;
      for (const t of w.tones) {
        const row = perTone[t - 1];
        if (row) {
          row.n += 1;
          if (!a.correct) row.wrong += 1;
        }
      }
      if (w.tones.length >= 2) {
        const key = w.tones.slice(0, 2).join('-');
        const row = pairs.get(key) ?? { n: 0, wrong: 0 };
        row.n += 1;
        if (!a.correct) row.wrong += 1;
        pairs.set(key, row);
      }
    }
    const worstPairs = [...pairs.entries()]
      .filter(([, v]) => v.n >= 3)
      .sort((a, b) => b[1].wrong / b[1].n - a[1].wrong / a[1].n)
      .slice(0, 5);
    return { perTone, worstPairs };
  }, [state.attempts]);

  const items = useMemo<QuizItem[]>(() => {
    const seen = Object.values(state.progress).filter((p) => p.introduced).map((p) => p.id);
    const pool = seen.length >= 12 ? seen : WORDS.slice(0, 60).map((w) => w.id);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 15);
    return shuffled
      .map((id) => buildItem('tone', id, { state, pool }))
      .filter((x): x is QuizItem => !!x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  if (started) {
    return (
      <>
        <TopBar title="Tone trainer" back="/games" />
        <div className="page">
          <QuizRunner
            items={items}
            title="Tones"
            onFinish={(r) => {
              if (!r.length) {
                setStarted(false);
                setSeed((s) => s + 1);
              }
            }}
            finishLabel="Back to the tone trainer"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Tone trainer" back="/games" />
      <div className="page stack">
        <div className="card stack--sm stack">
          <h3>The five shapes</h3>
          {[1, 2, 3, 4, 5].map((t) => {
            const s = TONE_SHAPES[t]!;
            const stat = toneStats.perTone[t - 1]!;
            return (
              <div className="row" key={t}>
                <ToneMark tone={t} size={34} />
                <div style={{ flex: 1 }}>
                  <b>{t === 5 ? 'Neutral' : `Tone ${t}`}</b> — {s.name}
                  <div className="small muted">{s.motion}</div>
                </div>
                <span className="chip mono">
                  {stat.n ? `${Math.round((1 - stat.wrong / stat.n) * 100)}%` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="card stack--sm stack">
          <h3>Tone twins in your 600 words</h3>
          <p className="small muted">
            {TONE_TWINS.length} sets of words with identical syllables where the tone is the only
            thing carrying the meaning. Play each pair back to back until you can hear the split.
          </p>
          {TONE_TWINS.map((t) => (
            <div className="row row--wrap" key={t.base}>
              <span className="chip chip--accent mono" style={{ minWidth: 64 }}>
                {t.base}
              </span>
              {t.variants.map((v) => (
                <span className="chip" key={v.pinyin}>
                  <b>{v.pinyin}</b>
                  {v.words.map((id) => {
                    const w = getWord(id);
                    return (
                      <Link to={`/word/${id}`} key={id} className="hanzi">
                        {w.hanzi}
                      </Link>
                    );
                  })}
                  <Speaker text={getWord(v.words[0]!).plain} compact />
                </span>
              ))}
            </div>
          ))}
          <Link
            className="btn btn--soft btn--sm"
            to={`/games/tone?ids=${TONE_TWINS.flatMap((t) => t.variants.flatMap((v) => v.words)).join(',')}`}
          >
            Drill only the tone twins
          </Link>
        </div>

        {toneStats.worstPairs.length > 0 && (
          <div className="card stack--sm stack">
            <h3>Your most-missed tone combinations</h3>
            {toneStats.worstPairs.map(([key, v]) => (
              <Meter
                key={key}
                label={key.split('-').map((t) => (t === '5' ? 'neutral' : `tone ${t}`)).join(' + ')}
                value={1 - v.wrong / v.n}
                right={`${Math.round((1 - v.wrong / v.n) * 100)}% of ${v.n}`}
                tone={v.wrong / v.n > 0.4 ? 'bad' : 'warn'}
              />
            ))}
          </div>
        )}

        <button className="btn btn--primary btn--lg btn--block" onClick={() => setStarted(true)}>
          Start tone drill · {items.length} questions
        </button>
      </div>
    </>
  );
}
