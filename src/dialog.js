'use strict';

// Shared by both guards in the extension's isolated content-script world.
const MRGuardUI = (() => {
	let active = false;

	function ask({ title, options, warning, confirmLabel }) {
		if (active) return Promise.resolve(false);
		active = true;
		return new Promise(resolve => {
			const previousFocus = document.activeElement;
			const host = document.createElement('div');
			const root = host.attachShadow({ mode: 'closed' });
			const style = document.createElement('style');
			style.textContent = `
				:host { all: initial; }
				dialog { box-sizing: border-box; width: min(520px, calc(100vw - 32px));
					max-height: calc(100dvh - 40px); overflow: auto; padding: 28px; margin: auto;
					border: 1px solid #394055; border-radius: 20px; background: #1b1e2b; color: #f4f5fa;
					font: 15px/1.55 system-ui, sans-serif; color-scheme: dark;
					box-shadow: 0 24px 90px #0009; }
				dialog::backdrop { background: #090b14b8; backdrop-filter: blur(4px); }
				.brand { display: flex; align-items: center; gap: 12px; color: #afb5c8;
					font-size: 12px; font-weight: 600; letter-spacing: .04em; }
				.brand svg { width: 40px; height: 40px; flex: none; }
				h2 { margin: 22px 0 8px; font-size: 25px; line-height: 1.25; letter-spacing: -.03em; }
				p { margin: 0 0 18px; color: #b9bfd0; }
				ul { display: grid; gap: 10px; list-style: none; padding: 0; margin: 20px 0; }
				li { padding: 14px 16px; border: 1px solid #665235; border-radius: 12px;
					background: #30291f; color: #ffe0a3; font-weight: 600; }
				.warning { padding: 14px 16px; border-radius: 12px; background: #30291f; color: #ffe0a3; }
				.actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
				button { padding: 11px 18px; border: 1px solid #495167; border-radius: 10px;
					background: #292e40; color: #f4f5fa; font: 600 14px/1.4 system-ui, sans-serif; cursor: pointer; }
				button:hover { background: #363d52; }
				button.primary { background: #70e3b5; border-color: #70e3b5; color: #10291f; }
				button.primary:hover { background: #95edcd; }
				button:focus-visible { outline: 3px solid #c4b5fd; outline-offset: 3px; }
				.note { font-size: 12px; margin: 18px 0 0; color: #969eb4; }
			`;
			const dialog = document.createElement('dialog');
			dialog.setAttribute('aria-labelledby', 'guard-title');
			dialog.setAttribute('aria-describedby', 'guard-description');
			function element(tag, text, className) {
				const node = document.createElement(tag);
				if (text) node.textContent = text;
				if (className) node.className = className;
				return node;
			}
			const brand = element('div', null, 'brand');
			const ns = 'http://www.w3.org/2000/svg';
			const icon = document.createElementNS(ns, 'svg');
			icon.setAttribute('viewBox', '0 0 128 128');
			icon.setAttribute('aria-hidden', 'true');
			for (const [tag, attrs] of [
				['rect', { x: 4, y: 4, width: 120, height: 120, rx: 28, fill: '#171b2d' }],
				['path', { d: 'M37 32v64M85 32v12c0 22-48 15-48 34', fill: 'none', stroke: '#f8fafc', 'stroke-width': 9 }],
				...[[37, 32], [85, 32], [37, 96]].map(([cx, cy]) =>
					['circle', { cx, cy, r: 10, fill: '#171b2d', stroke: '#f8fafc', 'stroke-width': 9 }]),
				['circle', { cx: 91, cy: 91, r: 25, fill: '#34d399', stroke: '#171b2d', 'stroke-width': 6 }],
				['path', { d: 'm80 91 8 8 15-17', fill: 'none', stroke: '#13251f', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }],
			]) {
				const shape = document.createElementNS(ns, tag);
				for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
				icon.append(shape);
			}
			brand.append(icon, element('span', 'Gitlab MR Checker'));
			const heading = element('h2', title);
			heading.id = 'guard-title';
			const description = element('p', 'Sprawdź wybrane opcje przed kontynuowaniem.');
			description.id = 'guard-description';
			const list = element('ul');
			for (const option of options) list.append(element('li', option));
			const actions = element('div', null, 'actions');
			const cancel = element('button', 'Wróć do MR');
			const confirm = element('button', confirmLabel, 'primary');
			cancel.type = confirm.type = 'button';
			let finished = false;
			function finish(accepted) {
				if (finished) return;
				finished = true;
				dialog.close();
				host.remove();
				active = false;
				if (previousFocus?.isConnected) previousFocus.focus();
				resolve(accepted);
			}
			cancel.addEventListener('click', () => finish(false));
			confirm.addEventListener('click', () => finish(true));
			dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
			dialog.addEventListener('click', event => {
				const rect = dialog.getBoundingClientRect();
				if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
					|| event.clientY < rect.top || event.clientY > rect.bottom)) finish(false);
			});
			actions.append(cancel, confirm);
			dialog.append(brand, heading, description, list);
			if (warning) dialog.append(element('p', warning, 'warning'));
			dialog.append(actions, element('p', 'Anulowanie pozostawi MR bez zmian. Esc zamyka to okno.', 'note'));
			root.append(style, dialog);
			document.documentElement.append(host);
			dialog.showModal();
			cancel.focus();
		});
	}
	return { ask };
})();
