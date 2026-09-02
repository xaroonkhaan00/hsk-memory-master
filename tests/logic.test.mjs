import test from 'node:test';
import assert from 'node:assert/strict';
import outfile from './build-bundle.mjs';

const m = await import(outfile);

test('vocabulary is complete and unique', () => {
  assert.equal(m.WORDS.length, 600);
  const ids = m.WORDS.map((w) => w.id);
  assert.equal(new Set(ids).size, 600);
  for (let i = 1; i <= 600; i += 1) assert.ok(ids.includes(i), `missing id ${i}`);
});

test('every record keeps its source fields', () => {
  for (const w of m.WORDS) {
    assert.ok(w.hanzi.trim(), `#${w.id} hanzi`);
    assert.ok(w.pinyin.trim(), `#${w.id} pinyin`);
    assert.ok(w.primaryMeaning.trim(), `#${w.id} meaning`);
    assert.ok(w.senses.some((s) => s.examples.length > 0), `#${w.id} example`);
    for (const s of w.senses) {
      for (const ex of s.examples) {
        assert.ok(ex.en.trim(), `#${w.id} example english`);
        assert.ok(!ex.pinyin.includes('?'), `#${w.id} unresolved example pinyin`);
      }
    }
  }
});

test('every record has enrichment', () => {
  for (const w of m.WORDS) {
    assert.ok(w.story.trim(), `#${w.id} story`);
    assert.ok(w.category, `#${w.id} category`);
    assert.ok(w.room, `#${w.id} room`);
    assert.ok(w.pack, `#${w.id} pack`);
    assert.equal(w.soundHooks.filter((h) => !h.hook).length, 0, `#${w.id} sound hook`);
    assert.equal(w.chars.filter((c) => !c.gloss).length, 0, `#${w.id} char gloss`);
  }
});

test('pinyin syllables align with characters', () => {
  for (const w of m.WORDS) {
    const hanziCount = [...w.hanzi].filter((c) => /[一-鿿]/.test(c)).length;
    assert.equal(w.syllables.length, hanziCount, `#${w.id} ${w.hanzi} ${w.pinyin}`);
  }
});

test('pinyin answers accept tone marks and tone numbers', () => {
  assert.equal(m.accepted('xuéxí', 'xuéxí'), 'exact');
  assert.equal(m.accepted('xue2xi2', 'xuéxí'), 'exact');
  assert.equal(m.accepted(' XUE2 XI2 ', 'xuéxí'), 'exact');
  assert.equal(m.accepted('xuexi', 'xuéxí'), 'toneless');
  assert.equal(m.accepted('xuexo', 'xuéxí'), 'no');
  assert.equal(m.accepted('nǚ’ér', 'nǚ’ér'), 'exact');
  assert.equal(m.accepted('nv3er2', 'nǚ’ér'), 'exact');
});

test('english answers ignore articles, case and punctuation', () => {
  assert.ok(m.englishMatches('  The Library. ', ['library']));
  assert.ok(m.englishMatches('dad', ['father; dad; daddy']));
  assert.ok(!m.englishMatches('mother', ['father; dad; daddy']));
});

test('spaced repetition lengthens on success and collapses on failure', () => {
  const now = Date.now();
  let p = m.emptyProgress(1);
  p = m.scheduleNext(p, 3, now);
  assert.ok(p.interval > 0);
  const first = p.interval;
  p = m.scheduleNext(p, 2, now);
  assert.ok(p.interval > first, 'good answer lengthens the interval');
  const grown = p.interval;
  p = m.scheduleNext(p, 0, now);
  assert.equal(p.interval, 0, 'a wrong answer brings it straight back');
  assert.equal(p.lapses, 1);
  assert.ok(p.due - now < 15 * 60 * 1000, 'and it is due within minutes');
  p = m.scheduleNext(p, 2, now);
  assert.ok(p.interval < grown, 'a lapsed word does not resume its old interval');
});

test('repeated lapses permanently shorten intervals', () => {
  const now = Date.now();
  let clean = m.emptyProgress(1);
  let lapsed = { ...m.emptyProgress(2), lapses: 5, ease: 2.5 };
  for (let i = 0; i < 4; i += 1) {
    clean = m.scheduleNext(clean, 2, now);
    lapsed = m.scheduleNext(lapsed, 2, now);
  }
  assert.ok(lapsed.interval < clean.interval, `${lapsed.interval} < ${clean.interval}`);
});

test('grading rewards speed', () => {
  assert.equal(m.gradeFor(true, 1000), 3);
  assert.equal(m.gradeFor(true, 6000), 2);
  assert.equal(m.gradeFor(true, 20000), 1);
  assert.equal(m.gradeFor(false, 500), 0);
});

test('a slow correct answer scores lower than a fast one', () => {
  const now = Date.now();
  let fast = m.emptyState();
  let slow = m.emptyState();
  for (let i = 0; i < 5; i += 1) {
    fast = m.recordAnswer(fast, { wordId: 1, dimension: 'meaning', correct: true, ms: 900, mode: 't' }, now);
    slow = m.recordAnswer(slow, { wordId: 1, dimension: 'meaning', correct: true, ms: 20000, mode: 't' }, now);
  }
  assert.ok(fast.progress[1].scores.meaning > slow.progress[1].scores.meaning);
});

test('memory fingerprint finds the weak dimension and up-weights it', () => {
  let s = m.emptyState();
  const now = Date.now();
  for (let i = 0; i < 40; i += 1) {
    s = m.recordAnswer(s, { wordId: (i % 20) + 1, dimension: 'meaning', correct: true, ms: 1200, mode: 't' }, now);
    s = m.recordAnswer(s, { wordId: (i % 20) + 1, dimension: 'tone', correct: i % 5 === 0, ms: 3000, mode: 't' }, now);
  }
  const fp = m.fingerprint(s);
  assert.ok(fp.ready);
  assert.equal(fp.weakest[0], 'tone');
  assert.ok(fp.weights.tone > fp.weights.meaning, 'weak dimension is asked more often');
  assert.ok(fp.byDimension.tone.accuracy < 0.4);
  assert.ok(fp.byDimension.meaning.accuracy > 0.9);
});

test('status classification moves a word up as it is learned', () => {
  let s = m.emptyState();
  const now = Date.now();
  assert.equal(m.progressOf(s, 5).status, 'new');
  for (let i = 0; i < 3; i += 1) {
    s = m.recordAnswer(s, { wordId: 5, dimension: 'meaning', correct: true, ms: 1000, mode: 't' }, now);
  }
  assert.notEqual(s.progress[5].status, 'new');
  for (let i = 0; i < 40; i += 1) {
    for (const d of ['character', 'meaning', 'pinyin', 'tone', 'listening', 'usage']) {
      s = m.recordAnswer(s, { wordId: 5, dimension: d, correct: true, ms: 900, mode: 't' }, now);
    }
  }
  assert.ok(['strong', 'mastered'].includes(s.progress[5].status), s.progress[5].status);
});

test('the error engine names the kind of mistake', () => {
  const state = m.emptyState();
  const typing = m.buildItem('typing', 128, { state }); // 学习 xuéxí
  assert.equal(typing.kind, 'type');
  assert.equal(m.judge(typing, 'xuéxí', 900).correct, true);
  // Tone marks are optional by default: the syllables are what is being tested,
  // and a phone keyboard makes typing tones a typing test instead.
  const toneless = m.judge(typing, 'xuexi', 900);
  assert.equal(toneless.correct, true);
  const toneMiss = m.judge(typing, 'xuexi', 900, { lenientPinyin: false });
  assert.equal(toneMiss.correct, false);
  assert.equal(toneMiss.errorKind, 'tone');
  const blank = m.judge(typing, '', 900);
  assert.equal(blank.errorKind, 'forgotten');
  const junk = m.judge(typing, 'zzz', 900);
  assert.equal(junk.errorKind, 'pinyin');
});

test('choosing a known look-alike is reported as a confusion, not a blank wrong', () => {
  const state = m.emptyState();
  // 61 买 buy vs 218 卖 sell are a curated confusion pair.
  const item = {
    key: 'k', wordId: 61, dimension: 'character', kind: 'mcq', mode: 'test',
    promptFace: 'meaning', answerFace: 'hanzi', instruction: '', prompt: 'buy',
    options: [{ key: '61', label: '买', wordId: 61 }, { key: '218', label: '卖', wordId: 218 }],
    answerKey: '61', reveal: '',
  };
  const v = m.judge(item, '218', 1500);
  assert.equal(v.correct, false);
  assert.equal(v.errorKind, 'similar-word');
  assert.equal(v.confusedWith, 218);
});

test('every training mode can build an item for a real word', () => {
  const state = m.emptyState();
  const audioModes = new Set(['listen-meaning', 'listen-hanzi']);
  for (const mode of m.MODES) {
    if (audioModes.has(mode.key)) continue; // no speech synthesis in Node
    let built = 0;
    for (const w of m.WORDS.slice(0, 200)) {
      if (m.buildItem(mode.key, w.id, { state, pool: m.WORDS.slice(0, 60).map((x) => x.id) })) built += 1;
    }
    assert.ok(built > 10, `${mode.key} built only ${built} items`);
  }
});

test('multiple choice always contains exactly one correct option', () => {
  const state = m.emptyState();
  for (const w of m.WORDS.slice(0, 120)) {
    for (const mode of ['hanzi-meaning', 'meaning-hanzi', 'pinyin-hanzi', 'tone']) {
      const item = m.buildItem(mode, w.id, { state });
      if (!item || !item.options) continue;
      const matches = item.options.filter((o) => o.key === item.answerKey);
      assert.equal(matches.length, 1, `${mode} #${w.id} has ${matches.length} correct options`);
      const keys = item.options.map((o) => o.key);
      assert.equal(new Set(keys).size, keys.length, `${mode} #${w.id} has duplicate options`);
      const labels = item.options.map((o) => o.label);
      assert.equal(new Set(labels).size, labels.length, `${mode} #${w.id} has duplicate labels`);
    }
  }
});

test('cloze items always contain a gap and a resolvable answer', () => {
  const state = m.emptyState();
  let made = 0;
  for (const w of m.WORDS) {
    const item = m.buildItem('cloze', w.id, { state });
    if (!item) continue;
    made += 1;
    assert.ok(item.prompt.includes('＿'), `#${w.id} cloze has no gap`);
    assert.ok(item.options.some((o) => o.key === item.answerKey));
  }
  assert.ok(made > 500, `only ${made} cloze items available`);
});

test('daily session adapts its size to the chosen length', () => {
  const state = m.emptyState();
  const short = m.buildDailySession(state, 5, false);
  const long = m.buildDailySession(state, 30, false);
  assert.ok(short.items.length > 0);
  assert.ok(long.items.length > short.items.length);
  assert.ok(long.items.every((i) => i.dimension !== 'listening'), 'no listening without audio');
});

test('cram picks the hardest words first', () => {
  let state = m.emptyState();
  const now = Date.now();
  for (let id = 1; id <= 40; id += 1) {
    for (let i = 0; i < 4; i += 1) {
      state = m.recordAnswer(state, {
        wordId: id, dimension: 'meaning', correct: id > 10, ms: 2000, mode: 't',
      }, now);
    }
  }
  const items = m.buildCram(state, 10, false);
  assert.equal(items.length, 10);
  const ids = new Set(items.map((i) => i.wordId));
  const hardOnes = [...ids].filter((id) => id <= 10).length;
  assert.ok(hardOnes >= 5, `expected the failing words to dominate, got ${[...ids].join(',')}`);
});

test('boss battles sample rather than asking every word', () => {
  const state = m.emptyState();
  const items = m.buildBoss(state, 'boss-600', false);
  assert.equal(items.length, 60);
  assert.ok(new Set(items.map((i) => i.wordId)).size > 30);
});

test('smart stopping triggers only after a bad run', () => {
  assert.equal(m.shouldSlowDown([]), false);
  assert.equal(m.shouldSlowDown(Array(8).fill({ correct: true })), false);
  assert.equal(m.shouldSlowDown(Array(8).fill({ correct: false })), true);
});

test('daily goal shrinks when accuracy drops', () => {
  let good = m.emptyState();
  let bad = m.emptyState();
  const now = Date.now();
  for (let i = 0; i < 40; i += 1) {
    good = m.recordAnswer(good, { wordId: 1, dimension: 'meaning', correct: true, ms: 1000, mode: 't' }, now);
    bad = m.recordAnswer(bad, { wordId: 1, dimension: 'meaning', correct: i % 4 === 0, ms: 1000, mode: 't' }, now);
  }
  assert.ok(m.dailyNewGoal(bad) < m.dailyNewGoal(good));
});

test('one missed day does not break the streak, two do', () => {
  const DAY = 86400000;
  const now = Date.now();
  const withDays = (offsets) => {
    const s = m.emptyState();
    for (const o of offsets) {
      const key = m.dateKey(now - o * DAY);
      s.days[key] = { date: key, reviews: 5, correct: 4, newWords: 0, ms: 1000 };
    }
    return s;
  };
  assert.equal(m.studyStreak(withDays([0, 1, 2]), now), 3);
  assert.equal(m.studyStreak(withDays([0, 1, 3, 4]), now), 4, 'one gap is forgiven');
  assert.equal(m.studyStreak(withDays([0, 1, 4, 5]), now), 2, 'two gaps end it');
});

test('desirable difficulty removes clues as a word gets stronger', () => {
  assert.deepEqual(m.supportsFor('new'), ['hanzi', 'pinyin', 'meaning']);
  assert.deepEqual(m.supportsFor('learning'), ['hanzi', 'pinyin']);
  assert.deepEqual(m.supportsFor('good'), ['hanzi']);
  assert.deepEqual(m.supportsFor('mastered'), []);
});

test('active recall replaces multiple choice as mastery grows', () => {
  let state = m.emptyState();
  assert.equal(m.preferTyping(state, 1), false);
  const now = Date.now();
  for (let i = 0; i < 10; i += 1) {
    state = m.recordAnswer(state, { wordId: 1, dimension: 'pinyin', correct: true, ms: 900, mode: 't' }, now);
    state = m.recordAnswer(state, { wordId: 1, dimension: 'meaning', correct: true, ms: 900, mode: 't' }, now);
    state = m.recordAnswer(state, { wordId: 1, dimension: 'character', correct: true, ms: 900, mode: 't' }, now);
    state = m.recordAnswer(state, { wordId: 1, dimension: 'tone', correct: true, ms: 900, mode: 't' }, now);
    state = m.recordAnswer(state, { wordId: 1, dimension: 'listening', correct: true, ms: 900, mode: 't' }, now);
    state = m.recordAnswer(state, { wordId: 1, dimension: 'usage', correct: true, ms: 900, mode: 't' }, now);
  }
  assert.equal(m.preferTyping(state, 1), true);
});

test('mastered words still come back for review', () => {
  const now = Date.now();
  let p = m.emptyProgress(1);
  for (let i = 0; i < 12; i += 1) p = m.scheduleNext(p, 3, now);
  assert.ok(p.due !== null, 'a mastered word still has a next review date');
  assert.ok(p.interval <= 240, 'intervals are capped so nothing is retired forever');
});

test('data relationships all resolve', () => {
  const ids = new Set(m.WORDS.map((w) => w.id));
  for (const w of m.WORDS) {
    for (const r of w.related) assert.ok(ids.has(r.id), `#${w.id} related ${r.id}`);
    for (const c of w.confusable) assert.ok(ids.has(c), `#${w.id} confusable ${c}`);
  }
  for (const c of m.CONFUSIONS) for (const id of c.words) assert.ok(ids.has(id));
  for (const mw of m.MEASURE_WORDS) if (mw.wordId) assert.ok(ids.has(mw.wordId), mw.mw);
  const packWords = m.PACKS.flatMap((p) => p.words);
  assert.equal(new Set(packWords).size, 600);
  const roomWords = m.ROOMS.flatMap((r) => r.words);
  assert.equal(new Set(roomWords).size, 600);
});

test('the journey covers every room in the palace', () => {
  const rooms = new Set(m.ROOMS.map((r) => r.key));
  for (const step of m.JOURNEY) assert.ok(rooms.has(step.room), step.room);
  assert.equal(m.JOURNEY.length, rooms.size);
});

test('achievements unlock from real state, not from nothing', () => {
  const empty = m.emptyState();
  for (const a of m.ACHIEVEMENTS) assert.equal(a.test(empty), false, a.key);
});

test('character-family questions keep the promise their instruction makes', () => {
  const state = m.emptyState();
  let checked = 0;
  for (const w of m.WORDS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const item = m.buildItem('char-family', w.id, { state });
      if (!item || !item.options) continue;
      checked += 1;
      const claimed = /contains 「(.)」/.exec(item.instruction)?.[1];
      assert.ok(claimed, item.instruction);
      for (const o of item.options) {
        assert.ok(o.label.includes(claimed), `${item.instruction} — but ${o.label} does not`);
      }
    }
  }
  assert.ok(checked > 300, `only checked ${checked} family questions`);
});

test('confusion battles only offer words from the same confusion set', () => {
  const state = m.emptyState();
  let checked = 0;
  for (const set of m.CONFUSIONS) {
    for (const id of set.words) {
      const item = m.buildItem('confusion', id, { state });
      if (!item || !item.options) continue;
      checked += 1;
      const allowed = new Set(m.CONFUSIONS.filter((c) => c.words.includes(id)).flatMap((c) => c.words));
      for (const o of item.options) {
        assert.ok(allowed.has(o.wordId), `${set.title}: ${o.label} is not in any of #${id}'s sets`);
      }
    }
  }
  assert.ok(checked > 100, `only checked ${checked} confusion questions`);
});

test('sound hooks are all distinct, so no two syllables share a cue', () => {
  const labels = new Map();
  for (const s of m.SOUNDS) {
    const label = (s.hook.match(/^"([^"]+)"/) || [])[1] ?? s.hook;
    assert.ok(!labels.has(label), `${s.base} and ${labels.get(label)} share the hook "${label}"`);
    labels.set(label, s.base);
  }
});

test('measure-word examples are all internally consistent', () => {
  for (const mw of m.MEASURE_WORDS) {
    assert.ok(mw.rule.trim(), mw.mw);
    assert.ok(mw.trap.trim(), mw.mw);
    assert.ok(mw.examples.length >= 1, mw.mw);
    for (const ex of mw.examples) {
      assert.ok(ex.zh.includes(mw.mw), `${mw.mw}: example "${ex.zh}" does not contain it`);
      assert.ok(ex.en.trim() && ex.pinyin.trim(), mw.mw);
    }
  }
});

test('packs are near-uniform and cover the levels in order', () => {
  assert.ok(m.PACKS.length >= 28 && m.PACKS.length <= 33, `${m.PACKS.length} packs`);
  for (const p of m.PACKS) {
    assert.ok(p.words.length >= 15 && p.words.length <= 22, `${p.id} has ${p.words.length} words`);
    assert.ok(p.label.trim());
  }
  const levels = m.PACKS.map((p) => p.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'packs run HSK1 → 2 → 3');
});

test('mini dialogues are complete and their targets really appear in them', () => {
  assert.ok(m.DIALOGUES.length >= 15, `${m.DIALOGUES.length} dialogues`);
  const ids = new Set(m.WORDS.map((w) => w.id));
  for (const d of m.DIALOGUES) {
    assert.ok(d.title.trim(), d.id);
    assert.ok(d.lines.length >= 2, d.title);
    assert.ok(d.targets.length >= 3, `${d.title} has only ${d.targets.length} targets`);
    const joined = d.lines.map((l) => l.zh).join('');
    for (const id of d.targets) {
      assert.ok(ids.has(id), `${d.title}: unknown word ${id}`);
      assert.ok(joined.includes(m.getWord(id).plain), `${d.title}: ${m.getWord(id).hanzi} is not in the text`);
    }
    for (const line of d.lines) {
      assert.ok(['A', 'B'].includes(line.speaker), line.speaker);
      assert.ok(line.zh.trim() && line.en.trim() && line.pinyin.trim(), d.title);
      assert.ok(!line.pinyin.includes('?'), `${d.title}: unresolved pinyin "${line.pinyin}"`);
    }
  }
});

test('generated pinyin resolves the erhua suffix and the 一/不 sandhi', () => {
  const all = [
    ...m.WORDS.flatMap((w) => w.senses.flatMap((s) => s.examples)),
    ...m.DIALOGUES.flatMap((d) => d.lines),
  ];
  for (const line of all) {
    const toks = line.tokens;
    for (let i = 0; i < toks.length; i += 1) {
      if (toks[i].z === '儿' && toks[i].p === 'ér' && i > 0 && /[一-鿿]/.test(toks[i - 1].z)) {
        assert.fail(`unresolved erhua in "${line.zh}"`);
      }
    }
    // 不 before a 4th tone becomes bú
    for (let i = 0; i < toks.length; i += 1) {
      if (toks[i].z !== '不' || !toks[i].p) continue;
      const next = toks.slice(i + 1).find((t) => t.p);
      if (!next) continue;
      // Only the FIRST tone mark of the following word matters.
      const firstMark = (next.p.match(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/) || [])[0] ?? '';
      const fourth = 'àèìòùǜ'.includes(firstMark);
      assert.equal(toks[i].p, fourth ? 'bú' : 'bù', `不 sandhi in "${line.zh}"`);
    }
  }
});

test('the measure-word guide covers the core set every learner needs', () => {
  const have = new Set(m.MEASURE_WORDS.map((mw) => mw.mw));
  // 个 first: it is the fallback that makes the whole system usable.
  for (const mw of ['个', '本', '张', '条', '件', '双', '只', '位', '口', '把', '辆', '家']) {
    assert.ok(have.has(mw), `measure-word guide is missing ${mw}`);
  }
  assert.equal(m.MEASURE_WORDS[0].mw, '个', 'the guide should lead with 个');
});
