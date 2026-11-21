export function details(node,p) {
  node.replaceChildren();
  for (const [key,label] of [['class','Class'],['order','Order'],['family','Family'],['genus','Genus'],['species','Species'],['organism','Scientific name'],['common','Common name'],['quality','Quality grade']]) {
    const term = document.createElement('dt'), value = document.createElement('dd');
    term.textContent = label;
    value.textContent = (p[key] || 'Not recorded').replaceAll('_',' ');
    if (p[key + 'Common'] && p[key]) value.textContent += ' (' + p[key + 'Common'] + ')';
    if (['genus','species','organism'].includes(key) && p[key]) value.style.fontStyle = 'italic';
    node.append(term,value);
  }
}
export function rememberDifficulty(state,card,rating) {
  if (!card) return;
  const reasons = [];
  if (card.typed !== undefined && !card.correct) reasons.push('Typed “' + card.typed + '”');
  else if (card.mistake) reasons.push('Guessed ' + card.mistake);
  if (card.assisted) reasons.push('Used choices');
  if (rating === 'Again' || rating === 'Hard') reasons.push('Rated ' + rating);
  if (!reasons.length) return;
  state.struggles ??= [];
  state.struggles = [{name:card.name,index:card.index,reasons,at:Date.now()},...state.struggles.filter(x=>x.name !== card.name)];
}
