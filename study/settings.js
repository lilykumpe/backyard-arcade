import {answerFor,defaults, importSource, makeSet, setKey, sources, targets, sourcePhotos, starterGroup, orderLabel, presentation, byFrequency} from './sets.js';

import {loadINat} from './inat.js';
import {taxonArt} from './artwork.js';
import {drawPool,drawPhotos} from './draw.js';

const $ = id => document.getElementById(id);
const preference = 'backyard-active-study';
const library = 'backyard-saved-configs';
function read(key, fallback) {
  try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}
}
export async function setupSettings(manifest) {
  const bundled = {id:manifest.id,title:manifest.title,photos:manifest.taxa.flatMap(t => t.photos.map(p => ({...p,superfamily:t.superfamily})))};
  let imported = [];
  try {imported = await sources();} catch {$('import-status').textContent = 'Browser storage for CSV imports is unavailable.';}
  const all = new Map([bundled,...imported].map(s => [s.id,s]));
  const local = document.querySelector('meta[name="local-study-pool"]');
  if (local && !all.has(local.content)) {
    try {
      const response = await fetch(local.dataset.file);
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      const source = {id:local.content,title:local.dataset.title,photos:sourcePhotos(data.fields,data.rows,bundled.photos)};
      all.set(source.id,source);
      await sources(source);
    } catch {
      $('import-status').textContent = all.has(local.content) ? 'The project collection is available for this visit.' :
        'Reopen the local preview online to load the full project collection, or import a CSV.';
    }
  }
  const families = manifest.taxa.map(t => t.scientific);
  function prepare(source) {
    source.starterFamilies = families;
    source.hasStarterCopies = source.id !== bundled.id && source.photos.some(p => p.src.startsWith('photos/'));
  }
  all.forEach(prepare);
  function migrate(c) {
    const source = all.get(c.source);
    if (!source) return c.target === 'order' ? null : c;
    if (Object.hasOwn(targets,c.target) && makeSet(source,c).taxa.length >= 2) return c;
    const fallback = Object.keys(targets).find(target => makeSet(source,{...c,target}).taxa.length >= 2);
    const target = fallback || (Object.hasOwn(targets,c.target) ? c.target : 'family');
    if (target === c.target) return c;
    // Changing the question must never resume a pending answer from a different rank.
    return {...c,target,draw:c.draw ? {...c.draw,id:target + '-mode-' + c.draw.id} : undefined};
  }
  function savedConfigs() {
    const configs = read(library,[defaults]).map(migrate).filter(Boolean);
    return [...new Map(configs.map(c=>[setKey(c),c])).values()];
  }
  let saved = savedConfigs();
  let active = migrate({...defaults,...read(preference,{})}) || {...defaults};
  if (active && !all.has(active.source)) active = {...defaults};
  let selected = active;
  const selectKeys = Object.keys(defaults);
  const config = () => Object.fromEntries(selectKeys.map(k => [k,$(k).value]));
  const setTitle = c => {
    const source = all.get(c.source);
    return presentation(source,c,makeSet(source,c)).title;
  };
  const label = c => [setTitle(c), c.group,c.order,c.family === starterGroup ? 'Starter moth families' : c.family,targets[c.target],c.quality === 'research' ? 'Research grade' : '',c.response === 'type' ? 'Typed' : 'Recall', c.draw ? 'Draw ' + c.draw.number + ' (' + c.draw.indices.length + ' photos)' : ''].filter(Boolean).join(' · ');
  function options(id, values, current) {
    const select = $(id);
    select.replaceChildren(...values.map(([value,name]) => {
      const option = new Option(name,value);
      const art = (id === 'order' || id === 'group') && taxonArt(value);
      if (art) option.style.setProperty('--option-icon','url("' + art + '")');
      return option;
    }));
    if (values.some(([value]) => value === current)) select.value = current;
  }
  function shortcutSources() {
    return [...new Set([all.get(local?.content), ...all.values()])].filter(s => s && s.id !== bundled.id).concat(bundled);
  }
  function matchesGradeAndRank(p,c) {
    return answerFor(p,c.target) && (c.quality !== 'research' || p.quality === 'research');
  }
  function frequencies(photos,field,c) {
    const counts = new Map();
    for (const p of photos) {
      if (!p[field]) continue;
      counts.set(p[field],(counts.get(p[field]) || 0) + Number(Boolean(matchesGradeAndRank(p,c))));
    }
    return counts;
  }
  function filters(c) {
    const source = all.get($('source').value);
    let photos = source.photos;
    for (const [key,field,title] of [['group','class','All classes'],['order','order','All orders'],['family','family','All families']]) {
      // From the starter, expose the orders in the project and imported collections directly.
      let counts = frequencies(photos,field,c);
      if (key === 'order' && source.id === bundled.id) {
        // Each shortcut opens one source. Count exactly that source for its order.
        counts = new Map();
        for (const candidate of shortcutSources()) {
          const rows = c.group ? candidate.photos.filter(p => p.class === c.group) : candidate.photos;
          for (const [order,count] of frequencies(rows,field,c)) {
            if (!counts.has(order)) counts.set(order,count);
          }
        }
      }
      const placeholder = key === 'order' && source.id === bundled.id ? 'Starter moths' : title;
      const commonNames = new Map();
      for (const p of photos) {
        if (p[field+'Common']) commonNames.set(p[field],p[field+'Common']);
      }
      const list = [['',placeholder], ...[...counts].sort(byFrequency).map(([v,n]) =>
        [v,(key === 'order' ? orderLabel(v,commonNames.get(v)) : commonNames.has(v) ? v + ' (' + commonNames.get(v) + ')' : v) + ' · ' + n.toLocaleString()])];
      if (key === 'family' && families.every(f=>counts.has(f))) list.splice(1,0,[starterGroup,'Six starter moth families']);
      options(key,list,c[key]);
      if ($(key).value) photos = photos.filter(p => p[field] === $(key).value);
    }
  }
  function preview() {
    const c = config(), source = all.get(c.source);
    const counts = new Map(Object.keys(targets).map(target =>
      [target,makeSet(source,{...c,target}).taxa.length]));
    for (const option of $('target').options) {
      const count = counts.get(option.value);
      if (option.value.endsWith('Common')) option.hidden = count === 0;
      option.disabled = count < 2;
      const label = option.value === 'common' && source.id.startsWith('inat-') ? 'Species (common name)' : targets[option.value];
      option.textContent = label + (count < 2 ? ' (' + count + (count === 1 ? ' answer)' : ' answers)') : '');
    }
    const previous = c.target;
    if (counts.get(c.target) < 2) {
      const next = [...counts.keys()].find(target => counts.get(target) >= 2);
      if (next) {
        $('target').value = c.target = next;
        filters(c);
      }
    }
    const s = makeSet(source,c);
    const viable = s.taxa.length >= 2;
    const count = s.taxa.reduce((n,t) => n + t.photos.length,0);
    const dirty = setKey(currentSelection(c)) !== setKey(active);
    $('apply').hidden = !dirty && $('filter-panel').hidden;
    $('matches').textContent = dirty || !$('filter-panel').hidden ?
      count + ' eligible photographs · ' + s.taxa.length + ' distinct answers' +
      (s.eligible > count ? ' · ' + (s.eligible-count) + ' missing this name' : '') +
      (!viable ? '. Broaden the filters or choose another source to get at least two possible answers.' :
       previous !== c.target ? '. Switched to ' + targets[c.target] + ' because the previous target had fewer than two answers.' : '') : '';
    const pool = drawPool(all.get(c.source),c,saved);
    const size = Math.min(Number($('draw-size').value),pool.count + Number(Boolean(pool.contrast)));
    $('draw').disabled = !size || !viable;
    $('draw-count').textContent = pool.exhausted ? 'All matching photos have been included. Draw again to start a new cycle.' :
      pool.count + ' available for a fresh draw · ' + size + ' in the next set' + (pool.contrast ? ' (includes one earlier example for comparison)' : '');
    $('apply').disabled = !viable;
    const chosen = currentSelection(c);
    $('saved').value = saved.some(v => setKey(v) === setKey(chosen)) ? setKey(chosen) : '';
  }
  function currentSelection(c) {
    return selected.draw && selectKeys.every(k => c[k] === selected[k]) ? selected : c;
  }
  function fill(c) {
    selected = c;
    options('source',[...all.values()].sort((a,b) => b.photos.length - a.photos.length || a.title.localeCompare(b.title)).map(s=>[s.id,(s.id === bundled.id ? 'Starter pack' : s.title) + ' · ' + s.photos.length + ' photos']),c.source);
    for (const k of ['target','response','quality']) $(k).value = c[k];
    filters(c);
    preview();
  }
  const savedOptions = saved.filter(c=>all.has(c.source)).map(c => {
    const source = all.get(c.source);
    const total = makeSet(source,c).taxa.reduce((n,t) => n + t.photos.length,0);
    return {key:setKey(c),title:label(c),source:source.title,total};
  }).sort((a,b) => b.total - a.total || a.title.localeCompare(b.title));
  options('saved',[['','All matching photos'], ...savedOptions.map(s =>
    [s.key,s.title + ' · ' + s.total.toLocaleString() + ' photos · ' + s.source])],setKey(active));
  fill(active);
  const previousSize = read('backyard-draw-size',24);
  if ([12,24,36,72].includes(previousSize)) $('draw-size').value = String(previousSize);
  $('active-label').textContent = 'Playing · ' + label(active);
  $('filters').onclick = () => {
    $('filter-panel').hidden = !$('filter-panel').hidden;
    $('filters').setAttribute('aria-expanded',String(!$('filter-panel').hidden));
    preview();
  };
  $('new-set').onclick = () => {
    const c = config();
    if (c.source === bundled.id) {
      const fullSource = all.get(local?.content) || [...all.values()].find(s => s.hasStarterCopies);
      if (fullSource) {
        c.source = fullSource.id;
        if (!c.family && !c.order && !c.group) {
          c.order = 'Lepidoptera';
          c.family = starterGroup;
        }
        fill(c);
      } else if (all.size === 1) {
        $('import-status').textContent = 'This starter pack has 36 photos. Import your iNaturalist CSV here to draw from a larger collection.';
      }
    }
    $('filter-panel').hidden = false;
    $('filters').setAttribute('aria-expanded','true');
    preview();
    $('source').focus();
  };
  $('draw-size').onchange = preview;
  $('saved').onchange = () => {
    const c = saved.find(v=>setKey(v) === $('saved').value);
    if (c) fill(c);
    else fill(config());
  };
  for (const k of selectKeys) $(k).onchange = () => {
    const c = config();
    if (k === 'order' && c.order && c.source === bundled.id) {
      const source = shortcutSources().find(s => s.photos.some(p=>p.order === c.order && (!c.group || p.class === c.group)));
      if (source) $('source').value = source.id;
    }
    if (k === 'source') Object.assign(c,{group:'',order:'',family:''});
    filters(c);
    preview();
  };
  async function selectSource(source,quality) {
    await sources(source);
    prepare(source);
    all.set(source.id,source);
    fill({...config(),source:source.id,group:'',order:'',family:'',quality});
  }
  let transfer;
  const showStatus = text => {$('import-status').textContent = text;};
  function importing(busy) {
    for (const id of ['inat-load','inat-kind','inat-value','inat-grade','inat-limit','csv']) $(id).disabled = busy;
    $('inat-cancel').hidden = !transfer || !busy;
  }
  $('inat-kind').onchange = () => {
    $('inat-label').textContent = $('inat-kind').value === 'user' ? 'Username or user ID' : 'Project slug or ID';
    $('inat-value').value = '';
    $('inat-value').focus();
  };
  $('inat-value').onkeydown = event => {
    if (event.key === 'Enter') {event.preventDefault();$('inat-load').click();}
  };
  $('inat-cancel').onclick = () => transfer?.abort();
  $('inat-load').onclick = async () => {
    if (!$('inat-value').value.trim()) {showStatus('Enter a username or project identifier.');$('inat-value').focus();return;}
    transfer = new AbortController();
    importing(true);
    const quality = $('inat-grade').value;
    showStatus('Connecting to iNaturalist…');
    try {
      const {source,scanned,total} = await loadINat({kind:$('inat-kind').value,value:$('inat-value').value,
        quality,limit:Number($('inat-limit').value),bundled:bundled.photos,signal:transfer.signal,progress:showStatus});
      transfer.signal.throwIfAborted();
      $('inat-cancel').hidden = true;
      await selectSource(source,quality);
      showStatus(source.photos.length.toLocaleString() + ' photos loaded from ' + scanned.toLocaleString() + ' of ' + total.toLocaleString() + ' matching observations.');
    } catch (error) {showStatus(transfer.signal.aborted ? 'Import cancelled.' : 'Import failed. ' + error.message);}
    finally {transfer = null;importing(false);}
  };
  $('csv').onchange = async () => {
    const file = $('csv').files[0];
    if (!file) return;
    importing(true);
    $('import-status').textContent = 'Reading ' + file.name + '…';
    try {
      const source = await importSource(file,bundled.photos);
      await selectSource(source,config().quality);
      $('import-status').textContent = source.photos.length + ' named photo records imported. Choose your settings, then start the set.';
    } catch (error) {$('import-status').textContent = 'Import failed. ' + error.message;}
    $('csv').value = '';
    importing(false);
  };
  function launch(c, replayFrom) {
    try {
      saved = savedConfigs();
      if (c.draw) localStorage.setItem('backyard-draw-size',JSON.stringify(Number($('draw-size').value)));
      if (!saved.some(v=>setKey(v) === setKey(c))) saved.push(c);
      localStorage.setItem(library,JSON.stringify(saved));
      localStorage.setItem(preference,JSON.stringify(c));
      // Starting a saved set explicitly resumes even if it was left on its sheet.
      sessionStorage.setItem('backyard-resume',setKey(c));
      if (replayFrom) sessionStorage.setItem('backyard-start-replay',JSON.stringify({from:replayFrom,to:setKey(c)}));
      location.reload();
    } catch {$('import-status').textContent = 'Unable to save settings in this browser.';}
  };
  $('settings').onsubmit = e => {
    e.preventDefault();
    if (!$('apply').disabled) launch(currentSelection(config()));
  };
  $('draw').onclick = () => {
    const c = config();
    const pool = drawPool(all.get(c.source),c,savedConfigs());
    if (!$('draw').disabled && pool.count) launch({...c,draw:drawPhotos(pool,Number($('draw-size').value))});
  };
  const source = all.get(active.source);
  const set = makeSet(source,active);
  Object.assign(set,presentation(source,active,set));
  function replayTyped() {
    const typed = {...active,response:'type'};
    if (active.draw) typed.draw = {...active.draw,originalResponse:active.draw.originalResponse || active.response};
    launch(typed,set.id);
  }
  return {set,config:active,replayTyped};
}
