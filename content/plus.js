/* Piniso v2.3 "plus" features that live on the lecture page:
   doubt snipe, lost-here, rewind-and-explain, speed coach, autoplay blocker, warm-up recap,
   mood check-in, focus replay, night-owl guard, smart breaks, shortcuts sheet, audio recap, share card. */
(() => {
  if (PZ.Plus) return;
  const h = PZ.h, esc = (x) => PMd.esc(x), I = (n, s) => PIcons.svg(n, s);

  class Plus {
    constructor(app) {
      this.app = app;
      this.seekLog = [];
      this.lastSpeedTip = 0;
      this.lastRate = 1;
    }
    get s() { return this.app.settings; }
    lang() { return this.app.lang(); }
    say(text, o) { return this.app.ui && this.app.ui.say(text, o); }

    // ---------------- session start ----------------
    async onSessionStart(sess, isNew) {
      sess.focusLog = sess.focusLog || [];
      sess.lost = sess.lost || [];
      this.log('start');
      this.autoplayOff();
      if (!isNew) return;
      // warm-up from the last study video (if it was recent)
      const last = (await PStore.listSessions()).find((r) => r.key !== sess.key && r.study !== false && r.notes >= 3 && Date.now() - r.updatedAt < 3 * 86400000);
      const st = this.app.stats || {};
      const moodAsked = (PStore.dayStat(st, 'mood') || 0) > 0;
      setTimeout(async () => {
        if (this.app.session !== sess) return;
        if (this.app.touring || !(this.app.stats && this.app.stats.toured)) return;
        if (!moodAsked) this.moodCheck();
        else if (last) this.warmUp(last);
      }, 6500);
      if (!moodAsked && last) setTimeout(() => this.app.session === sess && this.warmUp(last), 26000);
    }

    // ---------------- 12. mood check-in ----------------
    moodCheck() {
      const lg = this.lang();
      const set = (m) => {
        this.app.mood = m;
        this.app.bumpStats((st) => { PStore.bumpDay(st, 'mood'); st.moodToday = m; });
        const reply = { tired: lg === 'hinglish' ? 'Thaka hua dimaag? Aaj easy quizzes aur short notes 😴☕' : 'Tired brain? Easy quizzes and shorter notes today 😴☕', ok: 'Normal mode on 👍', fire: lg === 'hinglish' ? 'Fire mode! 🔥 Hard questions aayenge, ready raho' : 'Beast mode! 🔥 Harder questions today' }[m];
        this.say(reply, { mood: m === 'tired' ? 'sleepy' : m === 'fire' ? 'excited' : 'happy', ms: 4000, instant: true });
      };
      this.say(lg === 'hinglish' ? 'Aaj dimaag ka mood kaisa hai?' : 'How’s your brain today?', {
        mood: 'thinking', ms: 20000,
        actions: [{ label: '😴 Tired', onClick: () => set('tired') }, { label: '🙂 Okay', onClick: () => set('ok') }, { label: '🔥 Fire', pri: true, onClick: () => set('fire') }]
      });
    }
    difficulty() {
      const m = this.app.mood || (this.app.stats || {}).moodToday;
      return m === 'tired' ? 'easy' : m === 'fire' ? 'hard' : null;
    }

    // ---------------- 7. "before you start" warm-up ----------------
    async warmUp(row) {
      const prev = await PStore.getSession(row.key);
      if (!prev || this.app.quizRunning) return;
      const pts = (prev.summary && prev.summary.recap && prev.summary.recap.length ? prev.summary.recap : prev.notes.filter((n) => PZ.star(n)).concat(prev.notes).map((n) => PMd.plain(n.text))).slice(0, 3);
      const qs = (prev.cards || []).slice(-6).map((c) => ({ type: 'short', q: c.q, answer: PMd.plain(c.a) })).slice(0, 2);
      this.say(`**Quick recap of “${esc(row.title.slice(0, 50))}”** before we start:\n${pts.map((p) => '- ' + String(p).slice(0, 110)).join('\n')}`, {
        mood: 'idea', ms: 16000,
        actions: qs.length ? [{ label: '2-question warm-up', pri: true, icon: 'quiz', onClick: () => this.app.startQuizWith(qs, 'Warm-up from last video') }, { label: 'Skip' }] : [{ label: 'Got it' }]
      });
    }

    // ---------------- 2. lost here ----------------
    lostHere() {
      const app = this.app, sess = app.session, v = app.video;
      if (!sess || !v) return;
      const t = v.t;
      if (sess.lost.some((x) => !x.done && Math.abs(x.t - t) < 20)) { app.ui.toast('Already marked — I’ll explain it'); return; }
      sess.lost.push({ t, at: Date.now(), done: false, topic: sess.topic || '' });
      PAudio.sfx('pop'); app.ui.react('jump'); app.ui.mood('confused', 2000);
      app.ui.toast(`🧭 Marked “lost” at ${PZ.fmt(t)} — see Notes → Revisit list`, { action: { label: 'Explain now', onClick: () => this.explainLost(sess.lost[sess.lost.length - 1]) } });
      app.ui.refresh(['notes']); app.save();
    }
    async explainLost(x) {
      const app = this.app;
      if (!x) return;
      x.done = true;
      const n = app.session.lost.filter((y) => y.done).length;
      if (n >= 5) app.bumpStats((st, award) => award('lost_found'));
      await app.explainRange(Math.max(0, x.t - 70), x.t + 10, `I got lost around ${PZ.fmt(x.t)}. Explain that part again very simply, step by step, with one example.`);
      app.ui.refresh(['notes']); app.save();
    }

    // ---------------- 3. rewind-and-explain + 14. focus log ----------------
    onSeeked(from, to) {
      if (from == null || !(from - to > 4 && from - to < 120)) return;
      const now = Date.now();
      this.seekLog = this.seekLog.filter((x) => now - x.at < 4 * 60000);
      this.seekLog.push({ from, to, at: now });
      this.log('rewind');
      const near = this.seekLog.filter((x) => Math.abs(x.to - to) < 45);
      if (near.length >= 2 && now - (this.lastRewindTip || 0) > 5 * 60000 && !this.app.quizRunning) {
        this.lastRewindTip = now;
        const lg = this.lang();
        const t0 = Math.min(...near.map((x) => x.to)), t1 = Math.max(...near.map((x) => x.from));
        this.say(lg === 'hinglish' ? `Ye part (${PZ.fmt(t0)}–${PZ.fmt(t1)}) baar baar dekh rahe ho 🤔 Simple bhasha mein samjhaun?` : `You keep rewinding ${PZ.fmt(t0)}–${PZ.fmt(t1)} 🤔 Want a simpler explanation?`, {
          mood: 'thinking', ms: 14000,
          actions: [{ label: 'Yes, explain simply', pri: true, icon: 'bulb', onClick: () => this.app.explainRange(t0, t1, 'I rewound this part several times and still find it confusing. Explain it very simply, step by step, with an everyday example.') }, { label: 'I’m fine' }]
        });
      }
    }
    log(type) {
      const sess = this.app.session;
      if (!sess) return;
      sess.focusLog = sess.focusLog || [];
      const last = sess.focusLog[sess.focusLog.length - 1];
      if (last && last.type === type && type !== 'rewind') return;
      sess.focusLog.push({ at: Date.now(), type, t: this.app.video ? Math.round(this.app.video.t) : 0 });
      if (sess.focusLog.length > 600) sess.focusLog.splice(0, sess.focusLog.length - 600);
    }

    // ---------------- per-tick checks ----------------
    tick(t, playing, now) {
      const app = this.app;
      // 14. focus replay states
      const vis = document.visibilityState === 'visible';
      this.log(!vis ? 'away' : playing ? 'watch' : 'paused');
      // 5. speed coach (captions only, at most every 6 min)
      if (playing && app.tx && (app.tx.status === 'captions' || app.tx.status === 'texttrack' || app.tx.status === 'live-captions') && now - this.lastSpeedTip > 6 * 60000 && this.s.focus.speedCoach !== false) {
        const words = app.tx.store.words(t - 60, t);
        const rate = app.video.rate || 1;
        const wpm = words / rate; // teacher's own pace
        if (words > 0 && now - (this.sessStart || (this.sessStart = now)) > 3 * 60000) {
          let tip = null;
          if (wpm < 95 && rate <= 1) tip = { text: `Teacher is slow here (${Math.round(wpm)} words/min) 🐢 Try 1.25×?`, rate: 1.25 };
          else if (wpm > 185 && rate > 1) tip = { text: `Fast + dense part 🏎️ Back to 1× so nothing slips?`, rate: 1 };
          if (tip) {
            this.lastSpeedTip = now;
            this.say(tip.text, { mood: 'idea', ms: 9000, actions: [{ label: tip.rate + '×', pri: true, onClick: () => app.video.setRate ? app.video.setRate(tip.rate) : (app.video.v && (app.video.v.playbackRate = tip.rate)) }, { label: 'No thanks' }] });
          }
        }
      }
      // 15. night-owl guard (once per session)
      const hr = new Date().getHours();
      if (playing && (hr >= 23 || hr < 4) && !this.nightTold && this.s.focus.nightGuard !== false && now - (this.sessStart || now) > 10 * 60000) {
        this.nightTold = true;
        this.say(this.lang() === 'hinglish' ? 'Raat ke ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' baj gaye 🌙 Neend = memory save button. Kal yahin se shuru karein?' : 'It’s late 🌙 Sleep is when memory saves. Stop here and continue tomorrow?', {
          mood: 'sleepy', ms: 20000,
          actions: [{ label: '😴 Save & sleep', pri: true, onClick: () => { app.video.pause(); app.save(true); app.ui.toast('Saved at ' + PZ.fmt(t) + ' — good night! 🌙'); } }, { label: '15 more min' }]
        });
      }
      // 6. keep YouTube autoplay off while studying
      if (now - (this._apAt || 0) > 20000) { this._apAt = now; this.autoplayOff(); }
    }
    autoplayOff() {
      if (PZ.site() !== 'youtube' || this.s.focus.blockAutoplay === false) return;
      const b = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (b) { b.click(); if (!this._apToast) { this._apToast = true; this.app.ui && this.app.ui.toast('⏹️ Autoplay off while you study (no rabbit holes)'); } }
    }

    // ---------------- 16. smart break: wait for a natural pause ----------------
    goodMomentForBreak() {
      const app = this.app;
      if (!app.tx || !app.video) return true;
      const t = app.video.t;
      const cues = app.tx.store.range(t - 1, t + 6);
      if (!cues.length) return true;
      // a gap of 1.2s+ between lines right now, or a sentence just ended
      for (let i = 0; i < cues.length - 1; i++) if (cues[i + 1].start - cues[i].end > 1.2 && cues[i].end < t + 1.5) return true;
      const cur = cues.find((c) => c.start <= t && c.end >= t);
      return !cur || /[.?!।]\s*$/.test(cur.text);
    }

    // ---------------- 1. doubt snipe ----------------
    async snipe() {
      const app = this.app, v = app.video;
      if (!app.session || !v) return app.ui && app.ui.toast('Open a lecture first');
      if (this.sniping) return;
      const img = await app.captureFrame();
      if (!img) { app.snap(); return; }
      this.sniping = true;
      const wasPlaying = !v.paused; v.pause();
      const ov = h('div.snipe');
      const pic = h('img', { src: img, alt: '' });
      const box = h('div.sbox');
      const hint = h('div.shint', { html: '🎯 <b>Drag a box</b> around the part you don’t get &nbsp;·&nbsp; <b>Enter</b> = whole screen &nbsp;·&nbsp; <b>Esc</b> = cancel' });
      ov.append(pic, box, hint);
      app.ui.root.append(ov);
      let start = null, rect = null;
      const done = async (crop) => {
        cleanup();
        let use = img;
        if (crop && crop.w > 12 && crop.h > 12) use = await cropImg(img, pic, crop);
        app.bumpStats((st, award) => { st.snips = (st.snips || 0) + 1; if (st.snips >= 5) award('sniper'); });
        await app.ask('Explain ONLY this selected part of the board/screen: what it shows, the idea behind it, and how it connects to what the teacher is teaching. Simple steps.', false, use);
        if (wasPlaying && this.s.focus.resumeAfterSnipe) v.play();
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); cleanup(); if (wasPlaying) v.play(); } else if (e.key === 'Enter') { e.preventDefault(); done(null); } };
      const cleanup = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); this.sniping = false; };
      document.addEventListener('keydown', onKey, true);
      ov.addEventListener('pointerdown', (e) => { if (e.target.closest('.shint')) return; start = { x: e.clientX, y: e.clientY }; ov.setPointerCapture(e.pointerId); box.style.display = 'block'; });
      ov.addEventListener('pointermove', (e) => {
        if (!start) return;
        rect = { x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY), w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) };
        Object.assign(box.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
      });
      ov.addEventListener('pointerup', () => { if (start && rect) done(rect); start = null; });
    }

    // ---------------- 25. shortcuts sheet ----------------
    shortcuts() {
      const rows = [['Ctrl+K', 'Command bar — type anything ⌘'], ['Alt+Shift+P', 'Open / close the desk'], ['Alt+Shift+N', 'Notes'], ['Alt+Shift+Q', 'Quiz me now'], ['Alt+Shift+T', 'Talk (voice)'], ['Alt+Shift+M', 'Mark important ⭐'], ['Alt+Shift+X', 'I’m lost here 🧭'], ['Alt+Shift+D', 'Doubt snipe (drag a box) 🎯'], ['Alt+Shift+S', 'Explain the whole board 📸'], ['Alt+Shift+L', 'Listen to audio (no captions)'], ['Alt+Shift+F', 'Float on top'], ['Alt+Shift+/', 'This list']];
      const box = h('div.card.paper.keys');
      box.append(h('h2', { html: 'Keyboard <em>shortcuts</em>' }));
      const tb = h('div.ktab');
      rows.forEach(([k, d]) => tb.append(h('div.kr', null, h('kbd', { text: k }), h('span', { text: d }))));
      box.append(tb, h('div.small.muted', { text: 'Change them at chrome://extensions/shortcuts (edge://extensions/shortcuts in Edge).' }));
      const ov = this.app.ui.overlay(box, { clickOut: true });
      box.append(h('button.btn.pri.wide', { text: 'Got it', onclick: () => ov.close() }));
    }

    // ---------------- 23. audio recap ----------------
    speak(text) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(PMd.plain(text).replace(/[*_#>`$]/g, '').slice(0, 2500));
        const lg = this.lang();
        u.lang = lg === 'hindi' ? 'hi-IN' : 'en-IN';
        u.rate = 1.02;
        const vs = speechSynthesis.getVoices();
        const v = vs.find((x) => x.lang === u.lang) || vs.find((x) => /en-IN|hi-IN/.test(x.lang)) || vs.find((x) => /^en/.test(x.lang));
        if (v) u.voice = v;
        speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }
    stopSpeak() { try { speechSynthesis.cancel(); } catch (e) {} }

    // ---------------- 24. share card ----------------
    async shareCard(sum) {
      const app = this.app, sess = app.session, st = app.stats || {};
      const W = 1080, H = 1920; // 9:16 — fits WhatsApp status & Instagram stories
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const t0 = PINISO.themeOf(app.settings);
      const th = { paper: t0.paper, acc: t0.accent, ink: t0.ink };
      g.fillStyle = th.paper || '#FBF7EE'; g.fillRect(0, 0, W, H);
      g.fillStyle = th.acc || '#FFD23F'; g.beginPath(); g.arc(W - 80, 90, 260, 0, Math.PI * 2); g.fill();
      g.fillStyle = th.ink || '#1c1b18';
      g.font = '700 30px "PinisoMono", monospace'; g.fillText('TODAY I LEARNED', 80, 130);
      const wrap = (text, x, y, maxW, lh, font, maxLines) => {
        g.font = font; const words = String(text).split(/\s+/); let line = '', n = 0;
        for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { line += '…'; break; } } else line = t2; }
        g.fillText(line, x, y); return y + lh;
      };
      let y = wrap((sum && sum.title) || sess.title, 80, 260, W - 160, 92, '400 80px "PinisoSerif", Georgia, serif', 3);
      y += 40;
      y += 20;
      const pts = ((sum && sum.recap) || sess.notes.filter((n) => PZ.star(n)).concat(sess.notes).map((n) => n.text)).map((x) => PMd.plain(x)).slice(0, 3);
      pts.forEach((p, i) => {
        g.fillStyle = th.acc || '#FFD23F'; g.beginPath(); g.arc(104, y - 14, 26, 0, Math.PI * 2); g.fill();
        g.fillStyle = th.ink || '#1c1b18'; g.font = '800 30px "PinisoSans", sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), 104, y - 3); g.textAlign = 'left';
        y = wrap(p, 150, y, W - 230, 56, '500 44px "PinisoSans", sans-serif', 4) + 44;
      });
      // pet
      try {
        const svg = PinisoPet.svgString(app.petCfg(), 'proud');
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        g.drawImage(img, W - 420, H - 560, 360, 360);
      } catch (e) {}
      const qs = (sess.quizzes || []).flatMap((q) => q.items || []);
      g.fillStyle = th.ink || '#1c1b18';
      g.font = '600 42px "PinisoSans", sans-serif';
      g.fillText(`⏱ ${PZ.fmtDur(sess.watchSeconds)} studied`, 80, H - 360);
      if (qs.length) g.fillText(`✅ Quiz ${qs.filter((x) => x.correct).length}/${qs.length}`, 80, H - 295);
      g.fillText(`🔥 ${PStore.streak(st)} day streak`, 80, H - 230);
      if (PZ.V4) { const S = PZ.V4.STAGES[PZ.V4.stageOf(st.totalSeconds)]; g.fillText(`${S.e} Piniso level: ${S.n}`, 80, H - 165); }
      g.font = '400 40px "PinisoHand", cursive'; g.fillText('studied with Piniso ✏️ — just Piniso it', 80, H - 80);
      app.magic.markUsed('share');
      const url = c.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = 'piniso-today-' + PStore.todayKey() + '.png'; a.click();
      app.ui.toast('📸 Share card saved — post it on your status!');
    }
  }

  // crop a captured screenshot (data URL) to the rectangle drawn over the shown image
  async function cropImg(src, shown, r) {
    const im = await new Promise((res) => { const x = new Image(); x.onload = () => res(x); x.src = src; });
    const b = shown.getBoundingClientRect();
    const sx = im.naturalWidth / b.width, sy = im.naturalHeight / b.height;
    const c = document.createElement('canvas');
    const w = Math.max(8, r.w * sx), hh = Math.max(8, r.h * sy);
    const scale = Math.min(1, 1280 / Math.max(w, hh));
    c.width = Math.round(w * scale); c.height = Math.round(hh * scale);
    c.getContext('2d').drawImage(im, (r.x - b.left) * sx, (r.y - b.top) * sy, w, hh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  PZ.Plus = Plus;
})();
