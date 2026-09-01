import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MEASURE_WORDS, ROOMS, categoryLabel, confusionsFor, getPack, tryWord } from '../data';
import { useStore } from '../store';
import { progressOf } from '../services/progress';
import { DIMENSIONS } from '../types';
import {
  AudioRow,
  Meter,
  Sentence,
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

  if (!word) {
    return (
      <>
        <TopBar title="Word not found" back="/browse" />
        <div className="page">
          <Link className="btn" to="/browse">
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
        title={`#${word.id}`}
        sub={pack?.title}
        back
        right={
          <button
            className="btn btn--icon btn--ghost"
            aria-label={p.starred ? 'Remove star' : 'Star this word'}
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
        {/* A. large hanzi, B. tone-marked pinyin, C. simple meaning, D. part of speech */}
        <div className="card">
          <div className="word-hero">
            <div className="hz hanzi" lang="zh">{word.hanzi}</div>
            <div className="py">{word.syllables.map((s) => s.raw).join(' · ')}</div>
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
          {word.pos.length === 0 && (
            <p className="tiny muted center" style={{ marginTop: 8 }}>
              The source PDF gives no part of speech for this entry.
            </p>
          )}
          {word.alsoListedAs.length > 0 && (
            <p className="tiny muted center" style={{ marginTop: 8 }}>
              The PDF lists these characters again as{' '}
              {word.alsoListedAs.map((id, i) => {
                const other = tryWord(id);
                return other ? (
                  <span key={id}>
                    {i > 0 && ', '}
                    <Link to={`/word/${id}`}>
                      #{id} {other.pinyin} — {other.primaryMeaning}
                    </Link>
                  </span>
                ) : null;
              })}
              . Both entries are kept exactly as printed.
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <AudioRow text={word.plain} />
          </div>
        </div>

        {/* All meanings */}
        {word.allMeanings.length > 1 && (
          <div className="card stack--sm stack">
            <h3>All meanings in the PDF</h3>
            {word.senses.map((s, i) => (
              <div key={i} className="row" style={{ alignItems: 'baseline' }}>
                {s.pos && <span className="chip">{s.pos}</span>}
                <span style={{ flex: 1 }}>{s.meaning}</span>
              </div>
            ))}
          </div>
        )}

        {/* E. character logic */}
        <div className="card stack--sm stack">
          <h3>Character logic</h3>
          <div className="chars">
            {word.chars.map((c, i) => (
              <Link className="charbox" to={`/families/char/${encodeURIComponent(c.char)}`} key={i}>
                <div className="c hanzi">{c.char}</div>
                <div className="p">{c.pinyin}</div>
                <div className="g">{c.gloss}</div>
              </Link>
            ))}
          </div>
          {word.charLogic ? (
            <div className="fact">
              <span className="label">Fact · what each character means</span>
              {word.charLogic}
            </div>
          ) : (
            <div className="fact">
              <span className="label">Fact</span>
              {word.chars.length === 1
                ? `${word.chars[0]!.char} ${word.chars[0]!.pinyin} — ${word.chars[0]!.gloss}`
                : 'Single-character meanings are listed above.'}
            </div>
          )}
        </div>

        {/* F+G+I. mnemonic, sound hook, memory movie */}
        <div className="card stack--sm stack">
          <h3>Why I will remember this</h3>
          <div className="fact">
            <span className="label">See · the characters</span>
            {word.charLogic ?? word.chars.map((c) => `${c.char} = ${c.gloss}`).join(' · ')}
          </div>
          <div className="trick">
            <span className="label">Hear · memory sound hook, NOT real pronunciation</span>
            <ul style={{ margin: '4px 0 0', paddingLeft: '1.1em' }}>
              {word.soundHooks.map((h, i) => (
                <li key={i}>
                  <b>{h.syllable}</b> ({h.base}, tone {h.tone === 5 ? 'neutral' : h.tone}) →{' '}
                  {h.hook}
                </li>
              ))}
            </ul>
            <p className="tiny" style={{ marginTop: 6 }}>
              These English words only point at the sound. The real pronunciation is the audio
              button above — always trust that over the hook.
            </p>
          </div>
          <div className="trick">
            <span className="label">Imagine · memory movie, not historical origin</span>
            {word.story}
          </div>
          <div className="fact">
            <span className="label">Remember · the meaning</span>
            {word.allMeanings.slice(0, 4).join(' · ')}
          </div>
        </div>

        {measure && (
          <div className="card stack--sm stack">
            <h3>📏 Measure word</h3>
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
          </div>
        )}

        {/* J. original PDF example */}
        <div className="card stack--sm stack">
          <h3>Example sentences from the PDF</h3>
          {word.senses.map((s, si) =>
            s.examples.map((ex, xi) => (
              <div key={`${si}-${xi}`} className="stack--sm stack" style={{ paddingBottom: 6 }}>
                <Sentence tokens={ex.tokens} target={word.plain} />
                <div className="small muted">{ex.en}</div>
                <div className="row">
                  <span className="tiny muted">Original PDF example</span>
                  <span className="spacer" />
                  <AudioRow text={ex.zh} />
                </div>
              </div>
            )),
          )}
        </div>

        {/* K. the learner's own example — elaboration in your own words beats a
            generated sentence, and it is never mistaken for source material. */}
        <div className="card stack--sm stack">
          <h3>My own sentence</h3>
          <p className="tiny muted">
            Write one short sentence of your own using {word.hanzi}, or your own memory hook.
            Making it personal is one of the strongest things you can do for recall — and it shows
            up again when you get this word wrong.
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
        </div>

        {/* Confusions */}
        {confusions.length > 0 && (
          <div className="card stack--sm stack">
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
                        <span className="hanzi">{x.hanzi}</span> {x.pinyin}
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

        {/* Related */}
        {word.related.length > 0 && (
          <div className="card stack--sm stack">
            <h3>Its word family</h3>
            <p className="tiny muted">Words in this list share a character with {word.hanzi}.</p>
            <div className="list">
              {word.related.map((r) => {
                const x = tryWord(r.id);
                if (!x) return null;
                return (
                  <Link className="list__item" to={`/word/${x.id}`} key={x.id}>
                    <span className="list__hz hanzi">{x.hanzi}</span>
                    <span className="list__mid">
                      <span className="py">{x.pinyin}</span>
                      <div className="mn">{x.primaryMeaning}</div>
                    </span>
                    <span className="chip hanzi">{r.via.join('')}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="card stack--sm stack">
          <h3>Your memory of this word</h3>
          {DIMENSIONS.map((d) => (
            <Meter
              key={d}
              label={DIM_LABEL[d] ?? d}
              value={p.scores[d]}
              tone={p.scores[d] < 0.4 ? 'bad' : p.scores[d] < 0.7 ? 'warn' : 'good'}
            />
          ))}
          <div className="row row--wrap tiny muted" style={{ marginTop: 4 }}>
            <span>{p.attempts} answers</span>
            <span>· {p.attempts ? Math.round((p.correct / p.attempts) * 100) : 0}% right</span>
            <span>· {p.lapses} lapses</span>
            {p.avgMs > 0 && <span>· {(p.avgMs / 1000).toFixed(1)}s average</span>}
            {p.due && <span>· next review {new Date(p.due).toLocaleDateString()}</span>}
          </div>
          {p.errors.length > 0 && (
            <div className="trick">
              <span className="label">Last mistake</span>
              {p.errors[0]!.kind} error — you answered “{p.errors[0]!.given || '(nothing)'}” when the
              answer was “{p.errors[0]!.expected}”.
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="card stack--sm stack">
          <h3>Lists</h3>
          <div className="row row--wrap">
            {listNames.map((n) => (
              <button
                key={n}
                className={`chip chip--button${state.customLists[n]!.includes(word.id) ? ' chip--on' : ''}`}
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
        </div>

        <div className="row">
          <button
            className="btn btn--danger"
            onClick={() => {
              resetWord(word.id);
              showToast('Progress for this word reset');
            }}
          >
            Reset this word
          </button>
          <span className="spacer" />
          <Link className="btn btn--soft" to={`/word/${Math.max(1, word.id - 1)}`}>
            ← #{Math.max(1, word.id - 1)}
          </Link>
          <Link className="btn btn--soft" to={`/word/${Math.min(600, word.id + 1)}`}>
            #{Math.min(600, word.id + 1)} →
          </Link>
        </div>
      </div>
      {toast}
    </>
  );
}
