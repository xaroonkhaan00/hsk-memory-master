import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CHAR_HUBS,
  CONFUSIONS,
  DIALOGUES,
  MEASURE_WORDS,
  META,
  PACKS,
  ROOMS,
  SOUNDS,
  WORDS,
  loadConversations,
  loadStories,
  tryWord,
} from '../data';
import { useStore } from '../store';
import { TopBar } from '../components/ui';
import type { Scene } from '../types';

interface Check {
  label: string;
  pass: boolean;
  detail: string;
}

export default function QA() {
  const { state } = useStore();
  // Scene text is loaded on demand everywhere else, so this page fetches it too
  // rather than forcing it into everyone's first paint.
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all([loadStories(), loadConversations()]).then(([a, b]) => {
      if (live) setScenes([...a.values(), ...b.values()]);
    });
    return () => {
      live = false;
    };
  }, []);

  const checks = useMemo<Check[]>(() => {
    const ids = WORDS.map((w) => w.id);
    const idSet = new Set(ids);
    const missing = [];
    for (let i = 1; i <= 600; i += 1) if (!idSet.has(i)) missing.push(i);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    const noHanzi = WORDS.filter((w) => !w.hanzi.trim()).map((w) => w.id);
    const noPinyin = WORDS.filter((w) => !w.pinyin.trim()).map((w) => w.id);
    const noMeaning = WORDS.filter((w) => !w.primaryMeaning.trim()).map((w) => w.id);
    const noExample = WORDS.filter((w) => !w.senses.some((s) => s.examples.length)).map((w) => w.id);
    const noStory = WORDS.filter((w) => !w.story.trim()).map((w) => w.id);
    const noHook = WORDS.filter((w) => w.soundHooks.some((h) => !h.hook)).map((w) => w.id);
    const noCharGloss = WORDS.filter((w) => w.chars.some((c) => !c.gloss)).map((w) => w.id);
    const syllableMismatch = WORDS.filter(
      (w) => [...w.hanzi].filter((c) => /[一-鿿]/.test(c)).length !== w.syllables.length,
    ).map((w) => w.id);
    const noPack = WORDS.filter((w) => !w.pack).map((w) => w.id);
    const packWords = new Set(PACKS.flatMap((p) => p.words));
    const notInPack = WORDS.filter((w) => !packWords.has(w.id)).map((w) => w.id);
    const roomWords = new Set(ROOMS.flatMap((r) => r.words));
    const notInRoom = WORDS.filter((w) => !roomWords.has(w.id)).map((w) => w.id);
    const brokenConfusion = CONFUSIONS.flatMap((c) => c.words.filter((id) => !tryWord(id)));
    const brokenRelated = WORDS.flatMap((w) => w.related.filter((r) => !tryWord(r.id)).map((r) => r.id));
    const brokenExamplePinyin = WORDS.filter((w) =>
      w.senses.some((s) => s.examples.some((ex) => ex.pinyin.includes('?'))),
    ).map((w) => w.id);
    const emptyEnglish = WORDS.filter((w) =>
      w.senses.some((s) => s.examples.some((ex) => !ex.en.trim())),
    ).map((w) => w.id);
    const orphanChars = CHAR_HUBS.filter((h) => h.words.length === 0).map((h) => h.char);
    const orphanSounds = SOUNDS.filter((s) => !s.hook).map((s) => s.base);
    const badMeasure = MEASURE_WORDS.filter((m) => m.wordId !== 0 && !tryWord(m.wordId)).map((m) => m.mw);
    const badDialogue = DIALOGUES.filter(
      (d) =>
        d.targets.length === 0 ||
        d.targets.some((id) => !tryWord(id)) ||
        d.lines.some((l) => !l.zh.trim() || !l.en.trim() || l.pinyin.includes('?')),
    ).map((d) => d.title);
    const dialogueTargets = DIALOGUES.filter((d) =>
      d.targets.some((id) => !d.lines.some((l) => l.zh.includes(tryWord(id)?.plain ?? '\u0000'))),
    ).map((d) => d.title);

    // Story / conversation coverage is decided by the build's own segmenter and
    // republished here so the claim can be checked rather than trusted.
    const loaded: Scene[] = scenes ?? [];
    const badSceneTargets = loaded.filter((sc) => sc.targets.some((id) => !tryWord(id))).map((sc) => sc.id);
    const emptySceneLines = loaded
      .filter((sc) => sc.lines.some((l) => !/[\u4e00-\u9fff]/.test(l.zh) || !l.en.trim()))
      .map((sc) => sc.id);
    const chineseInEnglish = loaded
      .filter((sc) => sc.lines.some((l) => /[\u4e00-\u9fff]/.test(l.en)))
      .map((sc) => sc.id);
    const brokenScenePinyin = loaded.filter((sc) => sc.lines.some((l) => l.pinyin.includes('?'))).map((sc) => sc.id);
    const wordsWithoutStory = WORDS.filter((w) => w.inStories.length === 0).map((w) => w.id);
    const wordsWithoutConversation = WORDS.filter((w) => w.inConversations.length === 0).map((w) => w.id);

    const list = (arr: (number | string)[]) =>
      arr.length === 0 ? 'none' : arr.slice(0, 25).join(', ') + (arr.length > 25 ? ` … (+${arr.length - 25})` : '');

    return [
      { label: 'Vocabulary count is exactly 600', pass: WORDS.length === 600, detail: `${WORDS.length} records loaded` },
      { label: 'IDs 1–600 all present', pass: missing.length === 0, detail: `missing: ${list(missing)}` },
      { label: 'No duplicate IDs', pass: dupes.length === 0, detail: `duplicates: ${list(dupes)}` },
      { label: 'Every record has Chinese characters', pass: noHanzi.length === 0, detail: `missing: ${list(noHanzi)}` },
      { label: 'Every record has pinyin', pass: noPinyin.length === 0, detail: `missing: ${list(noPinyin)}` },
      { label: 'Every record has an English meaning', pass: noMeaning.length === 0, detail: `missing: ${list(noMeaning)}` },
      { label: 'Every record keeps its example sentence', pass: noExample.length === 0, detail: `missing: ${list(noExample)}` },
      { label: 'Every example has an English translation', pass: emptyEnglish.length === 0, detail: `missing: ${list(emptyEnglish)}` },
      { label: 'Every example sentence has full pinyin', pass: brokenExamplePinyin.length === 0, detail: `unresolved: ${list(brokenExamplePinyin)}` },
      { label: 'Pinyin syllables align 1:1 with characters', pass: syllableMismatch.length === 0, detail: `mismatched: ${list(syllableMismatch)}` },
      { label: 'Every record has a memory scene', pass: noStory.length === 0, detail: `missing: ${list(noStory)}` },
      { label: 'Every syllable has a sound hook', pass: noHook.length === 0, detail: `words affected: ${list(noHook)}` },
      { label: 'Every character has a gloss', pass: noCharGloss.length === 0, detail: `words affected: ${list(noCharGloss)}` },
      { label: 'Every word belongs to a learning pack', pass: noPack.length === 0 && notInPack.length === 0, detail: `unassigned: ${list([...noPack, ...notInPack])}` },
      { label: 'Every word has a memory-palace room', pass: notInRoom.length === 0, detail: `unplaced: ${list(notInRoom)}` },
      { label: 'Confusion sets reference real words', pass: brokenConfusion.length === 0, detail: `broken: ${list(brokenConfusion)}` },
      { label: 'Word-family links reference real words', pass: brokenRelated.length === 0, detail: `broken: ${list(brokenRelated)}` },
      { label: 'Character hubs are non-empty', pass: orphanChars.length === 0, detail: `empty: ${list(orphanChars)}` },
      { label: 'Sound families all have hooks', pass: orphanSounds.length === 0, detail: `missing: ${list(orphanSounds)}` },
      { label: 'Measure-word guide references real words', pass: badMeasure.length === 0, detail: `broken: ${list(badMeasure)}` },
      { label: 'Mini dialogues are complete', pass: badDialogue.length === 0, detail: `broken: ${list(badDialogue)}` },
      { label: 'Dialogue target words really appear in their dialogue', pass: dialogueTargets.length === 0, detail: `mismatched: ${list(dialogueTargets)}` },
      { label: 'Every word appears in at least one story', pass: wordsWithoutStory.length === 0, detail: `${600 - wordsWithoutStory.length}/600 covered · missing: ${list(wordsWithoutStory)}` },
      { label: 'Every word appears in at least one conversation', pass: wordsWithoutConversation.length === 0, detail: `${600 - wordsWithoutConversation.length}/600 covered · missing: ${list(wordsWithoutConversation)}` },
      { label: 'Story and conversation targets are real words', pass: !!scenes && badSceneTargets.length === 0, detail: scenes ? `broken: ${list(badSceneTargets)}` : 'loading scene text…' },
      { label: 'Every scene line has Chinese and an English meaning', pass: !!scenes && emptySceneLines.length === 0, detail: scenes ? `broken: ${list(emptySceneLines)}` : 'loading scene text…' },
      { label: 'No Chinese leaks into an English caption', pass: !!scenes && chineseInEnglish.length === 0, detail: scenes ? `broken: ${list(chineseInEnglish)}` : 'loading scene text…' },
      { label: 'Every scene line has full pinyin', pass: !!scenes && brokenScenePinyin.length === 0, detail: scenes ? `unresolved: ${list(brokenScenePinyin)}` : 'loading scene text…' },
      { label: 'Build reported no warnings', pass: META.warnings.length === 0, detail: META.warnings.slice(0, 5).join(' | ') || 'none' },
    ];
  }, [scenes]);

  const posMissing = META.posAbsentInPdf;
  const failed = checks.filter((c) => !c.pass);

  const samples = [1, 2, 3, 299, 300, 301, 598, 599, 600].map((id) => tryWord(id)).filter((w) => !!w);

  return (
    <>
      <TopBar title="Content check" sub="Everything in the app, verified" back="/dashboard" backLabel="Progress" />
      <div className="page page--wide stack">
        <div className={`card ${failed.length ? '' : ''}`}>
          <div className="row">
            <span style={{ fontSize: '2rem' }}>{failed.length === 0 ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <h2>{failed.length === 0 ? 'All checks pass' : `${failed.length} check(s) need attention`}</h2>
              <p className="small muted">Source: {META.generatedFrom}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Check</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.label}>
                    <td>{c.pass ? '✅' : '❌'}</td>
                    <td>{c.label}</td>
                    <td className="tiny muted">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-title">Known gaps in the source list</div>
        <div className="card stack--sm stack">
          <p className="small">
            These are <b>not</b> errors — the source list itself gives no part of speech for these{' '}
            {posMissing.length} entries (they are fixed phrases). Nothing has been invented to fill
            the gap.
          </p>
          <div className="row row--wrap">
            {posMissing.map((id) => {
              const w = tryWord(id);
              return w ? (
                <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                  #{id} <span className="hanzi">{w.hanzi}</span>
                </Link>
              ) : null;
            })}
          </div>
        </div>

        <div className="section-title">Headwords listed twice</div>
        <div className="card stack--sm stack">
          <p className="small">
            Six headwords appear more than once in the source. Five of them are genuinely separate
            entries (a different reading or a different sense); 长 is simply listed twice. Both
            copies are kept exactly as printed and cross-linked, rather than merged or dropped.
          </p>
          {META.repeatedHeadwords.map((r) => (
            <div className="row row--wrap" key={r.hanzi}>
              <span className="chip chip--accent hanzi">{r.hanzi}</span>
              {r.words.map((id) => {
                const w = tryWord(id);
                return w ? (
                  <Link className="chip chip--button" to={`/word/${id}`} key={id}>
                    #{id} {w.pinyin} — {w.primaryMeaning}
                  </Link>
                ) : null;
              })}
            </div>
          ))}
        </div>

        <div className="section-title">Corpus statistics</div>
        <div className="card grid grid--3">
          {[
            ['Words', META.totalWords],
            ['Senses', META.totalSenses],
            ['Examples', META.totalExamples],
            ['Characters', META.uniqueCharacters],
            ['Syllables', META.uniqueSyllables],
            ['Packs', META.packs],
            ['Confusion sets', META.confusionSets],
            ['Measure words', META.measureWords],
            ['Mini dialogues', META.dialogues],
            ['Stories', META.storyEpisodes],
            ['Conversation episodes', META.conversationEpisodes],
            ['Story coverage', `${META.storyCoverage}/600`],
            ['Conversation coverage', `${META.conversationCoverage}/600`],
            ['Tone twin sets', META.toneTwins],
            ['HSK1 / 2 / 3', `${META.levels['1']} / ${META.levels['2']} / ${META.levels['3']}`],
          ].map(([label, value]) => (
            <div className="stat" key={String(label)}>
              <div className="stat__value mono">{value}</div>
              <div className="stat__label">{label}</div>
            </div>
          ))}
        </div>

        <div className="section-title">Spot check — beginning, middle and end of the list</div>
        <div className="card">
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Word</th>
                  <th>Pinyin</th>
                  <th>POS</th>
                  <th>Meaning</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((w) => (
                  <tr key={w!.id}>
                    <td className="mono">{w!.id}</td>
                    <td className="hanzi" style={{ fontSize: '1.3rem' }}>
                      <Link to={`/word/${w!.id}`}>{w!.hanzi}</Link>
                    </td>
                    <td>{w!.pinyin}</td>
                    <td className="tiny">{w!.pos.join(', ') || <span className="muted">— none listed</span>}</td>
                    <td className="tiny">{w!.senses.map((s) => s.meaning).join(' / ')}</td>
                    <td className="tiny hanzi">
                      {w!.senses.flatMap((s) => s.examples).map((e) => e.zh).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-title">Progress stored on this device</div>
        <div className="card grid grid--3">
          <div className="stat">
            <div className="stat__value mono">{Object.keys(state.progress).length}</div>
            <div className="stat__label">progress records</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{state.attempts.length}</div>
            <div className="stat__label">answers logged</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{Object.keys(state.days).length}</div>
            <div className="stat__label">study days</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{Object.keys(state.customLists).length}</div>
            <div className="stat__label">custom lists</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{state.achievements.length}</div>
            <div className="stat__label">achievements</div>
          </div>
          <div className="stat">
            <div className="stat__value mono">{Object.keys(state.bossScores).length}</div>
            <div className="stat__label">boss results</div>
          </div>
        </div>
      </div>
    </>
  );
}
