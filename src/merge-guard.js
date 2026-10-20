(() => {
	'use strict';

	// Selectors from GitLab's merge_widget.vue and squash_before_merge.vue.
	// Match action controls, never their dropdown toggle or arbitrary button text.
	const actions = [
		'.accept-merge-request', '[data-testid="merge-button"]',
		'[data-testid="merge-immediately-button"]',
		'[data-testid="mt-merge-now-restart-button"]',
		'[data-testid="mt-merge-now-skip-restart-button"]',
	].join(', ');
	const widgets = '.mr-widget-body-ready-merge, [data-testid="ready_to_merge_state"], '
		+ '#js-vue-mr-widget, .js-mr-widget';
	const removeInput = '#remove-source-branch-input, [name="remove_source_branch"], '
		+ '[name="should_remove_source_branch"], [name="merge_request[force_remove_source_branch]"]';
	const squashInput = '[name="squash"], [name="merge_request[squash]"]';
	const removeContainer = '.js-remove-source-branch-checkbox, [data-testid="delete-source-branch-checkbox"]';
	const squashContainer = '.js-squash-checkbox, [data-testid="squash-checkbox"]';
	const replaying = new WeakSet();

	function isAutomaticMerge(control, widget) {
		const testId = control.getAttribute('data-testid') || '';
		if (['merge-immediately-button', 'mt-merge-now-restart-button',
			'mt-merge-now-skip-restart-button'].includes(testId)) return false;
		const label = `${control.textContent || ''} ${control.getAttribute('aria-label') || ''}`;
		if (/\bauto[\s-]?merge\b|\bautomatic merge\b|merge when (?:pipeline succeeds|(?:all )?merge checks pass)|automatyczn/i.test(label)) {
			return true;
		}
		return Boolean(widget?.querySelector?.(
			'input:is([type="checkbox"], [type="radio"]):checked:is('
			+ '[name="auto_merge"], [name="merge_request[auto_merge]"], '
			+ '[name="merge_when_pipeline_succeeds"], [name="merge_request[merge_when_pipeline_succeeds]"])'
			+ ':not([value="false"]):not([value="0"])',
		));
	}

	document.addEventListener('click', event => {
		if (event.button !== 0 || !/\/merge_requests\/\d+(?:\/|$)/.test(location.pathname)) return;
		const control = event.target.closest?.(actions);
		if (!control || control.matches(':disabled, [disabled], [aria-disabled="true"]')) return;
		if (replaying.has(control)) { replaying.delete(control); return; }
		// Dropdown items may be rendered outside the widget by a portal.
		const widget = control.closest(widgets) || document.querySelector(widgets);
		if (isAutomaticMerge(control, widget)) return;
		const options = new Set();
		let recognized = false;
		for (const input of widget?.querySelectorAll('input[type="checkbox"]') || []) {
			let label;
			if (input.matches(removeInput) || input.closest(removeContainer)) {
				label = 'Usuń branch źródłowy po merge';
			} else if (input.matches(squashInput) || input.closest(squashContainer)) {
				label = 'Scal commity przy merge (squash)';
			}
			if (label) {
				recognized = true;
				// Disabled but checked options can be enforced by project settings.
				if (input.checked) options.add(label);
			}
		}
		if (recognized && !options.size) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		const page = location.pathname;
		const inputs = [...(widget?.querySelectorAll('input[type="checkbox"]') || [])];
		const states = inputs.map(input => input.checked);
		MRGuardUI.ask({
			title: 'Kontynuować merge?', options: [...options], confirmLabel: 'Kontynuuj merge',
			warning: recognized ? undefined
				: 'Nie udało się odczytać opcji merge. Sprawdź usuwanie brancha i squash w panelu GitLaba.',
		}).then(confirmed => {
			if (!confirmed || !control.isConnected || page !== location.pathname) return;
			const currentInputs = [...(widget?.querySelectorAll('input[type="checkbox"]') || [])];
			const unchanged = currentInputs.length === inputs.length
				&& currentInputs.every((input, index) => input === inputs[index] && input.checked === states[index]);
			// A rerender or changed checkbox must be confirmed again.
			if (unchanged) replaying.add(control);
			try { control.click(); } finally { replaying.delete(control); }
		});
	}, true);
})();
