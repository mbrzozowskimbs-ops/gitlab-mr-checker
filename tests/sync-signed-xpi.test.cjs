const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { syncSignedXpi } = require('../scripts/sync-signed-xpi.cjs');

const repository = 'example/checker';
const addonId = 'checker@example.invalid';
const packageBytes = Buffer.from('signed XPI fixture');
const hash = `sha256:${createHash('sha256').update(packageBytes).digest('hex')}`;
const release = {
  tag_name: 'v1.5.0', draft: false, prerelease: false,
  assets: [{ name: 'gitlab-mr-checker-1.5.0-firefox.zip' }],
};
const approved = {
  version: '1.5.0', channel: 'listed',
  file: { status: 'public', url: 'https://addons.mozilla.org/files/file.xpi', hash },
};

function harness(releases = [release], version = approved) {
  const uploads = [];
  const requests = [];
  return {
    uploads, requests,
    options: {
      repository, addonId, githubToken: 'private-test-token', log: () => {},
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        if (url.startsWith('https://api.github.com/')) return Response.json(releases);
        if (url.includes('/versions/')) return version === null
          ? new Response('', { status: 404 }) : Response.json(version);
        if (url === approved.file.url) return new Response(packageBytes);
        throw new Error(`Unexpected request: ${url}`);
      },
      upload: async ({ tag, file, repository: repo }) => {
        uploads.push({ tag, repo, bytes: await readFile(file), file });
      },
    },
  };
}

test('attaches approved XPI to matching release without forwarding GitHub credentials to AMO', async () => {
  const h = harness();
  await syncSignedXpi(h.options);
  assert.equal(h.uploads.length, 1);
  assert.equal(h.uploads[0].tag, 'v1.5.0');
  assert.equal(h.uploads[0].repo, repository);
  assert.match(h.uploads[0].file, /gitlab-mr-checker-1\.5\.0-firefox\.xpi$/);
  assert.deepEqual(h.uploads[0].bytes, packageBytes);
  for (const request of h.requests.filter(r => !r.url.startsWith('https://api.github.com/'))) {
    assert.equal(request.options.headers?.Authorization, undefined);
  }
});

test('skips releases already containing the signed XPI', async () => {
  const h = harness([{ ...release, assets: [...release.assets, { name: 'gitlab-mr-checker-1.5.0-firefox.xpi' }] }]);
  await syncSignedXpi(h.options);
  assert.equal(h.uploads.length, 0);
  assert.equal(h.requests.length, 1);
});

test('skips pending, missing, disabled, and mismatched AMO versions', async () => {
  for (const version of [null, { ...approved, file: { ...approved.file, status: 'unreviewed' } },
    { ...approved, is_disabled: true }, { ...approved, version: '1.6.0' },
    { ...approved, channel: 'unlisted' }]) {
    const h = harness([release], version);
    await syncSignedXpi(h.options);
    assert.equal(h.uploads.length, 0);
  }
});

test('ignores drafts, prereleases and releases without the Firefox ZIP', async () => {
  const h = harness([{ ...release, draft: true }, { ...release, prerelease: true },
    { ...release, assets: [] }, { ...release, tag_name: 'v1.5.0-beta' }]);
  await syncSignedXpi(h.options);
  assert.equal(h.requests.length, 1);
});

test('rejects a damaged download before attaching it', async () => {
  const h = harness([release], { ...approved, file: { ...approved.file, hash: `sha256:${'0'.repeat(64)}` } });
  await assert.rejects(syncSignedXpi(h.options), /SHA-256/);
  assert.equal(h.uploads.length, 0);
});

test('fails visibly on AMO network/API errors instead of treating them as pending', async () => {
  const h = harness();
  const fetchImpl = h.options.fetchImpl;
  h.options.fetchImpl = (url, options) => url.includes('/versions/')
    ? new Response('', { status: 503 }) : fetchImpl(url, options);
  await assert.rejects(syncSignedXpi(h.options), /503/);
  assert.equal(h.uploads.length, 0);
});

test('visits later release pages so an older pending version can still receive its XPI', async () => {
  const h = harness();
  const fetchImpl = h.options.fetchImpl;
  h.options.fetchImpl = (url, options) => url.startsWith('https://api.github.com/') && url.endsWith('page=1')
    ? Response.json(Array.from({ length: 100 }, () => ({ ...release, assets: [] })))
    : fetchImpl(url, options);
  await syncSignedXpi(h.options);
  assert.equal(h.uploads.length, 1);
});

test('rejects insecure download URLs and failed downloads without uploading', async () => {
  const insecure = harness([release], { ...approved, file: { ...approved.file, url: 'http://example.com/file.xpi' } });
  await assert.rejects(syncSignedXpi(insecure.options), /HTTPS/);
  assert.equal(insecure.uploads.length, 0);

  const h = harness();
  const fetchImpl = h.options.fetchImpl;
  h.options.fetchImpl = (url, options) => url === approved.file.url
    ? new Response('', { status: 503 }) : fetchImpl(url, options);
  await assert.rejects(syncSignedXpi(h.options), /503/);
  assert.equal(h.uploads.length, 0);
});
