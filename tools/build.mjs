// Build the entry: score the snapshot, take the three screenshots of the built page, then write
// the output the grader reads.
//
//   node tools/build.mjs
//
// The order matters. main.ts copies screenshots/ into /output and then writes dossier.json from
// what it copied, so the shots have to exist and the dossier has to be written last, from the
// finished files.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const KIT = resolve('vendor/makefun-board.ts');

function run(command, args, label) {
  process.stdout.write(`\n=== ${label}\n`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    process.stderr.write(`\n${label} failed with exit code ${result.status}\n`);
    process.exit(result.status ?? 1);
  }
}

// 1. The screenshots, taken from a page built from the snapshot.
mkdirSync('out', { recursive: true });
rmSync('out', { recursive: true, force: true });
mkdirSync('out', { recursive: true });

process.stdout.write('=== build the page\n');
const pre = spawnSync(process.execPath, ['main.ts', '--input', 'input/snapshot.json', '--output', 'out'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, MAKEFUN_OUTPUT_DIR: 'out' },
});
if (pre.status !== 0 && pre.status !== 1) {
  process.stderr.write(`main.ts failed with exit code ${pre.status}\n`);
  process.exit(pre.status ?? 1);
}

run(process.execPath, ['tools/shoot.mjs', 'screenshots'], 'take the screenshots');

// 2. The output, with the screenshots in place and the dossier written last.
run(process.execPath, ['main.ts', '--input', 'input/snapshot.json', '--output', 'out'], 'write the output');

if (!existsSync(join('out', 'dossier.json'))) {
  process.stderr.write('no out/dossier.json: the entry is not complete\n');
  process.exit(1);
}

const dossier = JSON.parse(readFileSync(join('out', 'dossier.json'), 'utf8'));
const text = dossier.text ?? '';
const shots = dossier.images ?? [];
process.stdout.write('\n=== the entry\n');
process.stdout.write(`dossier text: ${text.length} bytes of the 65,536 the judge reads whole\n`);
process.stdout.write(`cover: image index ${dossier.cover}\n`);
process.stdout.write(`screenshots: ${shots.length}\n`);
for (const s of shots) {
  const bytes = Buffer.from(s.base64, 'base64').length;
  process.stdout.write(`  ${s.name}  ${s.media_type}  ${bytes} bytes\n`);
}
process.stdout.write(`dossier total: ${readFileSync(join('out', 'dossier.json')).length} bytes of the 1.5 MiB cap\n`);
