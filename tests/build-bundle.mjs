import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outfile = path.join(root, 'node_modules', '.tmp', 'test-bundle.mjs');

await build({
  entryPoints: [path.join(root, 'src', 'test-exports.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile,
  loader: { '.json': 'json' },
  logLevel: 'error',
});

export default outfile;
