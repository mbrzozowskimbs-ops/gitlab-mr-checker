'use strict';

function gitlabOrigin(value) {
	let url;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error('Wpisz pełny adres, np. https://gitlab.example.com');
	}
	if (url.protocol !== 'https:' || url.username || url.password || url.port
		|| url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
		throw new Error('Podaj wyłącznie adres HTTPS serwera, bez loginu, portu, ścieżki i parametrów.');
	}
	return url.origin;
}
