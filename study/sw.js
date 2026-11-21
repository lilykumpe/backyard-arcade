const scope = self.registration.scope;
const shellName = 'backyard-shell-v14:' + scope;
const photoName = 'backyard-photos-v1:' + scope;
const shell = ['index.html','study.css','review.js','offline.js','schedule.js','sets.js','inat.js','artwork.js','icons/index.json','draw.js','settings.js','answers.js','set.json','display.ttf','moth.png','beetle.png','lens.png'];
const home = new URL('index.html',scope).href;
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(shellName);
  await cache.addAll(shell.map(path => new Request(new URL(path,scope), {cache:'reload'})));
  const index = await cache.match(new URL('icons/index.json',scope).href);
  const icons = await index.json();
  await cache.addAll(icons.map(file => new Request(new URL('icons/' + file,scope), {cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (!url.href.startsWith(scope)) {
    if (event.request.destination === 'image') {
      event.respondWith(caches.open(photoName).then(async cache =>
        await cache.match(event.request) || fetch(event.request)));
    }
    return;
  }
  const path = url.pathname.slice(new URL(scope).pathname.length);
  if (path === '' || shell.includes(path) || path.startsWith('icons/')) {
    event.respondWith(caches.open(shellName).then(async cache =>
      await cache.match(path ? new URL(path,scope).href : home) || fetch(event.request)));
  } else if (path.startsWith('photos/')) {
    event.respondWith(caches.open(photoName).then(async cache =>
      await cache.match(event.request) || fetch(event.request)));
  }
});
