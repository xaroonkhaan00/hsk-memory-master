/**
 * Type-check the native Android plugin.
 *
 * A real compile needs the Android SDK, which is not available in this
 * environment. Compiling against tests/android-stubs still verifies the plugin's
 * own correctness — signatures, overrides, generics — which is where native
 * plugins usually break.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stubs = path.join(root, 'tests', 'android-stubs');
const plugin = path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'mfb', 'learnhsk3');

function javaFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...javaFiles(full));
    else if (name.endsWith('.java')) out.push(full);
  }
  return out;
}

const sources = [...javaFiles(stubs), ...javaFiles(plugin)];
const result = spawnSync(
  'javac',
  ['-d', path.join(root, 'node_modules', '.tmp', 'android-check'), '-nowarn', '-sourcepath', stubs, ...sources],
  { encoding: 'utf8' },
);

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  .split('\n')
  .filter((l) => !l.includes('JAVA_TOOL_OPTIONS'))
  .join('\n')
  .trim();

if (result.status !== 0) {
  console.error(output);
  console.error('\nAndroid plugin type-check FAILED');
  process.exit(1);
}
console.log(`Android plugin type-check passed (${sources.length - javaFiles(stubs).length} plugin files).`);
