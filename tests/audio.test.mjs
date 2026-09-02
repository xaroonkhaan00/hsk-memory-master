/**
 * The speech stack: what may be spoken, how a backend is chosen, and how a
 * failure is reported rather than swallowed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import outfile from './build-bundle.mjs';

const m = await import(outfile);
const repo = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const read = (p) => readFileSync(path.join(repo, p), 'utf8');

/* ------------------------------------------------------------- sanitising */

test('only Chinese is ever handed to a Mandarin voice', () => {
  assert.equal(m.audioText('图书馆'), '图书馆');
  assert.equal(m.audioText('我去图书馆。'), '我去图书馆。');
  assert.equal(m.audioText('túshūguǎn'), '');
  assert.equal(m.audioText('TOO-SHOO-GWAHN'), '');
  assert.equal(m.audioText('library'), '');
  assert.equal(m.audioText('<b>hello</b>'), '');
  assert.equal(m.audioText(''), '');
  assert.equal(m.audioText('Play again'), '');
  assert.equal(m.audioText('图书馆 (library)'), '图书馆 ( )');
  assert.equal(m.isSpeakable('图书馆'), true);
  assert.equal(m.isSpeakable('xuexi'), false);
});

test('every headword survives sanitising unchanged', () => {
  for (const w of m.WORDS) {
    assert.equal(m.audioText(w.plain), w.plain, `#${w.id} would be altered before speaking`);
  }
});

test('speeds stay slower than conversation by default', () => {
  assert.deepEqual(m.SPEED_OPTIONS.map((o) => o.value), [0.65, 0.75, 0.85, 1.0]);
  assert.deepEqual(m.REPEAT_OPTIONS.map((o) => o.value), [1, 2, 3]);
});

/* --------------------------------------------------------- native bridge */

test('the Android project registers a native speech plugin', () => {
  const plugin = read('android/app/src/main/java/com/mfb/learnhsk3/MandarinTtsPlugin.java');
  assert.match(plugin, /@CapacitorPlugin\(name = "MandarinTts"\)/);
  assert.match(plugin, /android\.speech\.tts\.TextToSpeech/);
  assert.match(plugin, /UtteranceProgressListener/);
  // Completion must come from the engine, not from a timer.
  assert.match(plugin, /public void onDone\(String utteranceId\)/);
  assert.match(plugin, /public void onError\(String utteranceId, int errorCode\)/);
  assert.match(plugin, /Locale\.SIMPLIFIED_CHINESE/);
  for (const method of ['initialize', 'status', 'voices', 'speak', 'stop']) {
    assert.match(plugin, new RegExp(`public void ${method}\\(PluginCall call\\)`), `missing ${method}`);
  }
  // Pausing the app must not leave a promise hanging forever.
  assert.match(plugin, /handleOnPause/);
});

test('the plugin is registered before the bridge starts', () => {
  const main = read('android/app/src/main/java/com/mfb/learnhsk3/MainActivity.java');
  const registerAt = main.indexOf('registerPlugin(MandarinTtsPlugin.class)');
  const superAt = main.indexOf('super.onCreate');
  assert.ok(registerAt > 0, 'plugin is never registered');
  assert.ok(registerAt < superAt, 'plugin must be registered before super.onCreate');
});

test('the manifest asks to see the speech engine', () => {
  // Without this Android 11+ hides the TTS service, which is exactly how the
  // app went silent on a real phone while every browser test passed.
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<queries>/);
  assert.match(manifest, /android\.intent\.action\.TTS_SERVICE/);
});

test('the web layer talks to the plugin by the same name', () => {
  const speech = read('src/services/speech.ts');
  assert.match(speech, /registerPlugin<MandarinTtsPlugin>\('MandarinTts'\)/);
  // Native on a native platform, Web Speech otherwise.
  assert.match(speech, /if \(isNative\(\)\)/);
  assert.match(speech, /speechSynthesis/);
});

test('nothing outside the speech module talks to speechSynthesis directly', () => {
  const files = [
    'src/services/audio.ts',
    'src/components/scene.tsx',
    'src/components/ui.tsx',
    'src/components/QuizRunner.tsx',
    'src/pages/Story.tsx',
    'src/pages/Cinema.tsx',
    'src/pages/Exam.tsx',
    'src/pages/AudioSettings.tsx',
  ];
  for (const f of files) {
    const text = read(f);
    assert.ok(!/speechSynthesis/.test(text), `${f} reaches past the audio service`);
    assert.ok(!/SpeechSynthesisUtterance/.test(text), `${f} builds its own utterance`);
  }
});

test('playback waits for completion instead of guessing with a timer', () => {
  const scene = read('src/components/scene.tsx');
  assert.match(scene, /await speakChinese\(/);
  // A story must not advance on an invented duration.
  assert.ok(
    !/setTimeout\([^)]*next|setTimeout\(\s*\(\)\s*=>\s*playFrom/.test(scene),
    'scene playback still advances on a timer',
  );
  const audio = read('src/services/audio.ts');
  assert.match(audio, /export async function speakChinese/);
  assert.match(audio, /Promise<SpeakResult>/);
});

test('a failure is reported, never reported as success', () => {
  const speech = read('src/services/speech.ts');
  assert.match(speech, /lastSpeechReport/);
  assert.match(speech, /record\(clean, 'failed'/);
  const settings = read('src/pages/AudioSettings.tsx');
  assert.match(settings, /Test Chinese audio/);
  assert.match(settings, /你好，我正在学习汉语。/);
  assert.match(settings, /Last error/);
});

test('the diagnostics screen reports the things a silent phone needs', () => {
  const s = read('src/pages/AudioSettings.tsx');
  for (const label of [
    'Platform',
    'Backend',
    'Engine started',
    'Mandarin available',
    'Locale requested',
    'Selected voice',
    'Speech rate',
    'Last text',
    'Last result',
    'Last error',
  ]) {
    assert.ok(s.includes(`<span>${label}</span>`), `diagnostics is missing "${label}"`);
  }
});

/* ------------------------------------------------------------ pinyin input */

test('typed pinyin never requires tone marks', () => {
  assert.equal(m.accepted('xuéxí', 'xuéxí'), 'exact');
  assert.equal(m.accepted('xue2xi2', 'xuéxí'), 'exact');
  assert.equal(m.accepted('xuexi', 'xuéxí'), 'toneless');
  assert.equal(m.accepted('XUE XI', 'xuéxí'), 'toneless');
  assert.equal(m.accepted('xuexo', 'xuéxí'), 'no');
});

test('a toneless answer is marked correct by default, and wrong only if asked', () => {
  const item = { kind: 'type', answerFace: 'pinyin', answerKey: 'xuéxí' };
  const lenient = m.judge(item, 'xuexi', 1200);
  assert.equal(lenient.correct, true);
  assert.match(lenient.note ?? '', /xuéxí/, 'the tone-marked form should be shown back');

  const numbers = m.judge(item, 'xue2xi2', 1200);
  assert.equal(numbers.correct, true);

  const strict = m.judge(item, 'xuexi', 1200, { lenientPinyin: false });
  assert.equal(strict.correct, false);
  assert.equal(strict.errorKind, 'tone');

  const wrong = m.judge(item, 'xuexo', 1200);
  assert.equal(wrong.correct, false);
});

test('pinyin is never called English in the interface', () => {
  for (const f of ['src/pages/Settings.tsx', 'src/components/QuizRunner.tsx', 'src/services/quiz.ts']) {
    const text = read(f);
    assert.ok(!/English answer/i.test(text), `${f} calls pinyin an English answer`);
  }
});
