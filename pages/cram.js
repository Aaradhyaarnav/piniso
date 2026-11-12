/* Piniso — night-before mode: cheat sheet, formula drills (60s), mistakes practice, most-missed cards. */
(async () => {
  const { h, esc } = PU;
  const S = await PStore.settings();
  PU.applyTheme(S);
  document.getElementById('pet').innerHTML = PinisoPet.svgString(PU.petCfg(S), 'proud');
  const ex = S.exam || {};
  if (ex.date) { const d = Math.ceil((new Date(ex.date + 'T09:00') - Date.now()) / 86400000); if (d >= 0) document.getElementById('sub').innerHTML = `📅 <b>${esc(ex.name || 'Exam')}</b> in <b>${d}</b> day${d === 1 ? '' : 's'}. Everything you need, nothing else.`; }
  const pane = document.getElementById('pane');

  // gather from all study sessions
  const rows = (await PStore.listSessions()).filter((r) => r.study !== false && (r.notes > 0 || r.quizzes > 0)).slice(0, 40);
  const sessions = [];
  for (const r of rows) { const s = await PStore.getSession(r.key); if (s) sessions.push(s); }
  const formulas = [], starred = [], cheat = [], mistakes = [];
  const seen = new Set();
  sessions.forEach((se) => {
    (se.notes || []).forEach((n) => {
      (n.text.match(/\$[^$]{3,70}\$/g) || []).forEach((f) => {
        if (!/[=<>≈∝]/.test(f) || seen.has(f)) return; seen.add(f);
        const name = PMd.plain(n.text.replace(/\$[^$]*\$/g, ' ')).replace(/\s+/g, ' ').split(/[:—–]/)[0].trim().slice(0, 50) || n.topic || 'Formula';
        formulas.push({ f, name, src: se.title });
      });
      if (n.star || n.kind === 'important') starred.push({ text: n.text, src: se.title });
    });
    ((se.summary && se.summary.cheatsheet) || []).forEach((x) => cheat.push({ text: x, src: se.title }));
    (se.quizzes || []).flatMap((q) => q.items || []).filter((x) => !x.correct).forEach((x) => mistakes.push({ q: x.q, a: x.answer, src: se.title }));
  });
  const cards = await PStore.cards();
  const missed = cards.filter((c) => (c.lapses || 0) > 0 || (c.ease || 2.5) < 2.3).sort((a, b) => (b.lapses || 0) - (a.lapses || 0) || (a.ease || 2.5) - (b.ease || 2.5)).slice(0, 20);

  const TABS = [['sheet', '📄 Cheat sheet'], ['drill', '⚡ Formula drill (60s)'], ['mistakes', '🔁 My mistakes'], ['missed', '🃏 Most-missed cards']];
  const tabs = document.getElementById('tabs');
  let cur = (location.hash || '#sheet').slice(1);
  const go = (k) => { cur = k; location.hash = k; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === k)); render(); };
  TABS.forEach(([k, l]) => tabs.append(h('button', { 'data-k': k, text: l, onclick: () => go(k) })));

  function render() {
    clearInterval(window._dt);
    pane.innerHTML = '';
    ({ sheet, drill, mistakes: mistakesPane, missed: missedPane }[cur] || sheet)();
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === cur));
  }

  function sheet() {
    const box = h('div.sheet');
    box.append(h('div.row.noprint', { style: { justifyContent: 'flex-end', marginBottom: '6px' } }, h('button.btn.sm', { text: '🖨️ Print', onclick: () => print() })));
    if (cheat.length) { box.append(h('h2', { text: 'Cheat sheet' })); const ul = h('ul'); cheat.slice(0, 40).forEach((x) => ul.append(h('li', { html: PMd.inline(x.text) }))); box.append(ul); }
    if (formulas.length) { box.append(h('h2', { text: 'Formulas' })); const fl = h('div.fl'); formulas.slice(0, 40).forEach((x) => fl.append(h('div', { html: `<small class="muted">${esc(x.name)}</small><div>${PMd.inline(x.f)}</div>` }))); box.append(fl); }
    if (starred.length) { box.append(h('h2', { text: '⭐ Teacher said important' })); const ul = h('ul'); starred.slice(0, 40).forEach((x) => ul.append(h('li', { html: PMd.inline(x.text) }))); box.append(ul); }
    if (mistakes.length) { box.append(h('h2', { text: 'Don’t repeat these mistakes' })); const ul = h('ul'); mistakes.slice(0, 15).forEach((x) => ul.append(h('li', { html: `${PMd.inline(x.q)} → <b>${PMd.inline(String(x.a || ''))}</b>` }))); box.append(ul); }
    if (!box.querySelector('h2')) box.append(h('p.muted', { text: 'Study a few lectures with Piniso first — your cheat sheet builds itself from notes, stars, formulas and mistakes.' }));
    pane.append(box);
  }

  function drill() {
    if (!formulas.length) { pane.append(h('p.muted', { text: 'No formulas in your notes yet.' })); return; }
    const deck = formulas.slice().sort(() => Math.random() - 0.5);
    let i = 0, score = 0, left = 60, shown = false;
    const box = h('div.drill');
    const timer = h('div.timer', { text: '60' });
    const big = h('div.big');
    const ans = h('div.ans');
    const btns = h('div.row2');
    box.append(timer, big, ans, btns);
    pane.append(box);
    const show = () => {
      const x = deck[i % deck.length];
      big.innerHTML = `What is the formula for<br><b>${esc(x.name)}</b>?`;
      ans.innerHTML = shown ? PMd.inline(x.f) : '<span class="muted">think… then reveal</span>';
      btns.innerHTML = '';
      if (!shown) btns.append(h('button.btn.pri', { text: 'Reveal (Space)', onclick: reveal }));
      else btns.append(h('button.btn.bad', { text: '✗ Didn’t know', onclick: () => next(false) }), h('button.btn.ok', { text: '✓ Knew it', onclick: () => next(true) }));
    };
    const reveal = () => { shown = true; show(); };
    const next = (ok) => { if (ok) { score++; PAudio.sfx('ding'); } else PAudio.sfx('womp'); i++; shown = false; show(); };
    const end = () => {
      clearInterval(window._dt);
      box.innerHTML = '';
      box.append(h('div.big', { html: `⏱️ Time! <b>${score}</b> formula${score === 1 ? '' : 's'} in 60 seconds` }), h('div.row2', null, h('button.btn.pri', { text: 'Again', onclick: render })));
      PStore.updateStats((st) => { st.xp += score * 2; st.tricks = st.tricks || { used: {}, shown: {} }; st.tricks.used = st.tricks.used || {}; st.tricks.used.drills = (st.tricks.used.drills || 0) + 1; });
    };
    window._dt = setInterval(() => { left--; timer.textContent = left; if (left <= 0) end(); }, 1000);
    document.onkeydown = (e) => { if (cur !== 'drill') return; if (e.code === 'Space') { e.preventDefault(); if (!shown) reveal(); } else if (shown && (e.key === 'ArrowRight' || e.key === 'y')) next(true); else if (shown && (e.key === 'ArrowLeft' || e.key === 'n')) next(false); };
    show();
  }

  function mistakesPane() {
    if (!mistakes.length) { pane.append(h('p.muted', { text: 'No mistakes saved yet 🎉 (every wrong quiz answer appears here).' })); return; }
    pane.append(h('p.muted', { text: 'Say the answer out loud, then tap the card to check.' }));
    mistakes.slice().sort(() => Math.random() - 0.5).slice(0, 25).forEach((x) => {
      const c = h('div.mcard', { onclick: () => c.classList.toggle('open') });
      c.innerHTML = `<b>${PMd.inline(x.q)}</b><div class="a">✅ ${PMd.inline(String(x.a || ''))}<div class="small muted">${esc(x.src.slice(0, 70))}</div></div>`;
      pane.append(c);
    });
  }

  function missedPane() {
    if (!missed.length) { pane.append(h('p.muted', { text: 'No hard cards yet — revise some cards first.' })); return; }
    pane.append(h('p.muted', { text: 'The cards you forget most. Tap to flip.' }));
    missed.forEach((c) => {
      const el = h('div.mcard', { onclick: () => el.classList.toggle('open') });
      el.innerHTML = `<b>${PMd.inline(c.q)}</b><div class="a">${PMd.inline(c.a)}</div>`;
      pane.append(el);
    });
  }
  render();
})();
