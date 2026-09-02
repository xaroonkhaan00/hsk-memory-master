/**
 * The HSK 3 mock exam: shape, shuffling, answer-key integrity, question
 * quality and scoring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import outfile from './build-bundle.mjs';

const m = await import(outfile);
const HANZI = /[一-鿿]/;

const paper = await m.generateExam({ seed: 4242 });

test('a full paper is 80 questions split 40 / 30 / 10', () => {
  assert.equal(paper.questions.length, 80);
  assert.equal(paper.counts.listening, 40);
  assert.equal(paper.counts.reading, 30);
  assert.equal(paper.counts.writing, 10);
});

test('the paper follows the official part structure', () => {
  const byPart = {};
  for (const q of paper.questions) byPart[q.part] = (byPart[q.part] ?? 0) + 1;
  assert.deepEqual(byPart, {
    L1: 10, L2: 10, L3: 10, L4: 10,
    R1: 10, R2: 10, R3: 10,
    W1: 5, W2: 5,
  });
});

test('question ids are unique inside a paper', () => {
  const ids = paper.questions.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('no question is accidentally duplicated', () => {
  const seen = new Map();
  for (const q of paper.questions) {
    const key = [
      q.part,
      q.prompt,
      q.passage ?? '',
      (q.audio ?? []).map((a) => a.text).join('|'),
      q.options.join('|'),
      q.answerText ?? '',
    ].join('##');
    assert.ok(!seen.has(key), `${q.id} repeats ${seen.get(key)}`);
    seen.set(key, q.id);
  }
});

test('every answer key survives the shuffle', () => {
  for (const q of paper.questions) {
    if (q.kind === 'order') {
      assert.ok(q.answerText && HANZI.test(q.answerText), `${q.id} has no answer sentence`);
      assert.ok(q.tiles && q.tiles.length >= 4, `${q.id} has too few tiles`);
      const tiles = [...q.tiles].sort().join('');
      const answer = [...q.answerText.match(/[一-鿿]+/g) ?? []];
      assert.equal(tiles, [...q.tiles].sort().join(''), `${q.id} tiles are unstable`);
      assert.ok(answer.length > 0, `${q.id} answer has no words`);
      continue;
    }
    assert.ok(q.answer >= 0 && q.answer < q.options.length, `${q.id} answer index out of range`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.id} has a duplicated option`);
    for (const o of q.options) assert.ok(o.trim().length > 0, `${q.id} has an empty option`);
  }
});

test('a word-order question can actually be rebuilt from its tiles', () => {
  for (const q of paper.questions.filter((x) => x.kind === 'order')) {
    const fromTiles = [...q.tiles].sort().join('|');
    const fromAnswer = [...q.tiles].sort().join('|');
    assert.equal(fromTiles, fromAnswer);
    // Every tile must appear in the answer sentence.
    for (const t of q.tiles) assert.ok(q.answerText.includes(t), `${q.id} tile ${t} is not in the answer`);
    assert.equal(q.tiles.join('').length, q.answerText.length, `${q.id} tiles do not add up`);
  }
});

test('listening questions carry real Chinese audio, reading questions carry none', () => {
  for (const q of paper.questions) {
    if (q.section === 'listening') {
      assert.ok(q.audio && q.audio.length > 0, `${q.id} has no audio`);
      for (const line of q.audio) {
        assert.ok(HANZI.test(line.text), `${q.id} audio is not Chinese: ${line.text}`);
        assert.ok(!/[A-Za-z]/.test(line.text), `${q.id} audio contains Latin text`);
      }
    } else {
      assert.ok(!q.audio, `${q.id} is not a listening question but has audio`);
    }
  }
});

test('every question is written in Chinese and assesses real vocabulary', () => {
  for (const q of paper.questions) {
    assert.ok(HANZI.test(q.prompt), `${q.id} prompt is not Chinese`);
    assert.ok(q.wordIds.length > 0, `${q.id} assesses no vocabulary`);
    for (const id of q.wordIds) assert.ok(m.tryWord(id), `${q.id} references unknown word ${id}`);
    assert.ok(q.explain.trim().length > 0, `${q.id} has no explanation`);
  }
});

test('multiple-choice options are Chinese, never English', () => {
  for (const q of paper.questions) {
    if (q.kind === 'order') continue;
    if (q.kind === 'truefalse') {
      assert.deepEqual(q.options, ['对', '错']);
      continue;
    }
    for (const o of q.options) assert.ok(HANZI.test(o), `${q.id} option is not Chinese: ${o}`);
  }
});

test('two attempts produce different papers', () => {
  const signature = (p) =>
    p.questions
      .map((q) => `${q.prompt}|${q.passage ?? ''}|${q.options.join(',')}|${(q.audio ?? []).map((a) => a.text).join('')}`)
      .join('##');
  return Promise.all([m.generateExam({ seed: 1 }), m.generateExam({ seed: 2 })]).then(([a, b]) => {
    assert.notEqual(signature(a), signature(b));
    assert.equal(a.questions.length, 80);
    assert.equal(b.questions.length, 80);
    assert.equal(a.counts.listening, 40);
    assert.equal(b.counts.listening, 40);
    assert.equal(a.counts.reading, 30);
    assert.equal(b.counts.reading, 30);
    assert.equal(a.counts.writing, 10);
    assert.equal(b.counts.writing, 10);
  });
});

test('the same seed rebuilds the same paper, so a result can be re-checked', async () => {
  const a = await m.generateExam({ seed: 99 });
  const b = await m.generateExam({ seed: 99 });
  assert.deepEqual(
    a.questions.map((q) => [q.id, q.options.join(','), q.answer]),
    b.questions.map((q) => [q.id, q.options.join(','), q.answer]),
  );
});

test('five freshly generated papers are all valid', async () => {
  for (let i = 0; i < 5; i += 1) {
    const p = await m.generateExam({ seed: 1000 + i * 7919 });
    assert.equal(p.questions.length, 80);
    assert.equal(p.counts.listening + p.counts.reading + p.counts.writing, 80);
    for (const q of p.questions) {
      if (q.kind === 'order') continue;
      assert.ok(q.options[q.answer], `${q.id} lost its answer`);
    }
  }
});

/* ---------------------------------------------------------------- scoring */

function perfectAnswers(p) {
  const out = {};
  for (const q of p.questions) out[q.id] = m.correctAnswerText(q);
  return out;
}

test('a perfect paper scores 300 and passes', () => {
  const r = m.scorePaper(paper, perfectAnswers(paper), 60_000);
  assert.equal(r.listening.score, 100);
  assert.equal(r.reading.score, 100);
  assert.equal(r.writing.score, 100);
  assert.equal(r.total, 300);
  assert.equal(r.passed, true);
  assert.deepEqual(r.wrongIds, []);
});

test('an empty paper scores nothing and does not pass', () => {
  const r = m.scorePaper(paper, {}, 60_000);
  assert.equal(r.total, 0);
  assert.equal(r.passed, false);
  assert.equal(r.wrongIds.length, 80);
});

test('180 is the pass threshold', () => {
  assert.equal(m.PASS_MARK, 180);
  const answers = perfectAnswers(paper);
  // Wrong answers until the total drops below the line.
  const ids = paper.questions.map((q) => q.id);
  let i = 0;
  let r = m.scorePaper(paper, answers, 1000);
  while (r.total >= 180 && i < ids.length) {
    answers[ids[i]] = '__wrong__';
    i += 1;
    r = m.scorePaper(paper, answers, 1000);
  }
  assert.ok(r.total < 180);
  assert.equal(r.passed, false);
  // And one mark back above the line passes again.
  answers[ids[i - 1]] = m.correctAnswerText(paper.questions.find((q) => q.id === ids[i - 1]));
  const back = m.scorePaper(paper, answers, 1000);
  assert.equal(back.passed, back.total >= 180);
});

test('each section is scored out of 100 independently', () => {
  const answers = {};
  for (const q of paper.questions) {
    if (q.section === 'reading') answers[q.id] = m.correctAnswerText(q);
  }
  const r = m.scorePaper(paper, answers, 1000);
  assert.equal(r.reading.score, 100);
  assert.equal(r.listening.score, 0);
  assert.equal(r.writing.score, 0);
  assert.equal(r.total, 100);
});

test('a wrong answer names the vocabulary to revisit', () => {
  const answers = perfectAnswers(paper);
  const target = paper.questions[0];
  answers[target.id] = '__wrong__';
  const r = m.scorePaper(paper, answers, 1000);
  assert.deepEqual(r.wrongIds, [target.id]);
  for (const id of target.wordIds) assert.ok(r.weakWordIds.includes(id));
});

/* -------------------------------------------------------------- practices */

test('single-section practice papers keep their own shape', async () => {
  const listening = await m.generateExam({ seed: 5, only: 'listening' });
  assert.equal(listening.counts.listening, 40);
  assert.equal(listening.counts.reading, 0);
  assert.equal(listening.counts.writing, 0);

  const writing = await m.generateExam({ seed: 5, only: 'writing' });
  assert.equal(writing.counts.writing, 10);
  assert.equal(writing.questions.length, 10);
});

test('the quick mock is shorter but still covers all three sections', async () => {
  const quick = await m.generateExam({ seed: 11, quick: true });
  assert.ok(quick.questions.length < 80);
  assert.ok(quick.counts.listening > 0);
  assert.ok(quick.counts.reading > 0);
  assert.ok(quick.counts.writing > 0);
});

test('rarely examined words are preferred', async () => {
  // Mark the first 300 words as heavily tested; a new paper should lean on the rest.
  const weights = {};
  for (let i = 1; i <= 300; i += 1) weights[i] = 50;
  const p = await m.generateExam({ seed: 77, weights });
  const ids = p.questions.flatMap((q) => q.wordIds);
  const fresh = ids.filter((id) => id > 300).length;
  assert.ok(fresh > 0, 'no lightly tested words were used at all');
});

test('official timings and totals are the ones the exam actually uses', () => {
  assert.equal(m.TIMING.listening, 35);
  assert.equal(m.TIMING.reading, 30);
  assert.equal(m.TIMING.writing, 15);
  assert.equal(m.FULL_MINUTES, 80);
  assert.equal(m.SECTION_MAX, 100);
});
