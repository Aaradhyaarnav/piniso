/* Piniso v4 — "make it a verb".
   ⌘ Command bar (Ctrl+K): every tool + video commands typed in plain words.
   ✏️ "Piniso karo" kickoff: one tap + a 3-2-1 pencil countdown instead of a form.
   🫥 Smart dodge: Piniso hops away from subtitles.
   ↩️ Undo for deleted notes.
   🌟 Golden moments: rare surprise rewards for right answers.
   🌱 Growth stages: Piniso grows with your study hours.
   📱 Revise on phone: flashcards as one offline HTML file. */
(() => {
  if (PZ.V4) return;
  const h = PZ.h, esc = (x) => PMd.esc(String(x == null ? '' : x)), I = (n, s) => PIcons.svg(n, s);

  // ---------------- growth stages (study hours) ----------------
  const STAGES = [
    { h: 0, n: 'Seed', e: '🌰', d: 'Just planted. Every minute counts.' },
    { h: 2, n: 'Sprout', e: '🌱', d: '2 hours of study — roots are forming.' },
    { h: 10, n: 'Sapling', e: '🌿', d: '10 hours — real habits now.' },
    { h: 30, n: 'Scholar', e: '📚', d: '30 hours — you study like a topper.' },
    { h: 80, n: 'Sage', e: '🦉', d: '80 hours — teachers ask you doubts now.' },
    { h: 200, n: 'Legend', e: '👑', d: '200 hours — Piniso bows to you.' }
  ];
  const stageOf = (sec) => { const hrs = (sec || 0) / 3600; let k = 0; STAGES.forEach((s, i) => { if (hrs >= s.h) k = i; }); return k; };

  // words students type for a tool (English + Hinglish)
  const ALIAS = {
    notes: 'notes likho write live', ask: 'doubt question sawal puchho explain', snipe: 'board screen box crop', lost: 'confused samajh nahi aaya lost',
    mark: 'star important imp zaroori', simple: 'eli5 easy simple samjhao', talk: 'voice speak bolo call', listen: 'audio hear captions',
    quiz: 'test mcq question', vquiz: 'viva oral voice', recall: 'revise memory yaad', clean: 'tidy neat clean', booklet: 'pdf print book booklet',
    cheat: 'summary short one page', report: 'finish end result score', cards: 'flashcards revise anki', makecards: 'flashcards make generate',
    reviseall: 'revision due all', drills: 'formula drill speed', night: 'exam tomorrow cram raat', mistakes: 'wrong galti errors',
    lock: 'block instagram reels focus', sprint: 'pomodoro timer', break: 'rest chai water', music: 'lofi song rain noise',
    float: 'pip window top', fullscreen: 'full screen', meme: 'funny meme joke', share: 'status share image', wrapped: 'week stats',
    recapaudio: 'audio summary podcast', anywhere: 'zoom pdf app desktop', keys: 'keyboard shortcuts hotkeys', settings: 'options key api theme',
    phone: 'mobile phone whatsapp offline cards', grow: 'level stage grow tree', warmup: 'warm up start', mission: 'today goals', videos: 'watchlist continue up next'
  };

  const parseTime = (s) => {
    const m = String(s).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    return m[3] != null ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
  };
  const dur = (n, unit) => (/^m/i.test(unit || '') ? n * 60 : n);

  class V4 {
    constructor(app) {
      this.app = app;
      this.goldenAt = 0;
      // ↩️ undo for deleted notes
      const del = app.deleteNote.bind(app);
      app.deleteNote = (id) => {
        const s = app.session; if (!s) return;
        const i = s.notes.findIndex((n) => n.id === id), n = s.notes[i];
        del(id);
        if (n && app.ui) app.ui.toast('Note deleted', { icon: 'trash', action: { label: 'Undo', onClick: () => { if (s.notes.some((x) => x.id === n.id)) return; s.notes.splice(Math.min(i, s.notes.length), 0, n); app.ui.refresh(['notes']); app.updateYtMarks(); app.save(); PAudio.sfx('pop'); } } });
      };
      // 🌟 golden moments ride on right answers
      const ans = app.onQuizAnswer.bind(app);
      app.onQuizAnswer = (correct, score, q) => { ans(correct, score, q); if (correct) this.maybeGolden('quiz'); };
    }
    on(k) { const v = (this.app.settings.v4 || {})[k]; return v !== false; }

    // =====================================================================
    // ⌘ Command bar
    // =====================================================================
    commands(q) {
      const app = this.app, v = app.video, out = [];
      const s = q.trim();
      if (!s) return out;
      let m;
      if ((m = s.match(/^(?:speed|rate|chalao)\s*(\d+(?:\.\d+)?)\s*x?$/i) || s.match(/^(\d(?:\.\d+)?)\s*x$/i))) {
        const r = PZ.clamp(+m[1], 0.25, 4);
        out.push({ e: '⏩', n: `Speed ${r}×`, d: 'Change the video speed', run: () => { if (v && v.setRate) { v.setRate(r); app.ui.toast(`Speed ${r}× ⏩`); } else app.ui.toast('Can’t change speed on this player'); } });
      }
      if ((m = s.match(/^(?:go\s*to|goto|jump(?:\s*to)?|@)?\s*(\d{1,2}:\d{2}(?::\d{2})?)$/i))) {
        const t = parseTime(m[1]);
        if (t != null) out.push({ e: '🎯', n: `Go to ${m[1]}`, d: 'Jump the video to this time', run: () => { if (v) { v.seek(t); app.ui.toast('Jumped to ' + m[1]); } } });
      }
      if ((m = s.match(/^(?:back|rewind|peeche|-)\s*(\d+)\s*(s|sec|secs|seconds|m|min|mins|minutes)?$/i))) {
        const d = dur(+m[1], m[2]);
        out.push({ e: '⏪', n: `Back ${d >= 60 ? Math.round(d / 60) + ' min' : d + ' s'}`, d: 'Rewind the video', run: () => { if (v) v.seek(Math.max(0, v.t - d)); } });
      }
      if ((m = s.match(/^(?:forward|skip|aage|\+)\s*(\d+)\s*(s|sec|secs|seconds|m|min|mins|minutes)?$/i))) {
        const d = dur(+m[1], m[2]);
        out.push({ e: '⏩', n: `Forward ${d >= 60 ? Math.round(d / 60) + ' min' : d + ' s'}`, d: 'Skip ahead', run: () => { if (v) v.seek(v.t + d); } });
      }
      if (/^(dance|nacho|party)$/i.test(s)) out.push({ e: '💃', n: 'Piniso, dance!', d: 'A little dance break', run: () => app.ui.play('dance') });
      if ((m = s.match(/^(?:move|do|play)\s+([a-z]+)$/i)) && globalThis.PinisoPet && PinisoPet.MOVES) {
        const nm = PinisoPet.MOVES.find((x) => x.toLowerCase() === m[1].toLowerCase()) || PinisoPet.MOVES.find((x) => x.toLowerCase().startsWith(m[1].toLowerCase()));
        if (nm) out.push({ e: '🎬', n: 'Piniso: ' + nm, d: 'Play this animation', run: () => app.ui.play(nm) });
      }
      if (/^(pause|ruko|stop)$/i.test(s)) out.push({ e: '⏸️', n: 'Pause video', d: '', run: () => v && v.pause() });
      if (/^(play|chalo|resume)$/i.test(s)) out.push({ e: '▶️', n: 'Play video', d: '', run: () => v && v.play() });
      if ((m = s.match(/^(?:note|n|likho)\s*[:\-]\s*(.+)$/i))) out.push({ e: '✍️', n: 'Add note', d: m[1], run: () => { if (!app.session) return app.ui.toast('Open a lecture first'); app.addUserNote(m[1]); app.ui.toast('Note added ✍️'); } });
      if ((m = s.match(/^(?:card|flashcard)\s*[:\-]\s*(.+?)\s*[|=]\s*(.+)$/i))) out.push({ e: '🃏', n: 'Add flashcard', d: m[1] + ' → ' + m[2], run: () => { if (!app.session) return app.ui.toast('Open a lecture first'); app.addCard(m[1], m[2]); } });
      if ((m = s.match(/^(?:timer|sprint|focus|pomodoro)\s*(\d+)/i))) { const n = PZ.clamp(+m[1], 5, 180); out.push({ e: '⏱️', n: `${n}-min focus sprint`, d: 'Timer + Guardian on', run: () => app.startSprint(n) }); }
      if ((m = s.match(/^(?:ask|\?|puchho)\s*[:\-]?\s*(.+)$/i))) out.push({ e: '💬', n: 'Ask Piniso', d: m[1], run: () => this.askNow(m[1]) });
      return out;
    }
    askNow(text) {
      const app = this.app;
      if (!app.session) { app.ui.toast('Open a lecture first'); return; }
      app.ui.openDesk('ask');
      app.ask(text, false);
    }
    toolList() {
      const app = this.app;
      return (PZ.Magic.TOOLS || []).map((t) => ({ id: t.id, e: t.e, n: t.n, d: t.d, k: t.k, off: !t.any && !app.session, run: () => app.magic.run(t.id), al: ALIAS[t.id] || '' }));
    }
    score(t, q) {
      const n = t.n.toLowerCase(), d = (t.d || '').toLowerCase(), al = t.al || '';
      if (n === q) return 100;
      if (n.startsWith(q)) return 80;
      if (n.split(/\s+/).some((w) => w.startsWith(q))) return 65;
      if (al.split(/\s+/).some((w) => w.startsWith(q))) return 55;
      if (n.includes(q)) return 45;
      if (d.includes(q)) return 30;
      // letters in order (fuzzy): "bkt" → booklet
      let i = 0; for (const c of n) if (c === q[i]) i++;
      return i === q.length && q.length >= 3 ? 15 : 0;
    }
    results(qIn) {
      const app = this.app, q = qIn.trim().toLowerCase();
      const groups = [];
      const cmd = this.commands(qIn);
      if (cmd.length) groups.push(['Do it', cmd]);
      const tools = this.toolList();
      if (!q) {
        const rec = ((app.stats && app.stats.cmdRecent) || []).map((id) => tools.find((t) => t.id === id)).filter(Boolean).slice(0, 4);
        if (rec.length) groups.push(['Recent', rec]);
        const next = app.magic.nextTrick && app.magic.nextTrick();
        const nt = next && tools.find((t) => t.id === next);
        groups.push(['Try typing', [
          { e: '⏩', n: 'speed 1.5', d: 'change speed', fill: 'speed 1.5' },
          { e: '🎯', n: 'go to 12:30', d: 'jump to a time', fill: 'go to ' },
          { e: '✍️', n: 'note: …', d: 'save a note fast', fill: 'note: ' },
          { e: '🔎', n: 'find …', d: 'search your notes', fill: 'find ' }
        ]]);
        if (nt) groups.push(['New trick for you', [Object.assign({}, nt, { badge: 'TRY' })]]);
        groups.push(['All tools', tools.filter((t) => !t.off)]);
        return groups;
      }
      // notes search: "find x" or any word with 3+ letters
      const fm = q.match(/^(?:find|search|dhundo)\s+(.+)$/);
      const nq = fm ? fm[1] : q.length >= 3 && !cmd.length ? q : '';
      const tl = fm ? [] : tools.map((t) => [this.score(t, q), t]).filter(([sc]) => sc > 0).sort((a, b) => b[0] - a[0]).map(([, t]) => t).slice(0, 8);
      if (tl.length) groups.push(['Tools', tl]);
      if (nq && app.session) {
        const hits = app.visibleNotes().filter((n) => PMd.plain(n.text).toLowerCase().includes(nq)).slice(0, 6)
          .map((n) => ({ e: '📝', n: PMd.plain(n.text).slice(0, 80), d: 'at ' + PZ.fmt(n.t) + ' · jump there', run: () => { app.seek(n.t, true); app.ui.openDesk('notes'); } }));
        if (hits.length) groups.push(['In your notes', hits]);
      }
      if (q && !cmd.length && app.session && q.length > 2) groups.push(['Ask', [{ e: '💬', n: 'Ask Piniso: “' + qIn.trim().slice(0, 60) + '”', d: 'Answer from this lecture', run: () => this.askNow(qIn.trim()) }]]);
      return groups;
    }
    remember(id) {
      if (!id) return;
      this.app.bumpStats((st) => { st.cmdRecent = [id].concat((st.cmdRecent || []).filter((x) => x !== id)).slice(0, 6); });
    }
    palette(initial) {
      const app = this.app;
      app.ensureUI();
      if (!app.ui) return;
      if (this.pal) { this.pal.close(); return; }
      if (app.magic.ov) app.magic.ov.close();
      const box = h('div.paper.cmdk');
      const inp = h('input.cmdk-in', { placeholder: 'Type a tool or a command… (speed 1.5 · go to 12:30 · note: …)', value: initial || '', spellcheck: 'false', autocomplete: 'off' });
      const list = h('div.cmdk-list', { role: 'listbox' });
      const st = app.stats || {}, k = stageOf(st.totalSeconds), S = STAGES[k];
      box.append(
        h('div.cmdk-top', null, h('span.cmdk-ic', { html: I('sparkle', 18) }), inp, h('span.cmdk-stage', { title: S.d, text: S.e + ' ' + S.n })),
        list,
        h('div.cmdk-foot', { html: '<span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> do it</span><span><kbd>Esc</kbd> close</span><span class="sp"></span><span>Ctrl + K anywhere</span>' }));
      let flat = [], sel = 0;
      const pick = (it) => {
        if (!it) return;
        if (it.fill != null) { inp.value = it.fill; draw(); inp.focus(); return; }
        close();
        if (it.off) { app.ui.toast('Open a lecture first, then ' + it.n.toLowerCase()); return; }
        this.remember(it.id);
        PAudio.sfx('pop');
        try { it.run && it.run(); } catch (e) { console.warn('[Piniso] cmd', e); }
      };
      const mark = () => { [...list.querySelectorAll('.cmdk-it')].forEach((el, i) => { el.classList.toggle('sel', i === sel); if (i === sel) el.scrollIntoView({ block: 'nearest' }); }); };
      const draw = () => {
        const groups = this.results(inp.value);
        list.innerHTML = ''; flat = [];
        groups.forEach(([label, items]) => {
          list.append(h('div.cmdk-g', { text: label }));
          items.forEach((it) => {
            const i = flat.length; flat.push(it);
            const row = h('button.cmdk-it' + (it.off ? '.off' : ''), { role: 'option', onclick: () => pick(it), onpointermove: () => { if (sel !== i) { sel = i; mark(); } } },
              h('span.ce', { text: it.e || '•' }), h('span.cn', null, h('b', { text: it.n }), it.d ? h('small', { text: it.d }) : null),
              it.badge ? h('span.cb', { text: it.badge }) : it.k ? h('kbd', { text: it.k }) : null);
            row.style.setProperty('--i', Math.min(i, 14));
            list.append(row);
          });
        });
        if (!flat.length) list.append(h('div.cmdk-none', { html: '🤷 Nothing found. Try <b>quiz</b>, <b>pdf</b>, <b>speed 2</b> or <b>note: …</b>' }));
        sel = 0; mark();
      };
      ['keyup', 'keypress'].forEach((ev) => inp.addEventListener(ev, (e) => e.stopPropagation()));
      inp.addEventListener('keydown', (e) => e.stopPropagation());
      inp.addEventListener('input', draw);
      const ov = this.pal = app.ui.overlay(box, {
        clickOut: true, onClose: () => { this.pal = null; },
        onKey: (e) => {
          if (e.key === 'ArrowDown') { sel = Math.min(flat.length - 1, sel + 1); mark(); return true; }
          if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); mark(); return true; }
          if (e.key === 'Enter') { pick(flat[sel]); return true; }
          if (e.key === 'Tab') { const it = flat[sel]; if (it && it.fill != null) { inp.value = it.fill; draw(); } return true; }
          return false;
        }
      });
      ov.el.classList.add('ov-top');
      const close = () => ov.close();
      draw();
      setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 40);
      PAudio.sfx('whoosh');
      app.magic.markUsed('cmdk');
    }

    // =====================================================================
    // ✏️ "Piniso karo" kickoff (replaces the long start form)
    // =====================================================================
    ritual() {
      const app = this.app, s = app.settings, hi = app.lang() === 'hinglish';
      return new Promise((res) => {
        const box = h('div.paper.kick');
        const petBox = h('div.kick-pet');
        const pet = PinisoPet.create(petBox, Object.assign({}, app.petCfg(), { size: 112 }));
        petBox.append(pet.el); pet.setMood('excited');
        let phone = !!s.v4phone, mins = s.v4sprint != null ? s.v4sprint : 25, goalOpen = false;
        const phoneBtn = h('button.kchip' + (phone ? '.on' : ''), { html: '📵 Phone away <small>+3 XP</small>', onclick: () => { phone = !phone; phoneBtn.classList.toggle('on', phone); PAudio.sfx('click'); pet.react('nod'); } });
        const seg = h('div.kseg');
        [[0, 'No timer'], [25, '25 min'], [45, '45 min'], [60, '60 min']].forEach(([v, l]) => seg.append(h('button' + (v === mins ? '.on' : ''), { text: l, onclick: (e) => { mins = v; [...seg.children].forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); PAudio.sfx('click'); } })));
        const goal = h('input.inp.kgoal', { placeholder: 'e.g. finish this chapter + 10 flashcards', value: s.guardian.goal || '' });
        ['keydown', 'keyup', 'keypress'].forEach((ev) => goal.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') go(); }));
        const goalWrap = h('div.kgoalw', { hidden: true }, h('label.f', { text: '🎯 My goal for this session' }), goal);
        const goalLink = h('button.klink', { text: '+ Add a goal (optional)', onclick: () => { goalOpen = !goalOpen; goalWrap.hidden = !goalOpen; goalLink.textContent = goalOpen ? '− Hide goal' : '+ Add a goal (optional)'; if (goalOpen) setTimeout(() => goal.focus(), 30); } });
        const goBtn = h('button.kgo', { html: '<span class="kgo-t">✏️ ' + (hi ? 'Piniso karo' : 'Piniso it') + '</span><span class="kgo-k">Enter ⏎</span>', onclick: () => go() });
        const title = String(app.meta().title || '').replace(/\s*-\s*YouTube$/, '').slice(0, 70);
        box.append(petBox,
          h('h2.kh', { html: hi ? 'Chalo, <em>shuru</em> karein?' : 'Ready to <em>start</em>?' }),
          title ? h('div.ksub', { text: '📺 ' + title }) : null,
          h('div.krow', null, phoneBtn, seg),
          goalLink, goalWrap,
          goBtn,
          h('div.kfoot', null,
            h('button.klink', { text: 'Skip', onclick: () => { ov.close(); res(false); } }),
            h('span.sp'),
            h('button.klink', { text: 'Always start instantly', title: 'No start screen next time (turn it back on in Settings → Study)', onclick: () => { app.setSetting({ guardian: { ritual: false } }); go(true); } })));
        let done = false;
        const go = async (quick) => {
          if (done) return; done = true;
          app.setSetting({ v4phone: phone, v4sprint: mins, guardian: { goal: goal.value.trim() } });
          if (phone) app.bumpStats((st) => { st.phoneAway = (st.phoneAway || 0) + 1; st.xp += 3; });
          if (!quick && s.pet.motion !== 'calm' && !matchMedia('(prefers-reduced-motion: reduce)').matches) await this.countdown(box, pet);
          ov.close();
          if (mins) PZ.Extras.startSprint(app, mins);
          app.ui.react('bigjump'); app.ui.play('tada'); app.ui.confetti();
          if (goal.value.trim()) app.ui.toast('🎯 Goal: ' + goal.value.trim().slice(0, 60), { ms: 4000 });
          res(true);
        };
        const ov = app.ui.overlay(box, { clickOut: false, onKey: (e) => { if (e.key === 'Enter' && !done) { go(); return true; } return false; }, onClose: () => { pet.destroy && pet.destroy(); if (!done) res(false); } });
        ov.el.classList.add('ov-top');
        PAudio.sfx('chime');
      });
    }
    countdown(box, pet) {
      return new Promise((res) => {
        box.classList.add('counting');
        const stage = h('div.kcount');
        box.append(stage);
        const nums = ['3', '2', '1', 'GO!'];
        let i = 0;
        const step = () => {
          if (i >= nums.length) { setTimeout(res, 380); return; }
          const n = nums[i];
          stage.innerHTML = `<svg viewBox="0 0 200 200" class="kring"><path d="M100 18C150 16 184 52 183 100C182 150 146 184 98 183C50 182 16 148 17 99C18 55 52 22 104 21" /></svg><div class="kn ${n.length > 1 ? 'go' : ''}">${n}</div>`;
          PAudio.sfx(n === 'GO!' ? 'levelup' : 'tick');
          if (pet.play) pet.play(n === 'GO!' ? 'superjump' : 'squish'); else pet.react(n === 'GO!' ? 'bigjump' : 'squish');
          pet.setMood(n === 'GO!' ? 'celebrate' : 'excited', 900);
          i++;
          setTimeout(step, n === 'GO!' ? 520 : 560);
        };
        step();
      });
    }

    // =====================================================================
    // 🫥 Smart dodge: never sit on the subtitles
    // =====================================================================
    captionBand() {
      const app = this.app, v = app.video;
      if (!v || !v.rect) return null;
      const yt = [...document.querySelectorAll('.ytp-caption-window-container .caption-window, .ytp-caption-segment')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 20 && r.height > 8);
      if (yt.length && !document.documentElement.classList.contains('pz-hide-cc')) {
        return { left: Math.min(...yt.map((r) => r.left)) - 12, right: Math.max(...yt.map((r) => r.right)) + 12, top: Math.min(...yt.map((r) => r.top)) - 10, bottom: Math.max(...yt.map((r) => r.bottom)) + 10 };
      }
      let showing = false;
      try { const tt = v.textTracks && v.textTracks(); if (tt) for (const t of tt) if (t.mode === 'showing' && t.activeCues && t.activeCues.length) showing = true; } catch (e) {}
      if (!showing) return null;
      const r = v.rect();
      if (r.width < 200) return null;
      return { left: r.left + r.width * 0.08, right: r.right - r.width * 0.08, top: r.bottom - r.height * 0.27, bottom: r.bottom - r.height * 0.03 };
    }
    dodge(ui) {
      if (!this.on('dodge') || ui.dragging || !ui.dock) return;
      const b = this.captionBand();
      const p = ui.petRect();
      const hit = b && p.x < b.right && p.x + p.w > b.left && p.y < b.bottom && p.y + p.h > b.top;
      if (!hit) { this.dodged = false; return; }
      const W = innerWidth, H = innerHeight;
      const cands = [
        { x: p.x, y: b.top - p.h - 6 },
        { x: b.right + 6, y: p.y },
        { x: b.left - p.w - 6, y: p.y },
        { x: p.x, y: b.bottom + 6 }
      ].filter((c) => c.x >= 6 && c.x <= W - p.w - 6 && c.y >= 6 && c.y <= H - p.h - 6);
      if (!cands.length) return;
      const c = cands.sort((a, z) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(z.x - p.x, z.y - p.y))[0];
      ui._lx = c.x; ui._ly = c.y;
      ui.dock.style.left = c.x + 'px'; ui.dock.style.top = c.y + 'px';
      ui.layoutRadial(); if (ui.bubble) ui.layoutBubble();
      if (!this.dodged) { this.dodged = true; ui.react('squish'); }
    }

    // =====================================================================
    // 🌟 Golden moments (variable reward, rare and never on wrong answers)
    // =====================================================================
    maybeGolden(src) {
      if (!this.on('golden')) return;
      const now = Date.now();
      if (now - this.goldenAt < 12 * 60000) return;
      const st = this.app.stats || {};
      const chance = (this.app.settings.dev || {}).forceGolden ? 1 : (st.golden || 0) === 0 ? 0.25 : 0.1;
      if (Math.random() > chance) return;
      this.goldenAt = now;
      setTimeout(() => this.golden(src), 1300);
    }
    golden(src) {
      const app = this.app, ui = app.ui;
      if (!ui) return;
      const lines = app.lang() === 'hinglish'
        ? ['GOLDEN! 🌟 Aaj toh dimaag on fire hai!', 'Jackpot! 🌟 Topper wali vibes!', 'Golden answer! 🌟 Ek aur aisa?']
        : ['GOLDEN! 🌟 Your brain is on fire!', 'Jackpot! 🌟 Topper energy!', 'Golden answer! 🌟 One more like that?'];
      const g = h('div.golden', null, h('div.gstar', { html: '<svg viewBox="0 0 100 100"><path d="M50 4l13 30 32 3-24 21 7 32-28-17-28 17 7-32L5 37l32-3z"/></svg>' }), h('div.gtxt', null, h('b', { text: '+25 XP' }), h('span', { text: lines[Math.floor(Math.random() * lines.length)] })));
      const p = ui.petRect();
      const busy = !!ui.root.querySelector('.ov');
      g.style.left = (busy ? innerWidth / 2 - 130 : Math.max(10, Math.min(innerWidth - 270, p.x + p.w / 2 - 130))) + 'px';
      g.style.top = (busy ? 18 : Math.max(10, p.y - 120)) + 'px';
      ui.root.append(g);
      ui.react('bigjump'); ui.play('superjump'); ui.mood('celebrate', 3500); PAudio.sfx('levelup');
      for (let i = 0; i < 18; i++) {
        const sp = h('i.gspark');
        sp.style.left = p.x + p.w / 2 + 'px'; sp.style.top = p.y + p.h / 3 + 'px';
        const a = (i / 18) * Math.PI * 2, d = 70 + Math.random() * 90;
        sp.style.setProperty('--dx', Math.cos(a) * d + 'px'); sp.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
        sp.style.animationDelay = Math.random() * 0.15 + 's';
        ui.root.append(sp); setTimeout(() => sp.remove(), 1400);
      }
      setTimeout(() => { g.classList.add('out'); setTimeout(() => g.remove(), 400); }, 3200);
      app.bumpStats((st) => { st.xp += 25; st.golden = (st.golden || 0) + 1; });
    }

    // =====================================================================
    // 🌱 Growth stages — checked every few minutes while studying
    // =====================================================================
    tick() {
      const app = this.app, st = app.stats;
      if (!st || !app.ui || !app.session) return;
      const k = stageOf(st.totalSeconds);
      if (st.stage == null) { app.bumpStats((s2) => { s2.stage = k; }); return; }
      if (k > st.stage) {
        app.bumpStats((s2) => { s2.stage = k; s2.xp += 40; });
        const S = STAGES[k];
        app.ui.react('bigjump'); app.ui.play('levelUp'); app.ui.confetti(); PAudio.sfx('levelup');
        app.ui.say(`${S.e} **Piniso grew into a ${S.n}!** ${S.d} (+40 XP)`, { mood: 'celebrate', ms: 12000, actions: [{ label: 'Show my week', onClick: () => app.magic.wrapped() }] });
      }
    }
    growCard() {
      const app = this.app, st = app.stats || {}, sec = st.totalSeconds || 0, k = stageOf(sec), S = STAGES[k], N = STAGES[k + 1];
      const hrs = sec / 3600;
      const pct = N ? Math.round((hrs - S.h) / (N.h - S.h) * 100) : 100;
      const box = h('div.paper.grow');
      box.append(
        h('div.grow-e', { text: S.e }),
        h('h2', { html: `Piniso is a <em>${S.n}</em>` }),
        h('p.muted', { text: S.d }),
        h('div.grow-bar', null, h('i', { style: { width: pct + '%' } })),
        h('div.small', { text: N ? `${hrs.toFixed(1)} h studied · ${Math.max(0, N.h - hrs).toFixed(1)} h more to become a ${N.n} ${N.e}` : `${hrs.toFixed(0)} h studied — maximum stage!` }),
        h('div.grow-path', null, ...STAGES.map((x, i) => h('span' + (i <= k ? '.on' : ''), { title: `${x.n} — ${x.h} h`, text: x.e }))));
      const ov = app.ui.overlay(box, { clickOut: true });
      box.append(h('button.ib.xbtn', { html: I('close', 17), onclick: () => ov.close() }));
    }

    // =====================================================================
    // 📱 Revise on phone: one offline HTML file with the flashcards
    // =====================================================================
    async phoneDeck(scope) {
      const app = this.app;
      let cards = [];
      let title = 'My flashcards';
      if (scope !== 'all' && app.session && app.session.cards.length) { cards = app.session.cards.map((c) => ({ q: c.q, a: c.a })); title = app.session.title || title; }
      else { cards = (await PStore.cards()).map((c) => ({ q: c.q, a: c.a, deck: (c.src && c.src.title) || '' })); title = 'All my flashcards'; }
      if (!cards.length) {
        if (app.ui) app.ui.toast('No flashcards yet 🃏', app.session && app.session.notes.length ? { action: { label: 'Make cards from my notes', onClick: () => app.makeCards() } } : {});
        return;
      }
      const html = PZ.V4.deckHTML(cards, title, app.settings);
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'piniso-cards-' + title.replace(/[^\w]+/g, '-').slice(0, 40).toLowerCase() + '.html';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      app.ui && app.ui.say('📱 **Saved!** Send this file to your phone (WhatsApp it to yourself) and open it — your cards work offline, no app needed.', { mood: 'proud', ms: 10000 });
    }
  }

  // the offline flashcard page (also used by the dashboard)
  V4.deckHTML = (cards, title, settings) => {
    const t = PINISO.themeOf(settings || PINISO.DEFAULTS);
    const data = JSON.stringify(cards.map((c) => ({ q: PMd.plain(c.q), a: PMd.plain(c.a), d: c.deck || '' }))).replace(/</g, '\\u003c');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)} · Piniso</title>
<style>
:root{--paper:${t.paper};--paper2:${t.paper2};--ink:${t.ink};--acc:${t.accent};--accink:${t.accentInk};--muted:${t.muted}}
*{box-sizing:border-box}html,body{margin:0;height:100%}body{background:var(--paper);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;padding:18px 16px env(safe-area-inset-bottom)}
h1{font:600 20px/1.2 Georgia,serif;margin:4px 0 2px;text-align:center}.sub{color:var(--muted);font-size:13px;margin-bottom:14px}
.bar{width:100%;max-width:440px;height:8px;border:2px solid var(--ink);border-radius:9px;overflow:hidden;margin-bottom:16px}.bar i{display:block;height:100%;background:var(--acc);transition:width .4s}
.stage{perspective:1200px;width:100%;max-width:440px;flex:1;max-height:420px;min-height:260px}
.card{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,1.4,.5,1);cursor:pointer}
.card.flip{transform:rotateY(180deg)}.face{position:absolute;inset:0;backface-visibility:hidden;background:var(--paper2);border:2.5px solid var(--ink);border-radius:20px 8px 18px 9px/9px 18px 8px 20px;box-shadow:5px 5px 0 var(--ink);padding:24px;display:flex;flex-direction:column;justify-content:center;text-align:center;font-size:20px;overflow:auto}
.face small{position:absolute;top:12px;left:16px;font:700 11px/1 ui-monospace,monospace;letter-spacing:.1em;color:var(--muted)}.back{transform:rotateY(180deg)}.tap{position:absolute;bottom:12px;left:0;right:0;font-size:12px;color:var(--muted)}
.btns{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:440px;margin:18px 0 10px}
button{font:700 15px/1 inherit;font-family:inherit;padding:14px 8px;border-radius:14px;border:2.5px solid var(--ink);background:var(--paper2);color:var(--ink);box-shadow:3px 3px 0 var(--ink)}
button:active{transform:translate(2px,2px);box-shadow:none}.g{background:var(--acc);color:var(--accink)}
.done{text-align:center;padding:30px 10px}.done b{font-size:44px;display:block}.foot{font-size:11px;color:var(--muted);margin-top:auto;padding:8px}
@keyframes pop{0%{transform:scale(.8);opacity:0}100%{transform:scale(1);opacity:1}}.card{animation:pop .35s cubic-bezier(.3,1.6,.5,1)}
</style></head><body>
<h1>${esc(title)}</h1><div class="sub" id="sub"></div><div class="bar"><i id="bar"></i></div>
<div class="stage" id="stage"></div>
<div class="btns" id="btns"><button id="b1">😵 Again</button><button id="b2">🤔 Hard</button><button class="g" id="b3">😎 Easy</button></div>
<div class="foot">Made with Piniso ✏️ · works offline</div>
<script>
var C=${data};var q=C.map(function(_,i){return i}).sort(function(){return Math.random()-.5});var done=0,total=C.length,cur=null;
function show(){var s=document.getElementById('stage');document.getElementById('bar').style.width=(done/total*100)+'%';document.getElementById('sub').textContent=done+' of '+total+' learned';
if(!q.length){s.innerHTML='<div class="done"><b>🎉</b>All done! Piniso is proud of you.<br><br><button onclick="location.reload()">Again from the start</button></div>';document.getElementById('btns').style.display='none';return}
cur=q[0];var c=C[cur];s.innerHTML='';var el=document.createElement('div');el.className='card';
el.innerHTML='<div class="face"><small>QUESTION'+(c.d?' · '+esc(c.d):'')+'</small>'+esc(c.q)+'<div class="tap">tap to flip</div></div><div class="face back"><small>ANSWER</small>'+esc(c.a)+'</div>';
el.onclick=function(){el.classList.toggle('flip')};s.appendChild(el)}
function esc(x){return String(x).replace(/[&<>"]/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]})}
function grade(g){if(cur==null)return;q.shift();if(g===1){q.splice(Math.min(2,q.length),0,cur)}else if(g===2){q.push(cur)}else{done++}show()}
document.getElementById('b1').onclick=function(){grade(1)};document.getElementById('b2').onclick=function(){grade(2)};document.getElementById('b3').onclick=function(){grade(3)};
show();
</script></body></html>`;
  };
  V4.STAGES = STAGES;
  V4.stageOf = stageOf;
  PZ.V4 = V4;

  // ---- wire into the rest of Piniso ----
  // the kickoff replaces the old start form
  if (PZ.Extras) { const old = PZ.Extras.ritual; PZ.Extras.ritual = (app) => (app.v4 ? app.v4.ritual() : old(app)); }
  // smart dodge runs after every placement of the pet
  if (PZ.UI) {
    const place = PZ.UI.prototype.place;
    PZ.UI.prototype.place = function (force) { place.call(this, force); try { if (this.app.v4) this.app.v4.dodge(this); } catch (e) {} };
    // the notes desk sits NEXT TO the video when there is room (instead of covering it)
    const placeDesk = PZ.UI.prototype.placeDesk;
    PZ.UI.prototype.placeDesk = function () {
      placeDesk.call(this);
      const d = this.desk, v = this.app.video;
      if (!d || this.deskPos || !v || !v.rect || document.fullscreenElement) { if (d) d.style.width = ''; return; }
      const r = v.rect();
      if (r.width < 300) return;
      const right = innerWidth - r.right - 16, left = r.left - 16;
      const w = right >= 320 ? Math.min(390, right - 8) : left >= 320 ? Math.min(390, left - 8) : 0;
      if (!w) { d.style.width = ''; return; }
      d.style.width = w + 'px';
      d.style.right = 'auto';
      d.style.left = (right >= 320 ? r.right + 12 : r.left - w - 12) + 'px';
      const top = PZ.clamp(r.top, 8, innerHeight - 340);
      d.style.top = top + 'px';
      d.style.height = Math.max(320, Math.min(680, innerHeight - top - 14)) + 'px';
    };
    const apply = PZ.UI.prototype.applySettings;
    PZ.UI.prototype.applySettings = function (s) { apply.call(this, s); if (this.root) this.root.classList.toggle('calm', s.pet.motion === 'calm'); };
  }
})();
