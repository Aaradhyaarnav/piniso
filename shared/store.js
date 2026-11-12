/* Piniso — storage helpers (settings, sessions, stats, flashcards). */
(() => {
  if (globalThis.PStore) return;
  const P = globalThis.PINISO;
  const area = () => chrome.storage.local;

  const get = (keys) => new Promise((res) => area().get(keys, (v) => res(v || {})));
  const set = (obj) => new Promise((res) => area().set(obj, () => res()));
  const remove = (keys) => new Promise((res) => area().remove(keys, () => res()));

  const todayKey = (d = new Date()) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  // ---------- settings ----------
  async function settings() {
    const { settings: s } = await get('settings');
    return P.deepMerge(P.DEFAULTS, s || {});
  }
  async function saveSettings(patch) {
    const cur = await settings();
    const next = P.deepMerge(cur, patch);
    await set({ settings: next });
    return next;
  }
  async function replaceSettings(full) {
    await set({ settings: P.deepMerge(P.DEFAULTS, full || {}) });
  }
  function onSettings(cb) {
    chrome.storage.onChanged.addListener((changes, a) => {
      if (a === 'local' && changes.settings) cb(P.deepMerge(P.DEFAULTS, changes.settings.newValue || {}));
    });
  }

  // ---------- sessions (one per video) ----------
  const sKey = (key) => 's:' + key;
  function blankSession(key, meta = {}) {
    return {
      key, title: meta.title || 'Untitled lecture', url: meta.url || '', site: meta.site || '',
      createdAt: Date.now(), updatedAt: Date.now(),
      topic: '', notes: [], terms: [], cards: [], comments: [], quizzes: [], marks: [], chat: [],
      processed: [], // [[start,end], ...] seconds already digested
      lastQuizAt: 0,
      watchSeconds: 0, awaySeconds: 0, awayCount: 0, xpEarned: 0,
      summary: null
    };
  }
  async function getSession(key) {
    const r = await get(sKey(key));
    return r[sKey(key)] || null;
  }
  async function saveSession(sess) {
    sess.updatedAt = Date.now();
    await set({ [sKey(sess.key)]: sess });
    const { sessions = [] } = await get('sessions');
    const i = sessions.findIndex((x) => x.key === sess.key);
    const row = {
      key: sess.key, title: sess.title, url: sess.url, site: sess.site, updatedAt: sess.updatedAt,
      createdAt: sess.createdAt, notes: sess.notes.length, watch: Math.round(sess.watchSeconds), topic: sess.topic || '',
      lastT: sess.lastT || 0, dur: sess.dur || 0, author: sess.author || '', vid: sess.vid || '', study: sess.study !== false,
      quizzes: (sess.quizzes || []).length, cards: (sess.cards || []).length, chat: (sess.chat || []).length,
      acc: (() => { const it = (sess.quizzes || []).flatMap((q) => q.items || []); return it.length ? Math.round(100 * it.filter((x) => x.correct).length / it.length) : null; })()
    };
    if (i >= 0) sessions[i] = row; else sessions.unshift(row);
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    await set({ sessions });
  }
  // "Up next" study queue
  async function queue() { const { pzQueue = [] } = await get('pzQueue'); return pzQueue; }
  async function saveQueue(q) { await set({ pzQueue: q.slice(0, 50) }); }
  async function addToQueue(item) {
    const q = await queue();
    if (!item || !item.url || q.some((x) => x.url === item.url)) return q;
    q.push(Object.assign({ addedAt: Date.now() }, item));
    await saveQueue(q);
    return q;
  }
  async function listSessions() {
    const { sessions = [] } = await get('sessions');
    return sessions;
  }
  async function deleteSession(key) {
    await remove(sKey(key));
    const { sessions = [] } = await get('sessions');
    await set({ sessions: sessions.filter((x) => x.key !== key) });
  }

  // ---------- stats / XP / badges ----------
  function blankStats() {
    return {
      xp: 0, days: {}, totalSeconds: 0, sessions: 0,
      quiz: { correct: 0, total: 0, streak: 0 }, notes: 0, doubts: 0, snaps: 0, reviews: 0,
      badges: {}, lastLevel: 1
    };
  }
  async function stats() {
    const { stats: s } = await get('stats');
    return Object.assign(blankStats(), s || {});
  }
  async function updateStats(fn) {
    const s = await stats();
    const before = P.levelFromXP(s.xp);
    const newBadges = [];
    const award = (id) => { if (!s.badges[id]) { s.badges[id] = Date.now(); newBadges.push(id); } };
    fn(s, award);
    // streak freeze: missed yesterday but studying today → use a freeze to keep the streak
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = todayKey(y), tk = todayKey();
    s.frozen = s.frozen || {};
    if ((s.days[tk] || 0) > 0 && !((s.days[yk] || 0) > 0) && !s.frozen[yk] && (s.freezes || 0) > 0) {
      const y2 = new Date(); y2.setDate(y2.getDate() - 2);
      if ((s.days[todayKey(y2)] || 0) > 0 || s.frozen[todayKey(y2)]) { s.frozen[yk] = 1; s.freezes--; }
    }
    // earn a freeze every 7 streak days (max 2 saved)
    const st = streak(s);
    s.freezeAt = s.freezeAt || 0;
    if (st >= 7 && Math.floor(st / 7) > Math.floor(s.freezeAt / 7)) { s.freezes = Math.min(2, (s.freezes || 0) + 1); s.freezeAt = st; }
    if (st < s.freezeAt) s.freezeAt = st;
    // daily mission complete → bonus once a day
    if (s._settings && !dayStat(s, 'missionBonus') && mission(s, s._settings, 0).allDone) { bumpDay(s, 'missionBonus'); s.xp += 50; award('mission'); }
    delete s._settings;
    // automatic badges
    if (st >= 3) award('streak_3');
    if (st >= 7) award('streak_7');
    if (st >= 30) award('streak_30');
    if (s.notes >= 100) award('note_hoarder');
    if (s.doubts >= 10) award('doubt_destroyer');
    if (s.reviews >= 50) award('card_shark');
    if (s.snaps >= 5) award('board_reader');
    const today = s.days[todayKey()] || 0;
    if (today >= 3 * 3600) award('marathon');
    const after = P.levelFromXP(s.xp);
    s.lastLevel = after;
    await set({ stats: s });
    return { stats: s, levelUp: after > before ? after : 0, newBadges };
  }
  // a "frozen" day (streak freeze used) keeps the streak alive
  function streak(s) {
    let n = 0; const d = new Date();
    const fz = s.frozen || {};
    // a day counts if you studied at all OR revised 5 flashcards (tiny, forgiving rule)
    const ok = (k) => (s.days[k] || 0) > 0 || fz[k] || (((s.daily || {})[k] || {}).cards || 0) >= 5;
    // today counts if studied; otherwise start from yesterday
    if (!ok(todayKey(d))) d.setDate(d.getDate() - 1);
    while (ok(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // per-day counters for the daily mission (quizzes done, cards revised …)
  function bumpDay(s, field, by = 1) {
    const k = todayKey();
    s.daily = s.daily || {};
    s.daily[k] = s.daily[k] || {};
    s.daily[k][field] = (s.daily[k][field] || 0) + by;
    // keep 60 days
    const keys = Object.keys(s.daily).sort();
    while (keys.length > 60) delete s.daily[keys.shift()];
  }
  function dayStat(s, field, k) { return ((s.daily || {})[k || todayKey()] || {})[field] || 0; }
  // the 3 small things to do today
  function mission(s, settings, due) {
    const goal = (settings.focus && settings.focus.dailyGoal) || 60;
    const mins = Math.round((s.days[todayKey()] || 0) / 60);
    const cardsTarget = Math.max(5, Math.min(15, (due || 0) + dayStat(s, 'cards')));
    const items = [
      { id: 'study', icon: '🎬', label: `Study ${goal} min`, done: mins >= goal, have: mins, need: goal },
      { id: 'cards', icon: '🃏', label: `Revise ${cardsTarget} flashcards`, done: dayStat(s, 'cards') >= cardsTarget, have: dayStat(s, 'cards'), need: cardsTarget },
      { id: 'quiz', icon: '❓', label: 'Finish 1 quiz', done: dayStat(s, 'quiz') >= 1, have: dayStat(s, 'quiz'), need: 1 }
    ];
    const ex = settings.exam || {};
    if (ex.date) {
      const days = Math.ceil((new Date(ex.date + 'T09:00') - Date.now()) / 86400000);
      if (days >= 0) items.exam = { name: ex.name || 'Exam', days };
    }
    items.allDone = items.every((x) => x.done);
    return items;
  }

  // ---------- flashcards (simple SM-2) ----------
  async function cards() { const { cards: c = [] } = await get('cards'); return c; }
  async function saveCards(c) { await set({ cards: c }); }
  async function addCards(list, src) {
    const c = await cards();
    const now = Date.now();
    for (const it of list) {
      if (!it || !it.q || !it.a) continue;
      const q = String(it.q).trim();
      if (c.some((x) => x.q.toLowerCase() === q.toLowerCase())) continue;
      c.push({ id: uid(), q, a: String(it.a).trim(), src: src || null, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, created: now });
    }
    await saveCards(c);
    return c;
  }
  function schedule(card, grade) { // grade: 0 again, 1 hard, 2 good, 3 easy
    const day = 86400000;
    if (grade === 0) { card.reps = 0; card.lapses++; card.interval = 0; card.ease = Math.max(1.3, card.ease - 0.2); card.due = Date.now() + 10 * 60000; return card; }
    card.reps++;
    if (card.reps === 1) card.interval = grade === 3 ? 3 : 1;
    else if (card.reps === 2) card.interval = grade === 1 ? 3 : 6;
    else card.interval = Math.round(card.interval * (grade === 1 ? 1.2 : grade === 3 ? card.ease * 1.3 : card.ease));
    card.ease = Math.max(1.3, card.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
    card.due = Date.now() + card.interval * day;
    return card;
  }
  async function dueCount() {
    const now = Date.now();
    return (await cards()).filter((c) => c.due <= now).length;
  }

  // ---------- usage tracker ----------
  async function addUsage(provider, model, tokens) {
    const { usage = {} } = await get('usage');
    const d = todayKey();
    usage[d] = usage[d] || {};
    const k = provider + ' · ' + model;
    usage[d][k] = usage[d][k] || { calls: 0, tokens: 0 };
    usage[d][k].calls++;
    usage[d][k].tokens += tokens || 0;
    // keep 14 days
    const keys = Object.keys(usage).sort();
    while (keys.length > 14) delete usage[keys.shift()];
    await set({ usage });
  }

  globalThis.PStore = {
    get, set, remove, todayKey, uid,
    settings, saveSettings, replaceSettings, onSettings,
    bumpDay, dayStat, mission,
    blankSession, getSession, saveSession, listSessions, deleteSession, queue, saveQueue, addToQueue,
    stats, updateStats, streak,
    cards, saveCards, addCards, schedule, dueCount,
    addUsage
  };
})();
