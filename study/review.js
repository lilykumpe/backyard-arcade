import {freshRecord, grade, interval, orderedTargets, ratings} from './schedule.js';
import {progressPrefix} from './library.js';
import {setupOffline} from './offline.js';

import {setupSettings} from './settings.js';
import {normalize} from './sets.js';
import {details, rememberDifficulty} from './answers.js';

const $ = selector => document.querySelector(selector);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, click, primary = false) {
  const node = el('button', text, primary ? 'primary' : '');
  node.onclick = click;
  return node;
}
function link(text, url) {
  const node = el('a',text);
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener';
  return node;
}
function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i],copy[j]] = [copy[j],copy[i]];
  }
  return copy;
}
async function start() {
  const response = await fetch('./set.json');
  if (!response.ok) throw new Error('Set unavailable');
  const {set,config,replayTyped,refreshLibrary} = await setupSettings(await response.json());
  const typing = config.response === 'type';
  const rank = {species:'species',common:'common name',familyCommon:'family',genusCommon:'genus'}[config.target] || config.target;
  $('h1').textContent = set.title;
  $('#set-art').src = set.art;
  $('#set-art').hidden = false;
  document.title = set.title + ' · Backyard Arcade';
  const taxa = new Map(set.taxa.map(t => [t[set.nameMode], t]));
  const names = [...taxa.keys()];
  const key = progressPrefix + set.id;
  const totalPhotos = set.taxa.reduce((sum,t) => sum + t.photos.length,0);
  const unit = {family:['family','families'],genus:['genus','genera'],species:['species','species'],common:['common name','common names'],familyCommon:['family','families'],genusCommon:['genus','genera']}[config.target];
  $('#description').textContent = names.length + ' ' + unit[Number(names.length !== 1)] + '  /  ' + totalPhotos + ' photographs';
  if (names.length < 2) {
    $('#keep').hidden = true;
    $('#desk').hidden = true;
    $('#exit').hidden = true;
    $('.download').hidden = true;
    $('#empty-study').hidden = false;
    if ($('#filter-panel').hidden) $('#filters').click();
    return;
  }
  let state;
  try {state = JSON.parse(localStorage.getItem(key));}
  catch {$('#notice').textContent = 'Saved progress is unavailable in this browser.';}
  state ??= {records:{},total:0,pending:null};
  state.records = Object.assign(Object.create(null),state.records);
  for (const name of names) state.records[name] ??= freshRecord();
  const replayRequest = JSON.parse(sessionStorage.getItem('backyard-start-replay') || 'null');
  if (typing && replayRequest?.to === set.id) {
    const prior = JSON.parse(localStorage.getItem('backyard-study:v1:' + replayRequest.from) || 'null');
    for (const name of names) {
      if (!state.records[name].turns && prior?.records?.[name]) state.records[name].cursor = prior.records[name].cursor;
    }
    state.replayQueue = shuffled(names);
    state.pending = null;
    state.sheetDay = null;
    persist();
    sessionStorage.removeItem('backyard-start-replay');
  }
  let card, nextTimer, warmed = [], loaded = false;
  const failed = new Set();
  const photoFor = (name, index) => {
    const photos = taxa.get(name).photos;
    return photos[index % photos.length];
  };
  const due = (early = false) => orderedTargets(state,state.order,Date.now(),early);
  function persist() {
    try {localStorage.setItem(key,JSON.stringify(state));}
    catch {$('#notice').textContent = 'Browser storage is unavailable. This session’s progress is temporary.';}
  }
  function tally() {
    const sum = field => names.reduce((n,name) => n + state.records[name][field],0);
    $('#due-count').textContent = due().length;
    $('#recall-count').textContent = sum('unaided');
    $('#choice-count').textContent = sum('assisted');
  }
  function preload() {
    const upcoming = state.replayQueue || due(true);
    warmed = upcoming.filter(name => name !== card.name).slice(0,2).map(name => {
      const img = new Image();
      img.fetchPriority = 'low';
      img.src = photoFor(name,state.records[name].cursor).src;
      return img;
    });
  }
  function sourceLink(photo) {
    if (photo.observation) return link('Observation ↗',photo.observation);
    if (photo.photoUrl) return link('Photo ↗',photo.photoUrl);
    return null;
  }
  function compare() {
    const area = $('#comparison'), pair = $('#pair');
    pair.replaceChildren();
    area.hidden = !card.mistake;
    if (!card.mistake) return;
    // Show a different example from the other family's next scheduled photograph.
    for (const [name,index] of [[card.name,card.index],[card.mistake,state.records[card.mistake].cursor + taxa.get(card.mistake).photos.length - 1]]) {
      const p = photoFor(name,index);
      const fig = el('figure'), img = el('img'), caption = el('figcaption');
      img.src = p.src;
      img.alt = p.organism + ', ' + name;
      caption.append(el('small',name === card.name ? 'Answer' : 'Your guess'),el('strong',name));
      const source = sourceLink(p);
      if (source) caption.append(source);
      fig.append(img,caption);
      pair.append(fig);
    }
  }
  function choices() {
    card.assisted = true;
    // Prefer previously confused families, then relatives in the same superfamily.
    const score = name => {
      const confusions = (state.records[card.name].mixed[name] || 0) + (state.records[name].mixed[card.name] || 0);
      return confusions * 2 + Number(taxa.get(name).superfamily === taxa.get(card.name).superfamily);
    };
    const alternatives = shuffled(names.filter(name => name !== card.name)).sort((a,b) => score(b) - score(a));
    card.options ??= shuffled([card.name,...alternatives.slice(0,3)]);
    persist();
    render();
    $('#actions button').focus();
  }
  function reveal(choice = null, mistake = null) {
    card.revealed = true;
    card.choice = choice;
    card.mistake = mistake || (choice && choice !== card.name ? choice : null);
    persist();
    render();
    $('#prompt').focus({preventScroll:true});
  }
  function advanceReplay() {
    if (!state.replayQueue) return;
    state.replayQueue.shift();
    if (!state.replayQueue.length) delete state.replayQueue;
  }
  function rate(rating) {
    rememberDifficulty(state,card,card.mistake || card.correct === false ? null : rating);
    grade(state,card,rating,Date.now());
    state.records[card.name].lastPhoto = photoFor(card.name,card.index).src;
    advanceReplay();
    persist();
    refreshLibrary();
    showNext(false,true);
  }
  function typeForm() {
    const form = el('form',null,'type-form'), label = el('label','Your answer'), input = el('input');
    input.required = true;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize','none');
    input.maxLength = 250;
    label.append(input);
    form.append(label,el('button','Check answer','primary'));
    form.onsubmit = e => {
      e.preventDefault();
      if (!loaded || !input.value.trim()) return;
      card.typed = input.value.trim();
      card.correct = normalize(card.typed) === normalize(card.name);
      const match = !card.correct && names.find(n=>normalize(n) === normalize(card.typed));
      reveal(null,match);
    };
    return form;
  }
  function render() {
    const actions = $('#actions'), prompt = $('#prompt'), caption = $('#caption');
    const photo = photoFor(card.name,card.index);
    actions.replaceChildren();
    $('#taxonomy').hidden = !card.revealed;
    $('#taxonomy').replaceChildren();
    if (card.revealed) details($('#taxonomy'),photo);
    prompt.textContent = card.revealed ? card.name : rank === 'common name' ? 'What is its common name?' : 'Which ' + rank + (config.target.endsWith('Common') ? ' (common name)?' : '?');
    const incorrect = Boolean(card.mistake) || card.correct === false;
    const mode = card.assisted ? 'Assisted recognition' : typing ? 'Typed recall' : 'Unaided recall';
    $('#mode').textContent = incorrect ? 'Incorrect' : card.revealed && (card.choice || card.correct) ? 'Correct' : mode;
    $('#specimen').alt = card.revealed ? photo.organism + ', ' + card.name : 'Organism to identify';
    const observationId = photo.observation?.match(/observations\/(\d+)/);
    $('#photo-id').textContent = observationId ? 'iNat #' + observationId[1] : '';
    caption.replaceChildren();
    caption.hidden = !card.revealed;
    if (card.revealed) {
      caption.append(el('i',photo.organism || card.name));
      const source = sourceLink(photo);
      if (source) caption.append(source);
    }
    if (card.revealed && incorrect) {
      actions.append(button('Next',() => rate('Again'),true));
    } else if (card.revealed) {
      const grid = el('div',null,'grid');
      for (const rating of ratings) {
        const span = interval(state.records[card.name],rating,card.assisted || card.correct === false);
        const label = span.minutes ? span.minutes + ' min' : span.days === 1 ? 'Tomorrow' : span.days + ' days';
        const btn = button(rating,() => rate(rating),rating === 'Good');
        btn.append(el('small',label));
        grid.append(btn);
      }
      actions.append(grid);
    } else if (typing) {
      actions.append(typeForm());
    } else if (card.assisted) {
      const grid = el('div',null,'grid');
      for (const option of card.options) grid.append(button(option,() => reveal(option)));
      actions.append(grid,button('Reveal answer',() => reveal()));
    } else {
      actions.append(button('Reveal answer',() => reveal(),true));
      if (names.length > 1) actions.append(button('Show choices',choices));
    }
    for (const b of actions.querySelectorAll('button')) b.disabled = !loaded;
    compare();
    tally();
  }
  function loadPhoto() {
    const img = $('#specimen'), status = $('#image-status');
    const photo = photoFor(card.name,card.index);
    loaded = false;
    status.hidden = false;
    status.textContent = 'Loading photograph…';
    render();
    img.onload = () => {
      loaded = true;
      status.hidden = true;
      for (const b of $('#actions').querySelectorAll('button')) b.disabled = false;
      preload();
    };
    img.onerror = () => {
      failed.add(photo.src);
      const offset = taxa.get(card.name).photos.findIndex((_,i) => !failed.has(photoFor(card.name,card.index+i).src));
      if (offset >= 0 && !card.revealed) {
        card.index += offset;
        persist();
        return loadPhoto();
      }
      status.replaceChildren('Photograph unavailable.',button('Retry photograph',() => {failed.clear();loadPhoto();}));
      if (names.length > 1) status.append(button('Skip unavailable answer',() => {
        advanceReplay();
        state.records[card.name].due = Date.now() + 120000;
        state.records[card.name].revisit = null;
        state.pending = null;
        persist();
        showNext();
      }));
    };
    img.src = photo.src;
  }
  function showNext(early = false, focus = false) {
    clearTimeout(nextTimer);
    const day = new Date().toDateString();
    if (state.orderDay !== day || state.order?.length !== names.length) {
      state.order = shuffled(names);
      state.orderDay = day;
    }
    const name = state.pending?.name || state.replayQueue?.[0] || due(early)[0];
    $('#desk').hidden = !name;
    $('#finished').hidden = !!name;
    $('#comparison').hidden = true;
    if (!name) {
      const today = state.today;
      $('#summary').textContent = today?.day === day ?
        'Today you rated ' + today.recalled + ' of ' + today.unaided + ' unaided reviews Good or Easy. Reviews with choices: ' + today.assisted + '.' : '';
      const at = Math.min(...names.map(n => Math.min(state.records[n].due,state.records[n].revisit?.time ?? Infinity)));
      $('#next-due').textContent = 'Next review ' + new Date(at).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) + '. Answers rotate through their available photographs.';
      nextTimer = setTimeout(() => showNext(),Math.min(2147483647,Math.max(100,at-Date.now()+100)));
      if (focus) $('#finished h2').focus();
      return;
    }
    card = state.pending ?? {name,index:state.records[name].cursor,assisted:false,revealed:false};
    state.pending = card;
    persist();
    loadPhoto();
    if (focus || state.replayQueue) ($('.type-form input') || $('#prompt')).focus({preventScroll:true});
    if (focus) $('#desk').scrollIntoView({block:'nearest'});
  }
  function showSheet() {
    clearTimeout(nextTimer);
    if (state.pending) rememberDifficulty(state,state.pending,null);
    state.sheetDay = new Date().toDateString();
    persist();
    for (const id of ['desk','comparison','finished','exit']) $('#'+id).hidden = true;
    $('#sheet').hidden = false;
    const list = state.struggles || [];
    $('#sheet-info').textContent = list.length ? 'The latest difficulty for each answer in this set, most recent first.' :
      'No difficult answers recorded yet. Wrong guesses, choices, and Again or Hard ratings appear here.';
    const entries = $('#entries');
    entries.replaceChildren();
    for (const item of list) {
      const p = photoFor(item.name,item.index);
      const row = el('article',null,'entry'), img = el('img'), text = el('div'), dl = el('dl');
      img.loading = 'lazy';
      img.src = p.src;
      img.alt = p.organism || item.name;
      details(dl,p);
      text.append(el('h3',item.name),el('p',item.reasons.join(' · ')),el('small',new Date(item.at).toLocaleDateString()),dl);
      const source = sourceLink(p);
      if (source) text.append(source);
      row.append(img,text);
      entries.append(row);
    }
    $('#sheet h2').focus();
  }
  function resume() {
    state.sheetDay = null;
    $('#sheet').hidden = true;
    $('#exit').hidden = false;
    persist();
    showNext();
  }
  $('#typed-replay').onclick = replayTyped;
  $('#exit').onclick = showSheet;
  $('#resume').onclick = resume;
  $('#extra').onclick = () => showNext(true,true);
  // Another tab may have graded this card. Resume its latest state before accepting input.
  window.addEventListener('storage',event => {
    if (event.key === key && event.newValue) {
      const incoming = JSON.parse(event.newValue);
      if (incoming.collection?.revision !== state.collection?.revision || incoming.collection?.name !== state.collection?.name ||
          incoming.collection?.scheduled !== state.collection?.scheduled) {location.reload();return;}
      state = incoming;
      if (state.sheetDay === new Date().toDateString()) {
        if ($('#sheet').hidden) showSheet();
      } else {
        $('#sheet').hidden = true;
        $('#exit').hidden = false;
        showNext();
      }
    }
  });
  const explicitResume = sessionStorage.getItem('backyard-resume') === set.id;
  sessionStorage.removeItem('backyard-resume');
  if (!explicitResume && state.sheetDay === new Date().toDateString()) showSheet();
  else resume();
  setupOffline(set).catch(() => {$('#download-status').textContent = 'Offline setup unavailable. Reopen online to retry.';});
}
start().catch(() => {$('#notice').textContent = 'The study set could not open. Start the local server and load this page again.';});
