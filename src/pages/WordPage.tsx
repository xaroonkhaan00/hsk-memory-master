import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MEASURE_WORDS,
  ROOMS,
  categoryLabel,
  confusionsFor,
  conversationsWith,
  getPack,
  storiesWith,
  tryWord,
} from '../data';
import { useStore } from '../store';
import { progressOf } from '../services/progress';
import { playWord } from '../services/audio';
import { DIMENSIONS } from '../types';
import {
  AudioRow,
  Meter,
  Sentence,
  NoVoiceNote,
  Speaker,
  StatusChip,
  Syllables,
  TopBar,
  useToast,
} from '../components/ui';

const DIM_LABEL: Record<string, string> = {
  character: 'Character',
  meaning: 'Meaning',
  pinyin: 'Pinyin',
  tone: 'Tone',
  listening: 'Listening',
  usage: 'Usage',
};

/** A card that can be folded away, so the page opens on what matters most. */
function Section({
  title,
  hint,
  open,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="disclosure" open={open}>
      <summary>
        {title}
        {hint && <span className="hint">{hint}</span>}
      </summary>
      <div className="disclosure__body">{children}</div>
    </details>
  );
}

export default function WordPage() {
  const { id = '' } = useParams();
  const word = tryWord(Number(id));
  const { state, toggleStar, addToList, resetWord, setNote } = useStore();
  const [toast, showToast] = useToast();
  const [newList, setNewList] = useState('');
  const [draft, setDraft] = useState<string | null>(null);

  const confusions = useMemo(() => (word ? confusionsFor(word.id) : []), [word]);
  const measure = useMemo(
    () => (word ? MEASURE_WORDS.find((m) => m.wordId === word.id) : undefined),
    [word],
  );
  const stories = useMemo(() => (word ? storiesWith(word.id) : []), [word]);
  const episodes = useMemo(() => (word ? conversationsWith(word.id) : []), [word]);

  const autoWord = state.settings.audio.autoWord;
  useEffect(() => {
    if (word && autoWord) playWord(word, state.settings.audio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word?.id, autoWord]);

  if (!word) {
    return (
      <>
        <TopBar title="Word not found" back="/browse" backLabel="Words" />
        <div className="page">
          <Link className="btn btn--soft" to="/browse">
            Back to search
          </Link>
        </div>
      </>
    );
  }

  const p = progressOf(state, word.id);
  const pack = getPack(word.pack);
  const room = ROOMS.find((r) => r.key === word.room);
  const listNames = Object.keys(state.customLists);

  return (
    <>
      <TopBar
        title={word.plain}
        sub={pack?.title}
        back
        right={
          <button
            className={`btn btn--icon btn--soft${p.starred ? ' is-on' : ''}`}
            type="button"
            aria-label={p.starred ? 'Remove star' : 'Star this word'}
            aria-pressed={p.starred}
            onClick={() => {
              toggleStar(word.id);
              showToast(p.starred ? 'Star removed' : 'Starred for extra review');
            }}
          >
            {p.starred ? '★' : '☆'}
          </button>
        }
      />
      <div className="page stack">
        {/* 1 the word · 2 the sound · 3 the pinyin · 4 the meaning */}
        <div className="card">
          <div className="word-hero">
            <div className="hz hanzi" lang="zh">
              {word.hanzi}
            </div>
            <div className="row center" style={{ marginTop: 10, marginBottom: 6 }}>
              <Speaker text={word.plain} label="Listen" />
              <Speaker text={word.plain} label="Slower" rate={0.65} />
              <NoVoiceNote />
            </div>
            <div className="py">{word.pinyin}</div>
            <div className="mn">{word.primaryMeaning}</div>
          </div>
          <Syllables word={word} size={28} />
          <div className="row row--wrap" style={{ justifyContent: 'center', marginTop: 12 }}>
            <StatusChip status={p.introduced ? p.status : 'new'} />
            {word.pos.map((x, i) => (
              <span className="chip" key={i}>
                {x}
              </span>
            ))}
            <span className="chip">HSK {word.level}</span>
            <span className="chip">{categoryLabel(word.category)}</span>
            {room && (
              <Link className="chip chip--button" to={`/palace/${room.key}`}>
                {room.icon} {room.label}
              </Link>
            )}
          </div>
        </div>

        {/* 5 the memory connection */}
        <div className="card stack--sm">
          <h3>Your memory connection</h3>
          <div className="fact">
            <span className="label">See · what the characters mean</span>
            {word.charLogic ?? word.chars.map((c) => `${c.char} = ${c.gloss}`).join(' · ')}
          </div>
          <div className="chars">
            {word.chars.map((c, i) => (
              <Link className="charbox" to={`/families/char/${encodeURIComponent(c.char)}`} key={i}>
                <div className="c hanzi" lang="zh">
                  {c.char}
                </div>
                <div className="p">{c.pinyin}</div>
                <div className="g">{c.gloss}</div>
              </Link>
            ))}
          </div>
          <div className="trick">
            <span className="label">Hear · a memory hook, not the real pronunciation</span>
            <ul style={{ margin: '4px 0 0', paddingLeft: '1.1em' }}>
              {word.soundHooks.map((h, i) => (
                <li key={i}>
                  <b>{h.syllable}</b> ({h.base}, tone {h.tone === 5 ? 'neutral' : h.tone}) → {h.hook}
                </li>
              ))}
            </ul>
            <p className="tiny" style={{ marginTop: 6 }}>
              These English words only point at the sound and are never spoken aloud. For the real
              pronunciation, use the listen button above.
            </p>
          </div>
          <div className="trick">
            <span className="label">Imagine · a scene to hang it on</span>
            {word.story}
          </div>
        </div>

        {/* 6 where the word actually lives */}
        {(stories.length > 0 || episodes.length > 0) && (
          <div className="card stack--sm">
            <h3>See it in use</h3>
            {stories.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 0 }}>
                  See in stories <span className="chip">{stories.length}</span>
                </div>
                <div className="row row--wrap">
                  {stories.slice(0, 6).map((s) => (
                    <Link key={s.id} className="chip chip--button" to={`/stories/${s.id}`}>
                      {s.emoji} {s.title}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {episodes.length > 0 && (
              <>
                <div className="section-title">
                  See in conversations <span className="chip">{episodes.length}</span>
                </div>
                <div className="row row--wrap">
                  {episodes.slice(0, 6).map((s) => (
                    <Link key={s.id} className="chip chip--button" to={`/cinema/${s.id}`}>
                      {s.emoji} {s.title}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 7 example sentences */}
        <div className="card stack--sm">
          <h3>Example sentences</h3>
          {word.senses.map((s, si) =>
            s.examples.map((ex, xi) => (
              <div key={`${si}-${xi}`} className="stack--sm" style={{ paddingBottom: 6 }}>
                <Sentence tokens={ex.tokens} target={word.plain} />
                <div className="small muted">{ex.en}</div>
                <AudioRow text={ex.zh} />
              </div>
            )),
          )}
          {word.senses.every((s) => s.examples.length === 0) && (
            <p className="small muted">
              This word has no example sentence of its own yet — meet it in a story instead.
            </p>
          )}
        </div>

        {/* 8 related words */}
        {word.related.length > 0 && (
          <div className="card stack--sm">
            <h3>Related words</h3>
            <p className="tiny muted">These share a character with {word.hanzi}.</p>
            <div className="list">
              {word.related.map((r) => {
                const x = tryWord(r.id);
                if (!x) return null;
                return (
                  <Link className="list__item" to={`/word/${x.id}`} key={x.id}>
                    <span className="list__hz hanzi" lang="zh">
                      {x.hanzi}
                    </span>
                    <span className="list__mid">
                      <span className="py">{x.pinyin}</span>
                      <div className="mn">{x.primaryMeaning}</div>
                    </span>
                    <span className="chip hanzi" lang="zh">
                      {r.via.join('')}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 9 words it is easy to mix up */}
        {confusions.length > 0 && (
          <div className="card stack--sm">
            <h3>Easy to mix up</h3>
            {confusions.map((c) => (
              <div className="fact" key={c.key}>
                <span className="label">{c.title}</span>
                {c.rule}
                <div className="row row--wrap" style={{ marginTop: 6 }}>
                  {c.words
                    .map((wid) => tryWord(wid))
                    .filter((x): x is NonNullable<typeof x> => !!x)
                    .map((x) => (
                      <Link
                        key={x.id}
                        className={`chip chip--button${x.id === word.id ? ' chip--accent' : ''}`}
                        to={`/word/${x.id}`}
                      >
                        <span className="hanzi" lang="zh">
                          {x.hanzi}
                        </span>{' '}
                        {x.pinyin}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
            <Link className="btn btn--soft btn--sm" to="/confusion">
              Train these in Confusion Battles
            </Link>
          </div>
        )}

        {/* everything else folds away */}
        {word.allMeanings.length > 1 && (
          <Section title="All its meanings" hint={`${word.senses.length} senses`}>
            {word.senses.map((s, i) => (
              <div key={i} className="row" style={{ alignItems: 'baseline' }}>
                {s.pos && <span className="chip">{s.pos}</span>}
                <span style={{ flex: 1 }}>{s.meaning}</span>
              </div>
            ))}
            {word.alsoListedAs.length > 0 && (
              <p className="tiny muted">
                These characters also appear as a separate entry:{' '}
                {word.alsoListedAs.map((other, i) => {
                  const o = tryWord(other);
                  return o ? (
                    <span key={other}>
                      {i > 0 && ', '}
                      <Link to={`/word/${other}`}>
                        {o.pinyin} — {o.primaryMeaning}
                      </Link>
                    </span>
                  ) : null;
                })}
                .
              </p>
            )}
          </Section>
        )}

        {measure && (
          <Section title="Measure word" hint="which one, and when">
            <div className="fact">
              <span className="label">Rule</span>
              {measure.rule}
            </div>
            <div className="trick">
              <span className="label">Common trap</span>
              {measure.trap}
            </div>
            <Link className="btn btn--soft btn--sm" to="/measure-words">
              Full measure-word guide
            </Link>
          </Section>
        )}

        <Section title="My own sentence" hint={p.note ? 'written' : 'strongest recall trick'}>
          <p className="tiny muted">
            Write one short sentence of your own using {word.hanzi}, or your own memory hook. Making
            it personal is one of the strongest things you can do for recall — and it comes back to
            you whenever you get this word wrong.
          </p>
          <textarea
            value={draft ?? p.note}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`e.g. 我每天都用${word.plain}。`}
            style={{ minHeight: 72 }}
            aria-label={`Your own sentence for ${word.hanzi}`}
          />
          <div className="row">
            <button
              className="btn btn--soft btn--sm"
              type="button"
              disabled={draft === null || draft === p.note}
              onClick={() => {
                setNote(word.id, (draft ?? '').trim());
                setDraft(null);
                showToast('Saved to this word');
              }}
            >
              Save
            </button>
            {p.note && (
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => {
                  setNote(word.id, '');
                  setDraft(null);
                  showToast('Cleared');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </Section>

        <Section
          title="Your memory of this word"
          hint={p.attempts ? `${p.attempts} answers` : 'not practised yet'}
        >
          {DIMENSIONS.map((d) => (
            <Meter
              key={d}
              label={DIM_LABEL[d] ?? d}
              value={p.scores[d]}
              tone={p.scores[d] < 0.4 ? 'bad' : p.scores[d] < 0.7 ? 'warn' : 'good'}
            />
          ))}
          <div className="row row--wrap tiny muted">
            <span>{p.attempts} answers</span>
            <span>· {p.attempts ? Math.round((p.correct / p.attempts) * 100) : 0}% right</span>
            <span>· {p.lapses} lapses</span>
            {p.avgMs > 0 && <span>· {(p.avgMs / 1000).toFixed(1)}s average</span>}
            {p.due && <span>· next review {new Date(p.due).toLocaleDateString()}</span>}
          </div>
          {p.errors.length > 0 && (
            <div className="trick">
              <span className="label">Last mistake</span>
              You answered “{p.errors[0]!.given || '(nothing)'}” when the answer was “
              {p.errors[0]!.expected}”.
            </div>
          )}
          <button
            className="btn btn--danger btn--sm"
            type="button"
            onClick={() => {
              resetWord(word.id);
              showToast('This word starts again');
            }}
          >
            Start this word again
          </button>
        </Section>

        <Section title="Lists" hint={listNames.length ? `${listNames.length} lists` : 'make one'}>
          <div className="row row--wrap">
            {listNames.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip chip--button${
                  state.customLists[n]!.includes(word.id) ? ' chip--on' : ''
                }`}
                onClick={() => {
                  addToList(n, word.id);
                  showToast(`Added to “${n}”`);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newList.trim()) return;
              addToList(newList.trim(), word.id);
              showToast(`Added to “${newList.trim()}”`);
              setNewList('');
            }}
          >
            <input
              type="text"
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              placeholder="New list, e.g. Exam tomorrow"
            />
            <button className="btn btn--soft" type="submit">
              Add
            </button>
          </form>
        </Section>

        <div className="row">
          <Link className="btn btn--soft" to={`/word/${Math.max(1, word.id - 1)}`}>
            ‹ Previous word
          </Link>
          <span className="spacer" />
          <Link className="btn btn--soft" to={`/word/${Math.min(600, word.id + 1)}`}>
            Next word ›
          </Link>
        </div>
      </div>
      {toast}
    </>
  );
}
