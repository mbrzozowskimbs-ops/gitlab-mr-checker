const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function setup(selected, answer = false) {
	const handlers = {};
	const messages = [];
	const form = {
		matches: selector => selector === 'form',
		getAttribute: () => '/group/project/-/merge_requests',
		querySelectorAll: () => selected.map(name => ({ name, checked: true })),
	};
	const button = { form, type: 'submit' };
	button.isConnected = true;
	button.click = () => {
		const event = dispatch('click');
		if (!event.prevented) dispatch('submit');
	};
	form.isConnected = true;
	form.requestSubmit = () => dispatch('submit');
	const target = { closest: () => button };
	const tasks = [];
	vm.runInNewContext(readFileSync(new URL('../src/guard.js', `file://${__filename}`), 'utf8'), {
		document: { addEventListener: (name, handler) => { handlers[name] = handler; } },
		location: { href: 'https://gitlab.example.com/group/project/-/merge_requests/new' },
		URL,
		window: { confirm: message => { messages.push(message); return answer; } },
		MRGuardUI: { ask: async config => {
			messages.push(JSON.stringify(config));
			return answer;
		} },
		setTimeout: callback => tasks.push(callback),
	});
	function dispatch(type, eventTarget = type === 'submit' ? form : target) {
		const event = {
			target: eventTarget, button: 0, prevented: false, stopped: false,
			preventDefault() { this.prevented = true; },
			stopImmediatePropagation() { this.stopped = true; },
		};
		handlers[type](event);
		return event;
	}
	return { dispatch, messages, form, tasks, button };
}

test('no selected options: save without a question', () => {
	const app = setup([]);
	assert.equal(app.dispatch('submit').prevented, false);
	assert.equal(app.messages.length, 0);
});

for (const selected of [
	['merge_request[force_remove_source_branch]'],
	['merge_request[squash]'],
	['merge_request[force_remove_source_branch]', 'merge_request[squash]'],
]) {
	test(`cancel blocks click and keyboard submit: ${selected}`, () => {
		for (const type of ['click', 'submit']) {
			const app = setup(selected);
			const event = app.dispatch(type);
			assert.equal(event.prevented, true);
			assert.equal(event.stopped, true);
			assert.equal(app.messages.length, 1);
		}
	});
}

test('confirmation replays click and submit without a second dialog', async () => {
	const app = setup(['merge_request[squash]'], true);
	assert.equal(app.dispatch('click').prevented, true);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(app.messages.length, 1);
	app.tasks.forEach(callback => callback());
	app.dispatch('submit');
	assert.equal(app.messages.length, 2);
});

test('message includes both selected options', () => {
	const app = setup(['merge_request[force_remove_source_branch]', 'merge_request[squash]']);
	app.dispatch('submit');
	assert.match(app.messages[0], /Usuń branch źródłowy/);
	assert.match(app.messages[0], /Scal commity/);
});

test('unrelated forms are ignored', () => {
	const app = setup(['merge_request[squash]']);
	app.form.getAttribute = () => '/group/project/-/issues';
	assert.equal(app.dispatch('submit').prevented, false);
	assert.equal(app.messages.length, 0);
});

test('editing an existing MR is protected', () => {
	const app = setup(['merge_request[remove_source_branch]']);
	app.form.getAttribute = () => '/group/project/-/merge_requests/42';
	assert.equal(app.dispatch('submit').prevented, true);
});

test('a changed selection needs a new confirmation', async () => {
	const app = setup(['merge_request[squash]'], true);
	app.dispatch('click');
	app.form.querySelectorAll = () => [{ name: 'merge_request[force_remove_source_branch]', checked: true }];
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(app.messages.length, 2);
});

test('unchecked and unrelated checkboxes do not trigger a question', () => {
	const app = setup([]);
	app.form.querySelectorAll = () => [
		{ name: 'merge_request[squash]', checked: false },
		{ name: 'unrelated', checked: true },
	];
	assert.equal(app.dispatch('submit').prevented, false);
	assert.equal(app.messages.length, 0);
});

test('cross-origin actions are ignored', () => {
	const app = setup(['merge_request[squash]']);
	app.form.getAttribute = () => 'https://example.org/group/project/-/merge_requests';
	assert.equal(app.dispatch('submit').prevented, false);
	assert.equal(app.messages.length, 0);
});
