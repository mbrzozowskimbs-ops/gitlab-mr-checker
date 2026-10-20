const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/build.cjs');

test('Firefox build contains runtime assets and the original browser manifest', () => {
  execFileSync(process.execPath, [script, 'firefox'], { cwd: root });
  const output = path.join(root, 'dist/firefox');
  const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json')));
  assert.deepEqual(manifest, JSON.parse(readFileSync(path.join(root, 'browsers/firefox/manifest.json'))));
  for (const file of ['guard.js', 'merge-guard.js', 'dialog.js', 'settings.js', 'background.js', 'options.js', 'options.html', 'options.css', 'icons/icon-48.png']) {
    assert.deepEqual(readFileSync(path.join(output, file)), readFileSync(path.join(root, 'src', file)));
  }
  for (const file of manifest.background.scripts) readFileSync(path.join(output, file));
  readFileSync(path.join(output, manifest.options_ui.page));
  for (const file of Object.values(manifest.icons)) readFileSync(path.join(output, file));
  for (const file of ['tests', 'docs', 'scripts', 'README.md']) {
    assert.equal(readdirSync(output).includes(file), false);
  }
});

test('unsupported targets fail with a clear message without a Chrome package', () => {
  const result = spawnSync(process.execPath, [script, 'chrome'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Chrome.*przygotowaniu/);
});
