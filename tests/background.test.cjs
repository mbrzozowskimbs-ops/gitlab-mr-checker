const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// A fresh Chrome registration as an earlier session would have persisted it.
function persistedGuard(overrides = {}) {
	return {
		id: 'mr-guard', matches: ['https://gitlab.example.com/*'],
		js: ['dialog.js', 'guard.js', 'merge-guard.js'], runAt: 'document_start', ...overrides,
	};
}

async function setup(origin, permitted = true, { chrome = false, registered = [] } = {}) {
	const listeners = {};
	const state = { origin, permitted, registrations: [], removed: 0, opened: 0, registered: [...registered] };
	const event = name => ({ addListener: fn => { listeners[name] = fn; } });
	const api = {
		storage: { local: { get: async () => ({ origin: state.origin }) } },
		permissions: { contains: async () => state.permitted, onRemoved: event('removed') },
		runtime: {
			id: 'test', onMessage: event('message'), onInstalled: event('installed'),
			getURL: path => `${chrome ? 'chrome-extension' : 'moz-extension'}://test/${path}`,
			openOptionsPage: async () => { state.opened++; },
		},
	};
	if (chrome) {
		api.action = { onClicked: event('click') };
		api.scripting = {
			getRegisteredContentScripts: async ({ ids }) => state.registered.filter(script => ids.includes(script.id)),
			registerContentScripts: async scripts => {
				for (const script of scripts) {
					if (state.registered.some(existing => existing.id === script.id)) throw new Error(`Duplicate ${script.id}`);
					state.registered.push(script);
					state.registrations.push(script);
				}
			},
			unregisterContentScripts: async ({ ids }) => {
				state.registered = state.registered.filter(script => !ids.includes(script.id));
				state.removed++;
			},
		};
	} else {
		api.browserAction = { onClicked: event('click') };
		api.contentScripts = { register: async config => {
			state.registrations.push(config);
			return { unregister: async () => { state.removed++; } };
		} };
	}
	const context = vm.createContext({ URL, [chrome ? 'chrome' : 'browser']: api });
	for (const name of ['settings.js', 'background.js']) {
		vm.runInContext(readFileSync(`${__dirname}/../src/${name}`, 'utf8'), context);
	}
	await vm.runInContext('updates', context);
	// Mirrors runtime.sendMessage: a listener returning true answers through sendResponse.
	const message = (body, sender) => new Promise(resolve => {
		if (listeners.message(body, sender, resolve) !== true) resolve(undefined);
	});
	return { state, listeners, context, message };
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
	const { state, message } = await setup('https://gitlab.example.com');
	state.origin = 'https://other.example.com';
	const result = await message({ type: 'configure' }, {
		id: 'test', url: 'moz-extension://test/options.html',
	});
	assert.equal(result.active, true);
	assert.equal(state.removed, 1);
	assert.equal(state.registrations[1].matches[0], 'https://other.example.com/*');
});

test('configuration from an options page in a tab receives an activation response', async () => {
	const { message } = await setup('https://gitlab.example.com');
	const result = await message({ type: 'configure' }, {
		id: 'test', tab: { id: 7 }, url: 'moz-extension://test/options.html',
	});
	assert.equal(result?.active, true);
});

test('content script cannot request configuration refresh', async () => {
	const { listeners } = await setup('https://gitlab.example.com');
	assert.equal(listeners.message({ type: 'configure' }, {
		id: 'test', tab: { id: 7 }, url: 'https://gitlab.example.com/',
	}, () => assert.fail('content script received a response')), undefined);
});

test('revoking host permission unregisters protection', async () => {
	const { state, listeners, context } = await setup('https://gitlab.example.com');
	state.permitted = false;
	listeners.removed();
	await vm.runInContext('updates', context);
	assert.equal(state.removed, 1);
	assert.equal(state.registrations.length, 1);
});

test('Chrome startup registers persistent protection for the saved host', async () => {
	const { state } = await setup('https://gitlab.example.com', true, { chrome: true });
	assert.equal(state.registered.length, 1);
	assert.equal(state.registered[0].id, 'mr-guard');
	assert.equal(state.registered[0].matches[0], 'https://gitlab.example.com/*');
	assert.deepEqual(Array.from(state.registered[0].js), ['dialog.js', 'guard.js', 'merge-guard.js']);
	assert.equal(state.registered[0].runAt, 'document_start');
});

test('Chrome refresh keeps an identical registration instead of re-registering', async () => {
	const { state, listeners, context } = await setup('https://gitlab.example.com', true, { chrome: true });
	listeners.removed();
	await vm.runInContext('updates', context);
	assert.equal(state.registered.length, 1);
	assert.equal(state.removed, 0);
	assert.equal(state.registrations.length, 1);
});

test('Chrome service worker start keeps protection persisted by an earlier session', async () => {
	const { state } = await setup('https://gitlab.example.com', true, { chrome: true, registered: [persistedGuard()] });
	assert.equal(state.removed, 0);
	assert.deepEqual(state.registered, [persistedGuard()]);
});

test('Chrome replaces a persisted registration with outdated scripts', async () => {
	const outdated = persistedGuard({ js: ['guard.js'] });
	const { state } = await setup('https://gitlab.example.com', true, { chrome: true, registered: [outdated] });
	assert.equal(state.removed, 1);
	assert.deepEqual(Array.from(state.registered[0].js), ['dialog.js', 'guard.js', 'merge-guard.js']);
});

test('Chrome removes persisted protection when no address is saved', async () => {
	const { state } = await setup(undefined, true, { chrome: true, registered: [persistedGuard()] });
	assert.equal(state.registered.length, 0);
});

test('Chrome configuration responds through sendResponse and switches host', async () => {
	const { state, message } = await setup('https://gitlab.example.com', true, { chrome: true });
	state.origin = 'https://other.example.com';
	const result = await message({ type: 'configure' }, {
		id: 'test', tab: { id: 7 }, url: 'chrome-extension://test/options.html',
	});
	assert.equal(result?.active, true);
	assert.deepEqual(state.registered.map(script => script.matches[0]), ['https://other.example.com/*']);
});

test('Chrome revoked host permission removes persisted protection', async () => {
	const { state, listeners, context } = await setup('https://gitlab.example.com', true, { chrome: true });
	state.permitted = false;
	listeners.removed();
	await vm.runInContext('updates', context);
	assert.equal(state.registered.length, 0);
});

test('Chrome toolbar button opens settings', async () => {
	const { state, listeners } = await setup(undefined, true, { chrome: true });
	await listeners.click();
	assert.equal(state.opened, 1);
});

test('failed registration answers inactive instead of leaving options waiting', async () => {
	const { state, message, context } = await setup('https://gitlab.example.com');
	vm.runInContext("extensionApi.contentScripts.register = async () => { throw new Error('boom'); }", context);
	state.origin = 'https://other.example.com';
	const result = await message({ type: 'configure' }, {
		id: 'test', url: 'moz-extension://test/options.html',
	});
	assert.equal(result.active, false);
});
