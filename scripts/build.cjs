const { cpSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const targets = ['firefox', 'chrome'];
const target = process.argv[2];

if (process.argv.length !== 3 || !targets.includes(target)) {
  console.error(`Użycie: node scripts/build.cjs <${targets.join('|')}>`);
  process.exit(1);
}

const output = path.join(root, 'dist', target);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(path.join(root, 'src'), output, { recursive: true });
// Browser-specific files (manifest, Chrome service worker) override shared ones; notes stay out.
cpSync(path.join(root, 'browsers', target), output, {
  recursive: true, filter: source => path.basename(source) !== 'README.md',
});
console.log(`Gotowe rozszerzenie: ${output}`);
