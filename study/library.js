import {defaults,makeSet,setKey} from './sets.js';
import {freshRecord,orderedTargets} from './schedule.js';

export const progressPrefix = 'backyard-study:v1:';
export const readProgress = c => JSON.parse(localStorage.getItem(progressPrefix + setKey(c)) || 'null');
export function writeProgress(c,state) {
  localStorage.setItem(progressPrefix + setKey(c),JSON.stringify(state));
}
export function samePractice(a,b) {
  return Object.keys(defaults).every(k=>a[k] === b[k]);
}
export function dueCount(state,now) {
  return orderedTargets(state,Object.keys(state.records),now).length;
}
export function collections() {
  const sets = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(progressPrefix + 'kept:')) continue;
    const state = JSON.parse(localStorage.getItem(key));
    if (state?.collection?.scheduled) sets.push({config:state.collection.config,name:state.collection.name,due:dueCount(state,Date.now())});
  }
  return sets.sort((a,b)=>b.due-a.due || a.name.localeCompare(b.name));
}
export function extendCollection(state,source,draw) {
  const c = state.collection.config;
  // Keep photo positions stable for pending cards and review-sheet entries.
  if (c.draw) c.draw = {...draw,indices:[...new Set([...c.draw.indices,...draw.indices])]};
  const fresh = new Set(draw.indices.map(i=>source.photos[i]));
  const set = makeSet(source,c);
  const refreshed = [];
  state.records = Object.assign(Object.create(null),state.records);
  for (const taxon of set.taxa) {
    const name = taxon.scientific;
    const record = state.records[name] ??= freshRecord();
    const next = taxon.photos.findIndex(p=>fresh.has(p) && p.src !== record.lastPhoto);
    if (next >= 0) {record.cursor = next;refreshed.push(name);}
  }
  state.order = [...new Set([...refreshed,...(state.order || []),...set.taxa.map(t=>t.scientific)])];
  state.orderDay = new Date().toDateString();
  state.sheetDay = null;
  if (!state.pending?.revealed) state.pending = null;
  state.collection.revision = draw.id;
  return c;
}
const drawHistoryKey = c => 'backyard-draw-history:' + JSON.stringify([c.source,c.group,c.order,c.family,c.quality,c.target]);
export function drawHistory(c) {
  const draw = JSON.parse(localStorage.getItem(drawHistoryKey(c)) || 'null');
  return draw ? [{...c,draw}] : [];
}
export function rememberDraw(c,draw) {
  const previous = drawHistory(c)[0]?.draw;
  const indices = previous?.cycle === draw.cycle ? [...new Set([...previous.indices,...draw.indices])] : draw.indices;
  localStorage.setItem(drawHistoryKey(c),JSON.stringify({...draw,indices}));
}
