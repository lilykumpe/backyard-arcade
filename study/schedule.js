// One record per target taxon. A photo never owns a due date.
export const ratings = ['Again', 'Hard', 'Good', 'Easy'];
export function freshRecord() {
  return {due: 0, days: 0, turns: 0, cursor: 0, unaided: 0, assisted: 0, correctChoice: 0, mixed: {}, revisit: null};
}
export function interval(record, rating, assisted) {
  if (rating === 'Again') return {minutes: 2};
  if (rating === 'Hard') return {minutes: 10};
  if (assisted) return {days: 1};
  const days = rating === 'Easy' ? Math.max(3, record.days * 3) : Math.max(1, record.days * 2);
  return {days: Math.min(days, 180)};
}
export function when(span, now) {
  if (span.minutes) return now + span.minutes * 60000;
  const date = new Date(now);
  date.setDate(date.getDate() + span.days);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function revisitDue(record, total, now) {
  return record.revisit && (total >= record.revisit.turn || now >= record.revisit.time);
}
export function orderedTargets(state, names, now, early = false) {
  const {records, total} = state;
  const ready = name => revisitDue(records[name], total, now);
  return names.filter(name => early || ready(name) || records[name].due <= now)
    .sort((a,b) => Number(Boolean(ready(b))) - Number(Boolean(ready(a)))
      || records[a].due - records[b].due || records[a].turns - records[b].turns);
}
export function grade(state, card, rating, now) {
  const record = state.records[card.name];
  const span = interval(record, rating, card.assisted || card.correct === false);
  record.due = when(span, now);
  record.days = span.days || 0;
  record.turns++;
  record.cursor = card.index + 1;
  state.total++;
  const day = new Date(now).toDateString();
  if (state.today?.day !== day) state.today = {day, unaided:0, recalled:0, assisted:0};
  state.today[card.assisted ? 'assisted' : 'unaided']++;
  if (!card.assisted && !card.mistake && card.correct !== false && (rating === 'Good' || rating === 'Easy')) state.today.recalled++;
  record[card.assisted ? 'assisted' : 'unaided']++;
  if (card.choice === card.name) record.correctChoice++;
  record.revisit = null;
  if (card.mistake) {
    record.mixed[card.mistake] = (record.mixed[card.mistake] || 0) + 1;
    for (const name of [card.name, card.mistake]) {
      state.records[name].revisit = {turn: state.total + 2, time: now + 120000};
    }
  }
  state.pending = null;
}
