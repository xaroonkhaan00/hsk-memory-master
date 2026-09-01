/**
 * Generate the Android launcher icons and splash screens from the MFB mark.
 *   node scripts/make-icons.mjs
 * Re-run after changing public/favicon.svg or src/brand/mark-foreground.svg.
 */
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const RES = 'android/app/src/main/res';
const BRAND_BG = '#5b6bff';
const SPLASH_BG = { r: 14, g: 16, b: 23, alpha: 1 };

const LAUNCHER = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const SPLASH = {
  'port-mdpi': [320, 480], 'port-hdpi': [480, 800], 'port-xhdpi': [720, 1280],
  'port-xxhdpi': [960, 1600], 'port-xxxhdpi': [1280, 1920],
  'land-mdpi': [480, 320], 'land-hdpi': [800, 480], 'land-xhdpi': [1280, 720],
  'land-xxhdpi': [1600, 960], 'land-xxxhdpi': [1920, 1280],
};

const roundel = await readFile('public/favicon.svg');
const foreground = await readFile('src/brand/mark-foreground.svg');

async function out(dir, name, buf) {
  await mkdir(path.join(RES, dir), { recursive: true });
  await writeFile(path.join(RES, dir, name), buf);
}

for (const [density, size] of Object.entries(LAUNCHER)) {
  const png = await sharp(roundel, { density: 512 }).resize(size, size).png().toBuffer();
  await out(`mipmap-${density}`, 'ic_launcher.png', png);
  await out(`mipmap-${density}`, 'ic_launcher_round.png', png);
}

for (const [density, size] of Object.entries(FOREGROUND)) {
  const png = await sharp(foreground, { density: 512 }).resize(size, size).png().toBuffer();
  await out(`mipmap-${density}`, 'ic_launcher_foreground.png', png);
}

// Adaptive icon: a flat brand background with the monogram floating on top, so
// the launcher can mask it to whatever shape the device uses.
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
await out('mipmap-anydpi-v26', 'ic_launcher.xml', adaptive);
await out('mipmap-anydpi-v26', 'ic_launcher_round.xml', adaptive);
await out('values', 'ic_launcher_background.xml',
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BRAND_BG}</color>
</resources>
`);

for (const [dir, [w, h]] of Object.entries(SPLASH)) {
  const mark = Math.round(Math.min(w, h) * 0.34);
  const logo = await sharp(roundel, { density: 512 }).resize(mark, mark).png().toBuffer();
  const png = await sharp({
    create: { width: w, height: h, channels: 4, background: SPLASH_BG },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
  await out(`drawable-${dir}`, 'splash.png', png);
}
const base = await sharp(roundel, { density: 512 }).resize(300, 300).png().toBuffer();
const baseSplash = await sharp({
  create: { width: 960, height: 1600, channels: 4, background: SPLASH_BG },
})
  .composite([{ input: base, gravity: 'centre' }])
  .png()
  .toBuffer();
await out('drawable', 'splash.png', baseSplash);

console.log('launcher icons and splash screens written to', RES);
