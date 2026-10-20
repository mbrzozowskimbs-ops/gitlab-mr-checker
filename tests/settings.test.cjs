const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const context = vm.createContext({ URL });
vm.runInContext(readFileSync(`${__dirname}/../src/settings.js`, 'utf8'), context);

test('normalizes an HTTPS address without exposing project paths', () => {
	assert.equal(vm.runInContext("gitlabOrigin(' https://GitLab.example.com/ ')", context),
		'https://gitlab.example.com');
});

for (const value of ['http://example.com', 'https://user:secret@example.com',
	'https://example.com/project', 'https://example.com/?token=x', 'https://example.com/#x',
	'https://example.com:8443', '*://*/*', '', 'file:///tmp']) {
	test(`rejects invalid or excessive address: ${value}`, () => {
		context.value = value;
		assert.throws(() => vm.runInContext('gitlabOrigin(value)', context));
	});
}
