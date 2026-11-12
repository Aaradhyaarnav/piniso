/* Piniso — study booklet v2.
   Notes → AI-designed chapters → real A4/Letter pages (PrintKit) → Print or Download PDF.
   Everything about the look is customizable live: colours, comfortable/compact layout, text size,
   margins, sections, answers, chapter order, high contrast and dyslexia-friendly spacing. */
(async () => {
  const { h, esc } = PU;
  const { uni, wrap } = PrintKit;
  const S = await PStore.settings();
  PU.applyTheme(S);
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const plain = (x) => PMd.plain(String(x || ''));
  const md = (x) => PMd.inline(String(x || ''));
  const norm = (x) => plain(x).toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();

  $('spet').innerHTML = PinisoPet.svgString(PU.petCfg(S), 'writing');
  $('wpet').innerHTML = PinisoPet.svgString(PU.petCfg(S), 'thinking');

  // ---------------- look & feel (remembered) ----------------
  const PALETTES = {
    rainbow: { name: 'Rainbow', c: ['#E4572E', '#2E86DE', '#2BA84A', '#E39B17', '#8E44AD', '#D63384', '#0F9D9A', '#E67E22'] },
    ocean: { name: 'Ocean', c: ['#1B6CA8', '#0F9DB0', '#3A6FE0', '#20A39E', '#5E60CE', '#118AB2'] },
    forest: { name: 'Forest', c: ['#2D6A4F', '#40916C', '#7F5539', '#52885B', '#9C6644', '#1B4332'] },
    sunset: { name: 'Sunset', c: ['#D62839', '#E76F51', '#C2410C', '#B5179E', '#E09F3E', '#9D4EDD'] },
    ink: { name: 'Ink saver', c: ['#222222', '#444444', '#333333', '#555555'] }
  };
  const SECTIONS = [['cover', 'Cover page'], ['tracker', 'Revision tracker'], ['map', 'Mind map'], ['summary', 'Chapter summary'], ['keypoints', 'Key points'], ['definitions', 'Definitions'], ['formulas', 'Formulas'], ['diagrams', 'Diagrams'], ['memory', 'Memory trick + example'], ['mistakes', 'Common mistakes'], ['questions', 'Practice questions'], ['sheet', 'Formula sheet'], ['cards', 'Cut-out flashcards'], ['sources', 'Video links']];
  const DEF_VIEW = { density: 'comfy', palette: 'rainbow', size: 'M', paper: 'A4', margin: 'normal', answers: 'end', lines: 'page', icons: true, dys: false, contrast: false, name: '', klass: '', sec: Object.fromEntries(SECTIONS.map(([k]) => [k, true])) };
  const saved = (await PStore.get('bookletPrefs')).bookletPrefs || {};
  const view = Object.assign({}, DEF_VIEW, saved, { sec: Object.assign({}, DEF_VIEW.sec, saved.sec || {}) });
  const setup = { split: 'topic', detail: 'standard', density: view.density };
  const savePrefs = () => PStore.set({ bookletPrefs: view }).catch(() => {});

  // ---------------- step 1: pick videos + topics ----------------
  const rows = (await PStore.listSessions()).filter((r) => r.study !== false && r.notes > 0);
  const sel = new Map(); // key -> Set(topic) (empty set = whole video)
  const sessCache = {};
  const getSess = async (k) => (sessCache[k] = sessCache[k] || (await PStore.getSession(k)));
  const reachedT = (sess) => Math.max(sess.maxT || 0, sess.lastT || 0) || Infinity;
  const usable = (sess, all) => (sess.notes || []).filter((n) => !n.pending && n.text && (all || !n.ahead || n.t <= reachedT(sess) + 2));
  const topicsOf = (sess) => { const out = []; usable(sess, $('unwatched').checked).sort((a, b) => a.t - b.t).forEach((n) => { const tp = n.topic || 'Notes'; if (!out.includes(tp)) out.push(tp); }); return out; };

  async function renderList() {
    const q = $('q').value.trim().toLowerCase();
    const list = $('list');
    list.innerHTML = '';
    const shown = rows.filter((r) => !q || (r.title + ' ' + (r.topic || '')).toLowerCase().includes(q));
    if (!shown.length) { list.append(h('div.muted', { style: { padding: '20px 4px' }, text: rows.length ? 'No match.' : 'No notes yet — study a lecture with Piniso first, then come back here.' })); return; }
    for (const r of shown) {
      const on = sel.has(r.key);
      const item = h('div.vitem' + (on ? '.on' : ''));
      const cb = h('input', { type: 'checkbox', checked: on, 'aria-label': r.title });
      cb.onchange = async () => { if (cb.checked) sel.set(r.key, new Set()); else sel.delete(r.key); if (!$('title').value && cb.checked) $('title').placeholder = 'e.g. ' + (r.topic || r.title).slice(0, 50); await renderList(); };
      item.append(h('label.vhead', null, cb, h('span.vt', null, h('b', { text: r.title }), h('span.small.muted', { text: `${r.notes} notes${r.topic ? ' · ' + r.topic : ''} · ${PU.ago(r.updatedAt)}` }))));
      if (on) {
        const sess = await getSess(r.key);
        const tps = sess ? topicsOf(sess) : [];
        if (tps.length > 1) {
          const set = sel.get(r.key);
          const tw = h('div.tps');
          tw.append(h('span.small.muted', { text: set.size ? 'Only these topics:' : 'All topics (or pick some):' }));
          tps.forEach((tp) => tw.append(h('button.chip.sm' + (set.has(tp) ? '.on' : ''), { text: tp, 'aria-pressed': String(set.has(tp)), onclick: () => { if (set.has(tp)) set.delete(tp); else set.add(tp); renderList(); } })));
          item.append(tw);
        }
      }
      list.append(item);
    }
  }
  $('q').oninput = renderList;
  $('unwatched').onchange = renderList;
  if (params.get('key') && rows.some((r) => r.key === params.get('key'))) sel.set(params.get('key'), new Set());
  const segs = (el, choices, obj, key, after) => { el.innerHTML = ''; el.append(PU.seg(choices, obj[key], (v) => { obj[key] = v; after && after(v); })); };
  segs($('split'), [['topic', 'A chapter per topic'], ['video', 'A chapter per video']], setup, 'split');
  segs($('detail'), [['short', 'Short'], ['standard', 'Standard'], ['detailed', 'Detailed']], setup, 'detail');
  segs($('density'), [['comfy', '🛋️ Comfortable'], ['compact', '📄 Compact (fewer pages)']], setup, 'density', (v) => { view.density = v; view.lines = v === 'compact' ? 'fill' : 'page'; savePrefs(); });
  await renderList();

  // saved booklets
  async function renderSaved() {
    const { booklets = [] } = await PStore.get('booklets');
    $('savedBox').hidden = !booklets.length;
    const box = $('saved'); box.innerHTML = '';
    booklets.slice().reverse().forEach((b) => {
      const row = h('div.srow', null, h('b', { text: b.title }), h('span.small.muted', { text: new Date(b.at).toLocaleDateString() }));
      row.append(h('button.btn.sm', { text: 'Open', onclick: () => { current = b; show(b.data); } }));
      row.append(h('button.btn.sm.ghost', { text: '✕', title: 'Delete', 'aria-label': 'Delete ' + b.title, onclick: async () => { const l = ((await PStore.get('booklets')).booklets || []).filter((x) => x.id !== b.id); await PStore.set({ booklets: l }); renderSaved(); } }));
      box.append(row);
    });
  }
  await renderSaved();
  let current = null; // the saved record being viewed

  // ---------------- AI ----------------
  const LANGN = { english: 'English', hinglish: 'Hinglish (Hindi in Roman letters mixed with English)', hindi: 'Hindi (Devanagari)' };
  const vidOf = (sess) => sess.vid || ((String(sess.key).match(/^yt:(.+)$/) || [])[1]) || '';
  function planChapters(sess, topics, all) {
    const notes = usable(sess, all).filter((n) => !topics.size || topics.has(n.topic || 'Notes')).sort((a, b) => a.t - b.t);
    if (!notes.length) return [];
    if (setup.split === 'video') return [{ title: sess.topic || sess.title, notes }];
    const groups = [];
    notes.forEach((n) => {
      const tp = n.topic || 'Notes';
      let g = groups.find((x) => x.title === tp);
      if (!g) { g = { title: tp, notes: [] }; groups.push(g); }
      g.notes.push(n);
    });
    // merge tiny topics into their neighbour, keep at most 8 chapters
    for (let i = groups.length - 1; i > 0; i--) if (groups[i].notes.length < 2 || groups.length > 8) { groups[i - 1].notes.push(...groups[i].notes); groups.splice(i, 1); }
    if (groups.length > 1 && groups[0].notes.length < 2) { groups[1].notes.unshift(...groups[0].notes); groups.shift(); }
    return groups;
  }
  function localChapter(sess, g) {
    const ns = g.notes;
    const defs = ns.filter((n) => n.kind === 'definition').map((n) => { const m = n.text.match(/^\*\*(.+?)\*\*\s*[—:-]\s*(.+)$/s); return m ? { term: m[1], meaning: m[2] } : null; }).filter(Boolean);
    const formulas = [];
    ns.forEach((n) => { (n.text.match(/\$([^$]{3,80})\$/g) || []).slice(0, 2).forEach((f) => { if (formulas.length < 4 && /[=<>]/.test(f)) formulas.push({ name: uni(plain(n.text).split(/[:—]/)[0]).slice(0, 30), latex: f.replace(/\$/g, ''), note: '' }); }); });
    const qs = [];
    (sess.quizzes || []).flatMap((z) => z.items || []).filter((x) => x.t == null || (x.t >= ns[0].t - 30 && x.t <= ns[ns.length - 1].t + 30)).slice(0, 4).forEach((x) => {
      if (x.type === 'mcq' && Array.isArray(x.options)) qs.push({ type: 'mcq', q: x.q, options: x.options.slice(0, 4), answer: typeof x.answer === 'number' ? x.options[x.answer] : x.answer_text || x.answer });
      else if (x.type === 'tf') qs.push({ type: 'short', q: 'True or false: ' + x.q, answer: x.answer === true || x.answer === 'true' ? 'True' : 'False' });
      else qs.push({ type: 'short', q: x.q, answer: plain(String(x.answer || '')) });
    });
    return {
      title: g.title, t: ns[0].t, summary: '', keypoints: ns.filter((n) => n.kind !== 'definition').slice(0, 8).map((n) => n.text.slice(0, 240)),
      definitions: defs.slice(0, 5), formulas, diagram: { type: 'none' }, mnemonic: '', example: (ns.find((n) => n.kind === 'example') || {}).text || '',
      mistakes: ns.filter((n) => n.kind === 'warning').map((n) => n.text).slice(0, 3), questions: qs, map: [], local: true
    };
  }
  const DETAIL = { short: { kp: '3-5', q: 2, tok: 1500 }, standard: { kp: '4-7', q: 3, tok: 2200 }, detailed: { kp: '6-10', q: 5, tok: 3000 } };
  async function aiChapter(sess, g, lang) {
    const D = DETAIL[setup.detail] || DETAIL.standard;
    const src = g.notes.map((n) => `[${Math.round(n.t)}s] ${PZ_star(n) ? '⭐ ' : ''}(${n.kind}) ${n.text}`).join('\n').slice(0, 6000);
    const user = `Design ONE chapter of a printable STUDY BOOKLET from these lecture notes. Students revise from paper before an exam, so it must be complete, correct and exam-ready.
LECTURE: "${sess.title}"   CHAPTER TOPIC: "${g.title}"
NOTES ([seconds] (kind) note):
${src}

Write in ${lang}. Use $LaTeX$ inside text for math. Return ONLY this JSON (compact, no markdown fences):
{"title":"short chapter title (max 6 words)","summary":"2 sentences: what this chapter is about and why it matters","keypoints":["${D.kp} crisp exam points, one line each"],"definitions":[{"term":"","meaning":"one line"}],"formulas":[{"name":"plain words","latex":"LaTeX WITHOUT $","note":"what the symbols mean + units"}],"diagram":{"type":"flow|cycle|compare|tree|none","title":"plain words","items":["3-6 labels, PLAIN WORDS, max 5 words, no LaTeX"],"left":"","right":"","rows":[["",""]]},"mnemonic":"","example":"one real-life example","mistakes":["one line each"],"questions":[{"type":"mcq","q":"","options":["","","",""],"answer":"exact text of the correct option"},{"type":"short","q":"","answer":""},{"type":"long","q":"","answer":"2-3 line model answer"}],"map":["3 sub-topics of this chapter for a mind map: 1-4 PLAIN words each, no symbols, no formulas, no arrows"],"cards":[{"q":"","a":""}]}
Rules: facts only from the notes or standard textbook knowledge. 0-3 formulas (only real ones, never invent). ${D.q} questions. 2-3 cards. diagram "none" unless it truly helps. No filler like "In this chapter we will learn" — every line must be useful for the exam.`;
    const msg = { type: 'ai:chat', json: true, maxTokens: D.tok, temperature: 0.3, timeout: 120000, messages: [{ role: 'system', content: 'You are a top teacher who designs clear, accurate revision booklets for students. Reply with JSON only.' }, { role: 'user', content: user }] };
    let r = await PU.bg(msg);
    if (!r.ok && !['NO_KEY', 'BAD_KEY'].includes(r.code)) r = await PU.bg(Object.assign({}, msg, { fast: true, maxTokens: Math.min(D.tok, 1800) }));
    if (!r.ok) throw Object.assign(new Error(r.error || 'AI error'), { code: r.code });
    const d = r.data || {};
    if (!d.keypoints && !d.summary) throw new Error('empty chapter');
    return d;
  }
  const PZ_star = (n) => !!(n.star || n.kind === 'important');

  $('go').onclick = async () => {
    if (!sel.size) { PU.toast('Pick at least one video'); return; }
    view.density = setup.density; savePrefs();
    $('setup').hidden = true; $('work').hidden = false;
    const keys = [...sel.keys()];
    const first = rows.find((r) => r.key === keys[0]);
    const data = { title: $('title').value.trim() || (keys.length === 1 && first ? (first.topic || first.title) : 'My study booklet'), made: Date.now(), chapters: [], cards: [], sources: [], edits: {}, order: null, hidden: [] };
    const lang = LANGN[S.lang.notes] || 'English';
    const all = $('unwatched').checked;
    const jobs = [];
    for (const k of keys) {
      const sess = await getSess(k);
      if (!sess) continue;
      data.sources.push({ title: sess.title, url: sess.url });
      planChapters(sess, sel.get(k), all).forEach((g) => jobs.push({ sess, g }));
      const lim = all ? Infinity : reachedT(sess);
      (sess.cards || []).filter((c) => c.t == null || c.t <= lim + 2).slice(0, 6).forEach((c) => data.cards.push({ q: c.q, a: c.a }));
    }
    if (!jobs.length) { $('work').hidden = true; $('setup').hidden = false; PU.toast('These videos have no notes yet 📝', 4000); return; }
    let done = 0, offline = 0, noKey = false;
    const out = new Array(jobs.length);
    const runOne = async (i) => {
      const { sess, g } = jobs[i];
      let c;
      try {
        if (noKey) throw new Error('no key');
        const d = await aiChapter(sess, g, lang);
        c = Object.assign(localChapter(sess, g), d, { local: false });
        (d.cards || []).forEach((x) => x && x.q && x.a && data.cards.push(x));
      } catch (e) {
        if (e.code === 'NO_KEY' || e.code === 'BAD_KEY') noKey = true;
        c = localChapter(sess, g); offline++;
        console.warn('[Piniso booklet] chapter fallback:', g.title, e.message);
      }
      out[i] = Object.assign(c, { t: c.t != null && isFinite(+c.t) ? +c.t : g.notes[0].t, key: sess.key, src: sess.title, url: sess.url, vid: vidOf(sess) });
      done++;
      $('wmsg').textContent = `Designed ${done} of ${jobs.length} chapters… (“${g.title.slice(0, 40)}”)`;
      $('wbar').style.width = Math.round(done / jobs.length * 100) + '%';
    };
    $('wmsg').textContent = `Planning ${jobs.length} chapters…`;
    let next = 0;
    await Promise.all([0, 1].map(async () => { while (next < jobs.length) { const i = next++; await runOne(i); } }));
    data.chapters = out.filter(Boolean);
    const seen = new Set(); data.cards = data.cards.filter((c) => { const k = norm(c.q); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 24);
    current = { id: Date.now(), title: data.title, at: Date.now(), data };
    await persist();
    show(data);
    if (offline) PU.toast(noKey ? 'No AI key — booklet made straight from your notes. Add a key in settings for diagrams & questions.' : `${offline} chapter(s) were made straight from your notes (AI was busy). Go back and make it again to retry.`, 7000);
  };
  async function persist() {
    if (!current) return;
    try {
      const list = (await PStore.get('booklets')).booklets || [];
      const i = list.findIndex((x) => x.id === current.id);
      current.title = current.data.title;
      if (i >= 0) list[i] = current; else list.push(current);
      await PStore.set({ booklets: list.slice(-10) });
    } catch (e) {}
  }
  let saveT = 0;
  const persistSoon = () => { clearTimeout(saveT); saveT = setTimeout(persist, 700); };

  // ================= drawing (canvas: crisp in print and identical in the PDF) =================
  const FONT = 'PinisoSans, "DM Sans", sans-serif';
  const SERIF = 'PinisoSerif, Georgia, serif';
  function scene(W, H, label, draw) {
    const cv = document.createElement('canvas');
    const k = 3; // ~300 dpi on A4
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', label);
    cv.style.width = '100%'; cv.style.maxWidth = W + 'px'; cv.style.display = 'block'; cv.style.margin = '0 auto';
    const x = cv.getContext('2d');
    x.scale(k, k); x.lineJoin = 'round'; x.lineCap = 'round';
    draw(x);
    return cv;
  }
  function rrect(x, X, Y, w, hh, r, fill, stroke, lw, dash) {
    x.beginPath(); x.roundRect(X, Y, w, hh, r);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.setLineDash(dash || []); x.strokeStyle = stroke; x.lineWidth = lw || 1.6; x.stroke(); x.setLineDash([]); }
  }
  function lines(x, arr, cx, cy, font, fill, lh) {
    x.font = font; x.fillStyle = fill; x.textAlign = 'center'; x.textBaseline = 'middle';
    arr.forEach((l, i) => x.fillText(l, cx, cy + (i - (arr.length - 1) / 2) * lh));
  }
  function curve(x, x1, y1, x2, y2, stroke, lw, dash) {
    const mx = (x1 + x2) / 2;
    x.beginPath(); x.moveTo(x1, y1); x.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    x.setLineDash(dash || []); x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); x.setLineDash([]);
  }
  function arrow(x, x1, y1, x2, y2, col, lw = 2.4) {
    const a = Math.atan2(y2 - y1, x2 - x1), hl = 9;
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2 - Math.cos(a) * hl * 0.7, y2 - Math.sin(a) * hl * 0.7); x.strokeStyle = col; x.lineWidth = lw; x.stroke();
    x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 - hl * Math.cos(a - 0.45), y2 - hl * Math.sin(a - 0.45)); x.lineTo(x2 - hl * Math.cos(a + 0.45), y2 - hl * Math.sin(a + 0.45)); x.closePath(); x.fillStyle = col; x.fill();
  }
  // where a ray from the box centre leaves the box
  const edge = (w, hh, dx, dy) => { const t = Math.min(Math.abs(w / 2 / (dx || 1e-6)), Math.abs(hh / 2 / (dy || 1e-6))); return [dx * t, dy * t]; };
  const cleanLabel = (s) => {
    let t = uni(plain(s)).replace(/^[\s\-–•*\d.)]+/, '').replace(/[.:;,\s]+$/, '');
    if (/=/.test(t)) t = t.split('=')[0].trim().replace(/\s+\S{1,2}$/, ''); // "Refractive index n = c/v" → "Refractive index"
    t = t.replace(/\s*[→⇒⟶➝]\s*/g, ' – ').replace(/\s*[←⇐]\s*/g, ' – '); // arrows don't draw reliably on canvas fonts
    return t.split(/\s+/).slice(0, 7).join(' ');
  };

  // ---------- the big picture: a clean two-sided mind map ----------
  function mapKids(c) {
    let k = (c.map || []).map(cleanLabel).filter(Boolean);
    if (k.length < 2) {
      k = k.concat((c.definitions || []).map((d) => cleanLabel(d.term)), (c.formulas || []).map((f) => cleanLabel(f.name)),
        (c.keypoints || []).map((p) => { const b = String(p).match(/\*\*(.+?)\*\*/); return cleanLabel(b ? b[1] : plain(p).split(/\s+/).slice(0, 4).join(' ')); }));
    }
    const seen = new Set([norm(c.title)]);
    return k.filter((x) => x && x.length > 1 && !seen.has(norm(x)) && seen.add(norm(x))).slice(0, 3);
  }
  function mindMap(title, chs, col) {
    const W = 884, CX = W / 2, CW = 168, BW = 146, KW = 148, GAP = 16; // 2 × (84 + 34 + 146 + 22 + 148) + 16
    const fB = `700 13px ${FONT}`, fK = `500 11.5px ${FONT}`, fC = `400 21px ${SERIF}`;
    const items = chs.slice(0, 10).map((c, i) => {
      const bl = wrap(c.title, BW - 22, fB, 2), kids = mapKids(c).map((k) => wrap(k, KW - 18, fK, 2));
      const bh = 18 + bl.length * 16, kh = kids.map((k) => 12 + k.length * 14.5);
      const kt = kh.reduce((a, b) => a + b, 0) + Math.max(0, kh.length - 1) * 7;
      return { c, i, bl, kids, bh, kh, hh: Math.max(bh, kt) };
    });
    const right = items.slice(0, Math.ceil(items.length / 2)), left = items.slice(Math.ceil(items.length / 2));
    const sideH = (arr) => arr.reduce((a, b) => a + b.hh, 0) + Math.max(0, arr.length - 1) * GAP;
    const H = Math.max(sideH(right), sideH(left), 150) + 28, CY = H / 2;
    const tl = wrap(title, CW - 26, fC, 3), ch = 30 + tl.length * 24;
    const label = 'Mind map of ' + uni(title) + ': ' + items.map((it) => uni(it.c.title) + (it.kids.length ? ' (' + it.kids.map((k) => k.join(' ')).join(', ') + ')' : '')).join('; ');
    const ink = view.palette === 'ink';
    return scene(W, H, label, (x) => {
      const place = (arr, side) => {
        let y = CY - sideH(arr) / 2;
        arr.forEach((it) => {
          const C = col(it.i), my = y + it.hh / 2;
          const bx = side > 0 ? CX + CW / 2 + 34 : CX - CW / 2 - 34 - BW;
          const kx = side > 0 ? bx + BW + 22 : bx - 22 - KW;
          curve(x, side > 0 ? CX + CW / 2 - 4 : CX - CW / 2 + 4, CY, side > 0 ? bx : bx + BW, my, C, 4);
          let ky = my - (it.kh.reduce((a, b) => a + b, 0) + Math.max(0, it.kh.length - 1) * 7) / 2;
          it.kids.forEach((kl, j) => {
            const khh = it.kh[j], kmy = ky + khh / 2;
            curve(x, side > 0 ? bx + BW : bx, my, side > 0 ? kx : kx + KW, kmy, C, 1.8);
            rrect(x, kx, ky, KW, khh, 9, '#fff', C, 1.6);
            lines(x, kl, kx + KW / 2, kmy, fK, '#1c1b18', 14.5);
            ky += khh + 7;
          });
          rrect(x, bx, my - it.bh / 2, BW, it.bh, 11, ink ? '#fff' : C, '#1c1b18', 1.8);
          lines(x, it.bl, bx + BW / 2, my, fB, ink ? '#1c1b18' : '#fff', 16);
          y += it.hh + GAP;
        });
      };
      place(right, 1); place(left, -1);
      rrect(x, CX - CW / 2, CY - ch / 2, CW, ch, 18, '#FFF6D6', '#1c1b18', 2.4);
      lines(x, tl, CX, CY, fC, '#1c1b18', 24);
    });
  }

  // ---------- chapter diagrams ----------
  function diagram(d, C) {
    if (!d || !d.type || d.type === 'none') return null;
    const items = (d.items || []).map(cleanLabel).filter(Boolean).slice(0, 6);
    const fI = `600 12px ${FONT}`, W = 680;
    if (d.type === 'compare' && (d.rows || []).length) {
      const t = h('table.cmp');
      t.innerHTML = `<thead><tr><th>${md(d.left || 'A')}</th><th>${md(d.right || 'B')}</th></tr></thead><tbody>${d.rows.slice(0, 8).map((r) => `<tr><td>${md(r[0] || '')}</td><td>${md(r[1] || '')}</td></tr>`).join('')}</tbody>`;
      return t;
    }
    if (items.length < 2) return null;
    const title = d.title ? cleanLabel(d.title) : '';
    if (d.type === 'cycle') {
      const n = items.length, H = 300, cx = W / 2, cy = H / 2, rx = 225, ry = 102, bw = 150;
      const L = items.map((it) => wrap(it, bw - 34, fI, 3)), bh = Math.max(...L.map((l) => 22 + l.length * 15));
      const pos = items.map((_, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
      return scene(W, H, 'Cycle: ' + items.join(' → ') + ' → back to ' + items[0], (x) => {
        pos.forEach(([x1, y1], i) => {
          const [x2, y2] = pos[(i + 1) % n], dx = x2 - x1, dy = y2 - y1;
          const [ax, ay] = edge(bw + 10, bh + 10, dx, dy);
          arrow(x, x1 + ax, y1 + ay, x2 - ax, y2 - ay, C);
        });
        pos.forEach(([px, py], i) => {
          rrect(x, px - bw / 2, py - bh / 2, bw, bh, 11, '#fff', '#1c1b18', 1.6);
          x.beginPath(); x.arc(px - bw / 2 + 13, py, 9, 0, Math.PI * 2); x.fillStyle = C; x.fill();
          lines(x, [String(i + 1)], px - bw / 2 + 13, py + 0.5, `700 10px ${FONT}`, '#fff', 10);
          lines(x, L[i], px + 8, py, fI, '#1c1b18', 15);
        });
        if (title) lines(x, wrap(title, 160, `700 13px ${FONT}`, 2), cx, cy, `700 13px ${FONT}`, C, 16);
      });
    }
    if (d.type === 'tree') {
      const n = items.length, gap = W / n, bw = Math.min(150, gap - 12);
      const L = items.map((it) => wrap(it, bw - 14, fI, 3)), bh = Math.max(...L.map((l) => 18 + l.length * 15));
      const rl = wrap(title || 'Overview', 220, `700 13px ${FONT}`, 2), rh = 18 + rl.length * 16, H = 10 + rh + 56 + bh + 10;
      return scene(W, H, 'Tree: ' + (title || 'Overview') + ' splits into ' + items.join(', '), (x) => {
        const ty = 10 + rh + 56;
        items.forEach((_, i) => { const cxx = gap * (i + 0.5); x.beginPath(); x.moveTo(W / 2, 10 + rh); x.bezierCurveTo(W / 2, 10 + rh + 30, cxx, ty - 30, cxx, ty); x.strokeStyle = C; x.lineWidth = 2.2; x.stroke(); });
        rrect(x, W / 2 - 125, 10, 250, rh, 11, view.palette === 'ink' ? '#fff' : C, '#1c1b18', 1.8);
        lines(x, rl, W / 2, 10 + rh / 2, `700 13px ${FONT}`, view.palette === 'ink' ? '#1c1b18' : '#fff', 16);
        items.forEach((_, i) => { const cxx = gap * (i + 0.5); rrect(x, cxx - bw / 2, ty, bw, bh, 10, '#fff', '#1c1b18', 1.6); lines(x, L[i], cxx, ty + bh / 2, fI, '#1c1b18', 15); });
      });
    }
    // flow, in rows of up to 4
    const per = items.length > 4 ? Math.ceil(items.length / 2) : items.length, rowsN = Math.ceil(items.length / per);
    const AG = 30, bw = Math.min(150, (W - (per - 1) * AG) / per);
    const L = items.map((it) => wrap(it, bw - 16, fI, 4)), bh = Math.max(...L.map((l) => 22 + l.length * 15)), RG = 34;
    const H = rowsN * bh + (rowsN - 1) * RG + 8;
    return scene(W, H, 'Steps: ' + items.join(' → '), (x) => {
      const P = items.map((_, i) => { const r = Math.floor(i / per), c = i % per, tot = per * bw + (per - 1) * AG; return [(W - tot) / 2 + c * (bw + AG), 4 + r * (bh + RG)]; });
      P.forEach(([px, py], i) => {
        if (i < P.length - 1) {
          const [qx, qy] = P[i + 1];
          if (qy === py) arrow(x, px + bw + 3, py + bh / 2, qx - 3, qy + bh / 2, C);
          else { x.beginPath(); x.moveTo(px + bw / 2, py + bh + 2); x.bezierCurveTo(px + bw / 2, py + bh + RG, qx + bw / 2, qy - RG, qx + bw / 2, qy - 10); x.strokeStyle = C; x.lineWidth = 2.4; x.stroke(); arrow(x, qx + bw / 2, qy - 12, qx + bw / 2, qy - 2, C); }
        }
        rrect(x, px, py, bw, bh, 11, i % 2 ? '#fff' : tintOf(C, 0.85), '#1c1b18', 1.6);
        lines(x, L[i], px + bw / 2, py + bh / 2, fI, '#1c1b18', 15);
      });
    });
  }

  // ---------------- colours ----------------
  function tintOf(hex, amt) {
    const m = String(hex).replace('#', '');
    const f = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
    const mix = (c) => Math.round(c + (255 - c) * amt);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
  const colOf = () => { const P = (PALETTES[view.palette] || PALETTES.rainbow).c; return (i) => P[i % P.length]; };

  // ================= building the pages =================
  const urlAt = (c, t) => { const tt = Math.max(0, Math.round(t || 0)); if (c.vid) return `https://www.youtube.com/watch?v=${encodeURIComponent(c.vid)}&t=${tt}s`; return c.url || ''; };
  let DATA = null;
  // editable text: your edits are remembered and survive re-layout
  function ed(tag, html, path, cls) {
    const e = h(tag + (cls ? '.' + cls : ''));
    e.innerHTML = DATA.edits && DATA.edits[path] != null ? DATA.edits[path] : html;
    e.contentEditable = 'true'; e.spellcheck = false;
    const before = e.innerHTML;
    e.addEventListener('input', () => { DATA.edits = DATA.edits || {}; DATA.edits[path] = e.innerHTML; persistSoon(); });
    e.addEventListener('blur', () => { if (e.innerHTML !== before) setTimeout(render, 0); });
    return e;
  }
  const blk = (cls, ...kids) => { const b = h('div.blk' + (cls ? '.' + cls : '')); kids.flat().forEach((k) => k && b.append(k)); return b; };
  const bt = (ico, text) => h('div.bt', { html: (ico ? `<span class="ico" aria-hidden="true">${ico}</span>` : '') + esc(text) });
  const orderOf = (data) => { const n = data.chapters.length; let o = Array.isArray(data.order) && data.order.length === n ? data.order : [...Array(n).keys()]; return o.filter((i) => !(data.hidden || []).includes(i)); };
  function ansText(q) {
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      const i = q.options.findIndex((o) => norm(o) === norm(q.answer));
      if (i >= 0) return `<b>${'ABCD'[i]})</b> ${md(q.options[i])}`;
    }
    return md(q.answer);
  }

  function build(data) {
    const V = view, sec = V.sec, compact = V.density === 'compact', col = colOf();
    const chIdx = orderOf(data), chs = chIdx.map((i) => data.chapters[i]);
    const B = [];
    // cover
    if (sec.cover) {
      const cover = blk('page-full.cover');
      const band = h('div.band'); (PALETTES[V.palette] || PALETTES.rainbow).c.slice(0, 6).forEach((c) => band.append(h('i', { style: { background: c } })));
      const pet = h('div.cpet'); pet.innerHTML = PinisoPet.svgString(PU.petCfg(S), 'proud');
      const nQ = chs.reduce((a, c) => a + (sec.questions ? (c.questions || []).length : 0), 0);
      const meta = h('div.cmeta');
      [[chs.length, 'chapter'], [nQ, 'question'], [sec.cards ? data.cards.length : 0, 'flashcard']].forEach(([n, w]) => n && meta.append(h('span', { text: `${n} ${w}${n > 1 ? 's' : ''}` })));
      cover.append(band, h('div.ctop', { text: 'STUDY BOOKLET' }), pet, ed('h1', esc(data.title), 'title', 'ctitle'));
      if (data.sources.length === 1 && norm(data.sources[0].title) !== norm(data.title)) cover.append(h('div.csub2', { text: data.sources[0].title }));
      cover.append(meta);
      const nm = h('div.cname');
      nm.append(h('span', { text: 'Name' }), h('span.ln', { text: V.name || '' }), h('span', { text: 'Class' }), h('span.ln', { text: V.klass || '' }));
      cover.append(nm);
      if (data.sources.length > 1) cover.append(h('div.csrc', { text: 'From: ' + data.sources.map((x) => x.title).join(' · ').slice(0, 260) }));
      B.push(cover);
    }
    // contents + revision tracker
    if (sec.tracker && chs.length) {
      B.push(blk('keepnext', h('h2.ph', { html: 'Contents & <em>revision tracker</em>' }), h('p.lead', { text: 'Tick each step. Revise after 1 day, 1 week and 1 month — spaced revision makes it stick.' })));
      const t = h('table.tbl.trk');
      t.innerHTML = '<thead><tr><th>#</th><th>Chapter</th><th>Read</th><th>Practised</th><th>Rev 1<br><small>+1 day</small></th><th>Rev 2<br><small>+1 week</small></th><th>Rev 3<br><small>+1 month</small></th><th>Confidence</th></tr></thead>';
      const tb = h('tbody');
      chs.forEach((c, k) => tb.append(h('tr.it', { html: `<td><span class="num" style="background:${col(chIdx[k])}">${k + 1}</span></td><td>${esc(uni(c.title))}</td>${'<td><span class="bx"></span></td>'.repeat(5)}<td class="conf">○ ○ ○ ○ ○</td>` })));
      t.append(tb);
      B.push(blk('split', t));
    }
    // mind map
    if (sec.map && chs.length) {
      B.push(blk('keepnext', h('h2.ph', { html: 'The big <em>picture</em>' })));
      const m = blk('mm'); m.append(mindMap(data.title, chs.map((c, k) => Object.assign({}, c, { _i: chIdx[k] })), (i) => col(chIdx[i])));
      B.push(m);
    }
    // chapters
    const allQ = [];
    chs.forEach((c, k) => {
      const ci = chIdx[k], C = col(ci), T = tintOf(C, 0.88), P = 'c' + ci + '.';
      const paint = (b) => { b.style.setProperty('--c', C); b.style.setProperty('--tint', T); return b; };
      const head = paint(blk('keepnext'));
      if (!compact) head.dataset.break = 'before';
      const hd = h('div.chead');
      hd.append(h('span.cnum', { text: String(k + 1).padStart(2, '0') }), ed('h2', md(c.title), P + 'title'));
      const u = urlAt(c, c.t);
      if (u && c.t != null) hd.append(h('a.watch', { href: u, target: '_blank', rel: 'noopener', text: '▶ ' + PU.fmt(c.t) }));
      head.append(hd);
      if (data.sources.length > 1 && c.src) head.append(h('div.cfrom', { text: 'From: ' + c.src }));
      B.push(head);
      if (sec.summary && c.summary) B.push(paint(blk('keepnext', ed('div', md(c.summary), P + 'sum', 'summary'))));
      const kps = sec.keypoints ? (c.keypoints || []).filter(Boolean) : [];
      const dfs = sec.definitions ? (c.definitions || []).filter((d) => d && d.term) .slice(0, 8) : [];
      const kpBox = () => { const ol = h('ol.kp' + (compact && kps.length > 3 && !dfs.length ? '.two' : '')); kps.forEach((x, j) => ol.append(ed('li', md(x), P + 'kp' + j, 'it'))); return h('div.box', null, bt('🎯', 'Key points'), ol); };
      const dfBox = () => { const w = h('div.defs'); dfs.forEach((d, j) => w.append(ed('div', `<b>${md(d.term)}</b> — ${md(d.meaning)}`, P + 'df' + j, 'it'))); return h('div.box', null, bt('📖', 'Definitions'), w); };
      const textLen = kps.concat(dfs.map((d) => d.term + d.meaning)).join(' ').length;
      if (kps.length && dfs.length && textLen < (compact ? 1100 : 800)) B.push(paint(blk('', h('div.cols2', null, kpBox(), dfBox()))));
      else {
        if (kps.length) B.push(paint(blk('split', kpBox())));
        if (dfs.length) B.push(paint(blk('split', dfBox())));
      }
      const fl = sec.formulas ? (c.formulas || []).filter((f) => f && f.latex).slice(0, 6) : [];
      if (fl.length) {
        const g = h('div.fgrid'); g.style.setProperty('--fcols', compact ? Math.min(3, fl.length) : Math.min(2, fl.length));
        fl.forEach((f) => { const b = h('div.fbox.it'); b.innerHTML = `<div class="fn">${esc(uni(f.name || 'Formula'))}</div><div class="fx">${PMd.math(String(f.latex).replace(/^\$+|\$+$/g, ''), true)}</div>${f.note ? `<div class="fnote">${md(f.note)}</div>` : ''}`; g.append(b); });
        B.push(paint(blk('split', bt('🧮', 'Formulas'), g)));
      }
      if (sec.diagrams) {
        const dg = diagram(c.diagram, C);
        if (dg) B.push(paint(blk('', bt('🗺️', c.diagram.title ? uni(plain(c.diagram.title)) : 'Diagram'), h('div.dgm', null, dg))));
      }
      if (sec.memory && (c.mnemonic || c.example)) {
        const kids = [];
        if (c.mnemonic) kids.push(h('div.memo', null, bt('🧠', 'Remember it'), ed('p', md(c.mnemonic), P + 'mn')));
        if (c.example) kids.push(h('div.box.exm', null, bt('🌍', 'Real-life example'), ed('div', md(c.example), P + 'ex')));
        B.push(paint(blk('', kids.length > 1 ? h('div.cols2', null, ...kids) : kids[0])));
      }
      const mi = sec.mistakes ? (c.mistakes || []).filter(Boolean).slice(0, 5) : [];
      if (mi.length) { const ul = h('ul'); mi.forEach((m, j) => ul.append(ed('li', md(m), P + 'mi' + j, 'it'))); B.push(paint(blk('split', h('div.box.warn', null, bt('⚠️', 'Common mistakes'), ul)))); }
      const qs = sec.questions ? (c.questions || []).filter((q) => q && q.q).slice(0, 6) : [];
      if (qs.length) {
        const w = h('div.qs');
        qs.forEach((q) => {
          const n = allQ.length + 1; allQ.push(Object.assign({ n, ch: k + 1 }, q));
          const el = h('div.it');
          const mcq = q.type === 'mcq' && Array.isArray(q.options) && q.options.length;
          const short = mcq && q.options.every((o) => plain(o).length < 18);
          el.innerHTML = `<div class="qq"><b>Q${n}.</b><span>${md(q.q)}<span class="qt">${mcq ? 'MCQ' : q.type === 'long' ? 'LONG' : 'SHORT'}</span></span></div>` +
            (mcq ? `<div class="opts${short ? '.four' : ''}">${q.options.slice(0, 4).map((o, j) => `<span><i>${'ABCD'[j]}</i><span>${md(o)}</span></span>`).join('')}</div>`.replace('opts.four', 'opts four') : (V.answers === 'inline' ? '' : `<div class="wl" style="--lines:${q.type === 'long' ? (compact ? 3 : 4) : (compact ? 1 : 2)}"></div>`)) +
            (V.answers === 'inline' ? `<div class="ans">✓ ${ansText(q)}</div>` : '');
          w.append(el);
        });
        B.push(paint(blk('split', bt('✍️', 'Try it yourself'), w)));
      }
    });
    // formula sheet (all formulas on one page)
    const allF = chs.flatMap((c, k) => (c.formulas || []).filter((f) => f && f.latex).map((f) => Object.assign({ k, ci: chIdx[k] }, f)));
    if (sec.sheet && allF.length > 1) {
      const head = blk('keepnext', h('h2.ph', { html: 'Formula <em>sheet</em>' }));
      if (!compact) head.dataset.break = 'before';
      B.push(head);
      const t = h('table.tbl.fs');
      t.innerHTML = '<thead><tr><th style="width:2.4em">Ch</th><th>Name</th><th>Formula</th><th>Meaning</th></tr></thead>';
      const tb = h('tbody');
      allF.forEach((f) => tb.append(h('tr.it', { html: `<td><span class="num" style="background:${col(f.ci)}">${f.k + 1}</span></td><td>${esc(uni(f.name || ''))}</td><td class="fxc">${PMd.math(String(f.latex).replace(/^\$+|\$+$/g, ''), true)}</td><td>${md(f.note || '')}</td>` })));
      t.append(tb);
      B.push(blk('split', t));
    }
    // flashcards to cut out
    if (sec.cards && data.cards.length) {
      const head = blk('keepnext', h('h2.ph', { html: 'Cut-out <em>flashcards</em>' }), h('p.lead', { text: '✂️ Cut along the dashed lines and fold down the middle: question on the front, answer on the back.' }));
      if (!compact) head.dataset.break = 'before';
      B.push(head);
      const g = h('div.cgrid'); g.style.setProperty('--cardh', compact ? '40mm' : '52mm');
      data.cards.forEach((c, j) => { const e = h('div.fc.it'); e.style.setProperty('--c', col(j)); e.style.setProperty('--tint', tintOf(col(j), 0.88)); e.innerHTML = `<div class="fq"><small>Q</small>${md(c.q)}</div><div class="fa"><small>A</small>${md(c.a)}</div>`; g.append(e); });
      B.push(blk('split', g));
    }
    // answer key
    if (sec.questions && V.answers === 'end' && allQ.length) {
      const head = blk('keepnext', h('h2.ph', { html: 'Answer <em>key</em>' }));
      if (!compact) head.dataset.break = 'before';
      B.push(head);
      const w = h('div.akey'); w.style.setProperty('--akcols', compact ? 3 : 2);
      allQ.forEach((q) => w.append(h('div.it', { html: `<b>Q${q.n}.</b> ${ansText(q)}` })));
      B.push(blk('split', w));
    }
    // video links
    if (sec.sources && data.sources.some((x) => x.url)) {
      const s = blk('srcs', h('b', { text: 'Watch again: ' }));
      data.sources.filter((x) => x.url).forEach((x) => s.append(h('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.title.slice(0, 70) })));
      B.push(s);
    }
    // lined notes
    if (V.lines !== 'none') {
      const l = blk('fill.lined', h('div.bt', { html: '<span class="ico" aria-hidden="true">📝</span>My notes' }), h('div.rule'));
      if (V.lines === 'page') l.dataset.break = 'before';
      B.push(l);
    }
    return B;
  }

  // ================= show + customize =================
  const MARG = { narrow: 10, normal: 14, wide: 19 };
  const SIZE = { comfy: { S: 11.5, M: 12.5, L: 14 }, compact: { S: 10, M: 10.8, L: 12 } };
  let sheets = [];
  function render() {
    if (!DATA) return;
    const book = $('book');
    const keep = window.scrollY;
    const cls = [view.density === 'compact' ? 'compact' : 'comfy', view.palette === 'ink' ? 'inksaver' : '', view.contrast ? 'contrast' : '', view.dys ? 'dys' : '', view.icons ? '' : 'noicons'].filter(Boolean);
    book.className = 'book ' + cls.join(' ');
    $('pgsize').textContent = `@page{size:${view.paper === 'Letter' ? 'letter' : 'A4'};margin:0}`;
    const fs = (SIZE[view.density] || SIZE.comfy)[view.size] || 12.5;
    book.style.setProperty('--fs-base', fs + 'px');
    const blocks = build(DATA);
    // sheets inherit the size from the book (set per sheet, since .sheet sets its own default)
    const footer = esc(uni(DATA.title)) + (view.name ? ' · ' + esc(view.name) : '');
    sheets = PrintKit.paginate(book, blocks, { paper: view.paper, margin: MARG[view.margin] || 14, footer, noFooterFirst: !!view.sec.cover });
    $('pinfo').textContent = `${sheets.length} page${sheets.length > 1 ? 's' : ''} · ${view.paper}`;
    window.scrollTo(0, keep);
  }
  // .sheet font size follows the chosen text size
  const fsStyle = h('style'); document.head.append(fsStyle);
  const applyFs = () => { const fs = (SIZE[view.density] || SIZE.comfy)[view.size] || 12.5, c0 = colOf()(0); fsStyle.textContent = `.book .sheet{--fs:${fs}px;--c:${c0};--tint:${tintOf(c0, 0.88)}}`; };

  function custPanel() {
    const P = $('cust'); P.innerHTML = '';
    const upd = (fn) => { fn(); savePrefs(); applyFs(); render(); custPanel(); };
    const seg = (choices, key) => PU.seg(choices, view[key], (v) => upd(() => { view[key] = v; }));
    P.append(h('h4', { text: 'Layout' }), seg([['comfy', '🛋️ Comfortable'], ['compact', '📄 Compact']], 'density'));
    P.append(h('div.small.muted', { style: { margin: '5px 0 0' }, text: view.density === 'compact' ? 'Tighter spacing, chapters flow on, 2–3 columns where it fits. Uses far fewer pages.' : 'Roomy spacing, every chapter starts on a new page.' }));
    P.append(h('h4', { text: 'Colours' }));
    const pals = h('div.pals');
    Object.entries(PALETTES).forEach(([k, p]) => { const b = h('button.pal' + (view.palette === k ? '.on' : ''), { title: p.name, 'aria-label': p.name + ' colours', 'aria-pressed': String(view.palette === k), onclick: () => upd(() => { view.palette = k; }) }); p.c.slice(0, 5).forEach((c) => b.append(h('i', { style: { background: c } }))); pals.append(b); });
    P.append(pals);
    P.append(h('h4', { text: 'Text size' }), seg([['S', 'Small'], ['M', 'Medium'], ['L', 'Large']], 'size'));
    P.append(h('h4', { text: 'Paper & margins' }));
    P.append(seg([['A4', 'A4'], ['Letter', 'Letter (US)']], 'paper'), h('div', { style: { height: '6px' } }), seg([['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']], 'margin'));
    P.append(h('h4', { text: 'Answers' }), seg([['end', 'At the end'], ['inline', 'Under each Q'], ['none', 'Hide']], 'answers'));
    P.append(h('h4', { text: 'Lined page for notes' }), seg([['page', 'Full page'], ['fill', 'Fill last page'], ['none', 'None']], 'lines'));
    P.append(h('h4', { text: 'Your details (cover & footer)' }));
    const inp = (key, ph) => { const i = h('input.inp', { value: view[key] || '', placeholder: ph, 'aria-label': ph }); i.onchange = () => upd(() => { view[key] = i.value.trim().slice(0, 60); }); return i; };
    const t2 = h('div.two'); t2.append(inp('name', 'Your name'), inp('klass', 'Class')); P.append(t2);
    P.append(h('h4', { text: 'Show' }));
    const cks = h('div.cks');
    SECTIONS.forEach(([k, lab]) => { const c = h('input', { type: 'checkbox', checked: !!view.sec[k] }); c.onchange = () => upd(() => { view.sec[k] = c.checked; }); cks.append(h('label.ck', null, c, h('span', { text: lab }))); });
    P.append(cks);
    P.append(h('h4', { text: 'Easier to read' }));
    const acc = h('div.cks');
    [['contrast', 'High contrast'], ['dys', 'Dyslexia-friendly spacing'], ['icons', 'Emoji icons']].forEach(([k, lab]) => { const c = h('input', { type: 'checkbox', checked: !!view[k] }); c.onchange = () => upd(() => { view[k] = c.checked; }); acc.append(h('label.ck', null, c, h('span', { text: lab }))); });
    P.append(acc);
    // chapters: order + hide
    if (DATA && DATA.chapters.length > 1) {
      P.append(h('h4', { text: 'Chapters (order & show)' }));
      const n = DATA.chapters.length;
      if (!Array.isArray(DATA.order) || DATA.order.length !== n) DATA.order = [...Array(n).keys()];
      DATA.hidden = DATA.hidden || [];
      const list = h('div.chl'), col = colOf();
      DATA.order.forEach((ci, pos) => {
        const off = DATA.hidden.includes(ci);
        const row = h('div.cr' + (off ? '.off' : ''));
        const cb = h('input', { type: 'checkbox', checked: !off, 'aria-label': 'Show ' + uni(DATA.chapters[ci].title) });
        cb.onchange = () => { DATA.hidden = cb.checked ? DATA.hidden.filter((x) => x !== ci) : DATA.hidden.concat([ci]); persistSoon(); render(); custPanel(); };
        const mv = (d) => { const o = DATA.order; [o[pos], o[pos + d]] = [o[pos + d], o[pos]]; persistSoon(); render(); custPanel(); };
        row.append(cb, h('i', { style: { background: col(ci) } }), h('span', { text: uni(plain(DATA.chapters[ci].title)), title: uni(plain(DATA.chapters[ci].title)) }),
          h('button', { text: '↑', title: 'Move up', 'aria-label': 'Move up', disabled: pos === 0, onclick: () => mv(-1) }),
          h('button', { text: '↓', title: 'Move down', 'aria-label': 'Move down', disabled: pos === n - 1, onclick: () => mv(1) }));
        list.append(row);
      });
      P.append(list);
    }
    const foot = h('div.custfoot');
    foot.append(h('div.small.muted', { text: '✏️ Click any text on the pages to fix or reword it before printing.' }),
      h('button.btn.sm.ghost', { text: 'Reset look to default', onclick: () => upd(() => { Object.assign(view, JSON.parse(JSON.stringify(DEF_VIEW))); }) }));
    if (DATA && DATA.edits && Object.keys(DATA.edits).length) foot.append(h('button.btn.sm.ghost', { text: 'Undo my text edits', onclick: () => { DATA.edits = {}; persistSoon(); render(); custPanel(); } }));
    P.append(foot);
  }

  async function show(data) {
    DATA = data;
    data.edits = data.edits || {};
    $('setup').hidden = true; $('work').hidden = true; $('tools').hidden = false; $('viewer').hidden = false;
    document.title = uni(data.title) + ' · Piniso booklet';
    try { await Promise.all([`400 12px PinisoSans`, `700 12px PinisoSans`, `400 20px PinisoSerif`, `400 20px PinisoHand`, `400 12px PinisoMono`].map((f) => document.fonts.load(f))); await document.fonts.ready; } catch (e) {}
    applyFs();
    custPanel();
    render();
    window.scrollTo(0, 0);
  }

  $('back').onclick = () => { $('tools').hidden = true; $('viewer').hidden = true; $('book').innerHTML = ''; DATA = null; $('setup').hidden = false; renderSaved(); };
  $('custBtn').onclick = () => { const v = $('viewer'); const off = v.classList.toggle('nocust'); $('custBtn').setAttribute('aria-expanded', String(!off)); };
  $('print').onclick = () => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); setTimeout(() => window.print(), 50); };
  $('pdf').onclick = async () => {
    if (!sheets.length) return;
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    $('pdfov').hidden = false;
    try {
      await PrintKit.downloadPDF(sheets, { paper: view.paper, title: uni(DATA.title), filename: uni(DATA.title) + ' - Piniso booklet' }, (i, n) => { $('pdfmsg').textContent = i < n ? `Drawing page ${i + 1} of ${n}…` : 'Saving…'; $('pdfbar').style.width = Math.round(i / n * 100) + '%'; });
      PU.toast('PDF saved to your Downloads ✅', 3500);
    } catch (e) {
      console.error(e);
      PU.toast('Could not make the PDF here — use 🖨️ Print → “Save as PDF” instead.', 6000);
    } finally { $('pdfov').hidden = true; }
  };
  // print shortcut prints the pages, not the setup screen
  window.addEventListener('beforeprint', () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });

  // open a saved booklet straight away (from the notes page)
  if (params.get('open')) { const { booklets = [] } = await PStore.get('booklets'); const b = booklets.find((x) => String(x.id) === params.get('open')); if (b) { current = b; show(b.data); } }
})();
