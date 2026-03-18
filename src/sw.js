const CACHE_NAME = "v9";

// Compute the base URL from the service worker's own location so the
// cached paths work both at the site root (localhost) and under a
// sub-path like /chooser/ on GitHub Pages.
const BASE = self.location.pathname.replace(/sw\.js$/, "");

const CACHE_URLS = [
	BASE,
	BASE + "index.css",
	BASE + "index.js",
	BASE + "favicon.ico",
	BASE + "manifest.webmanifest",
	BASE + "images/logo-16.png",
	BASE + "images/logo-32.png",
	BASE + "images/logo-48.png",
	BASE + "images/logo-96.png",
	BASE + "images/logo-144.png",
	BASE + "images/logo-192.png",
	BASE + "images/logo-192-opaque.png",
	BASE + "images/logo-384.png",
	BASE + "images/logo-maskable-48.png",
	BASE + "images/logo-maskable-96.png",
	BASE + "images/logo-maskable-144.png",
	BASE + "images/logo-maskable-192.png",
	BASE + "images/logo-maskable-384.png",
];

addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
	);
});

addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) =>
			Promise.all(
				cacheNames.map((cacheName) => {
					if (cacheName !== CACHE_NAME) {
						return caches.delete(cacheName);
					}
				})
			)
		)
	);
});

addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			if (response) {
				return response;
			}

			return fetch(event.request);
		})
	);
});

addEventListener("message", (event) => {
	if (event.data === "version") {
		event.source.postMessage({ version: CACHE_NAME });
	}
});
