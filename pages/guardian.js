/* Piniso Guardian — the page you land on when you try to open a distracting site during study time.
   Research: blockers only work when they are hard to bypass, so unlocking costs a flashcard + a wait + a pledge. */
(async () => {
  const { h, I, esc } = PU;
  const S = await PStore.settings();
  const ST = await PStore.stats();
  PU.applyTheme(S);
  const lang = PLines.langFor(S.lang.comments);
  const target = decodeURIComponent(location.hash.slice(1) || '');
  let domain = '';
  try { domain = new URL(target).hostname.replace(/^www\./, ''); } catch (e) {}
  let isShorts = false; try { isShorts = /youtube\.com$/.test(domain) && /^\/shorts/.test(new URL(target).pathname); } catch (e) {}
  const site = isShorts ? 'youtube.com/shorts' : (S.guardian.sites || []).find((d) => domain === d || domain.endsWith('.' + d)) || domain;
  const box = document.getElementById('box');
  const today = Math.round((ST.days[PStore.todayKey()] || 0) / 60);
  const sessions = await PStore.listSessions();
  const last = sessions.find((x) => x.url);
  document.addEventListener('pointerdown', () => PAudio.unlock(), { once: true });
  await PStore.updateStats((st) => { st.guardianBlocks = (st.guardianBlocks || 0) + 1; });

  const lines = {
    hinglish: ['Ruko zara, sabar karo ✋ Padhai chal rahi hai!', 'Pakde gaye! 👀 {site} baad mein, abhi padhai.', 'Bhai {site} kahin nahi jaa raha, exam zaroor aa raha hai 😤', 'Main Guardian hu. {site} pe entry band hai abhi 🛡️'],
    english: ['Not so fast ✋ We are studying!', 'Caught you! 👀 {site} can wait.', '{site} will still be there. Your exam is coming though 😤', 'Guardian on duty 🛡️ No {site} right now.'],
    hindi: ['रुको! ✋ अभी पढ़ाई का समय है।', 'पकड़े गए! 👀 {site} बाद में।']
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)].replace(/\{site\}/g, site);

  async function home() {
    box.innerHTML = '';
    const petHost = h('div.pet');
    const pet = PinisoPet.create(petHost, Object.assign(PU.petCfg(S), { size: 150, hat: 'crown' === S.pet.hat ? 'crown' : S.pet.hat }));
    pet.setMood('angry'); pet.react('shake');
    PAudio.sfx('error');
    box.append(petHost, h('h1', { html: 'Guardian <em>says no</em>' }), h('div.site', { text: '🚫 ' + (site || 'this site') }), h('p.hand', { text: pick(lines[lang] || lines.english) }));
    if (S.guardian.goal || S.guardian.plan) {
      const g = h('div.sticky.goal');
      if (S.guardian.goal) g.append(h('div', { html: `<b>Your goal today:</b> ${esc(S.guardian.goal)}` }));
      if (S.guardian.plan) g.append(h('div', { html: `<b>Your plan:</b> If I feel distracted, I will ${esc(S.guardian.plan)}` }));
      box.append(g);
    }
    box.append(h('p.small.muted', { html: `Studied today: <b>${today} min</b> · Streak 🔥 ${PStore.streak(ST)} · Guardian saved you <b>${(ST.guardianBack || 0)}</b> times` }));
    const acts = h('div.acts');
    acts.append(h('button.btn.pri', { html: I('book', 16) + (last ? 'Back to my lecture' : 'Back to studying'), onclick: back }));
    acts.append(h('button.btn', { html: I('cards', 16) + 'Revise 3 flashcards instead', onclick: () => { chrome.tabs.update({ url: chrome.runtime.getURL('pages/options.html#revise') }); credit(); } }));
    const gst = await PU.bg({ type: 'guardian:status' });
    if (gst && gst.strict) acts.append(h('div.small.muted', { text: `🔒 Focus lock until ${new Date(gst.lockUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — no unlocking. You set this, future you says thanks.` }));
    else acts.append(h('button.btn.ghost.sm', { text: `I really need ${S.guardian.passMinutes} minutes…`, onclick: unlock }));
    box.append(acts);
  }
  async function credit() { await PStore.updateStats((st, award) => { st.guardianBack = (st.guardianBack || 0) + 1; st.xp += 5; if (st.guardianBack >= 10) award('iron_will'); }); }
  async function back() {
    await credit();
    PAudio.sfx('ding');
    if (last) location.href = last.url; else history.length > 1 ? history.back() : window.close();
  }

  async function unlock() {
    const mode = S.guardian.unlock || 'card';
    box.innerHTML = '';
    const petHost = h('div.pet');
    const pet = PinisoPet.create(petHost, Object.assign(PU.petCfg(S), { size: 110 }));
    pet.setMood('nervous');
    box.append(petHost, h('h1', { html: 'Earn your <em>pass</em>', style: { fontSize: '36px' } }));
    const steps = [];
    if (mode === 'card' || mode === 'both') steps.push(cardStep);
    if (mode === 'wait' || mode === 'both') steps.push(waitStep);
    steps.push(pledgeStep);
    const area = h('div'); box.append(area);
    for (const st of steps) { const ok = await st(area, pet); if (!ok) return home(); }
    await PU.bg({ type: 'guardian:pass', domain: site, minutes: S.guardian.passMinutes });
    await PStore.updateStats((st) => { st.guardianPasses = (st.guardianPasses || 0) + 1; });
    area.innerHTML = '';
    area.append(h('p.hand', { text: `Okay… ${S.guardian.passMinutes} minutes. I'm timing you ⏱️` }));
    setTimeout(() => { location.href = target; }, 1200);
  }
  function cardStep(area, pet) {
    return new Promise(async (res) => {
      const cards = await PStore.cards();
      const now = Date.now();
      const pool = cards.filter((c) => c.due <= now);
      const c = (pool.length ? pool : cards)[Math.floor(Math.random() * (pool.length || cards.length))];
      area.innerHTML = '';
      if (!c) { res(true); return; }
      const ans = h('input.inp', { placeholder: 'Type your answer…' });
      const card = h('div.card.paper', null, h('div.small.muted', { text: 'Answer one flashcard first:' }), h('div', { style: { fontSize: '18px', margin: '6px 0 10px' }, html: PMd.render(c.q) }), ans);
      const go = h('button.btn.pri.wide', { style: { marginTop: '10px' }, text: 'Check', onclick: () => {
        if (ans.value.trim().length < 2) { ans.focus(); return; }
        card.append(h('div', { style: { marginTop: '10px' }, html: '<b>Answer:</b> ' + PMd.render(c.a) }));
        go.remove();
        card.append(h('div.row', { style: { marginTop: '10px' } },
          h('button.btn.sm', { text: 'I got it ✓', onclick: async () => { PStore.schedule(c, 2); await saveCard(c); pet.setMood('proud', 1500); res(true); } }),
          h('button.btn.sm', { text: 'I didn’t ✗', onclick: async () => { PStore.schedule(c, 0); await saveCard(c); pet.setMood('sad', 1500); res(true); } }),
          h('span.sp'), h('button.btn.sm.ghost', { text: 'Never mind, back to study', onclick: () => { back(); res(false); } })));
      } });
      card.append(go);
      area.append(card);
      ans.focus();
    });
  }
  async function saveCard(c) { const l = await PStore.cards(); const i = l.findIndex((x) => x.id === c.id); if (i >= 0) { l[i] = c; await PStore.saveCards(l); } }
  function waitStep(area, pet) {
    return new Promise((res) => {
      let n = 30;
      area.innerHTML = '';
      const cnt = h('div.count', { text: n });
      area.append(h('p.muted', { text: 'Wait 30 seconds. If the urge goes away, go back to studying 😌' }), cnt, h('button.btn', { text: 'The urge is gone — back to study', onclick: () => { clearInterval(t); back(); res(false); } }));
      const t = setInterval(() => { n--; cnt.textContent = n; if (n <= 0) { clearInterval(t); res(true); } }, 1000);
    });
  }
  function pledgeStep(area, pet) {
    return new Promise((res) => {
      const sentence = lang === 'hinglish' ? `Main ${site} ko apne goal se zyada important maan raha hu` : `I choose ${site} over my goal for ${S.guardian.passMinutes} minutes`;
      area.innerHTML = '';
      const inp = h('input.inp', { placeholder: 'Type the sentence exactly…' });
      inp.addEventListener('paste', (e) => e.preventDefault());
      area.append(h('p', { html: `Type this to unlock:<br><b class="hl">${esc(sentence)}</b>` }), inp,
        h('div.row', { style: { marginTop: '10px', justifyContent: 'center' } },
          h('button.btn', { text: 'Never mind 😅', onclick: () => { back(); res(false); } }),
          h('button.btn.pri', { text: 'Unlock', onclick: () => { if (inp.value.trim().toLowerCase().replace(/\s+/g, ' ') === sentence.toLowerCase()) res(true); else { pet.setMood('angry', 1500); pet.react('shake'); inp.select(); } } })));
      inp.focus();
    });
  }
  home();
})();
