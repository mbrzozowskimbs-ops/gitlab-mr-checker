const { appendFileSync } = require('node:fs');
const { createHmac, randomUUID } = require('node:crypto');

function amoJwt({ issuer, secret }, now = Date.now) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const iat = Math.floor(now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: issuer, jti: randomUUID(), iat, exp: iat + 60 })}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

// Matching versions in pom.xml and both manifests are enforced by tests/build.test.cjs, which runs first.
// Returns state 'new' (submit to AMO), 'released' (nothing to do) or 'incomplete' (in AMO, GitHub Release unfinished).
async function prepareRelease({ version, addonId, amoCredentials, repository, githubToken, fetchImpl = fetch }) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Firefox version must use X.Y.Z.');
  if (!addonId || !amoCredentials) throw new Error('Add-on ID, AMO_JWT_ISSUER and AMO_JWT_SECRET are required.');
  if (!repository || !githubToken) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required.');
  // AMO is the source of truth; only the authenticated owner can see unlisted versions.
  const amo = await fetchImpl(
    `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(addonId)}/versions/${version}/`, {
      headers: { Authorization: `JWT ${amoJwt(amoCredentials)}` },
      signal: AbortSignal.timeout(60000),
    });
  if (amo.status === 404) return { version, state: 'new' };
  if (!amo.ok) throw new Error(`AMO version ${version}: HTTP ${amo.status}`);

  // Drafts are invisible to this endpoint, so an unpublished draft also counts as unfinished.
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/tags/v${version}`, {
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(60000),
  });
  if (response.status === 404) return { version, state: 'incomplete' };
  if (!response.ok) throw new Error(`GitHub release v${version}: HTTP ${response.status}`);
  const assets = new Set((await response.json()).assets.map(asset => asset.name));
  const complete = ['zip', 'xpi'].every(extension => assets.has(`gitlab-mr-checker-${version}-firefox.${extension}`));
  return { version, state: complete ? 'released' : 'incomplete' };
}

module.exports = { prepareRelease, amoJwt };

if (require.main === module) {
  const firefox = require('../browsers/firefox/manifest.json');
  const { AMO_JWT_ISSUER: issuer, AMO_JWT_SECRET: secret } = process.env;
  prepareRelease({
    version: firefox.version,
    addonId: firefox.browser_specific_settings.gecko.id,
    amoCredentials: issuer && secret ? { issuer, secret } : undefined,
    repository: process.env.GITHUB_REPOSITORY,
    githubToken: process.env.GH_TOKEN,
  }).then(({ version, state }) => {
    appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\npublish=${state === 'new'}\n`);
    if (state === 'incomplete') {
      console.log(`::warning::Version ${version} is already in AMO, but GitHub Release v${version} is missing ` +
        'or lacks the ZIP/XPI. Finish it as described in README (Automatyczne wydania) or bump the version.');
    } else {
      console.log(`${version}: ${state === 'new' ? 'new release' : 'already released'}`);
    }
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
