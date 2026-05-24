const cacheName = "tri-translate-v1";
const appShell = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isShellAsset = url.origin === location.origin && /\.(html|js|css|webmanifest|svg)$/.test(url.pathname);
  event.respondWith(
    event.request.mode === "navigate" || isShellAsset
      ? fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
      : caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
