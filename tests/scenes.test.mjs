/**
 * Story Mode and Conversation Cinema: coverage, content quality, and the rule
 * that only real Chinese ever reaches a Mandarin voice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import outfile from './build-bundle.mjs';

const m = await import(outfile);
const stories = [...(await m.loadStories()).values()];
const conversations = [...(await m.loadConversations()).values()];
const HANZI = /[一-鿿]/;

test('Story Mode teaches every one of the 600 words', () => {
  const covered = new Set(stories.flatMap((s) => s.targets));
  const missing = m.WORDS.filter((w) => !covered.has(w.id)).map((w) => w.id);
  assert.deepEqual(missing, [], `words missing from every story: ${missing.join(', ')}`);
  assert.equal(covered.size, 600);
  assert.equal(m.META.storyCoverage, 600);
  assert.deepEqual(m.META.storyMissing, []);
});

test('Conversation Cinema teaches every one of the 600 words', () => {
  const covered = new Set(conversations.flatMap((s) => s.targets));
  const missing = m.WORDS.filter((w) => !covered.has(w.id)).map((w) => w.id);
  assert.deepEqual(missing, [], `words missing from every episode: ${missing.join(', ')}`);
  assert.equal(covered.size, 600);
  assert.equal(m.META.conversationCoverage, 600);
  assert.deepEqual(m.META.conversationMissing, []);
});

test('there is real content, not a handful of samples', () => {
  assert.ok(stories.length >= 30, `only ${stories.length} stories`);
  assert.ok(conversations.length >= 30, `only ${conversations.length} episodes`);
  for (const s of stories) assert.ok(s.lines.length >= 6, `${s.id} is too short`);
  for (const c of conversations) assert.ok(c.lines.length >= 8, `${c.id} is too short`);
});

test('every scene line is complete and readable', () => {
  for (const s of [...stories, ...conversations]) {
    assert.ok(s.title.trim(), `${s.id} title`);
    assert.ok(s.topic.trim(), `${s.id} topic`);
    assert.ok(s.targets.length > 0, `${s.id} teaches nothing`);
    for (const [i, l] of s.lines.entries()) {
      assert.ok(HANZI.test(l.zh), `${s.id} line ${i} has no Chinese`);
      assert.ok(l.en.trim(), `${s.id} line ${i} has no English`);
      assert.ok(!HANZI.test(l.en), `${s.id} line ${i} leaks Chinese into the English caption`);
      assert.ok(!l.pinyin.includes('?'), `${s.id} line ${i} has unresolved pinyin`);
      assert.ok(l.tokens.length > 0, `${s.id} line ${i} has no tokens`);
    }
  }
});

test('conversation lines always name which of the two speakers is talking', () => {
  for (const c of conversations) {
    for (const [i, l] of c.lines.entries()) {
      assert.ok(l.speaker === 'A' || l.speaker === 'B', `${c.id} line ${i} speaker ${l.speaker}`);
    }
    const who = new Set(c.lines.map((l) => l.speaker));
    assert.equal(who.size, 2, `${c.id} only has one speaker`);
  }
});

test('a scene target really appears in that scene, as its own word', () => {
  for (const s of [...stories, ...conversations]) {
    const spoken = new Set(s.lines.flatMap((l) => l.tokens.map((t) => t.z)));
    for (const id of s.targets) {
      const w = m.getWord(id);
      for (const form of w.matchForms) {
        assert.ok(spoken.has(form), `${s.id} claims #${id} ${w.hanzi} but never segments ${form}`);
      }
    }
  }
});

test('tappable words in a scene resolve to a real entry', () => {
  for (const s of [...stories, ...conversations]) {
    for (const l of s.lines) {
      for (const t of l.tokens) {
        if (t.w === undefined) continue;
        const w = m.tryWord(t.w);
        assert.ok(w, `${s.id} token ${t.z} points at missing word ${t.w}`);
        // A split frame word (因为……所以……) is tapped through either half.
        assert.ok(
          w.plain === t.z || w.matchForms.includes(t.z),
          `${s.id} token ${t.z} is linked to ${w.plain}`,
        );
      }
    }
  }
});

test('every word can be looked up in the story and conversation it appears in', () => {
  for (const w of m.WORDS) {
    assert.ok(m.storiesWith(w.id).length > 0, `#${w.id} has no story link`);
    assert.ok(m.conversationsWith(w.id).length > 0, `#${w.id} has no conversation link`);
  }
});

test('the scene index matches the scene text it stands in for', () => {
  const check = (index, full) => {
    assert.equal(index.length, full.length);
    for (const ref of index) {
      const scene = full.find((s) => s.id === ref.id);
      assert.ok(scene, `index lists unknown scene ${ref.id}`);
      assert.equal(ref.title, scene.title);
      assert.equal(ref.lines, scene.lines.length);
      assert.equal(ref.words, scene.targets.length);
      assert.equal(ref.first, scene.lines[0].zh);
    }
  };
  check(m.STORY_INDEX, stories);
  check(m.CONVERSATION_INDEX, conversations);
});

/* ------------------------------------------------------------------ audio */

test('only Chinese is ever sent to a Mandarin voice', () => {
  assert.equal(m.audioText('图书馆'), '图书馆');
  assert.equal(m.audioText('我去图书馆。'), '我去图书馆。');
  // pinyin, mnemonic hooks and English never reach the engine
  assert.equal(m.audioText('túshūguǎn'), '');
  assert.equal(m.audioText('TOO-SHOO-GWAHN'), '');
  assert.equal(m.audioText('library'), '');
  assert.equal(m.audioText(''), '');
  assert.equal(m.audioText('<b>hello</b>'), '');
  // a mixed string keeps only the Chinese half
  assert.equal(m.audioText('图书馆 (library)'), '图书馆 ( )');
  assert.equal(m.isSpeakable('图书馆'), true);
  assert.equal(m.isSpeakable('library'), false);
});

test('every headword and every scene line is speakable as written', () => {
  for (const w of m.WORDS) {
    assert.ok(m.isSpeakable(w.plain), `#${w.id} ${w.hanzi} is not speakable`);
    assert.equal(m.audioText(w.plain), w.plain, `#${w.id} would be altered before speaking`);
  }
  for (const s of [...stories, ...conversations]) {
    for (const l of s.lines) {
      assert.ok(m.isSpeakable(l.zh), `${s.id} line is not speakable`);
    }
  }
});

test('speaking speeds stay slower than natural conversation by default', () => {
  const values = m.SPEED_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, [0.65, 0.75, 0.85, 1.0]);
  assert.deepEqual(m.REPEAT_OPTIONS.map((o) => o.value), [1, 2, 3]);
});
