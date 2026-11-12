/* Piniso v3 — make every tool easy to find:
   ✨ Piniso it (one action), the Magic menu (all tools, searchable, grouped by moment),
   "new trick unlocked" (one feature taught per session), a 3-step welcome tour,
   60-second recall, and the weekly "Piniso Wrapped" share card. */
(() => {
  if (PZ.Magic) return;
  const h = PZ.h, esc = (x) => PMd.esc(x), I = (n, s) => PIcons.svg(n, s);

  // every tool, grouped by the moment a student needs it
  const GROUPS = [
    ['start', 'Before you start'], ['watch', 'While watching'], ['after', 'After the video'],
    ['revise', 'Revise & remember'], ['focus', 'Focus'], ['fun', 'Fun & share'], ['more', 'More']
  ];
  const TOOLS = [
    { id: 'pinisoit', g: 'start', e: '✨', n: 'Piniso it', d: 'Turn everything on for this lecture', run: (a) => a.pinisoIt(true), any: true },
    { id: 'warmup', g: 'start', e: '🔁', n: 'Warm-up quiz', d: '2 questions from your last video', run: (a) => a.magic.warmUpNow() },
    { id: 'mission', g: 'start', e: '🎯', n: 'Today’s mission', d: '3 small things to do today', run: (a) => a.ui.openDesk('focus') },
    { id: 'videos', g: 'start', e: '📺', n: 'My study videos', d: 'Continue where you stopped · Up next', run: (a) => a.ui.openDesk('videos') },
    { id: 'notes', g: 'watch', e: '📝', n: 'Live notes', d: 'AI notes while you watch', k: 'Alt+Shift+N', run: (a) => a.ui.openDesk('notes') },
    { id: 'ask', g: 'watch', e: '💬', n: 'Ask a doubt', d: 'Type any question about the lecture', run: (a) => a.ui.openDesk('ask') },
    { id: 'snipe', g: 'watch', e: '🎯', n: 'Doubt snipe', d: 'Drag a box on the board → explained', k: 'Alt+Shift+D', run: (a) => a.plus.snipe() },
    { id: 'lost', g: 'watch', e: '🧭', n: 'I’m lost here', d: 'Mark it — explain now or later', k: 'Alt+Shift+X', run: (a) => a.plus.lostHere() },
    { id: 'mark', g: 'watch', e: '⭐', n: 'Mark important', d: 'Star this moment, AI writes the note', k: 'Alt+Shift+M', run: (a) => a.markMoment() },
    { id: 'simple', g: 'watch', e: '🍼', n: 'Explain like I’m 10', d: 'The last few minutes, super simple', run: (a) => a.quick('simple') },
    { id: 'talk', g: 'watch', e: '🎙️', n: 'Talk with Piniso', d: 'Voice chat about the lecture', k: 'Alt+Shift+T', run: (a) => a.toggleTalk() },
    { id: 'listen', g: 'watch', e: '🎧', n: 'Listen to audio', d: 'For videos with no captions', run: (a) => a.listenHelp(false) },
    { id: 'quiz', g: 'after', e: '❓', n: 'Quiz me', d: 'Pick a part or the whole video', k: 'Alt+Shift+Q', run: (a) => a.ui.openDesk('quiz') },
    { id: 'vquiz', g: 'after', e: '🗣️', n: 'Voice quiz', d: 'Answer out loud', run: (a) => a.voiceQuiz() },
    { id: 'recall', g: 'after', e: '⚡', n: '60-second recall', d: '3 quick questions — locks it in memory', run: (a) => a.magic.recall() },
    { id: 'clean', g: 'after', e: '✨', n: 'Clean notes', d: 'Tidy topic-wise notes + exam corner', run: (a) => a.makeClean(false) },
    { id: 'booklet', g: 'after', e: '📘', n: 'Study booklet PDF', d: 'Colourful printable notes by topic', run: (a) => a.exportNotes('booklet') },
    { id: 'cheat', g: 'after', e: '📄', n: 'Cheat sheet', d: 'One-page exam summary', run: (a) => a.makeSummary(false) },
    { id: 'report', g: 'after', e: '🏆', n: 'Report card', d: 'Finish & see how you did', run: (a) => a.finish() },
    { id: 'cards', g: 'revise', e: '🃏', n: 'Flashcards', d: 'Revise this video’s cards', run: (a) => a.ui.openDesk('cards') },
    { id: 'makecards', g: 'revise', e: '🪄', n: 'Make more cards', d: 'AI makes cards from your notes', run: (a) => a.makeCards() },
    { id: 'reviseall', g: 'revise', e: '🔁', n: 'Revise all decks', d: 'Cards due from every lecture', run: () => PZ.bg({ type: 'open:options', hash: 'revise' }), any: true },
    { id: 'drills', g: 'revise', e: '🧮', n: 'Formula drill', d: '60 seconds, as many formulas as you can', run: () => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/cram.html#drill') }), any: true },
    { id: 'night', g: 'revise', e: '🌙', n: 'Night-before mode', d: 'Cheat sheet + mistakes + hard cards', run: () => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/cram.html') }), any: true },
    { id: 'mistakes', g: 'revise', e: '📕', n: 'My mistakes', d: 'Every wrong answer, with the fix', run: () => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/cram.html#mistakes') }), any: true },
    { id: 'lock', g: 'focus', e: '🔒', n: 'Focus lock 25 min', d: 'Blocks Instagram, Shorts & more', run: async (a) => { const r = await PZ.bg({ type: 'guardian:lock', minutes: 25 }); a.ui.toast(r && r.ok ? '🔒 Locked for 25 min — go!' : 'Could not lock'); }, any: true },
    { id: 'sprint', g: 'focus', e: '⏱️', n: '25-min sprint', d: 'Timer + Guardian on', run: (a) => a.startSprint(25) },
    { id: 'break', g: 'focus', e: '☕', n: 'Take a break', d: 'Eyes, water, stretch', run: (a) => a.startBreak() },
    { id: 'music', g: 'focus', e: '🎵', n: 'Study music', d: 'Lo-fi, rain, brown noise…', run: (a) => a.toggleMusic() },
    { id: 'float', g: 'focus', e: '🪟', n: 'Float on top', d: 'Piniso over every window', k: 'Alt+Shift+F', run: (a) => PZ.Extras.float(a) },
    { id: 'fullscreen', g: 'focus', e: '⛶', n: 'Full screen with me', d: 'Stay with you in full screen', run: (a) => PZ.Extras.fullscreenWithMe(a) },
    { id: 'meme', g: 'fun', e: '🤡', n: 'Meme maker', d: 'Turn the lecture into a meme', run: (a) => PZ.Extras.meme(a) },
    { id: 'share', g: 'fun', e: '📸', n: 'Share card', d: 'Today’s top 3 learnings as an image', run: (a) => a.plus.shareCard(a.session && a.session.summary) },
    { id: 'wrapped', g: 'fun', e: '🎁', n: 'My week (Wrapped)', d: 'Your study week + archetype', run: (a) => a.magic.wrapped(), any: true },
    { id: 'recapaudio', g: 'fun', e: '🔊', n: 'Listen to recap', d: 'Hear a summary (bus mode)', run: (a) => a.magic.audioRecap() },
    { id: 'cmdk', g: 'more', e: '⌘', n: 'Command bar', d: 'Type anything: “speed 1.5”, “go to 12:30”, “note: …”', k: 'Ctrl+K', run: (a) => a.v4 && a.v4.palette(), any: true },
    { id: 'phone', g: 'revise', e: '📱', n: 'Revise on phone', d: 'Flashcards as one offline file for your phone', run: (a) => a.v4 && a.v4.phoneDeck(), any: true },
    { id: 'grow', g: 'fun', e: '🌱', n: 'Piniso’s growth', d: 'Piniso grows with your study hours', run: (a) => a.v4 && a.v4.growCard(), any: true },
    { id: 'anywhere', g: 'more', e: '🖥️', n: 'Study any app/window', d: 'Zoom, PDFs, desktop apps', run: () => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/anywhere.html') }), any: true },
    { id: 'keys', g: 'more', e: '⌨️', n: 'Shortcuts', d: 'All keyboard shortcuts', k: 'Alt+Shift+/', run: (a) => a.plus.shortcuts(), any: true },
    { id: 'settings', g: 'more', e: '⚙️', n: 'Settings', d: 'Keys, language, look, Guardian', run: () => PZ.bg({ type: 'open:options' }), any: true }
  ];
  // the order new students learn the tricks in (one per session)
  const TRICKS = ['ask', 'mark', 'quiz', 'snipe', 'lost', 'talk', 'clean', 'cards', 'vquiz', 'booklet', 'lock', 'meme', 'recall', 'drills', 'share', 'float'];
  const PITCH = {
    ask: 'Type any doubt — I know exactly what the teacher just said.',
    mark: 'Teacher said something big? Press Alt+Shift+M and I write a proper note.',
    quiz: 'A 30-second quiz now = you remember it in the exam.',
    snipe: 'Drag a box around any part of the board and I explain just that.',
    lost: 'Lost? One tap marks the moment — I explain it whenever you want.',
    talk: 'Talk to me out loud about the lecture — like a study buddy on call.',
    clean: 'I turn all your rough notes into neat topic-wise notes.',
    cards: 'Your flashcards are ready — 2 minutes of revision locks them in.',
    vquiz: 'I ask, you answer out loud. Feels like a viva 😎',
    booklet: 'Make a colourful printable booklet of this chapter.',
    lock: 'One tap blocks Instagram & Shorts for 25 minutes.',
    meme: 'Turn this lecture into a meme for your study group 🤡',
    recall: '60 seconds of recall beats 10 minutes of re-reading.',
    drills: 'How many formulas can you recall in 60 seconds?',
    share: 'Show off what you learned today 📸',
    float: 'Keep me on top of every window — even other apps.'
  };

  class Magic {
    static get TOOLS() { return TOOLS; }
    static get GROUPS() { return GROUPS; }
    constructor(app) { this.app = app; this.trickShownThisSession = false; }
    tool(id) { return TOOLS.find((t) => t.id === id); }

    // ---- usage tracking (what has the student tried?) ----
    usedSet() { const st = this.app.stats || {}; return Object.assign({ notes: 1, pinisoit: 1 }, (st.tricks && st.tricks.used) || {}); }
    markUsed(id) {
      const was = this.usedSet()[id];
      this.app.bumpStats((st) => { st.tricks = st.tricks || { used: {}, shown: {} }; st.tricks.used = st.tricks.used || {}; st.tricks.used[id] = (st.tricks.used[id] || 0) + 1; });
      this._toasted = this._toasted || new Set();
      if (!was && TRICKS.includes(id) && this.app.ui && !this._toasted.has(id)) {
        this._toasted.add(id);
        const n = this.mastered() + 1;
        setTimeout(() => this.app.ui && this.app.ui.toast(`🎓 Trick learned: ${this.tool(id).n} · ${n}/${TRICKS.length + 2} mastered`, { ms: 3500 }), 900);
      }
    }
    mastered() { const u = this.usedSet(); return ['notes', 'pinisoit'].concat(TRICKS).filter((id) => u[id]).length; }
    nextTrick() { const u = this.usedSet(); return TRICKS.find((id) => !u[id]); }

    run(id) {
      const t = this.tool(id), app = this.app;
      if (!t) return;
      if (!t.any && !app.session) { app.ui && app.ui.toast('Open a lecture first, then ' + t.n.toLowerCase()); return; }
      this.markUsed(id);
      try { t.run(app); } catch (e) { console.warn('[Piniso] tool', id, e); }
    }

    // ---- the Magic menu ----
    open(filter) {
      const app = this.app;
      app.ensureUI();
      if (this.ov) { this.ov.close(); return; }
      const used = this.usedSet(), next = this.nextTrick();
      const box = h('div.card.paper.magic');
      const q = h('input.inp.mq', { placeholder: 'Search tools… (try “meme”, “pdf”, “voice”)', value: filter || '' });
      ['keyup', 'keypress'].forEach((ev) => q.addEventListener(ev, (e) => e.stopPropagation()));
      const prog = this.mastered(), total = TRICKS.length + 2;
      box.append(
        h('div.mhd', null, h('div', null, h('h2', { html: '✨ What should we <em>do</em>?' }), h('div.small.muted', { html: (app.session ? 'Tap any tool. Everything works on this lecture.' : 'Open a lecture to unlock the lecture tools.') + ' · Pro tip: press <b>Ctrl + K</b> and just type.' })),
          h('div.mprog', { title: 'Tricks you have tried' }, h('span.small', { html: `🎓 <b>${prog}</b>/${total} tricks` }), h('div.bar', null, h('i', { style: { width: Math.round(prog / total * 100) + '%' } })))),
        q);
      const list = h('div.mlist');
      box.append(list);
      const draw = () => {
        const f = q.value.trim().toLowerCase();
        list.innerHTML = '';
        let first = null;
        GROUPS.forEach(([g, label]) => {
          const items = TOOLS.filter((t) => t.g === g && (!f || (t.n + ' ' + t.d + ' ' + t.id).toLowerCase().includes(f)));
          if (!items.length) return;
          const sec = h('div.mg', null, h('div.mgl', { text: label }));
          const grid = h('div.mgrid');
          items.forEach((t) => {
            const off = !t.any && !app.session;
            const isNew = t.id === next;
            const tile = h('button.mt' + (off ? '.off' : '') + (isNew ? '.new' : ''), { title: t.d + (t.k ? ' (' + t.k + ')' : ''), onclick: () => { close(); this.run(t.id); } },
              h('span.me', { text: t.e }), h('span.mn', null, h('b', { text: t.n }), h('small', { text: t.d })),
              isNew ? h('span.mnew', { text: 'TRY' }) : !used[t.id] && TRICKS.includes(t.id) ? h('span.mdot', { title: 'Not tried yet' }) : null);
            if (!first && !off) first = t;
            grid.append(tile);
          });
          sec.append(grid); list.append(sec);
        });
        if (!list.children.length) list.append(h('div.muted', { style: { padding: '20px' }, text: 'No tool found. Try another word.' }));
        this._first = first;
      };
      q.addEventListener('input', draw);
      q.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && this._first) { close(); this.run(this._first.id); } if (e.key === 'Escape') close(); });
      draw();
      const ov = this.ov = app.ui.overlay(box, { clickOut: true, onClose: () => { this.ov = null; } });
      const close = () => ov.close();
      box.append(h('button.ib.xbtn', { html: I('close', 17), onclick: close }));
      setTimeout(() => q.focus(), 60);
      PAudio.sfx('pop');
    }

    // ---- per-tick: teach one new trick per session (after a few focused minutes) ----
    tick(t, playing, now) {
      const app = this.app, sess = app.session;
      if (!sess || this.trickShownThisSession || !playing || app.quizRunning || app.touring) return;
      if (!this.sessStart) this.sessStart = now;
      if (now - this.sessStart < 4 * 60000) return;
      const id = this.nextTrick();
      if (!id) return;
      const st = app.stats || {};
      const shownAt = ((st.tricks && st.tricks.shown) || {})[id] || 0;
      if (now - shownAt < 20 * 3600000 && shownAt) { this.trickShownThisSession = true; return; }
      this.trickShownThisSession = true;
      app.bumpStats((s2) => { s2.tricks = s2.tricks || { used: {}, shown: {} }; s2.tricks.shown = s2.tricks.shown || {}; s2.tricks.shown[id] = now; });
      const T = this.tool(id);
      app.ui.react('jump'); PAudio.sfx('chime');
      app.ui.say(`🎁 **New trick: ${T.n}** — ${PITCH[id] || T.d}`, {
        mood: 'excited', ms: 15000, tag: 'trick',
        actions: [{ label: 'Try it', pri: true, icon: 'sparkle', onClick: () => this.run(id) }, { label: 'All tools', onClick: () => this.open() }]
      });
    }

    // ---- 3-step welcome tour on the very first lecture ----
    async tour() {
      const app = this.app;
      app.touring = true;
      const done = () => { app.touring = false; app.bumpStats((st) => { st.toured = Date.now(); }); };
      const lg = app.lang();
      const steps = [
        { text: lg === 'hinglish' ? 'Hi! Main **Piniso** hoon 👋 Lecture dekhte waqt main notes likhta hoon, quiz leta hoon aur doubts solve karta hoon.' : 'Hi! I’m **Piniso** 👋 While you watch, I write notes, quiz you and solve doubts.', btn: 'Next →' },
        { text: '**Tap me** anytime → every tool in one place (meme maker, PDF booklet, voice quiz…). **Hover me** for quick buttons.', btn: 'Show me', act: () => this.open() },
        { text: 'That’s it! Notes start by themselves. Want a 25-min **focus lock** (blocks Instagram & Shorts)?', btn: '🔒 Lock 25 min', act: () => this.run('lock'), alt: 'Not now' }
      ];
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const r = await new Promise((res) => { this._tourRes = res; app.ui.say(s.text, { mood: i === 0 ? 'excited' : 'happy', sticky: true, instant: true, tour: true, tag: `${i + 1}/3`, onHide: () => res('skip'), actions: [{ label: s.btn, pri: true, onClick: () => res('go') }, { label: s.alt || 'Skip tour', onClick: () => res('skip') }] }); });
        this._tourRes = null;
        if (r === 'skip') break;
        if (r === 'go' && s.act) { s.act(); if (i === 1) await new Promise((res) => { const iv = setInterval(() => { if (!this.ov) { clearInterval(iv); res(); } }, 400); }); }
      }
      done();
    }

    // ---- 60-second recall (peak-end: finish every video by recalling) ----
    recall() {
      const app = this.app, sess = app.session;
      if (!sess) return;
      const t = app.video ? app.video.t : 0;
      let items = app.takePool(0, t, 3, true);
      if (items.length < 3) sess.cards.slice(-6).reverse().forEach((c) => { if (items.length < 3 && !items.some((x) => x.q === c.q)) items.push({ type: 'short', q: c.q, answer: PMd.plain(c.a), t: c.t }); });
      if (!items.length) { app.quizNow(false, 'all'); return; }
      app.startQuizWith(items, '60-second recall');
    }
    async warmUpNow() {
      const rows = (await PStore.listSessions()).filter((r) => r.key !== (this.app.session && this.app.session.key) && r.study !== false && r.notes >= 2);
      if (!rows.length) { this.app.ui.toast('No earlier video yet — this is your first! 🎉'); return; }
      this.app.plus.warmUp(rows[0]);
    }
    audioRecap() {
      const sess = this.app.session;
      const md = (sess.clean && sess.clean.md) || (sess.summary && (sess.summary.recap || []).join('. ')) || this.app.visibleNotes().slice(-10).map((n) => n.text).join('. ');
      if (!md) { this.app.ui.toast('No notes yet to read'); return; }
      if (this.app.plus.speak(md)) this.app.ui.toast('🔊 Reading your notes… (open Magic menu → Listen again to restart)', { action: { label: 'Stop', onClick: () => this.app.plus.stopSpeak() } });
    }

    // ---- weekly "Piniso Wrapped" ----
    async wrapped() {
      const app = this.app, st = await PStore.stats();
      const days = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = PStore.todayKey(d); days.push({ k, m: Math.round((st.days[k] || 0) / 60), lab: d.toLocaleDateString([], { weekday: 'narrow' }) }); }
      const mins = days.reduce((a, x) => a + x.m, 0), active = days.filter((x) => x.m > 0).length;
      const rows = (await PStore.listSessions()).filter((r) => r.study !== false && Date.now() - r.updatedAt < 7 * 86400000);
      const topics = {}; rows.forEach((r) => { if (r.topic) topics[r.topic] = (topics[r.topic] || 0) + (r.notes || 1); });
      const top = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
      const acc = st.quiz.total ? Math.round(st.quiz.correct / st.quiz.total * 100) : null;
      const cardsWk = days.reduce((a, x) => a + PStore.dayStat(st, 'cards', x.k), 0);
      const arch = active >= 6 ? ['👑', 'Consistency King', 'You showed up almost every day.'] : mins >= 600 ? ['🏃', 'Marathon Topper', 'Hours and hours of focus.'] : acc != null && acc >= 80 ? ['🎯', 'Quiz Sniper', 'You barely miss.'] : cardsWk >= 50 ? ['🧠', 'Memory Machine', 'Flashcards on repeat.'] : (st.doubts || 0) >= 10 ? ['🔍', 'Doubt Destroyer', 'No doubt survives you.'] : (st.badges || {}).night_owl ? ['🦉', 'Night Owl Scholar', 'The moon is your study lamp.'] : ['🌱', 'Rising Topper', 'Small steps, big results.'];
      // draw
      const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const th = PINISO.themeOf(app.settings);
      const ink = th.ink || '#1c1b18', acc2 = th.accent || '#FFD23F';
      g.fillStyle = th.paper || '#FBF7EE'; g.fillRect(0, 0, W, H);
      g.fillStyle = acc2; g.beginPath(); g.arc(W - 60, 160, 330, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4D9DE0'; g.globalAlpha = 0.85; g.beginPath(); g.arc(-40, H - 260, 300, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      g.fillStyle = ink; g.font = '700 34px "PinisoMono", monospace'; g.fillText('MY STUDY WEEK', 80, 150);
      g.font = '400 92px "PinisoSerif", Georgia, serif'; g.fillText('Piniso', 80, 270); g.font = 'italic 400 92px "PinisoSerif", Georgia, serif'; g.fillText('Wrapped', 80, 370);
      g.font = '120px serif'; g.fillText(arch[0], 80, 560);
      g.font = '700 64px "PinisoSans", sans-serif'; g.fillText(arch[1], 230, 530);
      g.font = '400 40px "PinisoHand", cursive'; g.fillText(arch[2], 232, 590);
      // bars
      const maxM = Math.max(30, ...days.map((x) => x.m)), bx = 80, by = 1000, bw = 110, gap = 24;
      days.forEach((x, i) => {
        const hh = Math.round((x.m / maxM) * 300);
        g.fillStyle = x.m ? acc2 : 'rgba(0,0,0,.08)'; g.strokeStyle = ink; g.lineWidth = 4;
        g.beginPath(); g.roundRect(bx + i * (bw + gap), by - Math.max(hh, 10), bw, Math.max(hh, 10), 16); g.fill(); g.stroke();
        g.fillStyle = ink; g.font = '700 32px "PinisoSans", sans-serif'; g.textAlign = 'center';
        g.fillText(x.lab, bx + i * (bw + gap) + bw / 2, by + 50); if (x.m) g.fillText(x.m + 'm', bx + i * (bw + gap) + bw / 2, by - hh - 18);
        g.textAlign = 'left';
      });
      const stat = (y, big, small) => { g.fillStyle = ink; g.font = '400 84px "PinisoSerif", Georgia, serif'; g.fillText(big, 80, y); g.font = '500 36px "PinisoSans", sans-serif'; g.fillText(small, 80, y + 50); };
      stat(1220, `${Math.floor(mins / 60)}h ${mins % 60}m`, 'focused study this week');
      stat(1380, `${PStore.streak(st)} 🔥`, 'day streak');
      stat(1540, acc != null ? acc + '%' : `${rows.length}`, acc != null ? 'quiz accuracy' : 'lectures studied');
      if (top.length) { g.font = '600 34px "PinisoSans", sans-serif'; g.fillText('Top topics: ' + top.join(' · ').slice(0, 60), 80, 1700); }
      try {
        const svg = PinisoPet.svgString(app.petCfg(), 'celebrate');
        const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        g.drawImage(im, W - 400, 1180, 320, 320);
      } catch (e) {}
      g.font = '400 40px "PinisoHand", cursive'; g.fillStyle = ink; g.fillText('I don’t just watch lectures. I Piniso them ✏️', 80, H - 90);
      const url = c.toDataURL('image/png');
      // show it
      const box = h('div.card.paper.wrapbox');
      box.append(h('img', { src: url, alt: 'Piniso Wrapped', style: { width: '100%', maxWidth: '300px', borderRadius: '14px', border: '2px solid var(--ink)', display: 'block', margin: '0 auto 12px' } }),
        h('div.row', { style: { gap: '8px', justifyContent: 'center' } },
          h('button.btn.pri', { html: I('download', 15) + 'Save for my story', onclick: () => { const a = document.createElement('a'); a.href = url; a.download = 'piniso-wrapped-' + PStore.todayKey() + '.png'; a.click(); } }),
          h('button.btn', { text: 'Close', onclick: () => ov.close() })));
      const ov = app.ui.overlay(box, { clickOut: true });
      app.ui.confetti && app.ui.confetti();
    }

    // ---- ✨ "Piniso it" button next to the YouTube video ----
    ytButton() {
      if (PZ.site() !== 'youtube' || !/\/watch/.test(location.pathname)) return;
      const host = document.querySelector('ytd-watch-metadata #top-level-buttons-computed, ytd-watch-metadata #actions-inner, #above-the-fold #actions');
      if (!host) return;
      let b = document.getElementById('pz-it');
      const on = !!this.app.session;
      if (!b) {
        b = document.createElement('button');
        b.id = 'pz-it';
        b.className = 'pz-it-btn';
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.app.pinisoIt(true); });
        host.prepend(b);
      }
      const label = on ? '✨ Piniso tools' : '✨ Piniso it';
      if (b.textContent !== label) b.textContent = label;
      b.title = on ? 'All Piniso tools for this lecture' : 'Turn on notes, quizzes & flashcards for this video';
    }
  }
  Magic.TOOLS = TOOLS; Magic.GROUPS = GROUPS; Magic.TRICKS = TRICKS;
  PZ.Magic = Magic;
})();
