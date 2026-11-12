/* Piniso dashboard */
(async () => {
  const { h, I, esc } = PU;
  let S = await PStore.settings();
  let ST = await PStore.stats();
  const main = document.getElementById('main');
  const nav = document.getElementById('nav');
  let brandPet = null, stagePet = null;
  { const v = document.getElementById('ver'); if (v) v.textContent = 'STUDY BUDDY · v' + chrome.runtime.getManifest().version; }

  const SECTIONS = [
    ['home', 'home', 'Home'], ['brain', 'brain', 'AI brain & keys'], ['voice', 'mic', 'Voice talk'], ['guardian', 'shield', 'Guardian'], ['study', 'bulb', 'Study modes'], ['design', 'palette', 'Design studio'],
    ['sound', 'music', 'Music & sounds'], ['library', 'book', 'Notes library'], ['revise', 'cards', 'Revise cards'], ['progress', 'trophy', 'Progress'],
    ['keys', 'keyboard', 'Shortcuts'], ['privacy', 'shield', 'Privacy & data']
  ];

  async function save(patch, rerender) {
    S = await PStore.saveSettings(patch);
    PU.applyTheme(S);
    if (brandPet) brandPet.setConfig(Object.assign(PU.petCfg(S), { size: 56 }));
    if (stagePet) stagePet.setConfig(Object.assign(PU.petCfg(S), { size: Math.max(120, Math.min(220, S.pet.size * 1.7)) }));
    if (rerender) route();
  }
  PStore.onSettings((s) => { S = s; });
  chrome.storage.onChanged.addListener((c, a) => { if (a === 'local' && c.stats) ST = Object.assign(ST, c.stats.newValue || {}); });

  PU.applyTheme(S);
  brandPet = PinisoPet.create(document.getElementById('brandPet'), Object.assign(PU.petCfg(S), { size: 56 }));
  document.addEventListener('pointerdown', () => PAudio.unlock(), { once: true });

  async function drawNav() {
    const due = await PStore.dueCount();
    nav.innerHTML = '';
    const cur = (location.hash || '#home').slice(1);
    SECTIONS.forEach(([id, ic, lab]) => {
      const a = h('a.nav' + (cur === id ? '.on' : ''), { href: '#' + id, html: I(ic, 18) + esc(lab) });
      if (id === 'revise' && due) a.append(h('span.cnt', { text: due }));
      nav.append(a);
    });
  }

  function header(title, sub) { return h('div.ph', null, h('div', null, h('h2', { html: title }), sub ? h('p', { html: sub }) : null)); }
  function card(title, ...kids) { return h('section.card.paper', null, title ? h('h3', { html: title }) : null, ...kids); }

  // ======================================================== WELCOME WIZARD
  function renderWelcome(step = 0) {
    main.innerHTML = '';
    const box = h('div.wiz.paper');
    const steps = h('div.steps'); for (let i = 0; i < 5; i++) steps.append(h('i' + (i <= step ? '.on' : '')));
    const petHost = h('div.petbig');
    const pet = PinisoPet.create(petHost, Object.assign(PU.petCfg(S), { size: 150 }));
    box.append(steps, petHost);
    const next = (n) => { pet.destroy(); renderWelcome(n); };
    if (step === 0) {
      pet.setMood('excited'); pet.react('bigjump');
      const name = h('input.inp', { value: S.pet.name, maxlength: 18, style: { maxWidth: '260px', textAlign: 'center', fontSize: '18px' } });
      box.append(h('h2', { html: 'Hi! I’m <em>your</em> study buddy' }), h('p', { text: 'I watch lectures with you, write notes, crack jokes that actually teach, and quiz you so your brain stays awake. First — what should you call me?' }),
        h('div.row', { style: { justifyContent: 'center' } }, name),
        h('div.row', { style: { justifyContent: 'center', marginTop: '20px' } }, h('button.btn.pri', { html: 'Next ' + I('chevron', 15), onclick: async () => { await save({ pet: { name: name.value.trim() || 'Piniso' } }); next(1); } })));
    } else if (step === 1) {
      pet.setMood('thinking');
      const pick = (key, cur) => {
        const wrap = h('div.chips', { style: { justifyContent: 'center' } });
        PINISO.LANGS.filter((l) => key === 'comments' || l[0] !== 'auto').forEach(([v, lab]) => wrap.append(h('button.chip' + (cur === v ? '.on' : ''), { text: lab, onclick: async (e) => { [...wrap.children].forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); await save({ lang: { [key]: v } }); } })));
        return wrap;
      };
      box.append(h('h2', { html: 'Which <em>language?</em>' }), h('p', { text: 'My funny comments and the notes can be in different languages. You can change this anytime.' }),
        h('b', { text: 'Comments & chat' }), pick('comments', S.lang.comments), h('div', { style: { height: '14px' } }), h('b', { text: 'Notes & quizzes' }), pick('notes', S.lang.notes),
        h('div.row', { style: { justifyContent: 'center', marginTop: '22px' } }, h('button.btn.ghost', { text: 'Back', onclick: () => next(0) }), h('button.btn.pri', { html: 'Next ' + I('chevron', 15), onclick: () => next(2) })));
    } else if (step === 2) {
      pet.setMood('idea');
      const key = h('input.inp', { type: 'password', placeholder: 'Paste your Groq key (starts with gsk_)', value: S.ai.keys.groq || '', style: { maxWidth: '380px' } });
      const res = h('div.res');
      const test = h('button.btn', { text: 'Test', onclick: async () => {
        test.disabled = true; res.className = 'res'; res.textContent = 'Testing…';
        await save({ ai: { provider: 'groq', keys: { groq: key.value.trim() } } });
        const r = await PU.bg({ type: 'ai:test', provider: 'groq', key: key.value.trim() });
        test.disabled = false;
        if (r && r.ok) { res.className = 'res ok'; res.textContent = '✓ Works! My brain is ON.'; pet.setMood('celebrate', 2500); PAudio.sfx('ding'); if (r.suggested) save({ ai: { models: { groq: r.suggested } } }); }
        else { res.className = 'res bad'; res.textContent = '✗ ' + ((r && r.error) || 'That key did not work.'); pet.setMood('sad', 2500); }
      } });
      box.append(h('h2', { html: 'Give me a <em>brain</em> 🧠' }),
        h('p', { html: 'I use <b>your own free AI key</b>. Groq is free and super fast — no card needed:<br>1) open <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> 2) sign in with Google 3) “Create API key” 4) paste it here.' }),
        h('div.row', { style: { justifyContent: 'center' } }, key, test), res,
        h('p.small', { html: 'Want Gemini, OpenAI, OpenRouter or an offline model instead? Set it up later in <b>AI brain & keys</b>.' }),
        deviceCard(true),
        h('div.row', { style: { justifyContent: 'center', marginTop: '14px' } }, h('button.btn.ghost', { text: 'Back', onclick: () => next(1) }), h('button.btn.pri', { html: 'Next ' + I('chevron', 15), onclick: async () => { if (key.value.trim()) await save({ ai: { keys: { groq: key.value.trim() } } }); next(3); } })));
    } else if (step === 3) {
      pet.setMood('love');
      const g = h('div.themes', { style: { textAlign: 'left' } });
      themeCards(g, async () => { pet.setConfig(Object.assign(PU.petCfg(S), { size: 150 })); });
      box.append(h('h2', { html: 'Pick my <em>look</em>' }), h('p', { text: 'You can design every detail later in the Design studio.' }), g,
        h('div.row', { style: { justifyContent: 'center', marginTop: '20px' } }, h('button.btn.ghost', { text: 'Back', onclick: () => next(2) }), h('button.btn.pri', { html: 'Next ' + I('chevron', 15), onclick: () => next(4) })));
    } else {
      pet.setMood('celebrate'); PAudio.sfx('levelup');
      box.append(h('h2', { html: 'We’re <em>ready!</em>' }),
        h('ul.clean', { style: { textAlign: 'left', maxWidth: '470px', margin: '14px auto' }, html: [
          'Open any lecture on <b>YouTube, Unacademy, PW, Khan Academy, Coursera, Udemy</b> — I pop up in the corner.',
          '<b>Hover</b> me for my menu. <b>Double-click</b> me for the notes desk. <b>Drag</b> me anywhere.',
          'No captions on a video? Click my toolbar icon → <b>Listen</b> (or press <span class="kb">Alt+Shift+L</span>).',
          'Pin me: click the 🧩 puzzle icon in your browser toolbar → pin <b>Piniso</b>.',
          'Turn on <b>Quiz mode</b> to get pop quizzes while you watch.'
        ].map((x) => `<li>${x}</li>`).join('') }),
        h('div.row', { style: { justifyContent: 'center', marginTop: '12px' } },
          h('button.btn', { text: 'Open dashboard', onclick: async () => { await save({ onboarded: true }); pet.destroy(); location.hash = '#home'; } }),
          h('button.btn.pri', { html: I('play', 15) + 'Try a lecture now', onclick: async () => { await save({ onboarded: true }); chrome.tabs.create({ url: 'https://www.youtube.com/results?search_query=class+10+science+one+shot+lecture' }); } })));
    }
    main.append(box);
  }

  function themeCards(container, after) {
    Object.entries(PINISO.THEMES).forEach(([id, t]) => {
      const b = h('button.th' + (S.ui.theme === id ? '.on' : ''));
      const top = h('div.sw4.pat-' + t.pattern, { style: { background: t.paper, '--line': t.line } });
      top.style.setProperty('--line', t.line);
      [t.ink, t.accent, t.paper2].forEach((c) => top.append(h('i', { style: { background: c } })));
      const tp = h('div.tp'); tp.innerHTML = PinisoPet.svgString(Object.assign({}, S.pet, t.pet, { accent: t.accent }), 'happy');
      top.append(tp);
      b.append(top, h('div.nm', { html: `${esc(t.label)}<small>${esc(t.note)}</small>` }));
      b.onclick = async () => { await save({ ui: { theme: id }, pet: { followTheme: true } }); [...container.children].forEach((c) => c.classList.remove('on')); b.classList.add('on'); PAudio.sfx('pop'); after && after(); };
      container.append(b);
    });
  }

  // ======================================================== HOME
  async function renderHome() {
    const today = (ST.days[PStore.todayKey()] || 0) / 60;
    const lvl = PINISO.levelFromXP(ST.xp);
    const sessions = await PStore.listSessions();
    const due = await PStore.dueCount();
    const a = S.ai, hasKey = a.provider === 'custom' ? !!a.customBaseUrl : !!(a.keys[a.provider] || '').trim();
    main.append(header(`Hey, let’s <em>study</em>`, `${esc(S.pet.name)} is ready. Open a lecture and press ✨ Piniso it — notes, quizzes and flashcards switch on by themselves.`));
    // 🎓 tricks checklist: every feature, so nothing stays hidden
    const TR = [['notes', '📝', 'Live notes', 'automatic'], ['pinisoit', '✨', 'Piniso it', 'the button next to any video'], ['ask', '💬', 'Ask a doubt', 'Notes desk → Ask'], ['mark', '⭐', 'Mark important', 'Alt+Shift+M'], ['quiz', '❓', 'Quiz me', 'Alt+Shift+Q'], ['snipe', '🎯', 'Doubt snipe', 'Alt+Shift+D — drag a box on the board'], ['lost', '🧭', 'I’m lost here', 'Alt+Shift+X'], ['talk', '🎙️', 'Talk with Piniso', 'Alt+Shift+T'], ['clean', '✨', 'Clean notes', 'Notes → Clean notes'], ['cards', '🃏', 'Revise flashcards', 'Cards → Revise'], ['vquiz', '🗣️', 'Voice quiz', 'Quiz → Voice quiz'], ['booklet', '📘', 'Study booklet PDF', 'Notes → Export'], ['lock', '🔒', 'Focus lock', 'popup → Lock now'], ['meme', '🤡', 'Meme maker', 'tap Piniso → Meme'], ['recall', '⚡', '60-sec recall', 'when a video ends'], ['drills', '🧮', 'Formula drill', 'Night-before mode'], ['share', '📸', 'Share card', 'report card'], ['float', '🪟', 'Float on top', 'Alt+Shift+F']];
    const used = Object.assign({ notes: 1, pinisoit: 1 }, (ST.tricks && ST.tricks.used) || {});
    const nDone = TR.filter(([id]) => used[id]).length;
    const tc = card(`🎓 Tricks mastered: <em>${nDone}/${TR.length}</em>`);
    tc.append(h('p.small.muted', { text: 'Tip: tap Piniso on any lecture to see every tool in one place. I also teach you one new trick per session.' }));
    const tg = h('div.tricks');
    TR.forEach(([id, e, n, how]) => tg.append(h('div.tr' + (used[id] ? '.done' : ''), { title: how }, h('span', { text: used[id] ? '✅' : e }), h('b', { text: n }), h('small', { text: how }))));
    tc.append(tg);
    main.append(tc);
    const dev = ((await PStore.get('deviceAI')).deviceAI || {}).status === 'available' && a.device !== false;
    if (!hasKey && !dev) main.append(card('Add my brain first 🧠', h('p', { html: 'Without an API key I can still keep you focused, play music and track your streak — but notes, comments and quizzes need a <b>free</b> key — or the AI built into Chrome.' }), h('div.row', null, h('a.btn.pri', { href: '#brain', html: I('bolt', 15) + 'Set up free key (1 min)' }), h('a.btn', { href: '#brain', text: '🖥️ Use built-in AI (no key)' }))));
    const g = h('div.grid3', { style: { marginBottom: '18px' } });
    const stat = (v, l) => h('div.stat', { html: `<b>${esc(v)}</b><span>${esc(l)}</span>` });
    g.append(stat(`${Math.round(today)} / ${S.focus.dailyGoal}m`, 'studied today'), stat(PStore.streak(ST) + ' 🔥', 'day streak'), stat('Lv ' + lvl, PINISO.levelTitle(lvl)));
    main.append(g);
    main.append(card('New: study <em>anything</em> 🖥️', h('p', { html: 'Studying in a desktop app, an offline video, a PDF or a Zoom/Meet class? Share that window and Piniso listens, reads the screen and floats on top of every window.' }),
      h('div.row.wrap', null, h('a.btn.pri', { href: 'anywhere.html', target: '_blank', html: I('pip', 15) + 'Open Study Anything' }), h('a.btn', { href: '#voice', html: I('mic', 15) + 'Set up voice talk' }), h('a.btn', { href: '#guardian', html: I('shield', 15) + 'Turn on Guardian' }))));
    if (due) main.append(card(`${due} flashcard${due > 1 ? 's' : ''} to revise`, h('p.muted', { text: 'Five minutes of revision now saves an hour before the exam.' }), h('a.btn.pri', { href: '#revise', html: I('cards', 15) + 'Start revision' })));
    const recent = card('Recent lectures');
    if (!sessions.length) recent.append(h('p.muted', { text: 'Nothing yet. Open a YouTube lecture to begin!' }));
    sessions.slice(0, 6).forEach((x) => recent.append(sessRow(x)));
    if (sessions.length > 6) recent.append(h('a.btn.sm', { href: '#library', text: 'See all ' + sessions.length }));
    main.append(recent);
    main.append(card('How to use me', h('ul.clean', { html: [
      '<b>Hover</b> me → menu: Notes · Ask · Quiz · Snap board · Star · Music',
      '<b>Double-click</b> me → the study desk with live notes, chat, quiz, flashcards, focus stats',
      '<b>Snap board</b> → I read the teacher’s board/slide and explain it (best with a free Gemini key)',
      '<b>Samjha nahi?</b> → I re-explain the last 2 minutes like you’re 12',
      'When the teacher says “important / exam mein aayega” I star it automatically ⭐',
      '<b>Finish</b> → get a shareable report card with your grade and a roast 😂'
    ].map((x) => `<li>${x}</li>`).join('') })));
  }
  function sessRow(x) {
    const r = h('div.sess');
    r.append(h('div.t', null, h('b', { text: x.title }), h('span.small.muted', { text: `${x.site} · ${PU.ago(x.updatedAt)} · ${PU.dur(x.watch)} · ${x.notes} notes${x.topic ? ' · ' + x.topic : ''}` })),
      h('a.btn.sm', { href: 'notes.html?key=' + encodeURIComponent(x.key), target: '_blank', html: I('notes', 14) + 'Notes' }),
      x.url ? h('a.btn.sm.ghost', { href: x.url, target: '_blank', html: I('play', 14) }) : null);
    return r;
  }

  // ======================================================== BRAIN
  // 🖥️ the AI built into Chrome: works with no key (download once, then free + offline)
  function deviceCard(compact) {
    const box = card(compact ? '' : '🖥️ No key? Use the AI built into Chrome');
    box.classList.add('devcard');
    const status = h('div.devst', { text: 'Checking your browser…' });
    const bar = h('div.devbar', { hidden: true }, h('i'));
    const btn = h('button.btn.pri', { hidden: true });
    const sw = PU.sw(S.ai.device !== false, (v) => save({ ai: { device: v } }));
    box.append(...[
      compact ? h('b', { text: '🖥️ Or skip the key: use the AI built into Chrome' }) : null,
      h('p.small.muted', { html: 'Free and private — it runs on <b>your</b> computer, even offline. Needs Chrome 138+ on a strong PC (16 GB RAM or a good graphics card). It is smaller than Groq/Gemini, so notes are simpler. A key always wins when you add one.' }),
      status, bar, h('div.row', { style: { gap: '10px', alignItems: 'center' } }, btn, h('div.sp'), compact ? null : h('span.small', { text: 'Use it when I have no key' }), compact ? null : sw)].filter(Boolean));
    const paint = (st, pct) => {
      btn.hidden = true; bar.hidden = true;
      if (st.status === 'available') { status.innerHTML = '✅ <b>Ready!</b> Piniso can write notes and quizzes without any key.'; }
      else if (st.status === 'downloadable') { status.innerHTML = '⬇️ Your browser has it — it needs a one-time download (about 2 GB, use Wi-Fi).'; btn.hidden = false; btn.innerHTML = I('download', 15) + 'Download built-in AI'; }
      else if (st.status === 'downloading') { status.innerHTML = '⏳ Downloading… you can keep using the PC.'; bar.hidden = false; bar.firstChild.style.width = (pct || st.progress || 5) + '%'; btn.hidden = false; btn.innerHTML = I('refresh', 15) + 'Check again'; }
      else { status.innerHTML = '😔 Not available on this browser/PC' + (st.reason ? ' — <span class="muted">' + esc(st.reason) + '</span>' : '') + '. Use a free Groq key instead (1 minute).'; }
    };
    const check = async () => { const local = await PDevice.status(); paint(local); if (local.status !== 'downloadable' && local.status !== 'downloading') PU.bg({ type: 'device:status' }); };
    btn.onclick = async () => {
      btn.disabled = true;
      paint({ status: 'downloading' }, 2);
      try {
        const sess = await PDevice.prepare((p) => paint({ status: 'downloading' }, p));
        try { sess.destroy(); } catch (e) {}
        await PU.bg({ type: 'device:status' });
        paint({ status: 'available' }); PAudio.sfx('levelup'); PU.toast('Built-in AI is ready 🎉');
      } catch (e) { paint({ status: 'unavailable', reason: e.message }); }
      btn.disabled = false;
    };
    check();
    return box;
  }

  function renderBrain() {
    main.append(header('AI <em>brain</em> & keys', 'Piniso uses <b>your own</b> API key. The key stays on this computer and is sent only to the AI company you pick. Groq and Gemini are free.'));
    const c = card('1. Choose the main brain');
    const grid = h('div.prov');
    Object.entries(PINISO.PROVIDERS).forEach(([id, p]) => {
      const b = h('button.pc' + (S.ai.provider === id ? '.on' : ''), { html: `${id === 'groq' ? '<span class="tag">BEST · FREE</span>' : p.free && id !== 'custom' ? '<span class="tag">FREE</span>' : ''}<b>${esc(p.label)}</b><small>${esc(p.hint)}</small>` });
      b.onclick = () => save({ ai: { provider: id } }, true);
      grid.append(b);
    });
    c.append(grid);
    main.append(c);

    main.append(deviceCard());
    const keysCard = card('2. Your keys');
    keysCard.append(h('p.small.muted', { text: 'Add a key for the main brain. Extra keys are optional: a Gemini key lets Piniso read the board (images); a Groq key lets it listen to audio on sites without captions.' }));
    ['groq', 'gemini', 'openai', 'openrouter'].forEach((id) => keysCard.append(keyBlock(id)));
    keysCard.append(customBlock());
    main.append(keysCard);

    const m = card('3. Models <span class="small muted" style="font-family:var(--f-ui)">(optional — defaults work)</span>');
    const prov = S.ai.provider;
    const dl = h('datalist#modelList');
    const model = h('input.inp', { list: 'modelList', value: S.ai.models[prov] || '' });
    const fb = h('input.inp', { list: 'modelList', value: S.ai.fallback[prov] || '' });
    model.onchange = () => save({ ai: { models: { [prov]: model.value.trim() } } });
    fb.onchange = () => save({ ai: { fallback: { [prov]: fb.value.trim() } } });
    const load = h('button.btn.sm', { html: I('refresh', 14) + 'Load models', onclick: async () => {
      load.disabled = true;
      const r = await PU.bg({ type: 'ai:models', provider: prov });
      load.disabled = false;
      if (r && r.ok) { dl.innerHTML = ''; r.ids.forEach((id) => dl.append(h('option', { value: id }))); PU.toast(r.ids.length + ' models found — click a box to pick'); } else PU.toast((r && r.error) || 'Could not load models');
    } });
    m.append(dl, PU.row('Main model for ' + PINISO.PROVIDERS[prov].label, 'Used for notes, comments, quizzes and doubts', h('div', { style: { width: '320px' } }, model)),
      PU.row('Backup model', 'Used automatically when the main one is busy or rate-limited', h('div', { style: { width: '320px' } }, fb)), h('div', { style: { marginTop: '8px' } }, load));
    const vis = h('select.inp');
    [['auto', 'Auto (best available)']].concat(Object.entries(PINISO.PROVIDERS).map(([k, p]) => [k, p.label])).forEach(([k, l]) => vis.append(h('option', { value: k, text: l, selected: S.ai.vision === k })));
    vis.onchange = () => save({ ai: { vision: vis.value } });
    m.append(PU.row('Board reading (images)', 'Auto uses Gemini/OpenAI when your main brain cannot see images', vis));
    const stt = h('select.inp');
    [['auto', 'Auto (Groq → OpenAI → Gemini)'], ['groq', 'Groq Whisper (free)'], ['openai', 'OpenAI Whisper'], ['gemini', 'Gemini']].forEach(([k, l]) => stt.append(h('option', { value: k, text: l, selected: S.ai.stt === k })));
    stt.onchange = () => save({ ai: { stt: stt.value } });
    m.append(PU.row('Listening (speech-to-text)', 'For videos without captions', stt));
    main.append(m);

    const u = card('Usage today');
    PStore.get('usage').then(({ usage = {} }) => {
      const d = usage[PStore.todayKey()] || {};
      const rows = Object.entries(d);
      if (!rows.length) { u.append(h('p.muted', { text: 'No AI calls yet today.' })); return; }
      const t = h('table.tbl', { html: '<tr><th>MODEL</th><th>CALLS</th><th>TOKENS</th></tr>' + rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.calls}</td><td>${v.tokens.toLocaleString()}</td></tr>`).join('') });
      u.append(t);
    });
    main.append(u);
  }
  function keyBlock(id) {
    const p = PINISO.PROVIDERS[id];
    const wrap = h('div.setrow', { style: { flexWrap: 'wrap' } });
    const inp = h('input.inp', { type: 'password', placeholder: p.label + ' API key', value: S.ai.keys[id] || '', autocomplete: 'off', spellcheck: 'false' });
    const eye = h('button.btn.sm.ghost', { html: I('eyeoff', 15), title: 'Show / hide', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; } });
    const res = h('div.res', { style: { width: '100%' } });
    inp.onchange = () => save({ ai: { keys: { [id]: inp.value.trim() } } });
    const test = h('button.btn.sm', { text: 'Test', onclick: async () => {
      test.disabled = true; res.className = 'res'; res.textContent = 'Testing…';
      await save({ ai: { keys: { [id]: inp.value.trim() } } });
      const r = await PU.bg({ type: 'ai:test', provider: id, key: inp.value.trim() });
      test.disabled = false;
      if (r && r.ok && r.busy) {
        res.className = 'res'; res.style.color = '#9a6700'; res.textContent = '⚠ ' + r.warning;
      } else if (r && r.ok) {
        res.style.color = '';
        res.className = 'res ok'; res.textContent = `✓ Working (${r.model})` + (r.busyModel ? ` — ${r.busyModel} was busy, so Piniso used ${r.model}.` : r.suggested ? ` — switched to ${r.suggested} because the default was not available.` : '');
        if (r.suggested) save({ ai: { models: { [id]: r.suggested } } });
        PAudio.sfx('ding');
      } else { res.className = 'res bad'; res.textContent = '✗ ' + ((r && r.error) || 'Not working'); PAudio.sfx('error'); }
    } });
    wrap.append(h('div.lbl', { html: `${esc(p.label)}<small>${esc(p.hint)} <a href="${p.keyUrl}" target="_blank">Get key ↗</a></small>` }), h('div.keyrow', { style: { width: '380px' } }, inp, eye, test), res);
    return wrap;
  }
  function customBlock() {
    const wrap = h('div.setrow', { style: { flexWrap: 'wrap' } });
    const url = h('input.inp', { placeholder: 'http://localhost:11434/v1', value: S.ai.customBaseUrl || '' });
    const key = h('input.inp', { type: 'password', placeholder: 'Key (optional)', value: S.ai.keys.custom || '' });
    const model = h('input.inp', { placeholder: 'Model name e.g. llama3.1', value: S.ai.models.custom || '' });
    const res = h('div.res', { style: { width: '100%' } });
    const go = h('button.btn.sm', { text: 'Save & test', onclick: async () => {
      let origin; try { origin = new URL(url.value.trim()).origin; } catch (e) { res.className = 'res bad'; res.textContent = 'Enter a valid address'; return; }
      const ok = await chrome.permissions.request({ origins: [origin + '/*'] }).catch(() => false);
      if (!ok) { res.className = 'res bad'; res.textContent = 'Permission needed to talk to that server.'; return; }
      await save({ ai: { customBaseUrl: url.value.trim(), keys: { custom: key.value.trim() }, models: { custom: model.value.trim() } } });
      res.className = 'res'; res.textContent = 'Testing…';
      const r = await PU.bg({ type: 'ai:test', provider: 'custom', key: key.value.trim(), base: url.value.trim() });
      if (r && r.ok) { res.className = 'res ok'; res.textContent = '✓ Connected (' + r.model + ')'; } else { res.className = 'res bad'; res.textContent = '✗ ' + ((r && r.error) || 'Not reachable'); }
    } });
    wrap.append(h('div.lbl', { html: 'Custom / offline server<small>Ollama, LM Studio, or any OpenAI-compatible API. For Ollama, start it with OLLAMA_ORIGINS=* so the browser can reach it.</small>' }),
      h('div', { style: { width: '380px', display: 'grid', gap: '6px' } }, url, model, h('div.keyrow', null, key, go)), res);
    return wrap;
  }

  // ======================================================== VOICE
  function renderVoice() {
    main.append(header('Voice <em>talk</em> 🎙️', 'Talk to Piniso out loud — a real speech-to-speech model, with live captions of what you and Piniso say. Works best with headphones.'));
    const v = S.voice;
    const c = card('Voice brain');
    const prov = h('select.inp');
    [['auto', 'Auto (Gemini if you have a key, else OpenAI)'], ['gemini', 'Gemini Live — free'], ['openai', 'OpenAI Realtime — paid']].forEach(([k, l]) => prov.append(h('option', { value: k, text: l, selected: v.provider === k })));
    prov.onchange = () => save({ voice: { provider: prov.value } });
    const res = h('div.res');
    const chk = h('button.btn.sm', { text: 'Check my voice model', onclick: async () => {
      chk.disabled = true; res.className = 'res'; res.textContent = 'Checking…';
      const r = await PU.bg({ type: 'voice:model' });
      chk.disabled = false;
      if (r && r.ok) { res.className = 'res ok'; res.textContent = `✓ Ready: ${r.provider} · ${r.model}`; } else { res.className = 'res bad'; res.textContent = '✗ ' + ((r && r.error) || 'Not available'); }
    } });
    c.append(PU.row('Provider', 'Gemini uses the same free key as “AI brain & keys” (aistudio.google.com/apikey).', prov), h('div', null, chk, res));
    const voice = h('select.inp');
    PINISO.GEMINI_VOICES.forEach((n) => voice.append(h('option', { value: n, text: n, selected: v.voice === n })));
    voice.onchange = () => save({ voice: { voice: voice.value } });
    const ov = h('select.inp');
    ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'].forEach((n) => ov.append(h('option', { value: n, text: n, selected: v.openaiVoice === n })));
    ov.onchange = () => save({ voice: { openaiVoice: ov.value } });
    c.append(PU.row('Gemini voice', 'Puck is playful, Kore is calm, Aoede is bright', voice), PU.row('OpenAI voice', '', ov));
    main.append(c);
    const m = card('How Piniso talks');
    const modes = h('div.prov');
    PINISO.VOICE_MODES.filter(([k]) => k !== 'vquiz').forEach(([k, l, d]) => { const b = h('button.pc' + (v.mode === k ? '.on' : ''), { html: `<b>${esc(l)}</b><small>${esc(d)}</small>` }); b.onclick = () => save({ voice: { mode: k } }, true); modes.append(b); });
    m.append(h('p.small.muted', { text: 'Default mode (you can switch inside the talk panel too):' }), modes,
      PU.row('Pause the lecture when we talk', 'Stops the teacher’s voice from confusing the mic', PU.sw(v.pauseVideo, (x) => save({ voice: { pauseVideo: x } }))),
      PU.row('Push-to-talk', 'Only send your voice while holding the button (great in noisy rooms)', PU.sw(v.ptt, (x) => save({ voice: { ptt: x } }))),
      PU.row('Live captions', 'Show what you and Piniso say as text', PU.sw(v.captions, (x) => save({ voice: { captions: x } }))));
    main.append(m);
    main.append(card('Things you can say', h('ul.clean', { html: ['“Pause the video and explain this simply”', '“Go back 30 seconds”', '“What’s on the board?” (Piniso looks at the screen)', '“Save that as a note” · “Star this moment”', '“Quiz me rapid fire!”', '“Let’s do a 45 minute focus sprint”', '“Revise my flashcards with me”', 'Start: hover Piniso → 🎙️, or press <span class="kb">Alt+Shift+T</span> on the video page'].map((x) => `<li>${x}</li>`).join('') })));
  }

  // ======================================================== GUARDIAN
  function renderGuardian() {
    const g = S.guardian;
    main.append(header('Guardian <em>mode</em> 🛡️', 'Blocks distracting sites while you study. Research shows blockers only work when they are hard to skip — so unlocking costs a flashcard, a wait and a pledge.'));
    const origins = () => (S.guardian.sites || []).map((d) => '*://*.' + String(d).trim().replace(/^www\./, '') + '/*');
    const c = card('Guardian');
    c.append(PU.row('Guardian is ON', 'Needs permission for the blocked sites (so it can show the Guardian page instead of an error)', PU.sw(g.enabled, async (v) => {
      if (v) { const ok = await chrome.permissions.request({ origins: origins() }).catch(() => false); if (!ok) PU.toast('Without permission, blocked sites show a plain error page instead'); }
      await save({ guardian: { enabled: v, touched: true } }); PU.bg({ type: 'guardian:sync' });
    })));
    c.append(PU.row('When', '“During study” = while a lecture plays (+10 min) or a focus sprint runs', PU.seg([['session', 'During study'], ['schedule', 'Study hours'], ['always', 'Always']], g.when, (v) => save({ guardian: { when: v } }, true))));
    if (g.when === 'schedule') {
      const f = h('input.inp', { type: 'time', value: g.from, style: { width: '130px' } }), t = h('input.inp', { type: 'time', value: g.to, style: { width: '130px' } });
      f.onchange = () => save({ guardian: { from: f.value } }); t.onchange = () => save({ guardian: { to: t.value } });
      c.append(PU.row('Study hours', '', h('div.row', null, f, h('span', { text: 'to' }), t)));
    }
    c.append(PU.row('To unlock a site', '', PU.seg([['card', 'Flashcard + pledge'], ['wait', '30s wait + pledge'], ['both', 'All three (hardest)']], g.unlock, (v) => save({ guardian: { unlock: v } }))),
      PU.row('Pass length', '', PU.seg([[3, '3 min'], [5, '5 min'], [10, '10 min']], g.passMinutes, (v) => save({ guardian: { passMinutes: v } }))),
      PU.row('Block YouTube Shorts', 'Shorts are the #1 study killer — blocked while you study, even inside YouTube', PU.sw(g.shorts !== false, async (v) => { await save({ guardian: { shorts: v } }); PU.bg({ type: 'guardian:sync' }); })),
      PU.row('Start-of-session ritual', 'Phone-away check, goal and an if–then plan before a new lecture', PU.sw(g.ritual, (v) => save({ guardian: { ritual: v } }))));
    main.append(c);
    const sc = card('Blocked sites');
    const ta = h('textarea.inp', { rows: 8, style: { fontFamily: 'var(--f-mono)', fontSize: '13px' } });
    ta.value = (g.sites || []).join('\n');
    sc.append(h('p.small.muted', { text: 'One site per line (subdomains are included). YouTube is never blocked — Shorts Police handles Shorts.' }), ta,
      h('div.row', { style: { marginTop: '8px' } }, h('button.btn.pri.sm', { text: 'Save list', onclick: async () => {
        const sites = ta.value.split(/\s+/).map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter((x) => x && !/youtube\.com$/.test(x));
        await save({ guardian: { sites } });
        if (S.guardian.enabled) await chrome.permissions.request({ origins: origins() }).catch(() => false);
        PU.bg({ type: 'guardian:sync' }); PU.toast('Saved ' + sites.length + ' sites');
      } })));
    main.append(sc);
    main.append(card('Guardian stats', h('p', { html: `Blocked attempts: <b>${ST.guardianBlocks || 0}</b> · Went back to studying: <b>${ST.guardianBack || 0}</b> · Passes used: <b>${ST.guardianPasses || 0}</b> · Sprints done: <b>${ST.sprints || 0}</b>` })));
  }

  // ======================================================== STUDY MODES
  function renderStudy() {
    main.append(header('Study <em>modes</em>', 'How Piniso talks, writes notes, quizzes you and protects your focus.'));
    const lang = card('Language & personality');
    const sel = (key, allowAuto) => { const s = h('select.inp'); PINISO.LANGS.filter((l) => allowAuto || l[0] !== 'auto').forEach(([v, l]) => s.append(h('option', { value: v, text: l, selected: S.lang[key] === v }))); s.onchange = () => save({ lang: { [key]: s.value } }); return s; };
    lang.append(PU.row('Comments & chat language', 'Funny recaps, doubt answers, quiz jokes', sel('comments', true)), PU.row('Notes & quiz language', 'The actual notes, questions and flashcards', sel('notes', false)));
    const hum = h('input', { type: 'range', min: 0, max: 5, step: 1, value: S.humor });
    const humL = h('span.pill', { text: humorLabel(S.humor) });
    hum.oninput = () => { humL.textContent = humorLabel(+hum.value); };
    hum.onchange = () => save({ humor: +hum.value });
    lang.append(PU.row('Humour level', 'Content is always useful — this only changes the jokes', h('div.row', { style: { width: '320px' } }, hum, humL)));
    main.append(lang);

    const b = card('Live notes & comments');
    b.append(PU.row('Funny-but-useful comments', 'Speech bubbles with recaps, tips and memory tricks', PU.sw(S.brain.commentsOn, (v) => save({ brain: { commentsOn: v } }))),
      PU.row('Auto notes', 'Clean, exam-ready notes with timestamps', PU.sw(S.brain.notesOn, (v) => save({ brain: { notesOn: v } }))),
      PU.row('How often', 'Minutes of video between notes/comments (less often = fewer API calls)', PU.seg([[120, '2m'], [180, '3m'], [300, '5m'], [480, '8m']], S.brain.commentEvery, (v) => save({ brain: { commentEvery: v } }))),
      PU.row('Notes ready on time', 'When the video has captions, Piniso reads one part ahead so notes appear right as the teacher says it (no 3-minute wait)', PU.sw(S.brain.notesAhead !== false, (v) => save({ brain: { notesAhead: v } }))),
      PU.row('Clean notes ✨', 'Keep a tidy topic-wise version of your notes (with exam corner) that updates by itself', PU.sw(S.brain.cleanAuto !== false, (v) => save({ brain: { cleanAuto: v } }))),
      PU.row('Fast answers ⚡', 'Ask, quiz and grading use a quicker model (separate free limit, so they never wait behind notes)', PU.seg([['fast', 'Fast'], ['best', 'Best quality']], S.ai.speed || 'fast', (v) => save({ ai: { speed: v } }))),
      PU.row('Auto flashcards', 'Make revision cards from the lecture', PU.sw(S.brain.cardsOn, (v) => save({ brain: { cardsOn: v } }))),
      PU.row('Important detector ⭐', 'Stars moments when the teacher says “important”, “exam mein aayega”, “yaad rakhna”… (works offline)', PU.sw(S.brain.autoImportant, (v) => save({ brain: { autoImportant: v } }))),
      PU.row('Read the screen when there’s no audio text', 'Takes a board snapshot instead (needs an image-capable model)', PU.sw(S.brain.visionFallback, (v) => save({ brain: { visionFallback: v } }))));
    main.append(b);

    const st = card('When should Piniso start?');
    const B = S.brain || {};
    st.append(PU.row('On study videos 📚', 'Piniso never starts by itself on normal videos (music, vlogs, games). Tap ✨ Piniso it under any video to start it yourself.',
      PU.seg([['ask', 'Ask me first'], ['auto', 'Start by itself'], ['manual', 'Only when I tap']], B.start || 'ask', (v) => save({ brain: { start: v } }))));
    if ((B.autoSites || []).length) st.append(PU.row('Always start on these sites', B.autoSites.join(', '), h('button.btn.sm.ghost', { text: 'Clear', onclick: () => save({ brain: { autoSites: [] } }, true) })));
    main.append(st);
    const ex = card('Exam, reminders & helpers');
    const exName = h('input.inp', { value: (S.exam && S.exam.name) || '', placeholder: 'e.g. Physics board exam', style: { maxWidth: '220px' } });
    const exDate = h('input.inp', { type: 'date', value: (S.exam && S.exam.date) || '', style: { maxWidth: '170px' } });
    const saveEx = () => save({ exam: { name: exName.value.trim(), date: exDate.value } });
    exName.onchange = saveEx; exDate.onchange = saveEx;
    ex.append(PU.row('Exam countdown 📅', 'Shows “exam in N days” in the popup and daily mission', h('div.row', { style: { gap: '8px', flexWrap: 'wrap' } }, exName, exDate)),
      PU.row('Revision reminder 🔔', 'A gentle notification in the evening when flashcards are due', PU.sw(S.focus.remind !== false, (v) => save({ focus: { remind: v } }))),
      PU.row('Speed coach 🐢🏎️', 'Suggests 1.25× on slow parts and 1× on dense parts', PU.sw(S.focus.speedCoach !== false, (v) => save({ focus: { speedCoach: v } }))),
      PU.row('Night-owl guard 🌙', 'After 11 pm, offers to save your place so you can sleep', PU.sw(S.focus.nightGuard !== false, (v) => save({ focus: { nightGuard: v } }))),
      PU.row('Block YouTube autoplay ⏹️', 'No random next video while you study', PU.sw(S.focus.blockAutoplay !== false, (v) => save({ focus: { blockAutoplay: v } }))),
      PU.row('Low-data mode 📶', 'Fewer, smaller AI calls (notes every 5 min, no read-ahead, no auto clean notes) — good on mobile hotspot', PU.sw(!!S.ai.lowData, (v) => save({ ai: { lowData: v, speed: v ? 'fast' : S.ai.speed }, brain: { commentEvery: v ? 300 : 180, notesAhead: !v, cleanAuto: !v } }, true))));
    main.append(ex);

    const q = card('Quiz mode');
    q.append(PU.row('Pop quizzes while I watch', 'Pauses the video and asks questions. Always skippable.', PU.sw(S.quiz.enabled, (v) => save({ quiz: { enabled: v } }))),
      PU.row('Every', '', PU.seg([[300, '5 min'], [480, '8 min'], [720, '12 min'], [1200, '20 min']], S.quiz.every, (v) => save({ quiz: { every: v } }))),
      PU.row('Questions per quiz', '', PU.seg([[1, '1'], [2, '2'], [3, '3'], [5, '5']], S.quiz.count, (v) => save({ quiz: { count: v } }))),
      PU.row('Difficulty', '', PU.seg([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], S.quiz.difficulty, (v) => save({ quiz: { difficulty: v } }))));
    const types = h('div.chips');
    [['mcq', 'MCQ'], ['tf', 'True / False'], ['short', 'One-word'], ['long', 'Written paragraph'], ['fill', '🧩 Fill the blank'], ['fix', '🕵️ Spot the mistake'], ['order', '🔢 Put in order'], ['match', '🔗 Match pairs']].forEach(([k, l]) => types.append(h('button.chip' + (S.quiz.types[k] ? '.on' : ''), { text: l, onclick: (e) => { const t = Object.assign({}, S.quiz.types, { [k]: !S.quiz.types[k] }); if (!Object.values(t).some(Boolean)) t.mcq = true; e.currentTarget.classList.toggle('on', t[k]); save({ quiz: { types: t } }); } })));
    q.append(PU.row('Question types', 'Written answers are graded by AI (Hinglish is fine)', types));
    q.append(PU.row('Pause video during quiz', '', PU.sw(S.quiz.autoPause, (v) => save({ quiz: { autoPause: v } }))));
    main.append(q);

    const f = card('Focus shield');
    f.append(PU.row('Pause when I leave the tab', 'Piniso notices tab-switching and pauses the lecture', PU.sw(S.focus.pauseOnLeave, (v) => save({ focus: { pauseOnLeave: v } }))),
      PU.row('Zen mode (YouTube)', 'Hide recommendations, comments, shorts and end screens', PU.sw(S.focus.zen, (v) => save({ focus: { zen: v } }))),
      PU.row('Shorts police 🚨', 'Piniso gets angry when you open YouTube Shorts', PU.sw(S.shortsPolice, (v) => save({ shortsPolice: v }))),
      PU.row('Hide captions Piniso turns on', 'Piniso can read captions without showing them', PU.sw(S.focus.hideCaptions, (v) => save({ focus: { hideCaptions: v } }))),
      PU.row('Break reminder', '', PU.seg([[0, 'Off'], [25, '25 min'], [45, '45 min'], [60, '60 min'], [90, '90 min']], S.focus.breakEvery, (v) => save({ focus: { breakEvery: v } }))),
      PU.row('Break length', '', PU.seg([[3, '3 min'], [5, '5 min'], [10, '10 min']], S.focus.breakLength, (v) => save({ focus: { breakLength: v } }))),
      PU.row('Daily goal', 'Minutes of focused study per day', PU.seg([[30, '30'], [60, '60'], [90, '90'], [120, '120'], [180, '180']], S.focus.dailyGoal, (v) => save({ focus: { dailyGoal: v } }))));
    main.append(f);

    const rs = card('Research-backed boosts');
    rs.append(PU.row('Pre-questions 🤔', 'Before a topic starts, Piniso asks a curiosity question it will answer later (on videos with captions)', PU.sw(S.study.prequestions, (v) => save({ study: { prequestions: v } }))),
      PU.row('“Your turn” summaries ✍️', 'Every few notes, you write a one-line summary and Piniso grades it — writing it yourself beats reading', PU.sw(S.study.yourTurn, (v) => save({ study: { yourTurn: v } }))));
    main.append(rs);
    const sites = card('Where Piniso works');
    sites.append(PU.row('Piniso is ON', 'Turn off to hide Piniso everywhere', PU.sw(S.enabled, (v) => save({ enabled: v }))));
    sites.append(PU.row('Run on every website', 'Piniso appears on any site with a lecture-length video (not on random short clips)', PU.sw(S.everywhere, async (v) => {
      if (v) { const ok = await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false); if (!ok) { PU.toast('Permission needed for every website'); route(); return; } }
      await save({ everywhere: v }); PU.bg({ type: 'everywhere:sync' }); PU.toast(v ? 'Piniso will now join lectures on any website' : 'Back to study sites only');
    })));
    sites.append(PU.row('Stay visible in full screen', 'When a site makes the bare video full screen, Piniso re-opens it in a full-screen layout where it can stay with you', PU.sw(S.fullscreenRewrap, (v) => save({ fullscreenRewrap: v }))));
    const list = S.disabledSites || [];
    sites.append(h('p.small.muted', { text: list.length ? 'Turned off on:' : 'Works automatically on YouTube, Unacademy, PW, Khan Academy, Coursera, Udemy, Vedantu, BYJU’S, NPTEL and edX. On any other site, click the Piniso icon → “Start Piniso on this page”.' }));
    list.forEach((d) => sites.append(h('div.row', { style: { margin: '4px 0' } }, h('span.pill', { text: d }), h('button.btn.sm.ghost', { text: 'Turn back on', onclick: () => save({ disabledSites: list.filter((x) => x !== d) }, true) }))));
    main.append(sites);
  }
  const humorLabel = (n) => ['Serious teacher', 'Calm senior', 'Friendly', 'Funny buddy', 'Class clown', 'Full meme mode'][n] || 'Funny buddy';

  // ======================================================== DESIGN STUDIO
  function renderDesign() {
    main.append(header('Design <em>studio</em>', 'Make Piniso yours. Every change updates the live preview and the in-video buddy instantly.'));
    const wrap = h('div.studio');
    const stage = h('div.stage.paper.' + 'pat-' + (PINISO.themeOf(S).pattern || 'plain'));
    const petHost = h('div.petbig');
    stagePet = PinisoPet.create(petHost, Object.assign(PU.petCfg(S), { size: Math.max(120, Math.min(220, S.pet.size * 1.7)) }));
    stagePet.setMood('happy', 1500);
    const bub = h('div.bub', { text: PLines.pick(PLines.langFor(S.lang.comments), 'poke') });
    petHost.addEventListener('click', () => { stagePet.react('poke'); stagePet.setMood(PinisoPet.MOODS[Math.floor(Math.random() * PinisoPet.MOODS.length)], 1800); bub.textContent = PLines.pick(PLines.langFor(S.lang.comments), 'poke'); PAudio.sfx('pop'); });
    const moods = h('div.moods');
    PinisoPet.MOODS.forEach((m) => moods.append(h('button.chip', { text: m, onclick: () => { stagePet.setMood(m, 3500); } })));
    const reacts = h('div.moods');
    ['jump', 'bigjump', 'spin', 'wave', 'wiggle', 'shake', 'squish', 'stretch'].forEach((r) => reacts.append(h('button.chip', { text: r, onclick: () => { stagePet.react(r); PAudio.sfx(r === 'spin' ? 'boing' : 'pop'); } })));
    // v4.1: the live 3D Piniso — every move in one gallery, plus the 3D / 2D switch
    const gal = h('div.moods.gallery');
    if (PinisoPet.MOVES) {
      const nice = (m) => m.replace(/([A-Z])/g, ' $1').toLowerCase();
      PinisoPet.MOVES.forEach((m) => gal.append(h('button.chip', { text: nice(m), onclick: () => { if (stagePet.play) stagePet.play(m); PAudio.sfx(/flip|spin|jump|tada|level/.test(m) ? 'boing' : 'pop'); } })));
    }
    const party = h('button.btn.sm.pri', { text: '🎉 Dance party', onclick: () => {
      const seq = ['groove', 'twirl', 'cheer', 'robot', 'backflip', 'dance', 'tada'];
      seq.forEach((m, i) => setTimeout(() => stagePet.play && stagePet.play(m), i * 1500));
    } });
    const mode = PU.seg([['3d', '✨ 3D clay'], ['2d', '✏️ Classic 2D']], S.pet.render || '3d', async (v) => { await save({ pet: { render: v } }); location.reload(); });
    stage.append(...[bub, petHost, h('div.row', { style: { justifyContent: 'center', gap: '8px', margin: '6px 0 2px' } }, mode, party),
      h('div.small.muted', { text: 'Click me! Try moods & moves:' }), moods, reacts,
      PinisoPet.MOVES ? h('div.small.muted', { style: { marginTop: '8px' }, text: `🎬 Animation gallery — ${PinisoPet.MOVES.length} moves (3D):` }) : null, PinisoPet.MOVES ? gal : null].filter(Boolean));
    const ctr = h('div');
    const lvl = PINISO.levelFromXP(ST.xp);

    // themes
    const tc = card('Theme');
    const tg = h('div.themes');
    themeCards(tg, () => { route(); });
    tc.append(tg);
    const custom = h('div', { style: { marginTop: '14px' } });
    const t = PINISO.themeOf(S);
    const cbtn = h('button.btn.sm', { html: I('palette', 14) + (S.ui.theme === 'custom' ? 'Editing your custom theme' : 'Customise these colours'), onclick: () => save({ ui: { theme: 'custom', custom: Object.assign({}, PINISO.themeOf(S), { label: 'My theme' }) } }, true) });
    custom.append(cbtn);
    if (S.ui.theme === 'custom') {
      const cols = h('div.colors', { style: { marginTop: '12px' } });
      [['paper', 'Background'], ['paper2', 'Cards'], ['ink', 'Ink (text)'], ['muted', 'Soft text'], ['line', 'Lines'], ['accent', 'Accent'], ['accentInk', 'Text on accent']].forEach(([k, l]) => {
        const c = h('input', { type: 'color', value: toHex(t[k]) });
        c.oninput = () => document.documentElement.style.setProperty({ paper: '--paper', paper2: '--paper2', ink: '--ink', muted: '--muted', line: '--line', accent: '--acc', accentInk: '--acc-ink' }[k], c.value);
        c.onchange = () => save({ ui: { custom: { [k]: c.value } } });
        cols.append(h('label', null, c, l));
      });
      custom.append(cols,
        PU.row('Paper pattern', '', PU.seg([['ruled', 'Ruled'], ['grid', 'Grid'], ['dots', 'Dots'], ['plain', 'Plain']], t.pattern, (v) => save({ ui: { custom: { pattern: v } } }, true))),
        PU.row('Dark theme', 'Tells the page this is a dark design', PU.sw(!!t.dark, (v) => save({ ui: { custom: { dark: v } } }))));
    }
    tc.append(custom);
    tc.append(PU.row('Corners', 'Hand-drawn, soft or sharp', PU.seg([['sketchy', 'Sketchy'], ['round', 'Round'], ['sharp', 'Sharp']], S.ui.corners, (v) => save({ ui: { corners: v } }))),
      PU.row('Speech font', '', PU.seg([['hand', 'Handwritten'], ['sans', 'Clean'], ['serif', 'Serif'], ['mono', 'Typewriter']], S.ui.font, (v) => save({ ui: { font: v } }))),
      PU.row('Speech bubble', '', PU.seg([['sketch', 'Sketch'], ['comic', 'Comic'], ['minimal', 'Minimal']], S.ui.bubble, (v) => save({ ui: { bubble: v } }))));
    ctr.append(tc);

    // pet
    const pc = card('Your buddy');
    const name = h('input.inp', { value: S.pet.name, maxlength: 18, style: { width: '220px' } });
    name.onchange = () => save({ pet: { name: name.value.trim() || 'Piniso' } });
    pc.append(PU.row('Name', 'Shows on the desk and in speech bubbles', name));
    pc.append(PU.row('Colours follow the theme', 'Turn off to paint your own buddy', PU.sw(S.pet.followTheme, (v) => save({ pet: Object.assign({ followTheme: v }, v ? {} : PINISO.petOf(S)) }, true))));
    if (!S.pet.followTheme) {
      const cols = h('div.colors', { style: { margin: '6px 0 10px' } });
      [['body', 'Body'], ['outline', 'Outline'], ['cheeks', 'Cheeks'], ['pencil', 'Pencil'], ['eraser', 'Eraser']].forEach(([k, l]) => {
        const c = h('input', { type: 'color', value: toHex(S.pet[k]) });
        c.oninput = () => stagePet.setConfig({ [k]: c.value });
        c.onchange = () => save({ pet: { [k]: c.value } });
        cols.append(h('label', null, c, l));
      });
      pc.append(cols);
    }
    const accRow = (label, kind) => {
      const box = h('div.chips');
      PINISO.ACCESSORIES[kind].forEach(([v, l]) => {
        const need = PINISO.UNLOCKS[kind + ':' + v] || 0;
        const locked = need > lvl;
        const b = h('button.chip' + (S.pet[kind] === v ? '.on' : '') + (locked ? '.locked' : ''), { html: (locked ? I('lock', 12) : '') + esc(l), title: locked ? `Reach level ${need} to unlock` : '' });
        b.onclick = () => { if (locked) { PU.toast(`🔒 Reach level ${need} to unlock ${l}`); return; } [...box.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); save({ pet: { [kind]: v } }); stagePet.react('jump'); PAudio.sfx('pop'); };
        box.append(b);
      });
      return PU.row(label, '', box);
    };
    pc.append(accRow('Eyes', 'eyes'), accRow('Hat', 'hat'), accRow('Face', 'face'), accRow('Neck', 'neck'), accRow('Holding', 'hold'), accRow('Aura', 'aura'));
    const size = h('input', { type: 'range', min: 64, max: 160, step: 4, value: S.pet.size });
    size.onchange = () => save({ pet: { size: +size.value } });
    pc.append(PU.row('Size on the video page', '', h('div', { style: { width: '240px' } }, size)),
      PU.row('Movement', 'Calm saves battery', PU.seg([['calm', 'Calm'], ['normal', 'Normal'], ['hyper', 'Hyper']], S.pet.motion, (v) => save({ pet: { motion: v } }))),
      PU.row('Where I sit', 'You can always drag me anywhere', PU.seg([['corner', 'Screen corner'], ['video', 'On the video']], S.pet.position, (v) => save({ pet: { position: v } }))));
    ctr.append(pc);

    // share
    const sc = card('Share your design');
    const code = h('input.inp', { placeholder: 'Paste a PNS1-… design code here' });
    sc.append(h('p.small.muted', { text: 'Copy your design code and send it to friends — they paste it to get your exact Piniso.' }),
      h('div.row.wrap', null,
        h('button.btn', { html: I('dice', 15) + 'Randomize ✨', onclick: randomize }),
        h('button.btn', { html: I('copy', 15) + 'Copy design code', onclick: () => { navigator.clipboard.writeText(designCode()); PU.toast('Design code copied!'); } }),
        h('button.btn.ghost', { html: I('refresh', 15) + 'Reset look', onclick: () => save({ ui: PINISO.DEFAULTS.ui, pet: Object.assign({}, PINISO.DEFAULTS.pet, { name: S.pet.name }) }, true) })),
      h('div.row', { style: { marginTop: '10px' } }, code, h('button.btn', { text: 'Apply', onclick: () => applyCode(code.value) })));
    ctr.append(sc);
    wrap.append(stage, ctr);
    main.append(wrap);
  }
  function toHex(c) {
    if (!c) return '#000000';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((x) => x + x).join('');
    const d = document.createElement('div'); d.style.color = c; document.body.append(d);
    const m = getComputedStyle(d).color.match(/\d+/g) || [0, 0, 0]; d.remove();
    return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('');
  }
  function designCode() {
    const d = { ui: { theme: S.ui.theme, custom: S.ui.custom, corners: S.ui.corners, font: S.ui.font, bubble: S.ui.bubble }, pet: Object.assign({}, S.pet) };
    return 'PNS1-' + btoa(unescape(encodeURIComponent(JSON.stringify(d))));
  }
  function applyCode(c) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(String(c).trim().replace(/^PNS1-/, '')))));
      const pet = Object.assign({}, d.pet || {}, { name: (d.pet && d.pet.name) || S.pet.name });
      const lvl = PINISO.levelFromXP(ST.xp);
      ['hat', 'face', 'neck', 'hold', 'aura'].forEach((k) => { if ((PINISO.UNLOCKS[k + ':' + pet[k]] || 0) > lvl) pet[k] = PINISO.DEFAULTS.pet[k]; });
      save({ ui: d.ui || {}, pet }, true);
      PU.toast('Design applied ✨');
    } catch (e) { PU.toast('That code does not look right'); }
  }
  function randomize() {
    const lvl = PINISO.levelFromXP(ST.xp);
    const pick = (kind) => { const ok = PINISO.ACCESSORIES[kind].filter(([v]) => (PINISO.UNLOCKS[kind + ':' + v] || 0) <= lvl); return ok[Math.floor(Math.random() * ok.length)][0]; };
    const themes = Object.keys(PINISO.THEMES);
    save({ ui: { theme: themes[Math.floor(Math.random() * themes.length)], corners: ['sketchy', 'round', 'sharp'][Math.floor(Math.random() * 3)] }, pet: { followTheme: true, eyes: pick('eyes'), hat: pick('hat'), face: Math.random() < 0.5 ? 'none' : pick('face'), neck: Math.random() < 0.5 ? 'none' : pick('neck'), hold: pick('hold') } }, true);
    PAudio.sfx('confetti');
  }

  // ======================================================== SOUND
  function renderSound() {
    main.append(header('Music & <em>sounds</em>', 'All music and sound effects are made live by code — no copyrighted tracks. The lecture audio always stays clear.'));
    const m = card('Study music');
    const grid = h('div.chips');
    const em = { off: '🔇', lofi: '🎧', rain: '🌧️', brown: '🌊', forest: '🌲', space: '🌌', examhall: '⏱️' };
    PINISO.MUSIC_MODES.forEach(([k, l]) => grid.append(h('button.chip' + (S.sound.music === k ? '.on' : ''), { html: `${em[k]} ${esc(l)}`, onclick: (e) => { [...grid.children].forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); save({ sound: { music: k } }); PAudio.setVolumes({ master: S.sound.master, music: S.sound.musicVol }); PAudio.music(k); PAudio.duck(false); } })));
    m.append(h('p.small.muted', { text: 'Click a mode to preview it here.' }), grid,
      h('div', { style: { margin: '8px 0' } }, h('button.btn.sm', { html: I('pause', 14) + 'Stop preview', onclick: () => PAudio.stopMusic() })),
      PU.row('Play music during', '“Breaks” = quizzes and break time. Music gets quieter while the lecture plays.', PU.seg([['breaks', 'Breaks & quizzes'], ['paused', 'When paused'], ['always', 'Always (soft)']], S.sound.musicWhen, (v) => save({ sound: { musicWhen: v } }))));
    const vol = (k, label) => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S.sound[k] }); r.oninput = () => PAudio.setVolumes({ master: k === 'master' ? +r.value : S.sound.master, music: k === 'musicVol' ? +r.value : S.sound.musicVol, sfx: k === 'sfxVol' ? +r.value : S.sound.sfxVol }); r.onchange = () => save({ sound: { [k]: +r.value } }); return PU.row(label, '', h('div', { style: { width: '260px' } }, r)); };
    m.append(vol('master', 'Master volume'), vol('musicVol', 'Music volume'));
    main.append(m);
    const sx = card('Sound effects');
    sx.append(PU.row('Sound effects', 'Pops, dings, scribbles, level-ups', PU.sw(S.sound.sfx, (v) => save({ sound: { sfx: v } }))), PU.row('Talking blips', 'Cute little sounds while Piniso “types”', PU.sw(S.sound.blips, (v) => save({ sound: { blips: v } }))), vol('sfxVol', 'Effects volume'));
    const g = h('div.sfxgrid');
    ['pop', 'ding', 'womp', 'scribble', 'whoosh', 'levelup', 'boing', 'chime', 'confetti', 'stamp', 'snore', 'yawn', 'error'].forEach((n) => g.append(h('button.chip', { text: '▶ ' + n, onclick: () => { PAudio.setVolumes({ master: S.sound.master, sfx: S.sound.sfxVol }); PAudio.sfx(n); } })));
    sx.append(h('p.small.muted', { text: 'Test them:' }), g);
    main.append(sx);
    const tt = card('Piniso’s voice');
    const vs = h('select.inp', { style: { maxWidth: '320px' } });
    const fill = () => { vs.innerHTML = ''; vs.append(h('option', { value: '', text: 'Automatic (best Indian English / Hindi voice)' })); PAudio.voices().forEach((v) => vs.append(h('option', { value: v.name, text: `${v.name} (${v.lang})`, selected: S.sound.voice === v.name }))); };
    fill(); try { speechSynthesis.onvoiceschanged = fill; } catch (e) {}
    vs.onchange = () => save({ sound: { voice: vs.value } });
    tt.append(PU.row('Read comments aloud', 'Uses your browser’s built-in voices (free, offline)', PU.sw(S.sound.tts, (v) => save({ sound: { tts: v } }))),
      PU.row('When', '', PU.seg([['paused', 'Only when video is paused'], ['always', 'Always (lowers lecture volume)']], S.sound.ttsWhen, (v) => save({ sound: { ttsWhen: v } }))),
      PU.row('Voice', '', vs),
      h('button.btn.sm', { html: I('volume', 14) + 'Test voice', onclick: () => PAudio.speak(PMd.plain(PLines.pick(PLines.langFor(S.lang.comments), 'start', { name: S.pet.name }).replace('{name}', S.pet.name)), { lang: S.lang.comments, voice: S.sound.voice }) }));
    main.append(tt);
  }

  // ======================================================== LIBRARY
  async function renderLibrary() {
    main.append(header('Notes <em>library</em>', 'Every lecture you studied with Piniso, with notes, flashcards and quiz history.'));
    const list = await PStore.listSessions();
    const q = h('input.inp', { placeholder: 'Search lectures and topics…', style: { maxWidth: '420px' } });
    const book = h('a.btn.pri', { href: chrome.runtime.getURL('pages/booklet.html'), target: '_blank', html: '📘 Make a study booklet (PDF)' });
    main.append(h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' } }, q, book));
    const box = card('');
    const draw = () => {
      box.innerHTML = '';
      const term = q.value.trim().toLowerCase();
      const rows = list.filter((x) => !term || (x.title + ' ' + x.topic + ' ' + x.site).toLowerCase().includes(term));
      if (!rows.length) box.append(h('p.muted', { text: list.length ? 'No match.' : 'No lectures yet.' }));
      rows.forEach((x) => {
        const r = sessRow(x);
        r.append(h('button.btn.sm.ghost.danger', { html: I('trash', 14), title: 'Delete', onclick: async () => { if (!confirm('Delete notes for “' + x.title + '”?')) return; await PStore.deleteSession(x.key); list.splice(list.indexOf(x), 1); draw(); } }));
        box.append(r);
      });
    };
    q.oninput = draw;
    draw();
    main.append(box);
  }

  // ======================================================== REVISE (spaced repetition)
  async function renderRevise() {
    main.append(header('Revise <em>cards</em>', 'Spaced repetition: cards you find hard come back sooner, easy ones later. 5 minutes a day = exam-ready.'));
    const all = await PStore.cards();
    const now = Date.now();
    let queue = all.filter((c) => c.due <= now).sort((a, b) => a.due - b.due);
    const wrap = h('div.rev');
    main.append(wrap);
    const info = h('div.row', { style: { marginBottom: '12px' } }, h('span.pill.acc', { text: `${queue.length} due` }), h('span.pill', { text: `${all.length} total` }), h('span.sp'));
    wrap.append(info);
    const stage = h('div');
    wrap.append(stage);
    let done = 0;
    const iv = (c, g) => { const x = PStore.schedule(Object.assign({}, c), g); const d = (x.due - Date.now()) / 86400000; return d < 0.02 ? '10m' : d < 1 ? Math.round(d * 24) + 'h' : Math.round(d) + 'd'; };
    const show = () => {
      stage.innerHTML = '';
      if (!queue.length) {
        const p = h('div', { style: { display: 'flex', justifyContent: 'center' } });
        const pet = PinisoPet.create(p, Object.assign(PU.petCfg(S), { size: 140 }));
        pet.setMood(done ? 'celebrate' : 'cool');
        stage.append(h('div.fcard.paper', null, p, h('div.hand', { text: done ? `Done! ${done} cards revised 🎉` : 'Nothing due right now 😎' }), h('p.muted', { text: all.length ? 'Come back later — I’ll keep the badge count on my icon.' : 'Watch a lecture with Piniso and cards will appear here.' })));
        if (done) PAudio.sfx('levelup');
        return;
      }
      const c = queue[0];
      const f = h('div.fcard.paper', null, h('span.lab', { text: 'QUESTION' }), h('div', { html: PMd.render(c.q) }));
      if (c.src && c.src.title) f.append(h('div.src', { text: '📺 ' + c.src.title + (c.src.t ? ' · ' + PU.fmt(c.src.t) : '') }));
      const btn = h('button.btn.pri.wide', { style: { marginTop: '14px' }, text: 'Show answer (Space)' });
      const reveal = () => {
        f.append(h('div.ans', { html: PMd.render(c.a) }));
        btn.remove();
        const g = h('div.grades');
        [['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]].forEach(([l, gr]) => g.append(h('button.btn' + (gr === 2 ? '.pri' : ''), { html: `${l}<small>${iv(c, gr)} · ${gr + 1}</small>`, onclick: () => grade(gr) })));
        stage.append(g);
        PAudio.sfx('click');
      };
      const grade = async (gr) => {
        PStore.schedule(c, gr);
        const list = await PStore.cards();
        const i = list.findIndex((x) => x.id === c.id);
        if (i >= 0) list[i] = c;
        await PStore.saveCards(list);
        queue.shift();
        if (gr === 0) queue.push(c);
        done++;
        PStore.updateStats((st) => { st.reviews++; st.xp += 2; PStore.bumpDay(st, 'cards'); st._settings = S; });
        PAudio.sfx(gr === 0 ? 'womp' : 'ding');
        info.firstChild.textContent = `${queue.length} due`;
        show();
        PU.bg({ type: 'badge' });
      };
      btn.onclick = reveal;
      stage.append(f, btn);
      document.onkeydown = (e) => {
        if (e.target.tagName === 'INPUT' || location.hash !== '#revise') return;
        if (e.code === 'Space' && btn.isConnected) { e.preventDefault(); reveal(); }
        else if (/^[1-4]$/.test(e.key) && !btn.isConnected && stage.querySelector('.grades')) grade(+e.key - 1);
      };
    };
    show();
    // browse
    const br = card('All cards');
    const tbl = h('table.tbl');
    tbl.innerHTML = '<tr><th>QUESTION</th><th>ANSWER</th><th>NEXT</th><th></th></tr>';
    all.slice().reverse().slice(0, 300).forEach((c) => {
      const tr = h('tr', { html: `<td>${PMd.inline(c.q)}</td><td>${PMd.inline(c.a)}</td><td class="small muted">${c.due <= now ? 'due' : new Date(c.due).toLocaleDateString()}</td>` });
      const td = h('td');
      td.append(h('button.btn.sm.ghost', { html: I('trash', 13), onclick: async () => { const l = (await PStore.cards()).filter((x) => x.id !== c.id); await PStore.saveCards(l); tr.remove(); PU.bg({ type: 'badge' }); } }));
      tr.append(td); tbl.append(tr);
    });
    br.append(all.length ? tbl : h('p.muted', { text: 'No cards yet.' }));
    wrap.append(h('div', { style: { height: '22px' } }), br);
  }

  // ======================================================== PROGRESS
  function renderProgress() {
    const lvl = PINISO.levelFromXP(ST.xp), cur = PINISO.xpForLevel(lvl), nxt = PINISO.xpForLevel(lvl + 1);
    main.append(header('Your <em>progress</em>', 'XP comes from studying (1 per minute), quizzes, doubts, board snaps and revision.'));
    const lc = card(`Level ${lvl} · <em>${esc(PINISO.levelTitle(lvl))}</em>`);
    lc.append(h('div.bar', { html: `<i style="width:${Math.max(2, Math.min(100, (ST.xp - cur) / (nxt - cur) * 100))}%"></i>` }), h('p.small.muted', { text: `${ST.xp} XP · ${nxt - ST.xp} XP to level ${lvl + 1} (${PINISO.levelTitle(lvl + 1)})` }));
    const unl = Object.entries(PINISO.UNLOCKS).map(([k, l]) => `<span class="pill ${l <= lvl ? 'ok' : ''}">${l <= lvl ? '✓' : '🔒'} Lv ${l}: ${esc(k.split(':')[1])}</span>`).join(' ');
    lc.append(h('div.row.wrap', { html: unl }));
    main.append(lc);
    const g = h('div.grid3', { style: { marginBottom: '18px' } });
    const stat = (v, l) => h('div.stat', { html: `<b>${esc(v)}</b><span>${esc(l)}</span>` });
    const qa = ST.quiz.total ? Math.round(ST.quiz.correct / ST.quiz.total * 100) + '%' : '—';
    g.append(stat(PU.dur(ST.totalSeconds), 'total focused study'), stat(PStore.streak(ST) + (PStore.streak(ST) === 1 ? ' day' : ' days'), 'current streak'), stat(String(ST.sessions), 'lectures'),
      stat(qa, `quiz accuracy (${ST.quiz.correct}/${ST.quiz.total})`), stat(String(ST.notes), 'notes made'), stat(String(ST.doubts), 'doubts asked'));
    main.append(g);
    const hc = card('Study calendar');
    const heat = h('div.heat');
    const d = new Date(); d.setDate(d.getDate() - 7 * 17 - d.getDay());
    const goal = (S.focus.dailyGoal || 60) * 60;
    for (let i = 0; i < 7 * 18; i++) {
      const k = PStore.todayKey(d), v = ST.days[k] || 0;
      const lv = v <= 0 ? 0 : v < goal * 0.33 ? 1 : v < goal * 0.66 ? 2 : v < goal ? 3 : 4;
      heat.append(h('i', { title: `${k}: ${Math.round(v / 60)} min`, style: { background: lv ? `color-mix(in srgb, var(--acc) ${[0, 30, 55, 80, 100][lv]}%, var(--paper2))` : '', borderColor: lv === 4 ? 'var(--ink)' : '' } }));
      d.setDate(d.getDate() + 1);
      if (d > new Date()) break;
    }
    hc.append(heat, h('p.small.muted', { text: 'Darker = closer to your daily goal.' }));
    main.append(hc);
    // weak-topic heatmap + mistake notebook (from every lecture)
    const wk = card('Weak-topic <em>heatmap</em>');
    const wbox = h('div.wheat', { text: 'Loading…' });
    wk.append(wbox, h('p.small.muted', { text: 'Colour = quiz accuracy (red weak → green strong). Faded = not revised for a while. Click to rewatch.' }));
    main.append(wk);
    const mk = card('Mistake <em>notebook</em>');
    const mbox = h('div.mbook', { text: 'Loading…' });
    mk.append(mbox, h('div.row', { style: { marginTop: '10px', gap: '8px' } }, h('a.btn.pri', { href: chrome.runtime.getURL('pages/cram.html#mistakes'), target: '_blank', text: '🔁 Practise my mistakes' }), h('a.btn', { href: chrome.runtime.getURL('pages/cram.html'), target: '_blank', text: '🌙 Night-before mode' })));
    main.append(mk);
    (async () => {
      const rows = (await PStore.listSessions()).filter((r) => r.study !== false && (r.notes > 0 || r.quizzes > 0)).slice(0, 40);
      const topics = [], wrong = [];
      for (const r of rows) {
        const se = await PStore.getSession(r.key);
        if (!se) continue;
        const items = (se.quizzes || []).flatMap((q) => (q.items || []).map((x) => Object.assign({ at: q.at }, x)));
        items.filter((x) => !x.correct).forEach((x) => wrong.push({ q: x.q, a: x.answer, user: x.user, title: se.title, key: se.key, t: x.t, vid: se.vid || ((se.key.match(/^yt:(.+)$/) || [])[1]), url: se.url, at: x.at }));
        const by = {};
        (se.notes || []).forEach((n) => { const tp = n.topic || se.topic || 'Notes'; (by[tp] = by[tp] || { t: n.t, notes: 0 }).notes++; });
        Object.entries(by).forEach(([tp, v]) => {
          const qs = items.filter((x) => x.t == null || Math.abs(x.t - v.t) < 600);
          const acc = qs.length ? qs.filter((x) => x.correct).length / qs.length : null;
          topics.push({ tp, acc, n: qs.length, t: v.t, title: se.title, age: (Date.now() - r.updatedAt) / 86400000, url: se.vid ? `https://www.youtube.com/watch?v=${se.vid}&t=${Math.max(0, Math.round(v.t - 5))}s` : se.url });
        });
      }
      wbox.innerHTML = '';
      if (!topics.length) wbox.append(h('div.muted', { text: 'Study a lecture and take a quiz to see your map.' }));
      topics.sort((a, b) => (a.acc == null ? 2 : a.acc) - (b.acc == null ? 2 : b.acc)).slice(0, 60).forEach((x) => {
        const col = x.acc == null ? 'var(--paper)' : `hsl(${Math.round(x.acc * 120)} 70% 62%)`;
        wbox.append(h('a.wt', { href: x.url, target: '_blank', title: `${x.title}
${x.acc == null ? 'no quiz yet' : Math.round(x.acc * 100) + '% right (' + x.n + ' questions)'} · ${Math.round(x.age)} days ago`, style: { background: col, opacity: x.age > 14 ? 0.55 : 1 } }, h('b', { text: x.tp.slice(0, 32) }), h('span', { text: x.acc == null ? '—' : Math.round(x.acc * 100) + '%' })));
      });
      mbox.innerHTML = '';
      if (!wrong.length) mbox.append(h('div.muted', { text: 'No mistakes saved yet. Every wrong quiz answer lands here with the right answer and the moment to rewatch.' }));
      wrong.sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30).forEach((x) => mbox.append(h('div.mk', null,
        h('div', { html: `<b>${PMd.inline(x.q)}</b>` }),
        h('div.small', { html: `${x.user ? `<s class="muted">${esc(String(x.user).slice(0, 80))}</s> → ` : ''}✅ ${PMd.inline(String(x.a || ''))}` }),
        h('div.small.muted', null, (x.t != null && x.vid) ? h('a', { href: `https://www.youtube.com/watch?v=${x.vid}&t=${Math.max(0, Math.round(x.t - 10))}s`, target: '_blank', text: '▶ rewatch ' + PU.fmt(x.t) }) : null, ' · ' + x.title.slice(0, 60)))));
    })();
    const bc = card('Badges');
    const bg = h('div.badges');
    Object.entries(PINISO.BADGES).forEach(([id, b]) => bg.append(h('div.bd' + (ST.badges[id] ? '' : '.off'), { html: `<div class="e">${b.icon}</div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>` })));
    bc.append(bg);
    main.append(bc);
  }

  // ======================================================== SHORTCUTS
  async function renderKeys() {
    main.append(header('Keyboard <em>shortcuts</em>', 'Change them on the browser’s shortcuts page.'));
    const c = card('');
    const cmds = await chrome.commands.getAll();
    const t = h('table.tbl', { html: '<tr><th>ACTION</th><th>SHORTCUT</th></tr>' + cmds.filter((x) => x.name !== '_execute_action').map((x) => `<tr><td>${esc(x.description)}</td><td>${x.shortcut ? `<span class="kb">${esc(x.shortcut)}</span>` : '<span class="muted">not set</span>'}</td></tr>`).join('') + '<tr><td>Star this moment (on the video page)</td><td><span class="kb">Alt+Shift+M</span></td></tr><tr><td>Open notes (on the video page)</td><td><span class="kb">Alt+Shift+N</span></td></tr><tr><td>Answer quiz options</td><td><span class="kb">1</span>–<span class="kb">4</span> or <span class="kb">A</span>–<span class="kb">D</span>, <span class="kb">T</span>/<span class="kb">F</span>, <span class="kb">Enter</span> next, <span class="kb">Esc</span> close</td></tr>' });
    c.append(t, h('div', { style: { marginTop: '12px' } }, h('button.btn', { text: 'Open browser shortcut settings', onclick: () => chrome.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' }) })));
    main.append(c);
  }

  // ======================================================== PRIVACY
  function renderPrivacy() {
    main.append(header('Privacy & <em>data</em>', 'Short version: everything stays on your computer.'));
    main.append(card('What Piniso does with your data', h('ul.clean', { html: [
      'Your notes, flashcards, stats and settings are saved <b>only in this browser</b> (local extension storage). There is no Piniso server and no account.',
      'Your API keys are stored locally and are sent <b>only</b> to the AI provider you choose (Groq, Google, OpenAI, OpenRouter or your own server).',
      'To make notes, Piniso sends <b>short parts of the lecture captions</b> (and a screenshot only when you press “Snap board”) to that AI provider.',
      '“Listen” mode records the lecture tab’s audio in ~25-second pieces and sends them to your speech-to-text provider. It never uses your microphone.',
      'Voice talk sends your microphone audio to your chosen voice AI only while the talk panel is open. Study Anything sends the shared window’s audio and screenshots only while you share.', 'Guardian blocks sites inside your browser; Piniso never reads or stores your browsing history.', 'No analytics, no ads, no tracking. Piniso runs on study sites, on pages where you click “Start Piniso”, or on every site if you turn that on.'
    ].map((x) => `<li>${x}</li>`).join('') })));
    const c = card('Backup & reset');
    const file = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.app !== 'piniso') throw new Error('Not a Piniso backup');
        const items = data.items || {};
        if (items.settings && items.settings.ai) items.settings.ai.keys = (await PStore.settings()).ai.keys;
        await PStore.set(items);
        PU.toast('Backup restored ✓'); setTimeout(() => location.reload(), 800);
      } catch (e) { PU.toast('Could not import: ' + e.message); }
    };
    c.append(h('p.small.muted', { text: 'Backups include notes, cards, stats and settings — but never your API keys.' }),
      h('div.row.wrap', null,
        h('button.btn', { html: I('download', 15) + 'Download backup', onclick: async () => {
          const all = await new Promise((r) => chrome.storage.local.get(null, r));
          if (all.settings && all.settings.ai) all.settings.ai.keys = {};
          const blob = new Blob([JSON.stringify({ app: 'piniso', version: PINISO.VERSION, at: Date.now(), items: all })], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `piniso-backup-${PStore.todayKey()}.json`; a.click();
        } }),
        h('button.btn', { html: I('refresh', 15) + 'Restore backup', onclick: () => file.click() }),
        h('button.btn.danger', { html: I('trash', 15) + 'Erase everything', onclick: async () => { if (!confirm('Erase ALL Piniso notes, cards, stats and settings?')) return; await new Promise((r) => chrome.storage.local.clear(r)); PU.toast('Erased'); setTimeout(() => location.reload(), 700); } })), file);
    main.append(c);
    main.append(card('About', h('p', { html: `Piniso v${PINISO.VERSION} — a product of <b>Eka</b>. Fonts: Caveat, DM Sans, Instrument Serif, JetBrains Mono (SIL OFL). Math rendering: KaTeX (MIT). Mascot, animations, music and sound effects are all original code.` })));
  }

  // ======================================================== router
  async function route() {
    const id = (location.hash || '#home').slice(1);
    document.onkeydown = null;
    if (stagePet) { stagePet.destroy(); stagePet = null; }
    PAudio.stopMusic();
    main.innerHTML = '';
    window.scrollTo(0, 0);
    await drawNav();
    if (id === 'welcome' || (!S.onboarded && id === 'home')) return renderWelcome(0);
    const fn = { voice: renderVoice, guardian: renderGuardian, home: renderHome, brain: renderBrain, study: renderStudy, design: renderDesign, sound: renderSound, library: renderLibrary, revise: renderRevise, progress: renderProgress, keys: renderKeys, privacy: renderPrivacy }[id] || renderHome;
    await fn();
  }
  window.addEventListener('hashchange', route);
  route();
})();
