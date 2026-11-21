import {setArt} from './artwork.js';

export const targets = {family:'Family', genus:'Genus', species:'Species (scientific name)', common:'Common name', familyCommon:'Family (common name)', genusCommon:'Genus (common name)'};
export const builtinId = 'backyard-moth-families';
export const defaults = {source:builtinId, target:'family', response:'recall', group:'', order:'', family:'', quality:'all'};
export function setKey(config) {
  if (config.draw) {
    const key = 'draw:' + config.draw.id;
    return config.draw.originalResponse && config.response !== config.draw.originalResponse ? key + ':' + config.response : key;
  }
  return Object.keys(defaults).every(k => config[k] === defaults[k]) ? builtinId :
    JSON.stringify(Object.keys(defaults).map(k => config[k]));
}
export const starterGroup = '@starter-families';
export function answerFor(photo,target) {
  if (target === 'common' && photo.observedRank && !photo.species) return '';
  return photo[target];
}
export function makeSet(source, config) {
  const groups = new Map();
  let eligible = 0;
  const photos = config.draw ? config.draw.indices.map(i => source.photos[i]) : source.photos;
  for (const p of photos) {
    if (config.group && config.group !== p.class || config.order && config.order !== p.order ||
        config.family && (config.family === starterGroup ? !source.starterFamilies?.includes(p.family) : config.family !== p.family) || config.quality === 'research' && p.quality !== 'research') continue;
    eligible++;
    const name = answerFor(p,config.target);
    if (!name) continue;
    if (!groups.has(name)) groups.set(name,{scientific:name,superfamily:p.superfamily,photos:[]});
    groups.get(name).photos.push(p);
  }
  return {id:setKey(config),title:source.title,rank:config.target,nameMode:'scientific',taxa:[...groups.values()],eligible};
}
const orderNames = {Coleoptera:'Beetle',Diptera:'Fly',Hemiptera:'True bug',Odonata:'Dragonfly and damselfly',
  Lepidoptera:'Butterfly and moth',Hymenoptera:'Hymenoptera',Araneae:'Spider'};
const classNames = {Insecta:'Insect', Aves:'Bird', Arachnida:'Arachnid', Mammalia:'Mammal',
  Reptilia:'Reptile', Amphibia:'Amphibian', Gastropoda:'Gastropod'};

export function byFrequency(a,b) {
  return b[1] - a[1] || a[0].localeCompare(b[0]);
}
const plurals = {family:'Families',genus:'Genera',species:'Species',common:'Common names', familyCommon:'Family common names', genusCommon:'Genus common names'};

const commonOrders = {Coleoptera:'beetles',Odonata:'dragonflies and damselflies',Lepidoptera:'butterflies and moths',
  Hemiptera:'true bugs',Hymenoptera:'ants, bees and wasps',Diptera:'flies',Orthoptera:'grasshoppers and crickets',
  Blattodea:'cockroaches and termites',Neuroptera:'lacewings and allies',Trichoptera:'caddisflies',Mantodea:'mantises',
  Dermaptera:'earwigs',Phasmida:'stick insects',Plecoptera:'stoneflies',Ephemeroptera:'mayflies',Thysanoptera:'thrips'};
export function orderLabel(order,preferred) {
  const common = preferred || commonOrders[order];
  return common ? order + ' (' + common + ')' : order;
}
export function presentation(source,c,set) {
  const photos = set.taxa.flatMap(t => t.photos);
  const order = c.order || (photos.length && photos.every(p => p.order === photos[0].order) ? photos[0].order : '');
  const moths = source.id === builtinId || c.family === starterGroup ||
    (order === 'Lepidoptera' && photos.length && photos.every(p => source.starterFamilies.includes(p.family)));
  let subject = c.family && c.family !== starterGroup ? c.family : '';
  if (!subject && moths) subject = source.id === builtinId ? 'Backyard Moth' : 'Moth';
  const group = c.group || (photos.length && photos.every(p => p.class === photos[0].class) ? photos[0].class : '');
  if (!subject) subject = orderNames[order] || order || classNames[group] || group;
  const broadGroups = new Set(photos.map(p => p.iconic || p.class || ''));
  if (!subject && broadGroups.size === 1) {
    const [shared] = broadGroups;
    subject = classNames[shared] || ({Plantae:'Plant', Fungi:'Fungal', Mollusca:'Mollusc'})[shared] || shared;
  }
  const mixed = new Set(photos.map(p => p.class).filter(Boolean)).size > 1;
  const title = subject ? subject + ' ' + plurals[c.target] : (mixed ? 'Mixed Taxa' : 'Identification') + ' · ' + plurals[c.target];
  return {title, art:setArt(photos,order,group,moths)};
}
export function normalize(s) {
  return s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
}
// iNaturalist exports can contain embedded newlines and doubled quotes in notes.
export function parseCSV(text) {
  const rows = [];
  let field = '', row = [], quoted = false;
  const finish = () => {row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = [];field = '';};
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {field += '"'; i++;}
      else quoted = !quoted;
    } else if (!quoted && c === ',') {row.push(field.trim()); field='';}
    else if (!quoted && (c === '\r' || c === '\n')) {
      if (c === '\r' && text[i+1] === '\n') i++;
      finish();
    } else field += c;
  }
  if (quoted) throw new Error('An unfinished quoted field was found in the CSV.');
  finish();
  return rows;
}
function webUrl(value) {
  try {const u = new URL(value);return ['http:','https:'].includes(u.protocol) ? u.href : '';}
  catch {return '';}
}
export function sourcePhotos(head, rows, bundled) {
  const fields = new Map((head || []).map((h,i) => [h.toLowerCase(),i]));
  if (!fields.has('image_url')) throw new Error('Include the image_url column in your iNaturalist export.');
  const known = new Map(bundled.map(p => [p.photoUrl,p]));
  const photos = [], seen = new Set();
  for (const row of rows) {
    const get = k => (row[fields.get(k)] || '').trim();
    const src = webUrl(get('image_url'));
    if (!src || seen.has(src)) continue;
    const u = new URL(src);
    const id = ['static.inaturalist.org','inaturalist-open-data.s3.amazonaws.com'].includes(u.hostname) && u.pathname.match(/^\/photos\/(\d+)\//)?.[1];
    const photoUrl = id ? 'https://www.inaturalist.org/photos/' + id : '';
    const match = known.get(photoUrl);
    const organism = get('scientific_name'), species = get('taxon_species_name') ||
      (!fields.has('taxon_species_name') && /^[A-Z][a-z-]+ [a-z][a-z-]+$/.test(organism) ? organism : '');
    const p = {src:match?.src || src, observation:webUrl(get('url')) || (/^\d+$/.test(get('id')) ? 'https://www.inaturalist.org/observations/' + get('id') : ''),
      photoUrl,credit:get('photo_attribution') || match?.credit || '',observer:get('user_name') || get('user_login'),
      iconic:get('iconic_taxon_name') || get('taxon_kingdom_name'),class:get('taxon_class_name'),order:get('taxon_order_name'),superfamily:get('taxon_superfamily_name'),
      family:get('taxon_family_name'),genus:get('taxon_genus_name') || species.split(' ')[0],species,organism,
      observedRank:get('taxon_rank'),common:get('common_name') || get('preferred_common_name') || get('taxon_common_name') || get('english_common_name'),
      familyCommon:get('family_common_name'),genusCommon:get('genus_common_name'),
      orderCommon:get('order_common_name'),classCommon:get('class_common_name'),license:get('photo_license') || match?.license || '',quality:get('quality_grade').toLowerCase()};
    // Keep row positions stable for photo draws saved by older versions.
    if (!p.order && !Object.keys(targets).some(k => p[k])) continue;
    seen.add(src);photos.push(p);
  }
  if (!photos.some(p => Object.keys(targets).some(k => p[k]))) throw new Error('No photographs with usable names were found. Include image URLs and the taxonomic columns you want to study.');
  return photos;
}
export async function importSource(file,bundled) {
  const text = await file.text();
  const [head,...rows] = parseCSV(text);
  const photos = sourcePhotos(head,rows,bundled);
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  const id = Array.from(new Uint8Array(hash),b => b.toString(16).padStart(2,'0')).join('');
  return {id,title:file.name.replace(/\.csv$/i,''),photos};
}
async function database() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('backyard-study-library',1);
    request.onupgradeneeded = () => request.result.createObjectStore('sources',{keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function sources(stored) {
  const db = await database();
  try {
    return await new Promise((resolve,reject) => {
      const tx = db.transaction('sources',stored ? 'readwrite' : 'readonly');
      const store = tx.objectStore('sources');
      const req = stored ? store.put(stored) : store.getAll();
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || new Error('Browser storage unavailable'));
    });
  } finally {db.close();}
}
