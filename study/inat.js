import {sourcePhotos} from './sets.js';

const base = 'https://api.inaturalist.org/v1/';
const pageSize = 200;
const taxaBatch = 30;
function pause(ms,signal) {
  return new Promise((resolve,reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {signal.removeEventListener('abort',stop);resolve();},ms);
    function stop() {clearTimeout(timer);reject(signal.reason);}
    signal.addEventListener('abort',stop,{once:true});
  });
}
function apiClient(signal,progress) {
  let nextRequest = 0;
  return async (path,params = {}) => {
    const url = new URL(path,base);
    url.search = new URLSearchParams({...params,locale:'en'}).toString();
    for (let attempt = 0; ; attempt++) {
      await pause(Math.max(0,nextRequest-Date.now()),signal);
      nextRequest = Date.now()+1100;
      const response = await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),credentials:'omit',referrerPolicy:'no-referrer'});
      if (response.ok) return response.json();
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        const retry = Number(response.headers.get('Retry-After')) || 2 ** (attempt+1);
        nextRequest = Date.now()+Math.max(1,retry)*1000;
        progress('Waiting for iNaturalist. Retrying…');
        continue;
      }
      if (!path.startsWith('taxa/') && (response.status === 404 || response.status === 422)) throw Error('Check the username or project identifier.');
      throw Error('iNaturalist returned HTTP ' + response.status + '. Try again later.');
    }
  };
}
const ranks = ['class','order','superfamily','family','genus','species'];
const columns = ['id','image_url','photo_attribution','user_login','iconic_taxon_name','scientific_name',
  'common_name','quality_grade','taxon_rank','photo_license','family_common_name','genus_common_name','order_common_name','class_common_name',
  ...ranks.map(r=>'taxon_'+r+'_name')];

export async function loadINat({kind,value,quality,limit,bundled,signal,progress},request = apiClient(signal,progress)) {
  value = value.trim();
  if (!value || !['user','project'].includes(kind) || !Number.isInteger(limit) || limit < 1 || limit > 20000) throw Error('Choose a source and an observation limit.');
  const query = {photos:'true',order:'desc',order_by:'id'};
  let title = kind === 'user' ? '@'+value : value;
  if (kind === 'project') {
    if (!/^[\p{L}\p{N}_-]+$/u.test(value)) throw Error('Enter a project slug or numeric ID.');
    const {results} = await request('projects/'+encodeURIComponent(value));
    if (!results?.[0]?.id) throw Error('Public project not found.');
    query.project_id = results[0].id;
    title = results[0].title || value;
  } else query[/^\d+$/.test(value) ? 'user_id' : 'user_login'] = value;
  if (quality === 'research') query.quality_grade = 'research';

  const rows = [], taxa = new Map(), missing = new Set(), seen = new Set();
  let total, scanned = 0, before;
  do {
    const per = Math.min(pageSize,limit-scanned);
    const page = await request('observations',{...query,per_page:per,...(before ? {id_below:before} : {})});
    total ??= page.total_results;
    if (!Array.isArray(page.results)) throw Error('Incomplete observation response. Try again.');
    if (!page.results.length) break;
    for (const obs of page.results) {
      if (seen.has(obs.id)) continue;
      seen.add(obs.id);
      const t = obs.taxon, photo = obs.photos?.find(p=>p.url && !p.hidden);
      if (!t?.name || !photo) continue;
      taxa.set(t.id,t);
      for (const id of t.ancestor_ids || []) missing.add(id);
      rows.push({id:obs.id,taxon:t.id,grade:obs.quality_grade,login:obs.user?.login,photo});
    }
    scanned = seen.size;
    progress('Fetched ' + scanned.toLocaleString() + ' of ' + Math.min(total,limit).toLocaleString() + ' observations.');
    const last = page.results.at(-1).id;
    if (before && last >= before) throw Error('iNaturalist repeated a page. Try again.');
    before = last;
    if (page.results.length < per) break;
  } while (scanned < Math.min(total,limit));
  if (!rows.length) throw Error('No public observations with identified, usable photos matched.');

  const ids = [...missing].filter(id=>!taxa.has(id));
  for (let i=0;i<ids.length;i+=taxaBatch) {
    progress('Loading taxonomy ' + (i+1) + '–' + Math.min(i+taxaBatch,ids.length) + ' of ' + ids.length + '…');
    const batch = await request('taxa/'+ids.slice(i,i+taxaBatch).join(','));
    if (!Array.isArray(batch.results)) throw Error('Incomplete taxonomy response. Try again.');
    for (const t of batch.results) taxa.set(t.id,t);
  }
  const data = rows.map(({id,taxon,grade,login,photo})=>{
    const t = taxa.get(taxon), lineage = {};
    for (const key of [...(t.ancestor_ids || []),t.id]) {
      const ancestor = taxa.get(key);
      if (ancestor) lineage[ancestor.rank] = ancestor;
    }
    return [id,photo.url.replace(/\/square(?=\.)/,'/medium'),photo.attribution,login,t.iconic_taxon_name,t.name,
      t.preferred_common_name,grade,t.rank,photo.license_code,...['family','genus','order','class'].map(rank=>lineage[rank]?.preferred_common_name),
      ...ranks.map(rank=>lineage[rank]?.name)].map(v=>String(v ?? ''));
  });
  const photos = sourcePhotos(columns,data,bundled);
  // Saved draws refer to positions. A changed query result must become a separate snapshot.
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([query,data])));
  const id = 'inat-' + Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  return {source:{id,title:'iNaturalist · '+title,photos},scanned,total};
}
