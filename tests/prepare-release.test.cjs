const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { prepareRelease, amoJwt } = require('../scripts/prepare-release.cjs');

const options = {
  version: '1.6.0', addonId: 'checker@example.invalid',
  amoCredentials: { issuer: 'user:1:2', secret: 'amo-secret' },
  repository: 'example/checker', githubToken: 'test-token',
};
const assets = ['zip', 'xpi'].map(extension => ({ name: `gitlab-mr-checker-1.6.0-firefox.${extension}` }));

function fetchStub({ amo, github = () => assert.fail('no GitHub lookup expected') }) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return url.startsWith('https://addons.mozilla.org/') ? amo() : github();
    },
  };
}

test('version missing in AMO requests publication with an authenticated lookup', async () => {
  const stub = fetchStub({ amo: () => new Response('', { status: 404 }) });
  assert.deepEqual(await prepareRelease({ ...options, fetchImpl: stub.fetchImpl }), { version: '1.6.0', state: 'new' });
  assert.match(stub.requests[0].url, /checker%40example\.invalid\/versions\/1\.6\.0\/$/);
  assert.match(stub.requests[0].init.headers.Authorization, /^JWT [\w-]+\.[\w-]+\.[\w-]+$/);
});

test('version in AMO with ZIP and XPI in its GitHub Release is released', async () => {
  const stub = fetchStub({ amo: () => Response.json({}), github: () => Response.json({ assets }) });
  assert.deepEqual(await prepareRelease({ ...options, fetchImpl: stub.fetchImpl }), { version: '1.6.0', state: 'released' });
  assert.match(stub.requests[1].url, /example\/checker\/releases\/tags\/v1\.6\.0$/);
});

test('version in AMO without a finished GitHub Release needs completion, not resubmission', async () => {
  for (const github of [() => new Response('', { status: 404 }), () => Response.json({ assets: [] }),
    () => Response.json({ assets: assets.slice(0, 1) })]) {
    const stub = fetchStub({ amo: () => Response.json({}), github });
    assert.equal((await prepareRelease({ ...options, fetchImpl: stub.fetchImpl })).state, 'incomplete');
  }
});

test('rejects malformed versions before any publication', async () => {
  await assert.rejects(prepareRelease({ ...options, version: '1.6' }), /X\.Y\.Z/);
});

test('requires AMO credentials', async () => {
  await assert.rejects(prepareRelease({ ...options, amoCredentials: undefined }), /AMO_JWT_SECRET/);
});

test('API failures are not mistaken for a missing version or release', async () => {
  const amoDown = fetchStub({ amo: () => new Response('', { status: 401 }) });
  await assert.rejects(prepareRelease({ ...options, fetchImpl: amoDown.fetchImpl }), /AMO.*401/);
  const githubDown = fetchStub({ amo: () => Response.json({}), github: () => new Response('', { status: 503 }) });
  await assert.rejects(prepareRelease({ ...options, fetchImpl: githubDown.fetchImpl }), /GitHub.*503/);
});

test('AMO JWT is signed with HS256 and expires within five minutes', () => {
  const token = amoJwt({ issuer: 'user:1:2', secret: 'amo-secret' }, () => 1_700_000_000_000);
  const [header, payload, signature] = token.split('.');
  assert.equal(signature, createHmac('sha256', 'amo-secret').update(`${header}.${payload}`).digest('base64url'));
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.iss, 'user:1:2');
  assert.equal(claims.iat, 1_700_000_000);
  assert.ok(claims.exp - claims.iat <= 300);
  assert.ok(claims.jti);
});
