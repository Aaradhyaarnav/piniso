/* Piniso printable notes — real paper pages (A4/Letter) with Print and Download PDF. */
(async () => {
  const { h, esc } = PU;
  const S = await PStore.settings();
  PU.applyTheme(S);
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const key = q.get('key');
  const sess = key ? await PStore.getSession(key) : null;
  if (!sess) { $('pages').innerHTML = '<div class="paper" style="max-width:560px;margin:40px auto;padding:24px"><h1>Notes not found</h1><p class="muted">They may have been deleted.</p></div>'; ['pdf', 'print', 'md', 'book'].forEach((id) => { $(id).disabled = true; }); return; }
  document.title = sess.title + ' — Piniso notes';
  const KIND = { point: '•', definition: '≡', formula: 'ƒ', example: '→', tip: '✎', warning: '!', important: '★', snap: '▣', doubt: '?', user: '✍', diagram: '◫', steps: '›' };
  const star = (n) => n.star || n.kind === 'important';
  const reached = Math.max(sess.maxT || 0, sess.lastT || 0) || Infinity;
  const aheadCount = (sess.notes || []).filter((n) => !n.pending && n.ahead && n.t > reached + 2).length;
  const secOf = (t) => String(t).split(':').map(Number).reduce((a, x) => a * 60 + x, 0);

  const saved = (await PStore.get('notesPrint')).notesPrint || {};
  const o = Object.assign({ density: 'comfy', size: 'M', paper: 'A4', recap: true, clean: true, all: true, terms: true, cards: true, times: true, imgs: true, unwatched: false }, saved);
  const save = () => PStore.set({ notesPrint: o }).catch(() => {});
  const SIZE = { comfy: { S: 11.5, M: 12.5, L: 14 }, compact: { S: 10, M: 10.8, L: 12 } };

  // ---------------- options strip ----------------
  function opts() {
    const P = $('opts'); P.innerHTML = '';
    const upd = (fn) => { fn(); save(); render(); opts(); };
    const grp = (lab, el) => h('div.grp', null, h('span.lab', { text: lab }), el);
    const seg = (choices, k) => PU.seg(choices, o[k], (v) => upd(() => { o[k] = v; }));
    P.append(grp('Layout', seg([['comfy', 'Comfortable'], ['compact', 'Compact']], 'density')), grp('Text', seg([['S', 'S'], ['M', 'M'], ['L', 'L']], 'size')), grp('Paper', seg([['A4', 'A4'], ['Letter', 'Letter']], 'paper')));
    const inc = h('div.grp', null, h('span.lab', { text: 'Include' }));
    const hasClean = !!(sess.clean && sess.clean.md);
    [['recap', 'Recap', !!(sess.summary && (sess.summary.recap || []).length)], ['clean', 'Clean notes', hasClean], ['all', hasClean ? 'All notes by time' : 'Notes', true], ['terms', 'Key terms', !!(sess.terms || []).length], ['cards', 'Flashcards', !!(sess.cards || []).length], ['times', 'Timestamps', true], ['imgs', 'Screenshots', (sess.notes || []).some((n) => n.img)], ['unwatched', `Parts not watched yet (${aheadCount})`, aheadCount > 0]].forEach(([k, lab, show]) => {
      if (!show) return;
      const c = h('input', { type: 'checkbox', checked: !!o[k] }); c.onchange = () => upd(() => { o[k] = c.checked; });
      inc.append(h('label.ck', null, c, h('span', { text: lab })));
    });
    P.append(inc);
  }

  // ---------------- blocks ----------------
  const blk = (cls, ...kids) => { const b = h('div.blk' + (cls ? '.' + cls : '')); kids.flat().forEach((k) => k && b.append(k)); return b; };
  const tsLink = (t) => h('a.ts', { href: PU.videoUrlAt(sess, t), target: '_blank', rel: 'noopener', text: PU.fmt(t) });
  function cleanBlocks() {
    const tmp = document.createElement('div');
    tmp.innerHTML = PMd.render(sess.clean.md).replace(/\(▶\s*((?:\d+:)?\d{1,2}:\d{2})\)/g, (_, ts) => `<a class="ts" target="_blank" rel="noopener" href="${esc(PU.videoUrlAt(sess, secOf(ts)))}">${ts}</a>`);
    const out = [];
    [...tmp.children].forEach((el) => {
      const tag = el.tagName;
      if (tag === 'H4' || tag === 'H3' || tag === 'H2') { const d = h('div.h2'); d.innerHTML = el.innerHTML; out.push(blk('keepnext', d)); }
      else if (tag === 'H5') { const d = h('div.h3'); d.innerHTML = el.innerHTML; out.push(blk('keepnext', d)); }
      else if (tag === 'UL' || tag === 'OL') { [...el.children].forEach((li) => li.classList.add('it')); out.push(blk('split', el)); }
      else if (tag === 'TABLE') { [...el.querySelectorAll('tr')].slice(1).forEach((tr) => tr.classList.add('it')); out.push(blk('split', el)); }
      else out.push(blk('', el));
    });
    return out;
  }
  function build() {
    const B = [];
    const notes = (sess.notes || []).filter((n) => !n.pending && (o.unwatched || !n.ahead || n.t <= reached + 2)).sort((a, b) => a.t - b.t);
    const pet = h('div.pet'); pet.innerHTML = PinisoPet.svgString(PU.petCfg(S), 'proud');
    const meta = h('div.meta');
    meta.append(document.createTextNode(`${new Date(sess.updatedAt).toLocaleDateString()} · ${notes.length} notes${sess.watchSeconds ? ' · studied ' + PU.dur(sess.watchSeconds) : ''}`));
    if (sess.url) { meta.append(h('br'), h('a', { href: sess.url, target: '_blank', rel: 'noopener', text: sess.url.length > 80 ? sess.url.slice(0, 80) + '…' : sess.url })); }
    B.push(blk('nhead', h('div', { style: { flex: '1', minWidth: '0' } }, h('h1', { text: sess.title }), meta), pet));
    const sm = sess.summary;
    if (o.recap && sm && (sm.recap || []).length) {
      const ul = h('ul'); sm.recap.forEach((x) => ul.append(h('li.it', { html: PMd.inline(x) })));
      B.push(blk('split', h('div.recap', null, h('div.t', { text: '⚡ Quick recap' }), ul)));
      if ((sm.cheatsheet || []).length) { const u2 = h('ul'); sm.cheatsheet.forEach((x) => u2.append(h('li.it', { html: PMd.inline(x) }))); B.push(blk('split', h('div.recap', null, h('div.t', { text: '📌 Cheat sheet' }), u2))); }
    }
    const hasClean = o.clean && sess.clean && sess.clean.md;
    if (hasClean) B.push(...cleanBlocks());
    if (o.all && notes.length) {
      if (hasClean) { const hd = blk('keepnext', h('div.h2', { text: 'All notes by time' })); hd.dataset.break = o.density === 'compact' ? '' : 'before'; B.push(hd); }
      let topic = null, list = null;
      const flush = () => { if (list && list.children.length) B.push(blk('split', list)); list = null; };
      notes.forEach((n) => {
        const tp = n.topic || 'Notes';
        if (tp !== topic) { flush(); B.push(blk('keepnext', h(hasClean ? 'div.h3' : 'div.h2', { text: tp }))); topic = tp; list = h('div.nl'); }
        const row = h('div.n.it' + (star(n) ? '.imp' : ''));
        row.append(tsLink(n.t), h('span.k', { text: star(n) ? '★' : (KIND[n.kind] || '•'), 'aria-hidden': 'true' }), h('div.x', { html: (n.img && o.imgs ? `<img src="${esc(n.img)}" alt="Screenshot at ${PU.fmt(n.t)}">` : '') + PMd.render(n.text) }));
        list.append(row);
      });
      flush();
    }
    if (o.terms && (sess.terms || []).length) {
      B.push(blk('keepnext', h('div.h2', { text: 'Key terms' })));
      const w = h('div.terms'); sess.terms.forEach((x) => w.append(h('div.it', { html: `<b>${PMd.inline(x.term)}</b><span>${PMd.inline(x.meaning)}</span>` }))); B.push(blk('split', w));
    }
    if (o.cards && (sess.cards || []).length) {
      B.push(blk('keepnext', h('div.h2', { text: 'Flashcards' })));
      const g = h('div.cards'); sess.cards.filter((c) => o.unwatched || c.t == null || c.t <= reached + 2).forEach((c) => g.append(h('div.it', { html: `<b>Q. ${PMd.inline(c.q)}</b>${PMd.inline(c.a)}` }))); B.push(blk('split', g));
    }
    if (!notes.length && !hasClean) B.push(blk('', h('p.muted', { text: 'No notes in this lecture yet.' })));
    return B;
  }

  // ---------------- render ----------------
  const fsStyle = h('style'); document.head.append(fsStyle);
  let sheets = [];
  function render() {
    const host = $('pages');
    const fs = (SIZE[o.density] || SIZE.comfy)[o.size] || 12.5;
    fsStyle.textContent = `#pages .sheet{--fs:${fs}px}`;
    $('pgsize').textContent = `@page{size:${o.paper === 'Letter' ? 'letter' : 'A4'};margin:0}`;
    host.className = [o.density === 'compact' ? 'compact' : '', o.times ? '' : 'notimes', o.imgs ? '' : 'noimg'].filter(Boolean).join(' ');
    const y = window.scrollY;
    sheets = PrintKit.paginate(host, build(), { paper: o.paper, margin: o.density === 'compact' ? 11 : 14, footer: esc(sess.title.slice(0, 90)) });
    $('pinfo').textContent = `${sheets.length} page${sheets.length > 1 ? 's' : ''} · ${o.paper}`;
    window.scrollTo(0, y);
  }
  try { await Promise.all(['400 12px PinisoSans', '700 12px PinisoSans', '400 20px PinisoSerif', '400 12px PinisoMono'].map((f) => document.fonts.load(f))); await document.fonts.ready; } catch (e) {}
  opts();
  render();

  // ---------------- actions ----------------
  const mdText = () => {
    const out = [`# ${sess.title}`, '', `Source: ${sess.url}`, ''];
    const notes = (sess.notes || []).filter((n) => !n.pending && (o.unwatched || !n.ahead || n.t <= reached + 2)).sort((a, b) => a.t - b.t);
    if (sess.clean && sess.clean.md) out.push(sess.clean.md, '', '# All notes by time');
    let tp = null;
    notes.forEach((n) => { const x = n.topic || 'Notes'; if (x !== tp) { out.push('', '## ' + x); tp = x; } out.push(`- [${PU.fmt(n.t)}] ${n.text.replace(/\n+/g, ' ')}`); });
    if ((sess.terms || []).length) out.push('', '## Key terms', ...sess.terms.map((x) => `- **${x.term}**: ${x.meaning}`));
    return out.join('\n');
  };
  $('print').onclick = () => window.print();
  $('md').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([mdText()], { type: 'text/markdown' })); a.download = sess.title.slice(0, 60).replace(/[\\/:*?"<>|]+/g, ' ') + ' - Piniso.md'; a.click(); };
  $('book').onclick = () => { location.href = 'booklet.html?key=' + encodeURIComponent(sess.key); };
  $('pdf').onclick = async () => {
    if (!sheets.length) return;
    $('pdfov').hidden = false;
    try {
      await PrintKit.downloadPDF(sheets, { paper: o.paper, title: sess.title, filename: sess.title + ' - Piniso notes' }, (i, n) => { $('pdfmsg').textContent = i < n ? `Drawing page ${i + 1} of ${n}…` : 'Saving…'; $('pdfbar').style.width = Math.round(i / n * 100) + '%'; });
      PU.toast('PDF saved to your Downloads ✅', 3500);
    } catch (e) { console.error(e); PU.toast('Could not make the PDF here — use 🖨️ Print → “Save as PDF” instead.', 6000); }
    finally { $('pdfov').hidden = true; }
  };
  if (q.get('print') === '1') setTimeout(() => window.print(), 600);
  if (q.get('pdf') === '1') setTimeout(() => $('pdf').click(), 600);
})();
