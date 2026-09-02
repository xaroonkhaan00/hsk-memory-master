import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unlinkSync } from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// One bundle per process: `node --test` runs the test files concurrently, and a
// shared output path means one process can import a file another is still
// writing — which shows up as "m.audioText is not a function".
const outfile = path.join(root, 'node_modules', '.tmp', `test-bundle-${process.pid}.mjs`);

await build({
  entryPoints: [path.join(root, 'src', 'test-exports.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  // Capacitor ships ESM under "module"; without these the neutral platform
  // refuses to resolve it and the whole test bundle fails.
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
  outfile,
  loader: { '.json': 'json' },
  logLevel: 'error',
});

process.on('exit', () => {
  try {
    unlinkSync(outfile);
  } catch {
    /* already gone */
  }
});

export default outfile;
