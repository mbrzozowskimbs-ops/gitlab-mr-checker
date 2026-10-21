'use strict';

const input = document.querySelector('#origin');
const status = document.querySelector('#status');
const button = document.querySelector('button');

extensionApi.storage.local.get('origin').then(({ origin }) => {
	if (origin && !input.value) input.value = origin;
}).catch(() => { status.textContent = 'Nie udało się odczytać ustawień.'; });

document.querySelector('#settings').addEventListener('submit', async event => {
	event.preventDefault();
	button.disabled = true;
	try {
		const origin = gitlabOrigin(input.value);
		// Must be called before any await: browsers require a user gesture.
		const granted = await extensionApi.permissions.request({ origins: [`${origin}/*`] });
		if (!granted) {
			status.textContent = 'Nie przyznano dostępu. Ustawienia nie zostały zmienione.';
			return;
		}
		const previous = await extensionApi.storage.local.get('origin');
		await extensionApi.storage.local.set({ origin });
		const result = await extensionApi.runtime.sendMessage({ type: 'configure' });
		if (!result?.active) throw new Error('Nie udało się włączyć ochrony. Spróbuj zapisać ponownie.');
		if (previous.origin && previous.origin !== origin) {
			await extensionApi.permissions.remove({ origins: [`${previous.origin}/*`] });
		}
		input.value = origin;
		status.textContent = 'Zapisano lokalnie. Odśwież wszystkie otwarte karty GitLaba.';
	} catch (error) {
		status.textContent = error.message || 'Nie udało się zapisać ustawień. Spróbuj ponownie.';
	} finally {
		button.disabled = false;
	}
});
