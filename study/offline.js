export async function setupOffline(set) {
  const button = document.querySelector('#offline');
  const status = document.querySelector('#download-status');
  const meter = document.querySelector('#meter');
  if (!('serviceWorker' in navigator) || !window.caches) {
    status.textContent = 'Offline saving needs localhost or HTTPS.';
    return;
  }
  // The worker and page share a cache name scoped to this installation path.
  const reg = await navigator.serviceWorker.register('./sw.js');
  const worker = reg.installing || reg.waiting;
  if (!reg.active && worker) await new Promise((resolve,reject) => {
    function changed() {
      if (worker.state === 'activated') resolve();
      if (worker.state === 'redundant') reject(new Error('Offline files could not be installed.'));
    }
    worker.addEventListener('statechange', changed);
    changed();
  });
  await navigator.serviceWorker.ready;
  const cache = await caches.open('backyard-photos-v1:' + reg.scope);
  const assets = set.taxa.flatMap(taxon => taxon.photos.map(photo => new URL(photo.src, document.baseURI).href));
  async function missing() {
    const keys = new Set((await cache.keys()).map(key => key.url));
    return assets.filter(url => !keys.has(url));
  }
  const done = () => {
    button.textContent = '✓ Set saved offline';
    button.disabled = true;
    status.textContent = assets.length + ' photographs ready on this device';
    meter.hidden = true;
  };
  const remaining = await missing();
  if (!remaining.length) return done();
  button.disabled = false;
  if (remaining.length < assets.length) status.textContent = (assets.length - remaining.length) + ' of ' + assets.length + ' photographs saved';
  button.onclick = async () => {
    button.disabled = true;
    try {
      const queue = await missing();
      meter.max = assets.length;
      meter.value = assets.length - queue.length;
      meter.hidden = false;
      const update = () => {status.textContent = 'Saved ' + meter.value + ' of ' + meter.max + ' photographs';};
      update();
      async function download() {
        while (queue.length) {
          const url = queue.shift();
          let response;
          try {response = await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});}
          catch (error) {
            if (new URL(url).origin === location.origin) throw error;
            // A photo host can permit display without permitting CORS reads.
            const image = new Image();
            image.referrerPolicy = 'no-referrer';
            image.src = url;
            await image.decode();
            response = await fetch(url,{mode:'no-cors',credentials:'omit',referrerPolicy:'no-referrer'});
          }
          if (response.type !== 'opaque' && (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/'))) throw new Error('Photo unavailable');
          await cache.put(url,response);
          meter.value++;
          update();
        }
      }
      const results = await Promise.allSettled(Array.from({length:3},download));
      if (results.some(r => r.status === 'rejected') || (await missing()).length) throw new Error('Incomplete download');
      done();
    } catch {
      status.textContent = meter.value + ' of ' + assets.length + ' saved. Check connection or browser storage, then retry.';
      button.textContent = 'Resume offline download';
      button.disabled = false;
    }
  };
}
