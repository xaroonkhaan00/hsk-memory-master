/**
 * Capture a few key screens so the layout can be eyeballed without a browser.
 *   node tests/screens.mjs [outdir]
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] ?? 'screens';
const PORT = 4327;
const BASE = `http://localhost:${PORT}`;

await mkdir(OUT, { recursive: true });
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
for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {}
  await sleep(400);
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

async function shoot(theme, pages) {
  const ctx = await browser.newContext({
    viewport: { width: 402, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByText('10 minutes').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Tones', { exact: true }).click();
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForTimeout(400);
  // Give the app some history so the dashboard is not empty.
  await page.goto(BASE + '/#/games/hanzi-meaning?source=unseen', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Start · / }).click();
  for (let i = 0; i < 14; i += 1) {
    const opts = page.locator('.option:not([disabled])');
    if (!(await opts.count())) break;
    await opts.nth(i % 3).click();
    await page.waitForTimeout(80);
    const next = page.getByRole('button', { name: /Next|See results/ });
    if (await next.count()) await next.first().click();
    await page.waitForTimeout(80);
  }
  for (const [name, route] of pages) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${theme}-${name}.png`, fullPage: false });
  }
  await ctx.close();
}

const PAGES = [
  ['home', '/#/'],
  ['word', '/#/word/526'],
  ['stories', '/#/stories'],
  ['story', '/#/stories/s01'],
  ['cinema', '/#/cinema'],
  ['episode', '/#/cinema/c01'],
  ['settings', '/#/settings'],
  ['audio', '/#/settings/audio'],
  ['exam', '/#/exam'],
  ['about', '/#/about'],
  ['map', '/#/map'],
  ['dashboard', '/#/dashboard'],
  ['heatmap', '/#/heatmap'],
  ['measure-words', '/#/measure-words'],
  ['palace', '/#/palace'],
  ['confusion', '/#/confusion'],
  ['tone', '/#/tone'],
  ['dialogues', '/#/dialogues'],
  ['qa', '/#/qa'],
];

await shoot('dark', PAGES);
await shoot('light', [
  ['home', '/#/'],
  ['word', '/#/word/526'],
  ['story', '/#/stories/s01'],
  ['episode', '/#/cinema/c01'],
  ['settings', '/#/settings'],
  ['audio', '/#/settings/audio'],
  ['exam', '/#/exam'],
  ['dashboard', '/#/dashboard'],
]);

await browser.close();
stopServer();
console.log(`screenshots written to ${OUT}/`);
