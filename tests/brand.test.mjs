/**
 * Branding, learner-facing wording, and the promise that upgrading never
 * throws away someone's progress.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import outfile from './build-bundle.mjs';

const m = await import(outfile);
const root = path.dirname(new URL(import.meta.url).pathname);
const repo = path.dirname(root);
const read = (p) => readFileSync(path.join(repo, p), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(path.join(repo, dir))) {
    const rel = path.join(dir, name);
    if (statSync(path.join(repo, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const screens = walk('src').filter(
  (f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('generated'),
);

/* ---------------------------------------------------------------- naming */

test('the app is called Learn HSK 3, by MFB, for MIAN FAZLI BASIT', () => {
  assert.equal(m.APP_NAME, 'Learn HSK 3');
  assert.equal(m.MONOGRAM, 'MFB');
  assert.equal(m.CREATOR, 'MIAN FAZLI BASIT');
});

test('the browser title and the Android launcher label both say Learn HSK 3', () => {
  assert.match(read('index.html'), /<title>Learn HSK 3<\/title>/);
  const strings = read('android/app/src/main/res/values/strings.xml');
  assert.match(strings, /<string name="app_name">Learn HSK 3<\/string>/);
  assert.match(strings, /<string name="title_activity_main">Learn HSK 3<\/string>/);
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.equal(cap.appName, 'Learn HSK 3');
  assert.equal(cap.appId, 'com.mfb.learnhsk3');
});

test('no old app name survives anywhere a user could see it', () => {
  const banned = [/HSK Memory Master/i, /Mandarin FlowBrain/i, /HSK 600 Vocabulary Memory Coach/i, /HSK Memory System/i];
  const files = [
    'index.html',
    'package.json',
    'capacitor.config.json',
    'android/app/src/main/res/values/strings.xml',
    ...screens,
  ];
  for (const f of files) {
    const text = read(f);
    for (const re of banned) {
      assert.ok(!re.test(text), `${f} still contains ${re}`);
    }
  }
});

test('the monogram is three separate letters, not a merged shape', () => {
  const logo = read('src/brand/Logo.tsx');
  // M, F and B each own a stem, and the horizontal 一 sweep sits under them.
  assert.ok(logo.includes('{/* M'), 'M stroke is missing');
  assert.ok(logo.includes('{/* F'), 'F stroke is missing');
  assert.ok(logo.includes('{/* B'), 'B stroke is missing');
  assert.ok(/aria-label=\{title\}/.test(logo), 'the mark carries an accessible name');
});

test('the launcher icon carries the monogram, never the full name', () => {
  const fg = read('src/brand/mark-foreground.svg');
  assert.ok(!/MIAN|FAZLI|BASIT/i.test(fg), 'the launcher foreground spells out the creator name');
  assert.ok(!/Learn HSK/i.test(fg), 'the launcher foreground spells out the app name');
});

test('the creator credit appears on the map, in settings and on the about page', () => {
  for (const f of ['src/pages/MapPage.tsx', 'src/pages/Settings.tsx', 'src/pages/About.tsx']) {
    assert.match(read(f), /<Credit \/>|CREATOR/, `${f} has no creator credit`);
  }
  assert.match(read('src/brand/Logo.tsx'), /export function Credit/);
});

/* --------------------------------------------------------------- wording */

test('no learner-facing screen talks about PDFs, schemas or databases', () => {
  const banned = [
    /taken from (the )?PDF/i,
    /extracted from (your |the )?PDF/i,
    /source JSON/i,
    /\bschema\b/i,
    /\bdatabase\b/i,
  ];
  for (const f of screens) {
    // Strip comments: the pipeline is allowed to document itself internally.
    const text = read(f)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const re of banned) {
      assert.ok(!re.test(text), `${f} shows technical wording: ${re}`);
    }
  }
});

test('empty states say something friendly rather than printing null', () => {
  const banned = [/>\s*null\s*</, /No records/i, />\s*\[\]\s*</];
  for (const f of screens.filter((f) => f.endsWith('.tsx'))) {
    const text = read(f);
    for (const re of banned) assert.ok(!re.test(text), `${f} renders ${re}`);
  }
});

/* --------------------------------------------------------------- storage */

test('a version 1 backup keeps every scrap of its progress', () => {
  const v1 = {
    version: 1,
    settings: {
      dailyMinutes: 20,
      selfReportedWeakness: 'tone',
      theme: 'dark',
      audioRate: 0.9,
      onboarded: true,
      showPinyinDefault: false,
    },
    progress: {
      7: { id: 7, attempts: 12, correct: 9, streak: 3, interval: 21, starred: true, note: 'mine' },
    },
    attempts: [{ at: 1, wordId: 7, dimension: 'meaning', correct: true, ms: 900, mode: 'mcq' }],
    days: { '2025-01-01': { date: '2025-01-01', reviews: 8, correct: 7, newWords: 2, ms: 60000 } },
    packDone: { 'pack-01': 1735689600000 },
    bossScores: {},
    achievements: [{ key: 'first-word', at: 1 }],
    customLists: { 'Exam tomorrow': [7, 8] },
    confusionLosses: {},
    createdAt: 1,
  };
  const next = m.migrate(structuredClone(v1));

  assert.equal(next.version, 2);
  // nothing the learner earned is lost
  assert.equal(next.progress[7].attempts, 12);
  assert.equal(next.progress[7].correct, 9);
  assert.equal(next.progress[7].interval, 21);
  assert.equal(next.progress[7].starred, true);
  assert.equal(next.progress[7].note, 'mine');
  assert.equal(next.attempts.length, 1);
  assert.deepEqual(next.customLists['Exam tomorrow'], [7, 8]);
  assert.equal(next.achievements.length, 1);
  assert.equal(next.packDone['pack-01'], 1735689600000);
  assert.equal(next.days['2025-01-01'].reviews, 8);
  // preferences are kept, not reset
  assert.equal(next.settings.dailyMinutes, 20);
  assert.equal(next.settings.theme, 'dark');
  assert.equal(next.settings.selfReportedWeakness, 'tone');
  assert.equal(next.settings.onboarded, true);
  // and the new blocks arrive filled in rather than undefined
  assert.equal(typeof next.settings.audio.rate, 'number');
  assert.equal(next.settings.captions.english, false);
  assert.deepEqual(next.stories.completed, []);
  assert.deepEqual(next.saved.lines, []);
  // a progress record missing new fields is completed, not dropped
  assert.equal(typeof next.progress[7].scores.tone, 'number');
  assert.ok(Array.isArray(next.progress[7].errors));
});

test('a version 2 state survives a round trip unchanged', () => {
  const base = m.emptyState();
  base.settings.audio.rate = 0.65;
  base.settings.audio.voiceId = 'zh-CN-test';
  base.settings.captions.pinyin = false;
  base.stories.completed = ['s01'];
  base.saved.lines = ['s01:2'];
  const next = m.migrate(structuredClone(base));
  assert.equal(next.settings.audio.rate, 0.65);
  assert.equal(next.settings.audio.voiceId, 'zh-CN-test');
  assert.equal(next.settings.captions.pinyin, false);
  assert.deepEqual(next.stories.completed, ['s01']);
  assert.deepEqual(next.saved.lines, ['s01:2']);
});

test('audio and caption defaults match what the app promises', () => {
  const s = m.emptyState().settings;
  assert.ok(s.audio.rate >= 0.8 && s.audio.rate <= 0.85, `default rate ${s.audio.rate}`);
  assert.equal(s.audio.repeat, 1);
  assert.equal(s.captions.hanzi, true);
  assert.equal(s.captions.pinyin, true);
  assert.equal(s.captions.english, false, 'English must start hidden');
  assert.equal(s.captions.highlightTargets, true);
});

/* --------------------------------------------------------------- android */

test('the Android project is wired to this web build and this brand', () => {
  const cap = JSON.parse(read('capacitor.config.json'));
  assert.equal(cap.webDir, 'dist');
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.scripts.android.includes('cap sync android'));
  for (const dpi of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const p = `android/app/src/main/res/mipmap-${dpi}/ic_launcher.png`;
    assert.ok(statSync(path.join(repo, p)).size > 0, `${p} is missing`);
  }
  const adaptive = read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml');
  assert.match(adaptive, /ic_launcher_foreground/);
});

test('the page is set up for a phone screen, not a desktop window', () => {
  const html = read('index.html');
  assert.match(html, /width=device-width/);
  assert.match(html, /viewport-fit=cover/);
  const css = read('src/styles/app.css');
  assert.match(css, /safe-area-inset-bottom/, 'the tab bar must clear the system navigation bar');
  assert.match(css, /--tap: 48px/, 'tap targets need a stated minimum');
});
