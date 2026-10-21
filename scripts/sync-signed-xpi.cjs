const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

async function syncSignedXpi({
  repository, addonId, githubToken, fetchImpl = fetch, log = console.log,
  upload = ({ tag, file, repository: repo }) => execFileSync('gh',
    ['release', 'upload', tag, file, '--repo', repo], { stdio: 'inherit' }),
}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !addonId || !githubToken) {
    throw new Error('GITHUB_REPOSITORY, add-on ID and GH_TOKEN are required.');
  }
  for (let page = 1; ; page++) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`GitHub releases API: HTTP ${response.status}`);
    const releases = await response.json();
    for (const release of releases) {
      if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) continue;
      const version = release.tag_name.slice(1);
      const basename = `gitlab-mr-checker-${version}-firefox`;
      if (!release.assets.some(asset => asset.name === `${basename}.zip`) ||
          release.assets.some(asset => asset.name === `${basename}.xpi`)) continue;

      const metadata = await fetchImpl(
        `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(addonId)}/versions/${version}/`,
        { signal: AbortSignal.timeout(60000) });
      if (metadata.status === 404) {
        log(`${release.tag_name}: version not public in AMO yet.`);
        continue;
      }
      if (!metadata.ok) throw new Error(`AMO version ${version}: HTTP ${metadata.status}`);
      const amo = await metadata.json();
      if (amo.version !== version || amo.channel !== 'listed' || amo.is_disabled || amo.file?.status !== 'public') {
        log(`${release.tag_name}: AMO version not approved for public distribution.`);
        continue;
      }
      if (!/^sha256:[a-f0-9]{64}$/i.test(amo.file.hash || '')) throw new Error(`Missing SHA-256 for ${version}`);
      const downloadUrl = new URL(amo.file.url);
      if (downloadUrl.protocol !== 'https:') throw new Error('AMO download must use HTTPS.');
      // GitHub credentials must never be sent to AMO or its download CDN.
      const download = await fetchImpl(downloadUrl.href, { signal: AbortSignal.timeout(60000) });
      if (!download.ok) throw new Error(`XPI download ${version}: HTTP ${download.status}`);
      const bytes = Buffer.from(await download.arrayBuffer());
      const actualHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
      if (actualHash !== amo.file.hash.toLowerCase()) throw new Error(`XPI SHA-256 mismatch for ${version}`);

      const directory = await mkdtemp(path.join(tmpdir(), 'gitlab-mr-checker-xpi-'));
      try {
        const file = path.join(directory, `${basename}.xpi`);
        await writeFile(file, bytes);
        await upload({ tag: release.tag_name, file, repository });
        log(`${release.tag_name}: signed XPI attached to GitHub Release.`);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
    if (releases.length < 100) break;
  }
}

module.exports = { syncSignedXpi };

if (require.main === module) {
  const manifest = require('../browsers/firefox/manifest.json');
  syncSignedXpi({
    repository: process.env.GITHUB_REPOSITORY,
    githubToken: process.env.GH_TOKEN,
    addonId: manifest.browser_specific_settings.gecko.id,
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
