const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

async function setup(origin, permitted = true) {
	const listeners = {};
	const state = { origin, permitted, registrations: [], removed: 0, opened: 0 };
	const event = name => ({ addListener: fn => { listeners[name] = fn; } });
	const context = vm.createContext({ URL, browser: {
		storage: { local: { get: async () => ({ origin: state.origin }) } },
		permissions: { contains: async () => state.permitted, onRemoved: event('removed') },
		contentScripts: { register: async config => {
			state.registrations.push(config);
			return { unregister: async () => { state.removed++; } };
		} },
		browserAction: { onClicked: event('click') },
		runtime: {
			id: 'test', onMessage: event('message'), onInstalled: event('installed'),
			getURL: path => `moz-extension://test/${path}`,
			openOptionsPage: async () => { state.opened++; },
		},
	} });
	for (const name of ['settings.js', 'background.js']) {
		vm.runInContext(readFileSync(`${__dirname}/../src/${name}`, 'utf8'), context);
	}
	await vm.runInContext('updates', context);
	return { state, listeners, context };
}

test('first install opens configuration without registering a script', async () => {
	const { state, listeners } = await setup();
	await listeners.installed();
	assert.equal(state.opened, 1);
	assert.equal(state.registrations.length, 0);
});

test('startup restores protection only for the locally saved host', async () => {
	const { state } = await setup('https://gitlab.example.com');
	assert.equal(state.registrations.length, 1);
	assert.equal(state.registrations[0].matches[0], 'https://gitlab.example.com/*');
	assert.deepEqual(Array.from(state.registrations[0].js, script => script.file), ['dialog.js', 'guard.js', 'merge-guard.js']);
});

test('missing host permission leaves protection disabled', async () => {
	const { state } = await setup('https://gitlab.example.com', false);
	assert.equal(state.registrations.length, 0);
});

test('changing address unregisters old script and registers new host', async () => {
	const { state, listeners } = await setup('https://gitlab.example.com');
	state.origin = 'https://other.example.com';
	const result = await listeners.message({ type: 'configure' }, {
		id: 'test', url: 'moz-extension://test/options.html',
	});
	assert.equal(result.active, true);
	assert.equal(state.removed, 1);
	assert.equal(state.registrations[1].matches[0], 'https://other.example.com/*');
});

test('configuration from an options page in a tab receives an activation response', async () => {
	const { listeners } = await setup('https://gitlab.example.com');
	const result = await listeners.message({ type: 'configure' }, {
		id: 'test', tab: { id: 7 }, url: 'moz-extension://test/options.html',
	});
	assert.equal(result?.active, true);
});

test('content script cannot request configuration refresh', async () => {
	const { listeners } = await setup('https://gitlab.example.com');
	assert.equal(listeners.message({ type: 'configure' }, {
		id: 'test', tab: { id: 7 }, url: 'https://gitlab.example.com/',
	}), undefined);
});

test('revoking host permission unregisters protection', async () => {
	const { state, listeners, context } = await setup('https://gitlab.example.com');
	state.permitted = false;
	listeners.removed();
	await vm.runInContext('updates', context);
	assert.equal(state.removed, 1);
	assert.equal(state.registrations.length, 1);
});
