(() => {
	'use strict';

	const labels = new Map([
		['merge_request[force_remove_source_branch]', 'Usuń branch źródłowy po merge'],
		['merge_request[remove_source_branch]', 'Usuń branch źródłowy po merge'],
		['merge_request[squash]', 'Scal commity przy merge (squash)'],
	]);
	const approvedClicks = new WeakMap();
	const replaying = new WeakSet();

	function selectedOptions(form) {
		return [...new Set([...form.querySelectorAll('input[type="checkbox"]')]
			.filter(input => input.checked && labels.has(input.name))
			.map(input => labels.get(input.name)))];
	}

	function check(event, form, fromClick, button) {
		if (!form?.matches('form')) return;
		const action = new URL(form.getAttribute('action') || location.href, location.href);
		if (action.origin !== new URL(location.href).origin
			|| !/\/merge_requests(?:\/\d+)?\/?$/.test(action.pathname)) return;

		const options = selectedOptions(form);
		if (!options.length) return;
		const signature = JSON.stringify([action.href, options]);
		// A submit button generates click, then submit in the same browser task.
		// Consume approval once; the replay's finally block also clears unused approval.
		if (!fromClick && approvedClicks.get(form) === signature) {
			approvedClicks.delete(form);
			return;
		}
		approvedClicks.delete(form);
		event.preventDefault();
		event.stopImmediatePropagation();
		const page = location.href;
		const submitter = event.submitter;
		MRGuardUI.ask({ title: 'Zapisać MR z tymi opcjami?', options, confirmLabel: 'Zapisz MR' }).then(confirmed => {
			if (!confirmed || !form.isConnected || page !== location.href) return;
			const currentAction = new URL(form.getAttribute('action') || location.href, location.href);
			const unchanged = signature === JSON.stringify([currentAction.href, selectedOptions(form)]);
			if (!unchanged) {
				// Recheck changed settings rather than approving a stale selection.
				if (fromClick && button.isConnected) button.click();
				else form.requestSubmit(submitter || undefined);
				return;
			}
			approvedClicks.set(form, signature);
			try {
				if (fromClick && button.isConnected) {
					replaying.add(button);
					button.click();
				} else if (!fromClick) form.requestSubmit(submitter || undefined);
			} finally {
				if (button) replaying.delete(button);
				approvedClicks.delete(form);
			}
		});
	}

	// Delegation also handles forms inserted later by GitLab navigation.
	document.addEventListener('click', event => {
		if (event.button !== 0) return;
		const button = event.target.closest?.('button, input[type="submit"], input[type="image"]');
		if (!button || !['submit', 'image'].includes(button.type)) return;
		if (replaying.has(button)) { replaying.delete(button); return; }
		check(event, button.form, true, button);
	}, true);
	document.addEventListener('submit', event => check(event, event.target, false), true);
})();
