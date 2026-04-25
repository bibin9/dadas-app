// Minimal service worker — required for full PWA install support on Android.
// We don't cache anything (the app needs live data); this just enables installability.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* network only */ });
