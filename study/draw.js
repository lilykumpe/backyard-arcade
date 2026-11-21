import {makeSet} from './sets.js';

const poolFields = ['source','group','order','family','quality','target'];

export function drawPool(source, config, saved) {
  const pool = makeSet(source,config);
  const history = saved.filter(c => c.draw && poolFields.every(k => c[k] === config[k]));
  let cycle = Math.max(1,...history.map(c => c.draw.cycle));
  const used = new Set(history.filter(c => c.draw.cycle === cycle).flatMap(c => c.draw.indices));
  const indices = new Map(source.photos.map((p,i) => [p,i]));
  const groups = pool.taxa.map(t => t.photos.map(p => indices.get(p)));
  // Locally bundled photos are already available in the starter set.
  if (cycle === 1 && source.hasStarterCopies) {
    source.photos.forEach((p,i) => {if (p.src.startsWith('photos/')) used.add(i);});
  }
  let remaining = groups.map(g => g.filter(i => !used.has(i))).filter(g => g.length);
  const exhausted = groups.length > 0 && !remaining.length;
  if (exhausted) {
    cycle++;
    remaining = groups;
  }
  const contrast = remaining.length === 1 && groups.length > 1 ?
    groups.filter(g => !g.includes(remaining[0][0])).flat() : null;
  return {groups:remaining, contrast, count:remaining.reduce((n,g) => n + g.length,0), exhausted, cycle,
    number:history.reduce((max,c)=>Math.max(max,c.draw.number || 1),0) + 1};
}
function shuffle(values) {
  const copy = [...values];
  for (let i=copy.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]] = [copy[j],copy[i]];
  }
  return copy;
}
export function drawPhotos(pool, size) {
  let groups = shuffle(pool.groups).map(shuffle);
  const indices = [];
  // When the tail has just one answer left, reserve a slot for a contrasting taxon.
  const freshLimit = pool.contrast ? size - 1 : size;
  while (indices.length < freshLimit && groups.length) {
    for (const g of groups) {
      indices.push(g.pop());
      if (indices.length === freshLimit) break;
    }
    groups = groups.filter(g => g.length);
  }
  if (pool.contrast) indices.push(pool.contrast[Math.floor(Math.random() * pool.contrast.length)]);
  return {id:crypto.randomUUID(),number:pool.number,cycle:pool.cycle,indices};
}
