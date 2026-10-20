const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');

function setup({ selected = [], answer = false, action = true, path = '/g/p/-/merge_requests/42' } = {}) {
	let handler;
	const messages = [];
	const inputs = selected.map(kind => ({
		checked: true,
		matches: selector => selector.includes(kind === 'delete' ? '#remove-source-branch-input' : '[name="squash"]'),
		closest: () => null,
	}));
	const widget = { querySelectorAll: () => inputs };
	const control = {
		closest: () => widget,
		matches: () => false,
		getAttribute: () => null,
		isConnected: true,
		click: () => { state.clicks++; handler({ ...event, target: { closest: () => control } }); },
	};
	const state = { clicks: 0 };
	vm.runInNewContext(readFileSync(`${__dirname}/../src/merge-guard.js`, 'utf8'), {
		document: { addEventListener: (name, fn) => { handler = fn; }, querySelector: () => widget },
		location: { pathname: path },
		window: { confirm: message => { messages.push(message); return answer; } },
		MRGuardUI: { ask: async config => { messages.push(JSON.stringify(config)); return answer; } },
	});
	const event = {
		button: 0, target: { closest: () => action ? control : null },
		prevented: false, stopped: false,
		preventDefault() { this.prevented = true; },
		stopImmediatePropagation() { this.stopped = true; },
	};
	return { event, messages, dispatch: () => handler(event), widget, control, state };
}

for (const selected of [['delete'], ['squash'], ['delete', 'squash']]) {
	test(`cancel stops merge: ${selected}`, () => {
		const app = setup({ selected });
		app.dispatch();
		assert.equal(app.event.prevented, true);
		assert.equal(app.event.stopped, true);
		assert.match(app.messages[0], /merge/);
		assert.equal(app.messages[0].includes('Usuń branch'), selected.includes('delete'));
		assert.equal(app.messages[0].includes('Scal commity'), selected.includes('squash'));
	});
}

test('OK replays merge exactly once without a second question', async () => {
	const app = setup({ selected: ['squash'], answer: true });
	app.dispatch();
	assert.equal(app.event.prevented, true);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(app.state.clicks, 1);
	assert.equal(app.messages.length, 1);
});

test('unchecked options do not prompt', () => {
	const app = setup({ selected: ['delete', 'squash'] });
	const inputs = app.widget.querySelectorAll();
	inputs.forEach(input => { input.checked = false; });
	app.widget.querySelectorAll = () => inputs;
	app.dispatch();
	assert.equal(app.messages.length, 0);
});

test('unrecognized options produce an explicit fallback confirmation', () => {
	const app = setup();
	app.dispatch();
	assert.match(app.messages[0], /Nie udało się odczytać/);
	assert.equal(app.event.prevented, true);
});

test('unrelated controls are ignored', () => {
	const app = setup({ selected: ['squash'], action: false });
	app.dispatch();
	assert.equal(app.messages.length, 0);
});

test('merge-like controls outside MR pages are ignored', () => {
	const app = setup({ selected: ['squash'], path: '/g/p/-/issues/42' });
	app.dispatch();
	assert.equal(app.messages.length, 0);
});

test('disabled controls are ignored', () => {
	const app = setup({ selected: ['squash'] });
	app.control.matches = () => true;
	app.dispatch();
	assert.equal(app.messages.length, 0);
});

for (const label of ['Set to auto-merge', 'Auto-merge', 'Automatic merge',
	'Merge when pipeline succeeds', 'Merge when all merge checks pass', 'Scal automatycznie']) {
	test(`automatic merge bypasses confirmation: ${label}`, () => {
		const app = setup({ selected: ['delete', 'squash'] });
		app.control.textContent = label;
		app.dispatch();
		assert.equal(app.event.prevented, false);
		assert.equal(app.messages.length, 0);
	});
}

test('selected automatic merge checkbox bypasses confirmation', () => {
	const app = setup({ selected: ['delete', 'squash'] });
	app.widget.querySelector = () => ({ checked: true });
	app.dispatch();
	assert.equal(app.event.prevented, false);
	assert.equal(app.messages.length, 0);
});

test('Merge immediately remains protected even if automatic merge is selected', () => {
	const app = setup({ selected: ['squash'] });
	app.widget.querySelector = () => ({ checked: true });
	app.control.getAttribute = name => name === 'data-testid' ? 'merge-immediately-button' : null;
	app.dispatch();
	assert.equal(app.event.prevented, true);
	assert.equal(app.messages.length, 1);
});
