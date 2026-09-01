# HSK Memory Master

A local-first Mandarin **memory coach** for the 600 vocabulary items in
*New HSK Level 3 Vocabulary (Chinese–English)*.

Not a flashcard app. The point is to stop 600 isolated facts from behaving like
600 isolated facts: every word is wired into a character family, a sound family,
a theme pack, a room in a memory palace, a confusion set and a memory scene —
and then drilled by a scheduler that learns *how you personally forget*.

Everything runs in your browser. No account, no server, no API key, no network
calls at runtime.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Build and preview a production bundle:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test           # 37 unit tests: data integrity, SRS, fingerprint, quiz engine
npm run test:e2e   # headless browser: every screen, every mode, a full Magic 20
                   # pack through all ten stages, and an export/import round
                   # trip. Takes a few minutes — it really does click through
                   # the whole pack.
```

Requires Node 18+. The browser test additionally needs `npx playwright install chromium`
if Chromium is not already present.

---

## The data

### Two layers, never mixed

| Layer | File | What it is |
|---|---|---|
| **Source** | `src/data/hsk3-source.json` | Exactly what the PDF says: number, characters, pinyin, part of speech, meanings, example sentences. Nothing added, nothing reworded. |
| **Enrichment** | `src/data/*.raw.txt` | Everything generated to help you remember: character glosses, sound hooks, memory scenes, themes, palace rooms, confusion rules, the measure-word guide, example translations. |

`scripts/build_data.py` merges the two into `src/data/generated/*.json`, which is
what the app imports. The generated files are committed, so the app builds
without Python.

The UI keeps the layers visually distinct everywhere:

- **Blue “Fact” panels** — what the characters actually mean, what the PDF says.
- **Amber “Memory trick — not historical origin” panels** — invented imagery.

Sound hooks are always labelled *memory sound hook, NOT real pronunciation*, and
sit next to the audio button so the real pronunciation is one tap away.

### Regenerating from the PDF

```bash
pip install pypdfium2
python3 scripts/extract_pdf.py docs/HSK3_VOCABULARY_CHIENG.pdf src/data/hsk3-source.json
npm run data       # rebuilds src/data/generated/*.json
```

The extractor works off the PDF's ruling lines rather than its text stream,
because the text stream alone is wrong in three ways: row 218 wraps its number
across two lines (`21` then `8`), long meanings wrap inside their cell, and
multi-sense rows are divided by half-width rules. Column boundaries come from
the vertical rules, record boundaries from the full-width horizontal rules, and
sense boundaries from the half-width ones.

Re-running it reproduces the committed `hsk3-source.json` byte for byte.

### Validation

`/#/qa` in the app shows 23 live checks. Current state:

```
600 words · ids 1–600 complete · 0 duplicates
0 missing hanzi · 0 missing pinyin · 0 missing meaning · 0 missing example
712 senses · 722 example sentences, all with pinyin and an English translation
619 characters in the words, all glossed (653 in the dictionary, including the
  34 that appear only inside example sentences)
275 syllables, all with a distinct sound hook
31 packs · 73 confusion sets · 42 tone twins · 33 measure words · 20 dialogues
every word in exactly one pack, one palace room and one theme
```

The only genuine gap in the source is **part of speech for 12 fixed phrases**
(不客气, 打电话, 对不起, 没关系, 再见, 打篮球, 好吃, 踢足球, 为什么, 感兴趣,
刮风, 一会儿). The PDF leaves those blank, so the app leaves them blank and says
so, rather than inventing a label.

---

## What the app does

### Memory Fingerprint
Six mastery dimensions are tracked *separately* for every word — character,
meaning, pinyin, tone, listening, usage. After ~30 answers the app knows things
like "you know the meaning 91% of the time but the tones only 43%", and starts
weighting question generation toward the weak dimensions. Self-reported
difficulty from onboarding is only the seed; measured performance overrides it.

### Spaced repetition
SM-2-inspired, with the parts that matter for real forgetting:
- Speed grades the answer. Correct-in-1s and correct-in-20s are not the same.
- A wrong answer brings the word back within minutes, not tomorrow.
- Repeated lapses **permanently** shorten that word's intervals.
- Intervals are capped, so nothing is retired forever.

### Magic 20
Packs of ~20 thematically grouped words, in HSK 1 → 2 → 3 order, each taken
through ten stages: preview, understand, connect, visualise, pronounce,
recognise, recall, use, test, retest mistakes. You cannot page through it —
every stage ends in an active-retrieval gate.

### 20 training modes
Hanzi↔meaning, hanzi↔pinyin, tone challenge, listening→meaning, listening→hanzi,
sentence gap, match pairs, speed round, weak-word rescue, confusion battle,
character family, pinyin family, story recall, reverse recall, typing, rapid
3-second recognition, spot-the-character, disappearing support (five rounds,
one clue removed each round), blur-to-recall.

### Connections, not lists
- **Character hubs** — 206 characters appear in more than one word; each has a
  page listing every word built on it.
- **Sound families** — 275 syllables, plus the groups everyone confuses
  (zh/z, ch/c, sh/s, j/q/x, n/l, -an/-ang, -in/-ing, -en/-eng, u/ü).
- **Confusion battles** — 73 hand-written sets, each with one rule that
  separates them, drawn only from words in this list (再/在, 买/卖, 他/她/它,
  的/得/地, 会/能/可以, 知道/认识, 就/才 …). Sets you keep losing rise to the top.
- **Memory palace** — 14 rooms; every word lives somewhere plausible.
- **Memory journey** — the same rooms in the order of one ordinary day.
- **Measure words** — all 33 in the list, each with what it counts, one easy
  rule, worked examples and the trap people fall into.
- **Tone twins** — 42 sets of words with identical syllables where only the tone
  carries the meaning (买/卖, 十/是, 九/就, 两/辆 …), playable side by side.
- **Mini dialogues** — 20 two-to-four-line conversations at HSK-3 level, built
  from words in the list, with generated pinyin and a recall test on the words
  each one used.

### Your own sentence
Every word has a "My own sentence" box. Elaborating in your own words is one of
the strongest things you can do for recall, and what you write comes back at you
when you get that word wrong. Nothing is generated into this field — it is yours,
and it is never confused with the PDF's own examples.

### The error engine
Never just "wrong". It works out whether you missed the tone but had the
syllables, confused a known look-alike, picked a word sharing a character, or
drew a blank — and files it in the Mistake Notebook with the memory hook.

### Audio
Browser `SpeechSynthesis` only, at 1× and 0.7×, with repeat-3×. If the device
has no Mandarin voice the listening modes are **hidden and labelled unavailable**
rather than played in the wrong language.

### Storage
IndexedDB, with a synchronous localStorage mirror written on page-hide so an
answer is never lost by closing the tab. Export/import as JSON from Settings —
and from the first onboarding screen, so a backup can be restored on a new
device. Reset one word, one pack, statistics only, or everything (with
confirmation).

---

## Project layout

```
docs/HSK3_VOCABULARY_CHIENG.pdf   the source PDF
scripts/extract_pdf.py            PDF  -> src/data/hsk3-source.json   (source layer)
scripts/build_data.py             raw  -> src/data/generated/*.json   (merged layer)
src/data/*.raw.txt                hand-authored enrichment
src/types/                        shared types
src/services/                     pinyin, storage, progress/SRS, quiz, session, tts
src/components/                   QuizRunner and the shared UI kit
src/pages/                        29 screens
tests/                            unit tests + headless browser smoke test
```

## Keyboard and accessibility

`1`–`4` (or `1`–`9`) choose an answer · `Enter` submits a typed answer and moves
to the next question. Every control is a real button, link or input, so tab
order and screen readers work without extra markup; Chinese text is marked
`lang="zh"`; tap targets are 44px or larger except inside the 600-cell heatmap,
where each tile carries a full text label for assistive technology. Animations
are disabled under `prefers-reduced-motion`.

## Licence

The vocabulary list is HSK material reproduced from the supplied PDF for
personal study. The application code is yours to do with as you like.
