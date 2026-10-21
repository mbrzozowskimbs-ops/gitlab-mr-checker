const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/build.cjs');
const sharedFiles = ['guard.js', 'merge-guard.js', 'dialog.js', 'settings.js', 'background.js', 'options.js', 'options.html', 'options.css', 'icons/icon-48.png'];

// Every browser build ships unchanged shared code and leaves development files out.
function assertSharedAssets(output) {
  for (const file of sharedFiles) {
    assert.deepEqual(readFileSync(path.join(output, file)), readFileSync(path.join(root, 'src', file)));
  }
  for (const file of ['tests', 'docs', 'scripts', 'README.md']) {
    assert.equal(readdirSync(output).includes(file), false);
  }
}

test('Firefox build contains runtime assets and the original browser manifest', () => {
  execFileSync(process.execPath, [script, 'firefox'], { cwd: root });
  const output = path.join(root, 'dist/firefox');
  const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json')));
  assert.deepEqual(manifest, JSON.parse(readFileSync(path.join(root, 'browsers/firefox/manifest.json'))));
  for (const file of manifest.background.scripts) readFileSync(path.join(output, file));
  readFileSync(path.join(output, manifest.options_ui.page));
  for (const file of Object.values(manifest.icons)) readFileSync(path.join(output, file));
  assertSharedAssets(output);
});

test('Chrome build contains shared assets, the MV3 manifest and its service worker', () => {
  execFileSync(process.execPath, [script, 'chrome'], { cwd: root });
  const output = path.join(root, 'dist/chrome');
  const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json')));
  assert.deepEqual(manifest, JSON.parse(readFileSync(path.join(root, 'browsers/chrome/manifest.json'))));
  assert.equal(manifest.manifest_version, 3);
  const worker = readFileSync(path.join(output, manifest.background.service_worker), 'utf8');
  const imported = worker.match(/importScripts\(([^)]*)\)/)[1].match(/'[^']+'/g).map(name => name.slice(1, -1));
  assert.deepEqual(imported, ['settings.js', 'background.js']);
  for (const file of imported) readFileSync(path.join(output, file));
  readFileSync(path.join(output, manifest.options_ui.page));
  for (const file of [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)]) {
    readFileSync(path.join(output, file));
  }
  assertSharedAssets(output);
});

test('Firefox build does not ship Chrome-only files', () => {
  execFileSync(process.execPath, [script, 'firefox'], { cwd: root });
  assert.equal(readdirSync(path.join(root, 'dist/firefox')).includes('service-worker.js'), false);
});

test('browser manifests and pom.xml share the release version', () => {
  const pom = readFileSync(path.join(root, 'pom.xml'), 'utf8').match(/<artifactId>gitlab-mr-checker<\/artifactId>\s*<version>([^<]+)/)[1];
  for (const browser of ['firefox', 'chrome']) {
    assert.equal(JSON.parse(readFileSync(path.join(root, `browsers/${browser}/manifest.json`))).version, pom);
  }
});

test('unsupported targets fail with a clear usage message', () => {
  const result = spawnSync(process.execPath, [script, 'safari'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Użycie: .*firefox\|chrome/);
});
