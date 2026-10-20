'use strict';

const guardScriptId = 'mr-guard';
const guardFiles = ['dialog.js', 'guard.js', 'merge-guard.js'];
let registration;
let updates = Promise.resolve(false);

async function permittedPattern() {
	const { origin } = await extensionApi.storage.local.get('origin');
	if (!origin) return undefined;
	const pattern = `${gitlabOrigin(origin)}/*`;
	return await extensionApi.permissions.contains({ origins: [pattern] }) ? pattern : undefined;
}

async function registerFirefoxGuard(pattern) {
	if (registration) await registration.unregister();
	registration = undefined;
	if (!pattern) return false;
	registration = await extensionApi.contentScripts.register({
		matches: [pattern], js: guardFiles.map(file => ({ file })), runAt: 'document_start',
	});
	return true;
}

async function registerChromeGuard(pattern) {
	// Chrome keeps registrations across browser and service worker restarts, and every
	// service worker start refreshes. Replacing an identical registration would leave
	// pages that load in between unprotected, so keep it.
	const wanted = pattern && { matches: [pattern], js: guardFiles, runAt: 'document_start' };
	const [current] = await extensionApi.scripting.getRegisteredContentScripts({ ids: [guardScriptId] });
	if (current && wanted && JSON.stringify([current.matches, current.js, current.runAt])
		=== JSON.stringify([wanted.matches, wanted.js, wanted.runAt])) return true;
	if (current) await extensionApi.scripting.unregisterContentScripts({ ids: [guardScriptId] });
	if (!wanted) return false;
	await extensionApi.scripting.registerContentScripts([{ id: guardScriptId, ...wanted }]);
	return true;
}

async function registerGuard() {
	// A missing, invalid or unpermitted address disables protection.
	const pattern = await permittedPattern().catch(() => undefined);
	return extensionApi.contentScripts ? registerFirefoxGuard(pattern) : registerChromeGuard(pattern);
}

function refresh() {
	updates = updates.catch(() => false).then(registerGuard);
	return updates;
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (sender.id === extensionApi.runtime.id && sender.url === extensionApi.runtime.getURL('options.html')
		&& message?.type === 'configure') {
		// Chrome ignores a returned promise; keep the channel open for sendResponse.
		refresh().then(active => sendResponse({ active }), () => sendResponse({ active: false }));
		return true;
	}
});
extensionApi.permissions.onRemoved.addListener(() => { refresh().catch(() => {}); });
(extensionApi.action ?? extensionApi.browserAction).onClicked.addListener(() => extensionApi.runtime.openOptionsPage());
extensionApi.runtime.onInstalled.addListener(async () => {
	const { origin } = await extensionApi.storage.local.get('origin');
	if (!origin) await extensionApi.runtime.openOptionsPage();
});
refresh().catch(() => {});
