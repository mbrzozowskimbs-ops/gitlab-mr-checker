const { cpSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = process.argv[2];

if (process.argv.length !== 3 || target !== 'firefox') {
  console.error('Użycie: node scripts/build.cjs firefox. Obsługa Chrome jest w przygotowaniu.');
  process.exit(1);
}

const output = path.join(root, 'dist', target);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(path.join(root, 'src'), output, { recursive: true });
cpSync(path.join(root, 'browsers', target, 'manifest.json'), path.join(output, 'manifest.json'));
console.log(`Gotowe rozszerzenie: ${output}`);
