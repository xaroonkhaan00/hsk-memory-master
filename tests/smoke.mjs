import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';

const PORT = 4318;
const BASE = `http://localhost:${PORT}`;

// Detached so the whole process group can be killed: `npx` spawns vite as a
// grandchild, and killing only the wrapper leaves the port held.
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGKILL');
  } catch {
    server.kill('SIGKILL');
  }
};
process.on('exit', stopServer);
process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});
server.stdout.on('data', () => {});
server.stderr.on('data', (d) => process.stderr.write(String(d)));

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await sleep(400);
  }
  throw new Error('preview server did not start');
}

const failures = [];
const notes = [];
function check(name, cond, extra = '') {
  const line = cond ? `  ok  ${name}` : `FAIL  ${name} ${extra}`;
  console.log(line);
  if (cond) notes.push(line);
  else failures.push(line);
}

await waitForServer();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  .catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });

// ---- onboarding
check('onboarding shows', await page.getByText('Learn HSK 3').first().isVisible());
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByText('10 minutes').click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByText('Tones', { exact: true }).click();
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForTimeout(500);
check('home after onboarding', await page.getByText('Learn HSK 3').first().isVisible());

// ---- routes render
const routes = [
  ['/#/', 'Learn HSK 3'],
  ['/#/map', 'The 600-word map'],
  ['/#/browse', 'All 600 words'],
  ['/#/games', 'Training modes'],
  ['/#/dashboard', 'Progress'],
  ['/#/heatmap', '600-word heatmap'],
  ['/#/notebook', 'My mistake notebook'],
  ['/#/measure-words', 'Measure words'],
  ['/#/palace', 'Memory palace'],
  ['/#/journey', 'Memory journey'],
  ['/#/families', 'Word families'],
  ['/#/confusion', 'Confusion battles'],
  ['/#/tone', 'Tone trainer'],
  ['/#/pinyin', 'Pinyin trainer'],
  ['/#/story', 'Story chain'],
  ['/#/stories', 'Story Mode'],
  ['/#/stories/s01', 'The first day'],
  ['/#/cinema', 'Conversation Cinema'],
  ['/#/cinema/c01', 'First meeting'],
  ['/#/saved', 'Saved scenes'],
  ['/#/exam', 'Mock exam'],
  ['/#/settings/audio', 'Audio diagnostics'],
  ['/#/about', 'MIAN FAZLI BASIT'],
  ['/#/dialogues', 'Mini dialogues'],
  ['/#/boss', 'Boss battles'],
  ['/#/cram', 'Cram mode'],
  ['/#/achievements', 'Achievements'],
  ['/#/lists', 'Lists'],
  ['/#/settings', 'Settings'],
  ['/#/qa', 'Content check'],
  ['/#/word/1', '爱'],
  ['/#/word/300', '左边'],
  ['/#/word/600', '作用'],
  ['/#/learn/pack-01', 'Pack 1'],
  ['/#/families/char/%E5%AD%A6', 'Character hub'],
  ['/#/today', "Today's session"],
];
for (const [route, needle] of routes) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  // Scene text is fetched on demand, so a screen can paint before its content
  // has arrived. Give it a moment rather than racing the first frame.
  await page
    .waitForFunction((n) => document.body.innerText.includes(n), needle, { timeout: 6000 })
    .catch(() => {});
  const body = await page.locator('body').innerText();
  check(`route ${route}`, body.includes(needle), `(missing "${needle}")`);
}

// ---- QA page all green
await page.goto(BASE + '/#/qa', { waitUntil: 'networkidle' });
const qaText = await page.locator('body').innerText();
check('content check is all green', qaText.includes('All checks pass'), qaText.slice(0, 400));

// ---- games: every mode builds questions
await page.goto(BASE + '/#/games', { waitUntil: 'networkidle' });
const modeLinks = await page.locator('a[href*="#/games/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
for (const href of modeLinks) {
  const key = href.split('/games/')[1];
  await page.goto(`${BASE}/#/games/${key}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const t = await page.locator('body').innerText();
  const startBtn = page.getByRole('button', { name: /^Start · \d+ questions$/ });
  const has = await startBtn.count();
  check(`mode ${key} can build questions`, has > 0, t.slice(0, 200));
}

// ---- answer a real quiz and confirm persistence
await page.goto(BASE + '/#/games/hanzi-meaning?source=unseen', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Start · / }).click();
await page.waitForTimeout(300);
let answeredCount = 0;
const counters = [];
for (let i = 0; i < 6; i += 1) {
  const opts = page.locator('.option');
  if ((await opts.count()) === 0) break;
  const header = await page.locator('.quiz .row.tiny').first().innerText();
  counters.push((header.match(/(\d+)\s*\/\s*\d+/) || [])[1]);
  await opts.first().click();
  answeredCount += 1;
  await page.waitForTimeout(150);
  const nextBtn = page.getByRole('button', { name: /Next|See results/ });
  if (await nextBtn.count()) await nextBtn.first().click();
  await page.waitForTimeout(150);
}
check('answered quiz questions', answeredCount >= 5, `answered ${answeredCount}`);
// Regression: answering must not rebuild the question list and restart the run.
check('quiz advances instead of restarting', counters.join(',') === '1,2,3,4,5,6', `counters=${counters.join(',')}`);

await page.goto(BASE + '/#/dashboard', { waitUntil: 'networkidle' });
const dash = await page.locator('body').innerText();
const loggedBefore = Number((dash.match(/(\d+)\s*\n\s*ANSWERS LOGGED/i) || [])[1] ?? 0);
check('dashboard records answers', loggedBefore >= 5, `logged=${loggedBefore}`);

// reload → progress survives
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.innerText.includes('ANSWERS LOGGED'), null, { timeout: 8000 });
await page.waitForTimeout(400);
const dash2 = await page.locator('body').innerText();
const logged = Number((dash2.match(/(\d+)\s*\n\s*ANSWERS LOGGED/i) || [])[1] ?? 0);
check('progress survives reload', logged >= 5, `logged=${logged} :: ${dash2.slice(0, 300).replace(/\n/g, ' | ')}`);

// ---- typing mode normalisation
await page.goto(BASE + '/#/games/typing?source=all', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Start · / }).click();
await page.waitForTimeout(250);
const promptHanzi = await page.locator('.quiz__prompt .big').innerText();
check('typing prompt shows hanzi', promptHanzi.length > 0);

// ---- search
await page.goto(BASE + '/#/browse', { waitUntil: 'networkidle' });
await page.getByPlaceholder(/Search hanzi/).fill('图书馆');
await page.waitForTimeout(200);
check('search by hanzi', (await page.locator('body').innerText()).includes('library'));
await page.getByPlaceholder(/Search hanzi/).fill('xuexi');
await page.waitForTimeout(200);
check('search by toneless pinyin', (await page.locator('body').innerText()).includes('学习'));
await page.getByPlaceholder(/Search hanzi/).fill('600');
await page.waitForTimeout(200);
check('search by number', (await page.locator('body').innerText()).includes('作用'));

// ---- export
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
check('settings shows backup', (await page.locator('body').innerText()).includes('Export my progress'));

// ---- export / import round trip
const dl = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export my progress/ }).click(),
]).then(([d]) => d);
const dlPath = await dl.path();
const backup = JSON.parse(await readFile(dlPath, 'utf8'));
check('export produces a readable backup', Object.keys(backup.progress ?? {}).length >= 5,
  `progress keys=${Object.keys(backup.progress ?? {}).length}`);

// wipe, then import it back
await page.getByRole('button', { name: 'Erase everything…' }).click();
await page.getByRole('button', { name: 'Yes, erase everything' }).click();
await page.waitForTimeout(700);

// a full reset returns to onboarding, so restore from there
check('full reset returns to onboarding', (await page.locator('body').innerText()).includes('Get started'));
await page.getByRole('button', { name: 'I already have a backup' }).click();
await page.locator('textarea').fill(JSON.stringify(backup));
await page.getByRole('button', { name: 'Import', exact: true }).click();
await page.waitForTimeout(700);
await page.goto(BASE + '/#/dashboard', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.innerText.includes('ANSWERS LOGGED'), null, { timeout: 8000 });
await page.waitForTimeout(300);
const afterImport = await page.locator('body').innerText();
const importedLogged = Number((afterImport.match(/(\d+)\s*\n\s*ANSWERS LOGGED/i) || [])[1] ?? 0);
check('import restores progress', importedLogged >= 5, `logged=${importedLogged}`);

// ---- Magic 20: walk a whole pack through all ten stages
// React swaps the DOM between the probe and the click often enough that a
// strict click would fail on a detached node; a short timeout and a retry on
// the next loop pass is the right shape for a walkthrough.
const click = async (loc) => {
  try {
    await loc.click({ timeout: 4000 });
    return true;
  } catch {
    return false;
  }
};
// Optimised pack walkthrough: one DOM probe per step instead of four locator
// round-trips, so the whole ten-stage run finishes in seconds rather than
// minutes.
await page.goto(BASE + '/#/learn/pack-01', { waitUntil: 'networkidle' });
let steps = 0;
let reachedMap = false;
let stuck = '';
for (; steps < 1200; steps += 1) {
  if (page.url().includes('#/map')) { reachedMap = true; break; }
  const probe = await page.evaluate(() => {
    const vis = (el) => el && !el.hasAttribute('disabled') && el.offsetParent !== null;
    const match = document.querySelector('.match');
    if (match) {
      const cols = match.querySelectorAll('.options');
      const left = [...(cols[0]?.querySelectorAll('.option') ?? [])].filter(vis);
      const right = [...(cols[1]?.querySelectorAll('.option') ?? [])].filter(vis);
      // A solved board still renders, with every tile disabled — fall through
      // to the Next button rather than waiting for tiles that will never
      // become clickable again.
      if (left.length && right.length) return { kind: 'match', left: left.length, right: right.length };
    }
    const input = [...document.querySelectorAll('input[type=text]')].find((el) => el.offsetParent !== null);
    if (input && !input.disabled) return { kind: 'typing' };
    const opts = [...document.querySelectorAll('.option')].filter(vis);
    if (opts.length) return { kind: 'options' };
    const primary = [...document.querySelectorAll('button.btn--primary, a.btn--primary')].filter(vis);
    if (primary.length) return { kind: 'primary' };
    return { kind: 'none', text: document.body.innerText.slice(0, 200) };
  });
  if (steps % 50 === 0) {
    const stage = await page.locator('.appbar__title span').first().innerText().catch(() => '?');
    console.log(`      … walkthrough step ${steps}: ${stage}`);
  }
  if (probe.kind === 'match') {
    // Match-pairs: for each left tile, try right options in order until the
    // pair disappears. Wrong picks stay enabled, so the index must advance.
    const leftLoc = () => page.locator('.match .options').first().locator('.option:not([disabled])');
    const rightLoc = () => page.locator('.match .options').nth(1).locator('.option:not([disabled])');
    const before = await leftLoc().count();
    for (let r = 0; r <= before; r += 1) {
      if (!(await leftLoc().count())) break;
      await click(leftLoc().first());
      const rc = await rightLoc().count();
      if (!rc) break;
      await click(rightLoc().nth(Math.min(r, rc - 1)));
      if ((await leftLoc().count()) < before) break;
    }
  } else if (probe.kind === 'typing') {
    const idk = page.getByRole('button', { name: "I don't know" });
    if (await idk.count()) await click(idk.first());
  } else if (probe.kind === 'options') {
    await click(page.locator('.option:not([disabled])').first());
  } else if (probe.kind === 'primary') {
    await click(page.locator('button.btn--primary:visible, a.btn--primary:visible').first());
  } else {
    stuck = probe.text ?? '';
    break;
  }
  // Let React commit before the next probe, otherwise the loop reads a stale
  // DOM and tries to click a button that is already disabled.
  await page.waitForTimeout(70);
}

check('Magic 20 pack runs all ten stages and returns to the map', reachedMap,
  `stopped after ${steps} steps at ${page.url()} :: ${stuck.replace(/\n/g, ' | ')}`);

// ---- disappearing mode advances through its rounds
await page.goto(BASE + '/#/games/disappearing', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Start · / }).click();
await page.waitForTimeout(250);
check('disappearing mode starts at round 1', (await page.locator('body').innerText()).includes('Round 1'));
for (let i = 0; i < 12; i += 1) {
  const next = page.getByRole('button', { name: /Next \(|Start round 2/ });
  if (!(await next.count())) break;
  await next.first().click();
  await page.waitForTimeout(80);
}
check('disappearing mode reaches round 2', (await page.locator('body').innerText()).includes('Round 2'));


/* ------------------------------------------------------------------ v2 */

// ---- the back control is real, labelled and thumb-sized
await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
await page.goto(BASE + '/#/stories', { waitUntil: 'networkidle' });
{
  const back = page.locator('.backbtn').first();
  check('back control is on the screen', (await back.count()) > 0);
  const box = await back.boundingBox();
  check('back control is big enough to hit', !!box && box.height >= 40 && box.width >= 40,
    `box=${JSON.stringify(box)}`);
  check('back control says Back', (await back.innerText()).trim().toLowerCase().includes('back'));
  check('back control is the first thing in the bar',
    await page.evaluate(() => document.querySelector('.appbar')?.firstElementChild?.classList.contains('backbtn')));
  await back.click();
  await page.waitForTimeout(250);
  check('back returns to the previous screen', page.url().endsWith('#/'), page.url());
}

// ---- Story Mode
await page.goto(BASE + '/#/stories/s01', { waitUntil: 'networkidle' });
await page.waitForSelector('.line', { timeout: 8000 });
{
  const body = await page.locator('body').innerText();
  check('a story shows its Chinese', /[一-鿿]/.test(body));
  check('English starts hidden in a story', body.includes('Show meaning'));
  // The view and difficulty controls live behind one disclosure so the story
  // itself is the first thing on screen.
  check('story offers its reading options', body.includes('Reading options'));
  await page.getByText('Reading options').click();
  await page.waitForTimeout(200);
  const opened = await page.locator('body').innerText();
  check('story offers the four learning views',
    ['Beginner', 'Intermediate', 'Recall', 'Listening'].every((v) => opened.includes(v)));
  check('story offers the three difficulties',
    ['Easy', 'Normal', 'Challenge'].every((v) => opened.includes(v)));

  // reveal one line's English, then check it stays revealed
  await page.getByRole('button', { name: 'Show meaning', exact: true }).first().click();
  await page.waitForTimeout(150);
  const revealed = await page.locator('.line__en').count();
  check('tapping reveals the English for one line', revealed >= 1, `revealed=${revealed}`);

  // pinyin toggle
  const pinyinBefore = await page.locator('.line .tok .p').count();
  await page.getByRole('button', { name: 'Pinyin', exact: true }).first().click();
  await page.waitForTimeout(200);
  const pinyinAfter = await page.locator('.line .tok .p').count();
  check('the pinyin toggle really removes the pinyin', pinyinBefore > 0 && pinyinAfter === 0,
    `before=${pinyinBefore} after=${pinyinAfter}`);
  await page.getByRole('button', { name: 'Pinyin', exact: true }).first().click();
  await page.waitForTimeout(200);
  check('the pinyin toggle puts it back', (await page.locator('.line .tok .p').count()) > 0);

  // tap a target word for its gloss, then tap it away
  const target = page.locator('.tok-btn.is-target').first();
  check('story words are tappable', (await target.count()) > 0);
  await target.click();
  await page.waitForTimeout(200);
  check('tapping a word reveals its pinyin and meaning', (await page.locator('.tok-gloss').count()) === 1);
  await page.locator('.tok-btn.is-open').first().click();
  await page.waitForTimeout(200);
  check('tapping the word again hides the gloss', (await page.locator('.tok-gloss').count()) === 0);

  // English caption toggle from the caption bar
  await page.getByRole('button', { name: 'English', exact: true }).first().click();
  await page.waitForTimeout(250);
  check('turning English on shows every line’s meaning',
    (await page.locator('.line__en').count()) === (await page.locator('.line').count()));
  await page.getByRole('button', { name: 'English', exact: true }).first().click();
  await page.waitForTimeout(250);
  check('turning English off hides them again', (await page.locator('.line__en').count()) === 0);

  // the story check runs and records a score
  await page.getByRole('button', { name: /check me|Check what you remember/ }).click();
  await page.waitForTimeout(300);
  check('a story ends in a check', (await page.locator('.option').count()) > 0);
  for (let i = 0; i < 10; i += 1) {
    const opts = page.locator('.option');
    if (!(await opts.count())) break;
    await opts.first().click();
    await page.waitForTimeout(850);
  }
  check('the story check finishes with a score',
    (await page.locator('body').innerText()).includes('remembered'));
}

// ---- Conversation Cinema
await page.goto(BASE + '/#/cinema/c01', { waitUntil: 'networkidle' });
await page.waitForSelector('.speaker-row', { timeout: 8000 });
{
  const body = await page.locator('body').innerText();
  check('an episode shows two speakers', body.includes('Speaker A') && body.includes('Speaker B'));
  check('an episode shows both sides of the conversation',
    (await page.locator('.speaker-row').count()) >= 8);
  check('the two speakers are drawn differently',
    (await page.locator('.avatar--a').count()) > 0 && (await page.locator('.avatar--b').count()) > 0);
  check('the learning loop is on screen',
    ['Watch', 'Replay', 'Tap words', 'No English', 'No pinyin', 'Audio only', 'Quiz']
      .every((v) => body.includes(v)));

  const pinyinBefore = await page.locator('.line .tok .p').count();
  await page.getByRole('button', { name: 'Pinyin', exact: true }).first().click();
  await page.waitForTimeout(200);
  check('caption toggles work in an episode too',
    pinyinBefore > 0 && (await page.locator('.line .tok .p').count()) === 0);
  await page.getByRole('button', { name: 'Pinyin', exact: true }).first().click();
  await page.waitForTimeout(200);

  // walking the loop to the last stage opens the quiz
  await page.getByRole('button', { name: /Stage 7: Quiz/ }).click();
  await page.waitForTimeout(400);
  check('the last stage of the loop is a quiz', (await page.locator('.option').count()) > 0);
}

// ---- saved scenes
await page.goto(BASE + '/#/stories/s02', { waitUntil: 'networkidle' });
await page.waitForSelector('.line', { timeout: 8000 });
await page.getByRole('button', { name: 'Save this story' }).click();
await page.waitForTimeout(200);
await page.goto(BASE + '/#/saved', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('a saved story appears in Saved scenes',
  (await page.locator('a[href*="#/stories/s02"]').count()) > 0);

// ---- audio settings are remembered between sessions
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
{
  const body = await page.locator('body').innerText();
  // Section headings are uppercased by CSS, and innerText reports what is drawn.
  const settingsText = body.toLowerCase();
  check('settings is grouped into sections',
    [
      'learning',
      'audio & voice',
      'stories & conversations',
      'pinyin',
      'mock exam',
      'appearance',
      'data & backup',
      'accessibility',
      'about',
    ].every((v) => settingsText.includes(v)));
  check('settings keeps a route into the audio screen',
    (await page.locator('a[href*="settings/audio"]').count()) > 0);
  check('settings offers the pinyin typing rule', settingsText.includes('tones optional'));
  check('settings names the app and its creator',
    body.includes('Learn HSK 3') && body.includes('MIAN FAZLI BASIT'));

  // Story Mode and Conversation Cinema now keep separate caption defaults, so
  // there are two "English" switches; the first belongs to Story Mode.
  const englishSwitch = page.getByRole('switch', { name: 'English' }).first();
  check('story and conversation captions are configured separately',
    (await page.getByRole('switch', { name: 'English' }).count()) === 2);
  check('English captions start off',
    (await englishSwitch.getAttribute('aria-checked')) === 'false');

  await page.getByRole('button', { name: 'Challenge' }).click();
  await page.waitForTimeout(200);
  await englishSwitch.click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('story difficulty survives a reload',
    (await page.getByRole('button', { name: 'Challenge' }).getAttribute('aria-pressed')) === 'true');
  check('caption preferences survive a reload',
    (await page.getByRole('switch', { name: 'English' }).first().getAttribute('aria-checked')) ===
      'true');

  // Typed-pinyin leniency is a setting, and it persists too.
  await page.getByRole('button', { name: 'Tones required' }).click();
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('typed-pinyin rule survives a reload',
    (await page.getByRole('button', { name: 'Tones required' }).getAttribute('aria-pressed')) ===
      'true');
  await page.getByRole('button', { name: 'Tones optional' }).click();
  await page.waitForTimeout(200);

  // put the caption default back so later runs start from the documented state
  await page.getByRole('switch', { name: 'English' }).first().click();
  await page.waitForTimeout(250);
}

// ---- the app has no Mandarin voice here, and says so instead of faking one
await page.goto(BASE + '/#/settings', { waitUntil: 'networkidle' });
{
  const body = await page.locator('body').innerText();
  const honest = /no mandarin voice yet|mandarin voice/i.test(body);
  check('audio section is honest about what this device has', honest);
}

// ---- phone widths: nothing overflows, nothing is too small to tap
for (const width of [360, 375, 390, 412, 430]) {
  await page.setViewportSize({ width, height: 800 });
  for (const route of ['/#/', '/#/stories/s01', '/#/cinema/c01', '/#/word/1', '/#/settings', '/#/map']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`no sideways scrolling at ${width}px on ${route}`, overflow <= 1, `overflow=${overflow}px`);
  }
  const small = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.tabbar a, .backbtn, .btn--lg, .btn--block')) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.height < 40) bad.push(`${el.className}:${Math.round(r.height)}`);
    }
    return bad;
  });
  check(`main controls stay thumb-sized at ${width}px`, small.length === 0, small.join(', '));
}
await page.setViewportSize({ width: 390, height: 844 });

// ---- both themes stay readable
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(BASE + '/#/stories/s01', { waitUntil: 'networkidle' });
  await page.waitForSelector('.line', { timeout: 8000 });
  const contrast = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
        const s = Number(v) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const el = document.querySelector('.line__zh');
    const bg = getComputedStyle(document.body).backgroundColor;
    const fg = getComputedStyle(el).color;
    const a = lum(fg);
    const b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  check(`Chinese stays readable in ${theme} mode`, contrast >= 4.5, `contrast=${contrast.toFixed(2)}`);
}
await page.emulateMedia({ colorScheme: 'light' });



/* ------------------------------------------------------------- mock exam */

await page.goto(BASE + '/#/exam', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
{
  const body = await page.locator('body').innerText();
  check('exam hub states the official shape',
    ['80', '40', '30', '10'].every((n) => body.includes(n)) && /listening/i.test(body));
  check('exam hub offers the practice modes',
    /listening practice/i.test(body) && /reading practice/i.test(body) &&
    /writing practice/i.test(body) && /quick mock/i.test(body));
  check('exam hub names the pass mark', body.includes('180'));
}

// A reading paper needs no audio, so it runs end to end in a headless browser.
await page.goto(BASE + '/#/exam/run?mode=reading&practice=1', { waitUntil: 'networkidle' });
await page.waitForSelector('.option', { timeout: 20000 });
{
  const header = await page.locator('.exam-bar__mid').innerText();
  check('exam shows question number and section', /Question 1 \/ 30/.test(header) && /Reading/.test(header));
  check('exam offers a flag control', (await page.getByRole('button', { name: /Flag for review/ }).count()) > 0);
  check('practice mode allows leaving via a clear control',
    (await page.getByRole('button', { name: 'Leave the exam' }).count()) > 0);

  // Answer every question with the first option, then submit.
  let answered = 0;
  for (let i = 0; i < 30; i += 1) {
    const opts = page.locator('.option');
    if (await opts.count()) {
      await opts.first().click();
      answered += 1;
    }
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (await next.count()) await next.first().click();
    else break;
    await page.waitForTimeout(40);
  }
  check('every reading question could be answered', answered === 30, `answered=${answered}`);

  await page.getByRole('button', { name: /Finish and submit/ }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Submit paper', exact: true }).click();
  await page.waitForTimeout(600);
  const result = await page.locator('body').innerText();
  check('the exam produces a score out of 300', result.includes('/ 300'));
  check('the exam reports each section', /listening/i.test(result) && /reading/i.test(result) && /writing/i.test(result));
  check('the exam says pass or not yet', /Pass|Not yet/.test(result));
  check('the exam offers a review', /Review|Nothing missed/i.test(result));
}

// The result is kept.
await page.goto(BASE + '/#/exam', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
check('a finished exam is stored in history',
  (await page.locator('body').innerText()).includes('/300'));

// Two attempts must not be the same paper.
// Enter through the hub the way a learner does. Re-issuing an identical URL
// with goto() is a no-op in the browser, so it would not exercise anything.
// The prompt line is the same for every question in a part, so the signature
// has to look at the material itself.
const paperSignature = async () => {
  await page.goto(BASE + '/#/exam', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Reading practice/ }).click();
  await page.waitForSelector('.option', { timeout: 20000 });
  await page.waitForTimeout(250);
  const passage = await page.locator('.exam-passage').first().innerText().catch(() => '');
  const options = await page.locator('.option__label').allInnerTexts();
  return `${passage}::${options.join('|')}`;
};
const first = await paperSignature();
const second = await paperSignature();
check('each attempt generates a different paper', first !== second, 'two attempts were identical');

// Leaving mid-exam asks first.
await page.goto(BASE + '/#/exam/run?mode=reading&practice=1', { waitUntil: 'networkidle' });
await page.waitForSelector('.option', { timeout: 20000 });
await page.getByRole('button', { name: 'Leave the exam' }).click();
await page.waitForTimeout(200);
check('leaving an exam asks for confirmation',
  (await page.locator('body').innerText()).includes('Leave exam?'));
await page.getByRole('button', { name: 'Stay' }).click();
await page.waitForTimeout(150);
check('staying keeps the paper open', (await page.locator('.option').count()) > 0);

/* --------------------------------------------------------- audio settings */

await page.goto(BASE + '/#/settings/audio', { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
{
  const body = await page.locator('body').innerText();
  check('audio settings offers a real test button', body.includes('Test Chinese audio'));
  check('audio settings shows the speeds', ['0.65', '0.75', '0.85', '1'].every((v) => body.includes(v)));
  await page.getByText('Audio diagnostics').click();
  await page.waitForTimeout(250);
  const diag = await page.locator('body').innerText();
  for (const label of ['Platform', 'Backend', 'Engine started', 'Mandarin available', 'Last result', 'Last error']) {
    check(`diagnostics reports ${label}`, diag.includes(label));
  }
  check('diagnostics does not claim a backend it does not have',
    /Browser speech|Native Android speech|None/.test(diag));
}


check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

await browser.close();
stopServer();

if (failures.length) {
  console.error('\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`\nAll ${notes.length} smoke checks passed.`);
