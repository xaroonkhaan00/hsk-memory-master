import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';

const PORT = 4318;
const BASE = `http://localhost:${PORT}`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
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
check('onboarding shows', await page.getByText('HSK Memory Master').first().isVisible());
await page.getByRole('button', { name: 'Get started' }).click();
await page.getByText('10 minutes').click();
await page.getByRole('button', { name: 'Next' }).click();
await page.getByText('Tones', { exact: true }).click();
await page.getByRole('button', { name: 'Start learning' }).click();
await page.waitForTimeout(500);
check('home after onboarding', await page.getByText('HSK Memory System').first().isVisible());

// ---- routes render
const routes = [
  ['/#/', 'HSK Memory System'],
  ['/#/map', 'The 600-word map'],
  ['/#/browse', 'All 600 words'],
  ['/#/games', 'Training modes'],
  ['/#/dashboard', 'Progress dashboard'],
  ['/#/heatmap', '600-word heatmap'],
  ['/#/notebook', 'My mistake notebook'],
  ['/#/measure-words', 'Measure words'],
  ['/#/palace', 'Memory palace'],
  ['/#/journey', 'Memory journey'],
  ['/#/families', 'Families'],
  ['/#/confusion', 'Confusion battles'],
  ['/#/tone', 'Tone trainer'],
  ['/#/pinyin', 'Pinyin trainer'],
  ['/#/story', 'Story chain'],
  ['/#/dialogues', 'Mini dialogues'],
  ['/#/boss', 'Boss battles'],
  ['/#/cram', 'Cram mode'],
  ['/#/achievements', 'Achievements'],
  ['/#/lists', 'Lists'],
  ['/#/settings', 'Settings'],
  ['/#/qa', 'Data validation'],
  ['/#/word/1', '爱'],
  ['/#/word/300', '左边'],
  ['/#/word/600', '作用'],
  ['/#/learn/pack-01', 'Pack 1'],
  ['/#/families/char/%E5%AD%A6', 'Character hub'],
  ['/#/today', "Today's session"],
];
for (const [route, needle] of routes) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const body = await page.locator('body').innerText();
  check(`route ${route}`, body.includes(needle), `(missing "${needle}")`);
}

// ---- QA page all green
await page.goto(BASE + '/#/qa', { waitUntil: 'networkidle' });
const qaText = await page.locator('body').innerText();
check('QA page all checks pass', qaText.includes('All checks pass'), qaText.slice(0, 400));

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
check('settings shows backup', (await page.locator('body').innerText()).includes('Export progress'));

// ---- export / import round trip
const dl = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export progress/ }).click(),
]).then(([d]) => d);
const dlPath = await dl.path();
const backup = JSON.parse(await readFile(dlPath, 'utf8'));
check('export produces a readable backup', Object.keys(backup.progress ?? {}).length >= 5,
  `progress keys=${Object.keys(backup.progress ?? {}).length}`);

// wipe, then import it back
await page.getByRole('button', { name: 'Full reset…' }).click();
await page.getByRole('button', { name: 'Yes, erase everything' }).click();
await page.waitForTimeout(700);

// a full reset returns to onboarding, so restore from there
check('full reset returns to onboarding', (await page.locator('body').innerText()).includes('Get started'));
await page.getByRole('button', { name: 'I already have a backup' }).click();
await page.locator('textarea').fill(JSON.stringify(backup));
await page.getByRole('button', { name: 'Import pasted JSON' }).click();
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
    const stage = await page.locator('.topbar__sub').innerText().catch(() => '?');
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

check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

await browser.close();
server.kill();

if (failures.length) {
  console.error('\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`\nAll ${notes.length} smoke checks passed.`);
