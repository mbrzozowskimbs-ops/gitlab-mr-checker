'use strict';

let registration;
let updates = Promise.resolve();

async function registerGuard() {
	if (registration) {
		await registration.unregister();
		registration = undefined;
	}
	const { origin } = await browser.storage.local.get('origin');
	if (!origin) return;
	const pattern = `${gitlabOrigin(origin)}/*`;
	if (!await browser.permissions.contains({ origins: [pattern] })) return;
	registration = await browser.contentScripts.register({
		matches: [pattern], js: [{ file: 'dialog.js' }, { file: 'guard.js' }, { file: 'merge-guard.js' }],
		runAt: 'document_start',
	});
}

function refresh() {
	updates = updates.catch(() => {}).then(registerGuard);
	return updates;
}

browser.runtime.onMessage.addListener((message, sender) => {
	if (sender.id === browser.runtime.id && sender.url === browser.runtime.getURL('options.html')
		&& message?.type === 'configure') {
		return refresh().then(() => ({ active: Boolean(registration) }));
	}
});
browser.permissions.onRemoved.addListener(() => { refresh().catch(() => {}); });
browser.browserAction.onClicked.addListener(() => browser.runtime.openOptionsPage());
browser.runtime.onInstalled.addListener(async () => {
	const { origin } = await browser.storage.local.get('origin');
	if (!origin) await browser.runtime.openOptionsPage();
});
refresh().catch(() => {});
