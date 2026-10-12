/* CribSheet - a simple baby tracker. No build step, no dependencies beyond the optional Firebase SDK. */

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DAY = 86400000;
const OZ = 29.5735, LB = 453.59237, IN = 2.54;
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const trim = (n, d = 1) => Number(Number(n).toFixed(d)).toString();
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };

function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }

function toInput(ms) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromInput(s) { const t = new Date(s).getTime(); return isNaN(t) ? Date.now() : t; }
function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function fmtDay(ms) {
  const t = startOfDay(Date.now()), s = startOfDay(ms);
  if (s === t) return 'Today';
  if (s === t - DAY) return 'Yesterday';
  const d = new Date(ms);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}
function fmtDate(ms) { return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ' + (m % 60) + 'm ago';
  const d = Math.floor(h / 24); return d + 'd ' + (h % 24) + 'h ago';
}
function mmss(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s); }
const minsOf = sec => Math.round((sec || 0) / 60);

function fmtVol(ml, unit) { return unit === 'ml' ? Math.round(ml) + ' mL' : trim(ml / OZ, 1) + ' oz'; }
function fmtWeight(g, unit) {
  if (unit === 'g') return Math.round(g) + ' g';
  const totalOz = g / LB * 16; let lb = Math.floor(totalOz / 16); let oz = Math.round((totalOz - lb * 16) * 10) / 10;
  if (oz >= 16) { lb++; oz = 0; }
  return lb + ' lb ' + trim(oz, 1) + ' oz';
}
function fmtLen(cm, unit) { return unit === 'cm' ? trim(cm, 1) + ' cm' : trim(cm / IN, 2) + ' in'; }
const sideName = s => s === 'L' ? 'Left' : 'Right';
const otherSide = s => s === 'L' ? 'R' : 'L';

// ---------- preferences ----------
const PREF_KEY = 'cs.prefs';
const defaults = { bottleUnit: 'oz', pumpUnit: 'oz', weightUnit: 'lb', lengthUnit: 'in', theme: 'auto', activeBaby: null, hid: null, logFilter: 'all' };
const prefs = { ...defaults, ...load(PREF_KEY, {}) };
function setPref(k, v) { prefs[k] = v; save(PREF_KEY, prefs); }
function applyTheme() { if (prefs.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = prefs.theme; }

// ---------- stores ----------
function clean(o) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }

class LocalStore {
  constructor() { this.mode = 'local'; this.entries = load('cs.entries', []); this.babies = load('cs.babies', []); this.listeners = []; this.ready = true; }
  async init() { }
  onChange(cb) { this.listeners.push(cb); cb(this.snapshot()); }
  snapshot() { return { entries: this.entries, babies: this.babies }; }
  emit() { save('cs.entries', this.entries); save('cs.babies', this.babies); this.listeners.forEach(cb => cb(this.snapshot())); }
  async addEntry(e) { this.entries = [...this.entries.filter(x => x.id !== e.id), clean(e)]; this.emit(); }
  async updateEntry(id, patch) { this.entries = this.entries.map(e => e.id === id ? clean({ ...e, ...patch }) : e); this.emit(); }
  async deleteEntry(id) { this.entries = this.entries.filter(e => e.id !== id); this.emit(); }
  async addBaby(b) { this.babies = [...this.babies.filter(x => x.id !== b.id), clean(b)]; this.emit(); }
  async updateBaby(id, patch) { this.babies = this.babies.map(b => b.id === id ? clean({ ...b, ...patch }) : b); this.emit(); }
  async deleteBaby(id) { this.babies = this.babies.filter(b => b.id !== id); this.entries = this.entries.filter(e => e.babyId !== id); this.emit(); }
  async wipe() { this.entries = []; this.babies = []; this.emit(); }
}

class CloudStore {
  constructor(cfg, hid) { this.mode = 'cloud'; this.cfg = cfg; this.hid = hid; this.entries = []; this.babies = []; this.listeners = []; this.ready = false; this.error = null; this.unsubs = []; }
  async init() {
    const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const [appM, authM, fsM] = await Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-auth.js'), import(V + 'firebase-firestore.js')]);
    this.fs = fsM;
    const app = appM.initializeApp(this.cfg);
    try { this.db = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) }); }
    catch { this.db = fsM.getFirestore(app); }
    const auth = authM.getAuth(app);
    await new Promise((res, rej) => {
      authM.onAuthStateChanged(auth, u => { if (u) res(u); }, rej);
      authM.signInAnonymously(auth).catch(rej);
    });
    const col = n => fsM.collection(this.db, 'households', this.hid, n);
    this.unsubs.push(fsM.onSnapshot(col('entries'), s => { this.entries = s.docs.map(d => ({ id: d.id, ...d.data() })); this.ready = true; this.error = null; this.emit(); }, err => { this.error = err; this.emit(); }));
    this.unsubs.push(fsM.onSnapshot(col('babies'), s => { this.babies = s.docs.map(d => ({ id: d.id, ...d.data() })); this.emit(); }, err => { this.error = err; this.emit(); }));
    fsM.setDoc(fsM.doc(this.db, 'households', this.hid), { touchedAt: Date.now() }, { merge: true }).catch(() => { });
  }
  stop() { this.unsubs.forEach(u => u()); this.unsubs = []; }
  onChange(cb) { this.listeners.push(cb); cb(this.snapshot()); }
  snapshot() { return { entries: this.entries, babies: this.babies }; }
  emit() { this.listeners.forEach(cb => cb(this.snapshot())); }
  ref(n, id) { return this.fs.doc(this.db, 'households', this.hid, n, id); }
  addEntry(e) { return this.fs.setDoc(this.ref('entries', e.id), clean(e)); }
  updateEntry(id, patch) { return this.fs.setDoc(this.ref('entries', id), clean(patch), { merge: true }); }
  deleteEntry(id) { return this.fs.deleteDoc(this.ref('entries', id)); }
  addBaby(b) { return this.fs.setDoc(this.ref('babies', b.id), clean(b)); }
  updateBaby(id, patch) { return this.fs.setDoc(this.ref('babies', id), clean(patch), { merge: true }); }
  async deleteBaby(id) {
    const ids = this.entries.filter(e => e.babyId === id).map(e => e.id);
    await this.batchDelete('entries', ids);
    return this.fs.deleteDoc(this.ref('babies', id));
  }
  async batchDelete(coll, ids) {
    for (let i = 0; i < ids.length; i += 400) {
      const b = this.fs.writeBatch(this.db);
      ids.slice(i, i + 400).forEach(id => b.delete(this.ref(coll, id)));
      await b.commit();
    }
  }
  async batchSet(coll, docs) {
    for (let i = 0; i < docs.length; i += 400) {
      const b = this.fs.writeBatch(this.db);
      docs.slice(i, i + 400).forEach(d => b.set(this.ref(coll, d.id), clean(d)));
      await b.commit();
    }
  }
  async wipe() { await this.batchDelete('entries', this.entries.map(e => e.id)); await this.batchDelete('babies', this.babies.map(b => b.id)); }
}

const FBCFG = window.CRIBSHEET_FIREBASE || {};
const cloudConfigured = !!(FBCFG.apiKey && FBCFG.projectId);
let store = null, cloudError = null;

// ---------- state ----------
let entries = [], babies = [];
let timer = load('cs.timer', null);
let lastDeleted = null;

let promptedBaby = false;
function onData(snap) {
  entries = snap.entries.slice().sort((a, b) => b.at - a.at);
  babies = snap.babies.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  if (!babies.find(b => b.id === prefs.activeBaby)) setPref('activeBaby', babies[0] ? babies[0].id : null);
  renderAll();
  if (!babies.length && !promptedBaby && store && store.ready && !$('#sheetBg').classList.contains('open')) { promptedBaby = true; openBabySheet(null, true); }
}
const activeBaby = () => babies.find(b => b.id === prefs.activeBaby) || null;
const babyEntries = () => entries.filter(e => e.type === 'pump' || e.babyId === prefs.activeBaby);
const babyName = id => (babies.find(b => b.id === id) || {}).name || '';

function doWrite(p, okMsg) {
  Promise.resolve(p).then(() => { if (okMsg) toast(okMsg); }).catch(err => { console.error(err); toast('Could not save: ' + (err.message || err)); });
}
function addEntry(e) { if (!e.createdAt) e.createdAt = Date.now(); doWrite(store.addEntry(e), 'Logged'); }

// ---------- age ----------
function ageText(b) {
  if (!b || !b.dob) return '';
  const [y, m, d] = b.dob.split('-').map(Number);
  const born = new Date(y, m - 1, d).getTime();
  const days = Math.floor((startOfDay(Date.now()) - born) / DAY);
  if (days < 0) return 'Due ' + fmtDate(born);
  if (days === 0) return 'Born today';
  if (days < 14) return days + (days === 1 ? ' day old' : ' days old');
  if (days < 84) return Math.floor(days / 7) + 'w ' + (days % 7) + 'd old';
  const now = new Date(); let months = (now.getFullYear() - y) * 12 + (now.getMonth() - (m - 1)); if (now.getDate() < d) months--;
  const anchor = new Date(y, m - 1 + months, d).getTime();
  const extraDays = Math.floor((startOfDay(Date.now()) - anchor) / DAY);
  if (months < 24) return months + 'mo ' + Math.floor(extraDays / 7) + 'w old';
  return Math.floor(months / 12) + 'y ' + (months % 12) + 'mo old';
}

// ---------- nursing side recommendation ----------
function lastNurse() { return babyEntries().find(e => e.type === 'nurse') || null; }
function recommendedSide() { const l = lastNurse(); if (!l) return 'L'; return otherSide(l.startSide || 'L'); }

// ---------- rendering ----------
function renderAll() { renderHeader(); renderHome(); renderLog(); renderGrowth(); renderPump(); renderSettings(); }

function renderHeader() {
  const b = activeBaby();
  $('#babyName').textContent = b ? b.name : 'Set up baby';
  $('#babyAge').textContent = b ? (ageText(b) || 'Add a birthdate') : 'Tap to begin';
}

function entrySummary(e, full = false) {
  switch (e.type) {
    case 'nurse': {
      const tot = minsOf((e.leftSec || 0) + (e.rightSec || 0));
      return { title: `Nursed · ${tot} min`, detail: `L ${minsOf(e.leftSec)} min · R ${minsOf(e.rightSec)} min · started ${sideName(e.startSide || 'L').toLowerCase()}` + (e.note ? ' · ' + e.note : '') };
    }
    case 'bottle': return { title: `Bottle · ${fmtVol(e.ml, e.unit || prefs.bottleUnit)}`, detail: (e.contents === 'formula' ? 'Formula' : 'Breast milk') + (e.note ? ' · ' + e.note : '') };
    case 'diaper': return { title: `Diaper · ${e.kind === 'both' ? 'Wet + dirty' : e.kind === 'dirty' ? 'Dirty' : 'Wet'}`, detail: e.note || '' };
    case 'pump': return { title: `Pumped · ${fmtVol(e.ml, e.unit || prefs.pumpUnit)}`, detail: e.note || '' };
    case 'measure': {
      const parts = [];
      if (e.weightG != null) parts.push('Weight ' + fmtWeight(e.weightG, prefs.weightUnit));
      if (e.lengthCm != null) parts.push('Length ' + fmtLen(e.lengthCm, prefs.lengthUnit));
      if (e.headCm != null) parts.push('Head ' + fmtLen(e.headCm, prefs.lengthUnit));
      return { title: full ? parts.join(' · ') : (parts[0] || 'Measurement'), detail: (full ? '' : parts.slice(1).join(' · ')) + (e.note ? (parts.length > 1 && !full ? ' · ' : '') + e.note : '') };
    }
  }
  return { title: e.type, detail: '' };
}

function renderHome() {
  const list = babyEntries();
  const now = Date.now();
  // timer banner
  const banner = $('#timerBanner');
  banner.hidden = !timer;
  // right now
  const lastFeed = list.find(e => e.type === 'nurse' || e.type === 'bottle');
  const lastDiaper = list.find(e => e.type === 'diaper');
  const lastPump = entries.find(e => e.type === 'pump');
  const lastWeight = list.find(e => e.type === 'measure' && e.weightG != null);
  const item = (lbl, val, sub) => `<div class="item"><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="sub">${sub}</span></div>`;
  let html = '';
  html += item('Last feed', lastFeed ? ago(lastFeed.at) : '—', lastFeed ? `${entrySummary(lastFeed).title} · ${fmtTime(lastFeed.at)}` : 'No feeds logged yet');
  html += item('Last diaper', lastDiaper ? ago(lastDiaper.at) : '—', lastDiaper ? `${entrySummary(lastDiaper).title.replace('Diaper · ', '')} · ${fmtTime(lastDiaper.at)}` : 'No diapers logged yet');
  html += item('Last pump', lastPump ? ago(lastPump.at) : '—', lastPump ? `${fmtVol(lastPump.ml, prefs.pumpUnit)} · ${fmtTime(lastPump.at)}` : 'No pumps logged yet');
  if (lastWeight) html += item('Weight', fmtWeight(lastWeight.weightG, prefs.weightUnit), fmtDay(lastWeight.at));
  $('#now').innerHTML = html;
  // next side
  const ns = $('#nextside');
  if (timer) {
    ns.innerHTML = `<span class="pill ${timer.side}">${sideName(timer.side).toUpperCase()}</span><span class="txt">Nursing now on the ${sideName(timer.side).toLowerCase()}. Tap the banner above to switch or finish.</span>`;
  } else {
    const rec = recommendedSide(); const l = lastNurse();
    ns.innerHTML = `<span class="pill ${rec}">${sideName(rec).toUpperCase()}</span><span class="txt"><b>Start the next feed on the ${sideName(rec).toLowerCase()}.</b><br>${l ? `Last feed started on the ${sideName(l.startSide || 'L').toLowerCase()} at ${fmtTime(l.at)}${l.endSide ? ` and ended on the ${sideName(l.endSide).toLowerCase()}` : ''}.` : 'No nursing logged yet, so either side is fine.'}</span>`;
  }
  // totals
  const T = windows(list, now);
  $('#avgNote').textContent = T.divisor >= 7 ? 'Avg per day, last 7 days' : `Avg per day, over ${trim(T.divisor, 1)} day${T.divisor === 1 ? '' : 's'} so far`;
  $('#totals').innerHTML = totalsTable(T, feedRows());
}

function windows(list, now) {
  const t0 = startOfDay(now), d0 = now - DAY, w0 = now - 7 * DAY;
  const logged = list.filter(e => e.type !== 'measure');
  const first = logged.length ? Math.min(...logged.map(e => e.at)) : now;
  const divisor = Math.max(1, Math.min(7, (now - first) / DAY));
  return { today: list.filter(e => e.at >= t0), day: list.filter(e => e.at >= d0), week: list.filter(e => e.at >= w0), divisor };
}
const count = t => l => l.filter(e => e.type === t).length;
const volOf = t => l => l.filter(e => e.type === t).reduce((s, e) => s + (e.ml || 0), 0);
function feedRows() {
  return [
    { group: 'Feeding' },
    { label: 'Nursing sessions', fn: count('nurse'), fmt: n => trim(n, 1) },
    { label: 'Nursing time', fn: l => l.filter(e => e.type === 'nurse').reduce((s, e) => s + (e.leftSec || 0) + (e.rightSec || 0), 0) / 60, fmt: n => Math.round(n) + ' min', parts: l => [['L', l.filter(e => e.type === 'nurse').reduce((s, e) => s + (e.leftSec || 0), 0) / 60], ['R', l.filter(e => e.type === 'nurse').reduce((s, e) => s + (e.rightSec || 0), 0) / 60]] },
    { label: 'Bottles', fn: count('bottle'), fmt: n => trim(n, 1) },
    { label: 'Bottle volume', fn: volOf('bottle'), fmt: ml => fmtVol(ml, prefs.bottleUnit), parts: l => [['BM', l.filter(e => e.type === 'bottle' && e.contents !== 'formula').reduce((s, e) => s + (e.ml || 0), 0)], ['Formula', l.filter(e => e.type === 'bottle' && e.contents === 'formula').reduce((s, e) => s + (e.ml || 0), 0)]] },
    { label: 'All feeds', fn: l => count('nurse')(l) + count('bottle')(l), fmt: n => trim(n, 1) },
    { group: 'Diapers' },
    { label: 'Wet', fn: l => l.filter(e => e.type === 'diaper' && e.kind !== 'dirty').length, fmt: n => trim(n, 1) },
    { label: 'Dirty', fn: l => l.filter(e => e.type === 'diaper' && e.kind !== 'wet').length, fmt: n => trim(n, 1) },
    { label: 'Diaper changes', fn: count('diaper'), fmt: n => trim(n, 1) },
    { group: 'Pumping' },
    ...pumpRows()
  ];
}
function pumpRows() {
  return [
    { label: 'Pumps', fn: count('pump'), fmt: n => trim(n, 1) },
    { label: 'Pumped volume', fn: volOf('pump'), fmt: ml => fmtVol(ml, prefs.pumpUnit) }
  ];
}
function totalsTable(T, rows) {
  let h = '<thead><tr><th></th><th>Today</th><th>24 h</th><th>Avg/day</th></tr></thead><tbody>';
  for (const r of rows) {
    if (r.group) { h += `<tr class="group"><td colspan="4">${r.group}</td></tr>`; continue; }
    const cell = (l, div = 1) => {
      let s = r.fmt(r.fn(l) / div);
      if (r.parts) { const p = r.parts(l); if (p.some(x => x[1] > 0)) s += p.map(x => `<span class="sub">${x[0]} ${r.fmt(x[1] / div)}</span>`).join(''); }
      return s;
    };
    h += `<tr><td>${r.label}</td><td>${cell(T.today)}</td><td>${cell(T.day)}</td><td>${cell(T.week, T.divisor)}</td></tr>`;
  }
  return h + '</tbody>';
}

function entryRow(e) {
  const s = entrySummary(e);
  return `<button class="entry" type="button" data-id="${e.id}"><svg class="ic ${e.type}"><use href="#i-${e.type}"/></svg><div class="body"><b>${esc(s.title)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</div><time>${fmtTime(e.at)}</time></button>`;
}

function renderLog() {
  const f = prefs.logFilter;
  $$('#filters .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.f === f)));
  let list = babyEntries();
  if (f !== 'all') list = list.filter(e => e.type === f);
  const out = $('#history');
  if (!list.length) { out.innerHTML = `<div class="empty">Nothing logged yet.${activeBaby() ? ' Use the buttons on the Home tab.' : ''}</div>`; return; }
  const groups = new Map();
  for (const e of list) { const k = startOfDay(e.at); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  let h = '';
  for (const [k, es] of groups) {
    const n = t => es.filter(e => e.type === t).length;
    const sum = [n('nurse') ? `${n('nurse')} nursed` : '', n('bottle') ? `${n('bottle')} bottle${n('bottle') > 1 ? 's' : ''}` : '', n('diaper') ? `${n('diaper')} diaper${n('diaper') > 1 ? 's' : ''}` : '', n('pump') ? `${n('pump')} pump${n('pump') > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
    h += `<div class="day"><h3>${fmtDay(k)}</h3><span class="sum">${sum}</span></div><div class="entries">${es.map(entryRow).join('')}</div>`;
  }
  out.innerHTML = h;
}

function renderPump() {
  const list = entries.filter(e => e.type === 'pump');
  const T = windows(list, Date.now());
  $('#pumpTotals').innerHTML = totalsTable(T, pumpRows());
  const recent = list.slice(0, 15);
  $('#pumpList').innerHTML = recent.length ? `<div class="entries">${recent.map(e => `<button class="entry" type="button" data-id="${e.id}"><svg class="ic pump"><use href="#i-pump"/></svg><div class="body"><b>${fmtVol(e.ml, prefs.pumpUnit)}</b><span>${fmtDay(e.at)}${e.note ? ' · ' + esc(e.note) : ''}</span></div><time>${fmtTime(e.at)}</time></button>`).join('')}</div>` : '<div class="empty">No pumps logged yet.</div>';
  $$('#pq-unit button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.u === prefs.pumpUnit)));
  if (!$('#pq-time').value) $('#pq-time').value = toInput(Date.now());
}

function renderGrowth() {
  const list = babyEntries().filter(e => e.type === 'measure').slice().sort((a, b) => a.at - b.at);
  const b = activeBaby();
  const metrics = [
    { key: 'weightG', title: 'Weight', fmt: v => fmtWeight(v, prefs.weightUnit), axis: v => prefs.weightUnit === 'g' ? Math.round(v) + ' g' : trim(v / LB, 1) + ' lb', delta: (a, c) => prefs.weightUnit === 'g' ? trim(c - a, 0) + ' g' : trim((c - a) / LB * 16, 1) + ' oz' },
    { key: 'lengthCm', title: 'Length', fmt: v => fmtLen(v, prefs.lengthUnit), axis: v => fmtLen(v, prefs.lengthUnit), delta: (a, c) => fmtLen(c - a, prefs.lengthUnit) },
    { key: 'headCm', title: 'Head circumference', fmt: v => fmtLen(v, prefs.lengthUnit), axis: v => fmtLen(v, prefs.lengthUnit), delta: (a, c) => fmtLen(c - a, prefs.lengthUnit) }
  ];
  let h = '';
  for (const m of metrics) {
    const pts = list.filter(e => e[m.key] != null).map(e => ({ t: e.at, v: e[m.key], id: e.id }));
    h += `<section class="card"><h2>${m.title}</h2>`;
    if (!pts.length) { h += `<p class="muted small" style="margin:0">No ${m.title.toLowerCase()} recorded yet.</p></section>`; continue; }
    const last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2] : null;
    const sign = prev && last.v - prev.v >= 0 ? '+' : '';
    h += `<div class="stat"><span class="big">${m.fmt(last.v)}</span><span class="delta">${fmtDay(last.t)}${prev ? ` · ${sign}${m.delta(prev.v, last.v)} since ${fmtDate(prev.t)}` : ''}</span></div>`;
    if (pts.length > 1) h += chartSvg(pts, m.axis, b && b.dob);
    h += `<div class="entries" style="margin-top:10px">${pts.slice().reverse().slice(0, 6).map(p => `<button class="entry" type="button" data-id="${p.id}"><div class="body"><b>${m.fmt(p.v)}</b></div><time>${fmtDay(p.t)}</time></button>`).join('')}</div>`;
    h += '</section>';
  }
  if (!list.length) h = `<div class="empty">No measurements yet. Tap <b>Measure</b> on the Home tab to add weight, length, or head circumference.</div>` + h;
  $('#growth').innerHTML = h;
}

function chartSvg(pts, axisFmt, dob) {
  const W = 320, H = 150, L = 46, R = 12, T = 12, B = 24;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  let v0 = Math.min(...pts.map(p => p.v)), v1 = Math.max(...pts.map(p => p.v));
  if (v1 === v0) { v0 -= 1; v1 += 1; } else { const padv = (v1 - v0) * 0.12; v0 -= padv; v1 += padv; }
  const x = t => L + (t1 === t0 ? (W - L - R) / 2 : (t - t0) / (t1 - t0) * (W - L - R));
  const y = v => T + (1 - (v - v0) / (v1 - v0)) * (H - T - B);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Growth chart">`;
  for (let i = 0; i <= 3; i++) { const v = v0 + (v1 - v0) * i / 3; s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${L - 4}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${axisFmt(v)}</text>`; }
  s += `<polyline class="line" points="${pts.map(p => x(p.t).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ')}"/>`;
  pts.forEach((p, i) => { s += `<circle class="pt${i === pts.length - 1 ? ' last' : ''}" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5"/>`; });
  const xl = t => dob ? dayLabel(t, dob) : fmtDate(t);
  s += `<text class="axis" x="${L}" y="${H - 6}">${xl(t0)}</text><text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${xl(t1)}</text></svg>`;
  return s;
}
function dayLabel(t, dob) { const [y, m, d] = dob.split('-').map(Number); const days = Math.round((startOfDay(t) - new Date(y, m - 1, d).getTime()) / DAY); return days < 0 ? fmtDate(t) : `Day ${days} · ${fmtDate(t)}`; }

function renderSettings() {
  $('#babyList').innerHTML = babies.length ? babies.map(b => `<div class="li"><div class="body"><b>${esc(b.name)}${b.id === prefs.activeBaby ? ' <span class="muted small">· active</span>' : ''}</b><span>${b.dob ? 'Born ' + new Date(b.dob + 'T00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + ageText(b) : 'No birthdate'}</span></div>${b.id !== prefs.activeBaby ? `<button class="btn" type="button" data-select="${b.id}">Select</button>` : ''}<button class="btn" type="button" data-edit="${b.id}">Edit</button></div>`).join('') : '<div class="li"><div class="body muted small">No baby yet. Add one to start logging.</div></div>';
  $$('[data-pref]').forEach(seg => { const k = seg.dataset.pref; $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === prefs[k]))); });
  renderSync();
}

function renderSync() {
  const p = $('#syncPanel');
  const online = navigator.onLine;
  if (!cloudConfigured) {
    p.innerHTML = `<p class="status warn"><i></i>Not set up. This phone keeps its own log.</p><p class="small muted" style="margin:8px 0 0">To share one log between two phones, create a free Firebase project and paste its config into <code>firebase-config.js</code>. The README in the repository walks through it step by step.</p>`;
    return;
  }
  if (store && store.mode === 'cloud') {
    const code = prefs.hid;
    p.innerHTML = `<p class="status ${store.error ? 'bad' : online ? 'ok' : 'warn'}"><i></i>${store.error ? 'Sync error: ' + esc(store.error.message || store.error) : online ? 'Syncing with your household' : 'Offline. Changes will sync when back online.'}</p>
      <p class="small muted" style="margin:10px 0 0">Household code. Enter it on the other phone under Settings → Sync.</p>
      <div class="code">${esc(code.slice(0, 4) + '-' + code.slice(4))}</div>
      <div class="grid2"><button class="btn" type="button" id="copyCode">Copy code</button><button class="btn danger" type="button" id="leaveHh">Leave household</button></div>`;
    $('#copyCode').onclick = () => { navigator.clipboard?.writeText(code).then(() => toast('Code copied')).catch(() => toast(code)); };
    $('#leaveHh').onclick = () => { if (confirm('Leave this household on this phone? The shared data stays in the cloud; this phone goes back to its own local log.')) { setPref('hid', null); location.reload(); } };
    return;
  }
  p.innerHTML = `<p class="status warn"><i></i>${cloudError ? 'Could not connect: ' + esc(cloudError.message || cloudError) + '. Using local log for now.' : 'Firebase is configured. Create a household on one phone, then join it from the other.'}</p>
    <div class="grid2" style="margin-top:10px"><button class="btn primary" type="button" id="createHh">Create household</button><button class="btn" type="button" id="joinHh">Join with code</button></div>
    ${cloudError && prefs.hid ? `<div class="actions"><button class="btn" type="button" id="retryHh">Retry connection</button><button class="btn danger" type="button" id="leaveHh2">Forget household</button></div>` : ''}`;
  $('#createHh').onclick = () => joinHousehold(genCode());
  $('#joinHh').onclick = () => openSheet(`<h2>Join a household</h2><p class="sub">Enter the code shown on the other phone.</p><form id="joinForm"><div class="field"><label for="jcode">Household code</label><input type="text" id="jcode" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX" required></div><div class="actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Join</button></div></form>`, root => {
    $('#joinForm', root).onsubmit = ev => { ev.preventDefault(); const c = $('#jcode', root).value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 6) { toast('That code looks too short'); return; } closeSheet(); joinHousehold(c); };
  });
  const r = $('#retryHh'); if (r) r.onclick = () => location.reload();
  const l2 = $('#leaveHh2'); if (l2) l2.onclick = () => { setPref('hid', null); location.reload(); };
}
function genCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = new Uint8Array(8); crypto.getRandomValues(r); for (const b of r) s += A[b % A.length]; return s; }
async function joinHousehold(code) {
  const local = store && store.mode === 'local' ? store : null;
  const hasLocal = local && (local.entries.length || local.babies.length);
  toast('Connecting…');
  const cloud = new CloudStore(FBCFG, code);
  try { await cloud.init(); } catch (err) { console.error(err); toast('Could not connect: ' + (err.message || err)); return; }
  if (hasLocal && confirm(`Upload the ${local.entries.length} entries and ${local.babies.length} baby profile(s) on this phone to the household?`)) {
    try { await cloud.batchSet('babies', local.babies); await cloud.batchSet('entries', local.entries); }
    catch (err) { console.error(err); toast('Upload failed: ' + (err.message || err)); return; }
  }
  setPref('hid', code);
  location.reload();
}

// ---------- sheets ----------
let sheetCleanup = null;
function openSheet(html, wire) {
  const sheet = $('#sheet');
  sheet.innerHTML = '<div class="grab"></div>' + html;
  $('#sheetBg').classList.add('open');
  document.body.style.overflow = 'hidden';
  $$('[data-close]', sheet).forEach(b => b.onclick = closeSheet);
  if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; }
  if (wire) sheetCleanup = wire(sheet) || null;
  const first = $('input:not([type=hidden]):not([type=datetime-local]):not([type=date]), select', sheet);
  if (first && window.matchMedia('(min-width:600px)').matches) first.focus();
}
function closeSheet() { $('#sheetBg').classList.remove('open'); document.body.style.overflow = ''; if (sheetCleanup) { sheetCleanup(); sheetCleanup = null; } $('#sheet').innerHTML = ''; }

function segHtml(id, opts, val, cls = '') { return `<div class="seg ${cls}" id="${id}">${opts.map(o => `<button type="button" data-v="${o[0]}" aria-pressed="${String(o[0] === val)}">${o[1]}</button>`).join('')}</div>`; }
function segVal(id, root) { const b = $(`#${id} button[aria-pressed="true"]`, root); return b ? b.dataset.v : null; }
function wireSeg(root, onChange) { $$('.seg', root).forEach(seg => $$('button', seg).forEach(b => b.addEventListener('click', () => { $$('button', seg).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); if (onChange) onChange(seg.id, b.dataset.v); }))); }
const timeField = (val, id = 'f-time', label = 'Time') => `<div class="field"><label for="${id}">${label}</label><input type="datetime-local" id="${id}" value="${toInput(val)}" required></div>`;
const noteField = v => `<div class="field"><label for="f-note">Note (optional)</label><input type="text" id="f-note" value="${esc(v || '')}" placeholder="e.g. spit up, fussy, vitamin D"></div>`;
const formActions = (edit, label) => `<div class="actions">${edit ? '<button class="btn danger" type="button" id="f-del">Delete</button>' : '<button class="btn" type="button" data-close>Cancel</button>'}<button class="btn primary" type="submit">${label}</button></div>`;

function requireBaby() { if (activeBaby()) return true; openBabySheet(null, true); return false; }

function openLog(type, entry) {
  if (type !== 'pump' && !entry && !requireBaby()) return;
  if (type === 'nurse') return openNurse(entry);
  if (type === 'bottle') return openBottle(entry);
  if (type === 'diaper') return openDiaper(entry);
  if (type === 'measure') return openMeasure(entry);
  if (type === 'pump') return openPump(entry);
}

function submitEntry(root, entry, build) {
  return ev => {
    ev.preventDefault();
    let data; try { data = build(); } catch (err) { toast(err.message); return; }
    if (entry) doWrite(store.updateEntry(entry.id, data), 'Saved'); else addEntry({ id: uid(), ...data });
    closeSheet();
  };
}
function wireDelete(root, entry) {
  const d = $('#f-del', root); if (!d) return;
  d.onclick = () => { closeSheet(); deleteWithUndo(entry); };
}
function deleteWithUndo(entry) {
  lastDeleted = entry;
  doWrite(store.deleteEntry(entry.id));
  toast('Deleted', { label: 'Undo', fn: () => { if (lastDeleted) { doWrite(store.addEntry(lastDeleted), 'Restored'); lastDeleted = null; } } });
}

// nursing
function openNurse(entry) {
  if (entry) return openNurseManual(entry);
  if (timer) return openTimer();
  const rec = recommendedSide(), l = lastNurse();
  openSheet(`<h2>Nurse</h2><p class="sub">${l ? `Last feed started on the ${sideName(l.startSide || 'L').toLowerCase()} at ${fmtTime(l.at)}.` : 'No feeds logged yet.'}</p>
    ${segHtml('n-mode', [['timer', 'Timer'], ['manual', 'Log manually']], 'timer', 'block')}
    <div id="n-timer">
      <p class="eyebrow" style="margin-top:14px">Start on the ${sideName(rec).toLowerCase()}</p>
      <div class="sides">
        <button type="button" class="side L ${rec === 'L' ? 'recommended' : ''}" data-start="L"><span class="lab">Left</span><span class="t">Start</span>${rec === 'L' ? '<span class="rec">Recommended</span>' : ''}</button>
        <button type="button" class="side R ${rec === 'R' ? 'recommended' : ''}" data-start="R"><span class="lab">Right</span><span class="t">Start</span>${rec === 'R' ? '<span class="rec">Recommended</span>' : ''}</button>
      </div>
      <p class="hint">The timer keeps running if you lock your phone or switch apps. When you finish, the feed is logged automatically.</p>
      <div class="actions"><button class="btn" type="button" data-close>Cancel</button></div>
    </div>
    <div id="n-manual" hidden></div>`, root => {
    wireSeg(root, (id, v) => { if (id === 'n-mode') { $('#n-timer', root).hidden = v !== 'timer'; const m = $('#n-manual', root); m.hidden = v !== 'manual'; if (v === 'manual' && !m.innerHTML) { m.innerHTML = nurseManualHtml(null, rec); wireNurseManual(root, null); } } });
    $$('[data-start]', root).forEach(b => b.onclick = () => { timerStart(b.dataset.start); openTimer(); });
  });
}
function nurseManualHtml(e, rec) {
  const start = e ? (e.startSide || 'L') : rec;
  return `<form id="n-form">
    ${timeField(e ? e.at : Date.now(), 'f-time', 'Started at')}
    <div class="field"><label>Started on</label>${segHtml('n-side', [['L', 'Left'], ['R', 'Right']], start, 'block')}</div>
    <div class="field"><label>Minutes on each side</label><div class="pair">
      <div class="with-unit"><input type="number" id="f-left" inputmode="numeric" min="0" step="1" placeholder="0" value="${e ? minsOf(e.leftSec) : ''}"><span class="unit">min L</span></div>
      <div class="with-unit"><input type="number" id="f-right" inputmode="numeric" min="0" step="1" placeholder="0" value="${e ? minsOf(e.rightSec) : ''}"><span class="unit">min R</span></div>
    </div></div>
    ${noteField(e && e.note)}
    ${formActions(!!e, e ? 'Save' : 'Log feed')}
  </form>`;
}
function wireNurseManual(root, e) {
  wireSeg(root);
  $('#n-form', root).onsubmit = submitEntry(root, e, () => {
    const L = num($('#f-left', root).value) || 0, R = num($('#f-right', root).value) || 0;
    if (L + R <= 0) throw new Error('Enter minutes for at least one side');
    const startSide = segVal('n-side', root);
    return { type: 'nurse', babyId: e ? e.babyId : prefs.activeBaby, at: fromInput($('#f-time', root).value), leftSec: Math.round(L * 60), rightSec: Math.round(R * 60), startSide, endSide: (L > 0 && R > 0) ? otherSide(startSide) : (L > 0 ? 'L' : 'R'), note: $('#f-note', root).value.trim() || null };
  });
  wireDelete(root, e);
}
function openNurseManual(e) {
  openSheet(`<h2>Edit nursing</h2><p class="sub">${fmtDay(e.at)}</p>` + nurseManualHtml(e), root => wireNurseManual(root, e));
}
function openTimer() {
  if (!timer) return;
  openSheet(`<h2>Nursing</h2><p class="sub">Started ${fmtTime(timer.startedAt)} on the ${sideName(timer.startSide).toLowerCase()}</p>
    <div class="sides">
      <div class="side L" id="t-L"><span class="lab">Left</span><span class="t" id="t-Lt">0:00</span></div>
      <div class="side R" id="t-R"><span class="lab">Right</span><span class="t" id="t-Rt">0:00</span></div>
    </div>
    <p class="total">Total <b id="t-tot">0:00</b></p>
    <button class="btn big block" type="button" id="t-switch">Switch sides</button>
    <div class="actions"><button class="btn danger" type="button" id="t-cancel">Cancel</button><button class="btn primary big" type="button" id="t-finish">Finish &amp; log</button></div>`, root => {
    const paint = () => {
      if (!timer) return;
      const t = timerTotals();
      $('#t-Lt', root).textContent = mmss(t.L); $('#t-Rt', root).textContent = mmss(t.R); $('#t-tot', root).textContent = mmss(t.total);
      $('#t-L', root).classList.toggle('on', timer.side === 'L'); $('#t-R', root).classList.toggle('on', timer.side === 'R');
      $('#t-switch', root).textContent = 'Switch to ' + sideName(otherSide(timer.side)).toLowerCase();
    };
    paint();
    const iv = setInterval(paint, 500);
    $('#t-switch', root).onclick = () => { timerSwitch(); paint(); renderHome(); };
    $('#t-finish', root).onclick = () => { timerFinish(); closeSheet(); };
    $('#t-cancel', root).onclick = () => { if (confirm('Cancel this timer without logging?')) { timer = null; save('cs.timer', null); closeSheet(); renderHome(); } };
    return () => clearInterval(iv);
  });
}
function timerTotals() { if (!timer) return { L: 0, R: 0, total: 0 }; const cur = (Date.now() - timer.sideStart) / 1000; const L = timer.L + (timer.side === 'L' ? cur : 0), R = timer.R + (timer.side === 'R' ? cur : 0); return { L, R, total: L + R }; }
function timerStart(side) { const now = Date.now(); timer = { babyId: prefs.activeBaby, startedAt: now, side, sideStart: now, startSide: side, L: 0, R: 0 }; save('cs.timer', timer); renderHome(); }
function timerSwitch() { const now = Date.now(); timer[timer.side] += (now - timer.sideStart) / 1000; timer.side = otherSide(timer.side); timer.sideStart = now; save('cs.timer', timer); }
function timerFinish() {
  const t = timerTotals();
  const e = { id: uid(), type: 'nurse', babyId: timer.babyId, at: timer.startedAt, leftSec: Math.round(t.L), rightSec: Math.round(t.R), startSide: timer.startSide, endSide: timer.side };
  timer = null; save('cs.timer', null);
  addEntry(e);
}

// bottle
function openBottle(e) {
  const unit = e ? (e.unit || prefs.bottleUnit) : prefs.bottleUnit;
  const amt = e ? (unit === 'ml' ? Math.round(e.ml) : trim(e.ml / OZ, 2)) : '';
  openSheet(`<h2>${e ? 'Edit bottle' : 'Bottle'}</h2><form id="b-form">
    <div class="field"><label for="f-amt">Amount</label><div class="inline"><input type="number" id="f-amt" inputmode="decimal" step="0.1" min="0" placeholder="0" value="${amt}" required>${segHtml('b-unit', [['oz', 'oz'], ['ml', 'mL']], unit)}</div></div>
    <div class="field"><label>Contents</label>${segHtml('b-contents', [['breastmilk', 'Breast milk'], ['formula', 'Formula']], e ? e.contents : 'breastmilk', 'block')}</div>
    ${timeField(e ? e.at : Date.now())}
    ${noteField(e && e.note)}
    ${formActions(!!e, e ? 'Save' : 'Log bottle')}</form>`, root => {
    wireSeg(root, (id, v) => { if (id === 'b-unit') setPref('bottleUnit', v); });
    $('#b-form', root).onsubmit = submitEntry(root, e, () => {
      const a = num($('#f-amt', root).value); if (a == null || a <= 0) throw new Error('Enter an amount');
      const u = segVal('b-unit', root);
      return { type: 'bottle', babyId: e ? e.babyId : prefs.activeBaby, at: fromInput($('#f-time', root).value), ml: u === 'ml' ? a : a * OZ, unit: u, contents: segVal('b-contents', root), note: $('#f-note', root).value.trim() || null };
    });
    wireDelete(root, e);
  });
}

// diaper
function openDiaper(e) {
  openSheet(`<h2>${e ? 'Edit diaper' : 'Diaper'}</h2><form id="d-form">
    <div class="field"><label>What was in it</label>${segHtml('d-kind', [['wet', 'Wet'], ['dirty', 'Dirty'], ['both', 'Both']], e ? e.kind : 'wet', 'block')}</div>
    ${timeField(e ? e.at : Date.now())}
    ${noteField(e && e.note)}
    ${formActions(!!e, e ? 'Save' : 'Log diaper')}</form>`, root => {
    wireSeg(root);
    $('#d-form', root).onsubmit = submitEntry(root, e, () => ({ type: 'diaper', babyId: e ? e.babyId : prefs.activeBaby, at: fromInput($('#f-time', root).value), kind: segVal('d-kind', root), note: $('#f-note', root).value.trim() || null }));
    wireDelete(root, e);
  });
}

// measurements
function openMeasure(e) {
  const wu = prefs.weightUnit, lu = prefs.lengthUnit;
  let lb = '', oz = '', g = '';
  if (e && e.weightG != null) { g = Math.round(e.weightG); const tOz = e.weightG / LB * 16; lb = Math.floor(tOz / 16); oz = trim(tOz - lb * 16, 1); }
  const lenV = e && e.lengthCm != null ? (lu === 'cm' ? trim(e.lengthCm, 1) : trim(e.lengthCm / IN, 2)) : '';
  const headV = e && e.headCm != null ? (lu === 'cm' ? trim(e.headCm, 1) : trim(e.headCm / IN, 2)) : '';
  openSheet(`<h2>${e ? 'Edit measurements' : 'Measurements'}</h2><p class="sub">Fill in whatever you measured. Blank fields are skipped.</p><form id="m-form">
    <div class="field"><div class="row" style="justify-content:space-between"><label for="f-lb" style="margin:0">Weight</label>${segHtml('m-wu', [['lb', 'lb + oz'], ['g', 'g']], wu, 'sm')}</div>
      <div class="pair" id="m-lbwrap" ${wu === 'g' ? 'hidden' : ''} style="margin-top:6px"><div class="with-unit"><input type="number" id="f-lb" inputmode="numeric" min="0" step="1" placeholder="0" value="${lb}"><span class="unit">lb</span></div><div class="with-unit"><input type="number" id="f-oz" inputmode="decimal" min="0" max="16" step="0.1" placeholder="0" value="${oz}"><span class="unit">oz</span></div></div>
      <div class="with-unit" id="m-gwrap" ${wu === "g" ? "" : "hidden"} style="margin-top:6px"><input type="number" id="f-g" inputmode="numeric" min="0" step="1" placeholder="0" value="${g}"><span class="unit">g</span></div></div>
    <div class="field"><div class="row" style="justify-content:space-between"><label style="margin:0">Length and head</label>${segHtml('m-lu', [['in', 'in'], ['cm', 'cm']], lu, 'sm')}</div>
      <div class="pair" style="margin-top:6px"><div class="with-unit"><input type="number" id="f-len" inputmode="decimal" min="0" step="0.01" placeholder="Length" value="${lenV}"><span class="unit" data-lu>${lu}</span></div><div class="with-unit"><input type="number" id="f-head" inputmode="decimal" min="0" step="0.01" placeholder="Head" value="${headV}"><span class="unit" data-lu>${lu}</span></div></div></div>
    ${timeField(e ? e.at : Date.now())}
    ${noteField(e && e.note)}
    ${formActions(!!e, e ? 'Save' : 'Save measurements')}</form>`, root => {
    wireSeg(root, (id, v) => {
      if (id === 'm-wu') { setPref('weightUnit', v); const lbw = $('#m-lbwrap', root), gw = $('#m-gwrap', root); lbw.hidden = v === 'g'; gw.hidden = v !== 'g'; }
      if (id === 'm-lu') {
        const old = prefs.lengthUnit; setPref('lengthUnit', v); $$('[data-lu]', root).forEach(x => x.textContent = v);
        if (old !== v) ['#f-len', '#f-head'].forEach(s => { const i = $(s, root), n = num(i.value); if (n != null) i.value = v === 'cm' ? trim(n * IN, 1) : trim(n / IN, 2); });
      }
    });
    $('#m-form', root).onsubmit = submitEntry(root, e, () => {
      const wu2 = segVal('m-wu', root), lu2 = segVal('m-lu', root);
      let weightG;
      if (wu2 === 'g') { const gv = num($('#f-g', root).value); if (gv != null && gv > 0) weightG = gv; }
      else { const l = num($('#f-lb', root).value) || 0, o = num($('#f-oz', root).value) || 0; if (l + o > 0) weightG = (l * 16 + o) / 16 * LB; }
      const toCm = v => v == null ? undefined : (lu2 === 'cm' ? v : v * IN);
      const lengthCm = toCm(num($('#f-len', root).value)), headCm = toCm(num($('#f-head', root).value));
      if (weightG == null && lengthCm == null && headCm == null) throw new Error('Enter at least one measurement');
      return { type: 'measure', babyId: e ? e.babyId : prefs.activeBaby, at: fromInput($('#f-time', root).value), weightG: weightG ?? null, lengthCm: lengthCm ?? null, headCm: headCm ?? null, note: $('#f-note', root).value.trim() || null };
    });
    wireDelete(root, e);
  });
}

// pumping
function openPump(e) {
  const unit = e ? (e.unit || prefs.pumpUnit) : prefs.pumpUnit;
  const amt = e ? (unit === 'ml' ? Math.round(e.ml) : trim(e.ml / OZ, 2)) : '';
  openSheet(`<h2>${e ? 'Edit pump' : 'Pump'}</h2><form id="p-form">
    <div class="field"><label for="f-amt">Amount pumped</label><div class="inline"><input type="number" id="f-amt" inputmode="decimal" step="0.1" min="0" placeholder="0" value="${amt}" required>${segHtml('p-unit', [['oz', 'oz'], ['ml', 'mL']], unit)}</div></div>
    ${timeField(e ? e.at : Date.now())}
    ${noteField(e && e.note)}
    ${formActions(!!e, e ? 'Save' : 'Log pump')}</form>`, root => {
    wireSeg(root, (id, v) => { if (id === 'p-unit') setPref('pumpUnit', v); });
    $('#p-form', root).onsubmit = submitEntry(root, e, () => {
      const a = num($('#f-amt', root).value); if (a == null || a <= 0) throw new Error('Enter an amount');
      const u = segVal('p-unit', root);
      return { type: 'pump', at: fromInput($('#f-time', root).value), ml: u === 'ml' ? a : a * OZ, unit: u, note: $('#f-note', root).value.trim() || null };
    });
    wireDelete(root, e);
  });
}

// babies
function openBabySheet(b, firstRun = false) {
  openSheet(`<h2>${b ? 'Edit baby' : firstRun ? 'Welcome to CribSheet' : 'Add a baby'}</h2>${firstRun ? '<p class="sub">Add your baby to start logging. You can add more than one in Settings.</p>' : ''}<form id="baby-form">
    <div class="field"><label for="f-name">Name</label><input type="text" id="f-name" value="${esc(b ? b.name : '')}" autocomplete="off" required placeholder="Baby"></div>
    <div class="field"><label for="f-dob">Birthdate</label><input type="date" id="f-dob" value="${esc(b ? b.dob || '' : '')}"></div>
    <div class="actions">${b ? (babies.length > 1 ? '<button class="btn danger" type="button" id="f-delbaby">Delete</button>' : '') : (firstRun ? '' : '<button class="btn" type="button" data-close>Cancel</button>')}<button class="btn primary" type="submit">${b ? 'Save' : 'Add baby'}</button></div></form>`, root => {
    $('#baby-form', root).onsubmit = ev => {
      ev.preventDefault();
      const name = $('#f-name', root).value.trim() || 'Baby', dob = $('#f-dob', root).value || undefined;
      if (b) doWrite(store.updateBaby(b.id, { name, dob: dob ?? null }), 'Saved');
      else { const nb = { id: uid(), name, dob, createdAt: Date.now() }; setPref('activeBaby', nb.id); doWrite(store.addBaby(nb), `Added ${name}`); }
      closeSheet();
    };
    const d = $('#f-delbaby', root); if (d) d.onclick = () => { const n = entries.filter(e => e.babyId === b.id).length; if (confirm(`Delete ${b.name} and their ${n} log entries? This cannot be undone.`)) { closeSheet(); doWrite(store.deleteBaby(b.id), 'Deleted'); } };
  });
}
function openBabyChooser() {
  if (!babies.length) return openBabySheet(null, true);
  if (babies.length === 1) return openBabySheet(babies[0]);
  openSheet(`<h2>Who are you logging for?</h2><div class="list" style="margin-top:8px">${babies.map(b => `<div class="li"><button class="entry" type="button" data-pick="${b.id}" style="padding:4px 0"><div class="body"><b>${esc(b.name)}${b.id === prefs.activeBaby ? ' ✓' : ''}</b><span>${ageText(b) || 'No birthdate'}</span></div></button><button class="btn" type="button" data-editb="${b.id}">Edit</button></div>`).join('')}</div>
    <div class="actions"><button class="btn" type="button" data-close>Close</button><button class="btn" type="button" id="chooser-add">Add a baby</button></div>`, root => {
    $$('[data-pick]', root).forEach(x => x.onclick = () => { setPref('activeBaby', x.dataset.pick); closeSheet(); renderAll(); });
    $$('[data-editb]', root).forEach(x => x.onclick = () => openBabySheet(babies.find(b => b.id === x.dataset.editb)));
    $('#chooser-add', root).onclick = () => openBabySheet(null);
  });
}

// ---------- export / import ----------
function download(name, text, type = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvEscape(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportCsv() {
  const cols = ['type', 'baby', 'date', 'time', 'left_min', 'right_min', 'start_side', 'end_side', 'amount_oz', 'amount_ml', 'contents', 'diaper', 'weight_g', 'weight_lb_oz', 'length_cm', 'length_in', 'head_cm', 'head_in', 'note'];
  const rows = entries.slice().sort((a, b) => a.at - b.at).map(e => {
    const d = new Date(e.at);
    return {
      type: e.type, baby: e.babyId ? babyName(e.babyId) : '', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      left_min: e.type === 'nurse' ? trim((e.leftSec || 0) / 60, 1) : '', right_min: e.type === 'nurse' ? trim((e.rightSec || 0) / 60, 1) : '', start_side: e.startSide || '', end_side: e.endSide || '',
      amount_oz: e.ml != null ? trim(e.ml / OZ, 2) : '', amount_ml: e.ml != null ? Math.round(e.ml) : '', contents: e.contents || '', diaper: e.kind || '',
      weight_g: e.weightG != null ? Math.round(e.weightG) : '', weight_lb_oz: e.weightG != null ? fmtWeight(e.weightG, 'lb') : '', length_cm: e.lengthCm != null ? trim(e.lengthCm, 1) : '', length_in: e.lengthCm != null ? trim(e.lengthCm / IN, 2) : '', head_cm: e.headCm != null ? trim(e.headCm, 1) : '', head_in: e.headCm != null ? trim(e.headCm / IN, 2) : '', note: e.note || ''
    };
  });
  const text = cols.join(',') + '\n' + rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
  download(`cribsheet-${toInput(Date.now()).slice(0, 10)}.csv`, text, 'text/csv');
}
function exportJson() { download(`cribsheet-backup-${toInput(Date.now()).slice(0, 10)}.json`, JSON.stringify({ app: 'CribSheet', version: 1, exportedAt: new Date().toISOString(), babies, entries }, null, 1), 'application/json'); }
async function importJson(file) {
  let data; try { data = JSON.parse(await file.text()); } catch { toast('That file is not a CribSheet backup'); return; }
  if (!data || !Array.isArray(data.entries)) { toast('That file is not a CribSheet backup'); return; }
  const bs = Array.isArray(data.babies) ? data.babies : [];
  if (!confirm(`Restore ${data.entries.length} entries and ${bs.length} baby profile(s)? Existing entries with the same id are updated; nothing is deleted.`)) return;
  try {
    if (store.mode === 'cloud') { await store.batchSet('babies', bs); await store.batchSet('entries', data.entries); }
    else { for (const b of bs) await store.addBaby(b); for (const e of data.entries) await store.addEntry(e); }
    toast('Backup restored');
  } catch (err) { toast('Restore failed: ' + (err.message || err)); }
}

// ---------- toast ----------
let toastTimer = null;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (action ? `<button type="button">${esc(action.label)}</button>` : '');
  if (action) $('button', t).onclick = () => { action.fn(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2200);
}

// ---------- navigation and wiring ----------
function showView(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  window.scrollTo({ top: 0 });
  if (name === 'pump') $('#pq-time').value = toInput(Date.now());
}
function findEntry(id) { return entries.find(e => e.id === id); }

function wire() {
  $$('nav.tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));
  $$('#quick button').forEach(b => b.onclick = () => openLog(b.dataset.log));
  $('#timerBanner').onclick = openTimer;
  $('#babyBtn').onclick = openBabyChooser;
  $('#sheetBg').addEventListener('click', ev => { if (ev.target === ev.currentTarget) closeSheet(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#sheetBg').classList.contains('open')) closeSheet(); });
  $$('#filters .chip').forEach(c => c.onclick = () => { setPref('logFilter', c.dataset.f); renderLog(); });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('.entry[data-id]'); if (!b) return;
    const e = findEntry(b.dataset.id); if (e) openLog(e.type, e);
  });
  // pump quick form
  $$('#pq-unit button').forEach(b => b.onclick = () => { setPref('pumpUnit', b.dataset.u); renderPump(); renderHome(); });
  $('#pumpQuick').onsubmit = ev => {
    ev.preventDefault();
    const a = num($('#pq-amount').value); if (a == null || a <= 0) { toast('Enter an amount'); return; }
    const u = prefs.pumpUnit;
    addEntry({ id: uid(), type: 'pump', at: fromInput($('#pq-time').value), ml: u === 'ml' ? a : a * OZ, unit: u });
    $('#pq-amount').value = ''; $('#pq-time').value = toInput(Date.now());
  };
  // settings
  $('#addBaby').onclick = () => openBabySheet(null);
  $('#babyList').addEventListener('click', ev => {
    const s = ev.target.closest('[data-select]'); if (s) { setPref('activeBaby', s.dataset.select); renderAll(); return; }
    const e = ev.target.closest('[data-edit]'); if (e) openBabySheet(babies.find(b => b.id === e.dataset.edit));
  });
  $$('[data-pref]').forEach(seg => $$('button', seg).forEach(b => b.onclick = () => { setPref(seg.dataset.pref, b.dataset.v); applyTheme(); renderAll(); }));
  $('#exportCsv').onclick = () => { if (!entries.length) { toast('Nothing to export yet'); return; } exportCsv(); };
  $('#exportJson').onclick = exportJson;
  $('#importJson').onclick = () => $('#importFile').click();
  $('#importFile').onchange = ev => { const f = ev.target.files[0]; if (f) importJson(f); ev.target.value = ''; };
  $('#wipe').onclick = async () => {
    if (!confirm(store.mode === 'cloud' ? 'Delete every entry and baby in this household, for every phone? Export a backup first if you want to keep anything.' : 'Delete every entry and baby on this phone? Export a backup first if you want to keep anything.')) return;
    if (!confirm('Really delete everything? This cannot be undone.')) return;
    try { await store.wipe(); timer = null; save('cs.timer', null); toast('All data deleted'); } catch (err) { toast('Delete failed: ' + (err.message || err)); }
  };
  window.addEventListener('online', renderSync); window.addEventListener('offline', renderSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderHome(); });
  // clock: timer banner every second, relative times every 30 s
  let n = 0;
  setInterval(() => {
    if (timer) { const t = timerTotals(); $('#bannerSide').textContent = sideName(timer.side); $('#bannerTime').textContent = mmss(t.total); }
    if (++n % 30 === 0 && $('#view-home').classList.contains('active') && !$('#sheetBg').classList.contains('open')) renderHome();
  }, 1000);
}

// ---------- boot ----------
async function boot() {
  applyTheme();
  wire();
  if (cloudConfigured && prefs.hid) {
    store = new CloudStore(FBCFG, prefs.hid);
    $('#now').innerHTML = '<div class="muted small">Connecting to your household…</div>';
    try { await store.init(); }
    catch (err) { console.error(err); cloudError = err; store = new LocalStore(); }
  } else store = new LocalStore();
  store.onChange(onData);
  if (cloudError) toast('Sync unavailable: ' + (cloudError.message || cloudError));
  
  if (timer && !document.hidden) $('#timerBanner').hidden = false;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
