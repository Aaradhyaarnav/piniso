/* Piniso content — the app: sessions, focus tracking, auto notes, quizzes, music, breaks, exports. */
(() => {
  if (globalThis.__PINISO_APP__) return;
  globalThis.__PINISO_APP__ = true;
  if (!PZ.isTop) { PZ.Video.Agent.start(); return; }

  const IMPORTANT = [
    /\b(very |really |super |most )?important\b/i, /\bexam(s|ination)?\b/i, /\bremember (this|that|it)\b/i, /\bnote (this|it|that) down\b|\bwrite (this|it) down\b/i,
    /\bkey point\b/i, /\bfrequently asked\b/i, /\bdon'?t forget\b/i, /\bpay attention\b/i, /\bcommon mistake\b/i, /\b(board|jee|neet|cbse|upsc) (exam|paper|question)/i,
    /\byaad rakh(na|o|iye|ein|ega|lena)?\b/i, /\bdhyan (se|dena|do|rakhna|rakho)\b/i, /\blikh (lo|lijiye|lena|le)\b/i, /\bnote kar(\s?lo|lijiye|o|na)?\b/i,
    /\b(bahut|bohot|bahot) (important|zaroori|jaruri|zaruri)\b/i, /\bpakka (aayega|aata|puchha)\b/i, /\bexam me(in)? (aata|aayega|puchha)/i, /\bzaroor(i)?\b/i,
    /(महत्वपूर्ण|ज़रूरी|जरूरी|याद\s*रख|ध्यान\s*(से|दे|रख)|लिख\s*ल|परीक्षा|एग्ज़ाम|नोट\s*कर)/
  ];

  class App {
    constructor() {
      this.session = null; this.video = null; this.tx = null; this.ui = null;
      this.cursor = 0; this.scanT = 0; this.busy = false;
      this.lastTick = Date.now(); this.pendingSec = 0; this.pendingXP = 0; this.lastFlush = Date.now();
      this.sinceBreak = 0; this.focusRun = 0; this.awayStart = 0;
      this.lastInteract = Date.now(); this.sleeping = false;
      this.flags = []; this.lastFlagAt = 0;
      this.musicUser = null; this.musicReasons = new Set();
      this.greeted = false; this.statusShown = '';
      this.noKeyShown = false; this.rateShown = 0;
      this.dirty = false;
    }

    // ------------------------------------------------ boot
    async init() {
      this.settings = await PStore.settings();
      this.stats = await PStore.stats();
      this.talk = new PZ.Talk(this);
      this.timeline = new PZ.Timeline(this);
      this.plus = new PZ.Plus(this);
      this.magic = new PZ.Magic(this);
      this.v4 = PZ.V4 ? new PZ.V4(this) : null;
      this.later = [];
      PZ.nowT = (sess) => this.nowFor(sess);
      this.studyOK = new Set(); this.knownKeys = new Set(); this.offerNo = new Set();
      try { (await PStore.listSessions()).forEach((r) => { if (r.study !== false && (r.notes > 0 || r.watch > 120)) this.knownKeys.add(r.key); }); } catch (e) {}
      this.screenMode = location.protocol === 'chrome-extension:';
      if (location.protocol === 'chrome-extension:' && chrome.tabs && chrome.tabs.getCurrent) { try { const t = await chrome.tabs.getCurrent(); this.myTabId = t && t.id; } catch (e) {} }
      PAudio.setVolumes({ master: this.settings.sound.master, sfx: this.settings.sound.sfx ? this.settings.sound.sfxVol : 0, music: this.settings.sound.musicVol });
      PStore.onSettings((s) => this.onSettings(s));
      chrome.storage.onChanged.addListener((ch, a) => { if (a === 'local' && ch.stats) this.stats = Object.assign(this.stats || {}, ch.stats.newValue || {}); if (a === 'local' && ch.deviceAI) this.deviceOK = (ch.deviceAI.newValue || {}).status === 'available'; });
      try { const d = (await PStore.get('deviceAI')).deviceAI; this.deviceOK = !!d && d.status === 'available'; } catch (e) {}
      chrome.runtime.onMessage.addListener((m, s, reply) => this.onMessage(m, reply));
      document.addEventListener('visibilitychange', () => this.onVisibility());
      ['pointerdown', 'keydown', 'wheel', 'mousemove'].forEach((ev) => window.addEventListener(ev, PZ.throttle(() => this.onInteract(), 1500), { passive: true, capture: true }));
      window.addEventListener('pointerdown', () => PAudio.unlock(), { once: true, capture: true });
      window.addEventListener('keydown', (e) => this.hotkeys(e), true);
      PZ.mw.on('nav', () => setTimeout(() => this.checkKey(), 300));
      PZ.Video.Watch.start((v) => this.onVideo(v));
      setInterval(() => this.checkKey(), 1500);
      // the small ✨ Piniso it button under YouTube videos: the manual switch for any video
      setInterval(() => { try { if (PZ.alive() && this.enabledHere()) this.magic.ytButton(); } catch (e) {} }, 2000);
      setInterval(() => { if (PZ.alive()) this.tick(); }, 4000);
      setInterval(() => this.shortsPolice(), 5000);
      window.addEventListener('pagehide', () => this.save(true));
    }
    enabledHere() { return this.settings.enabled && !(this.settings.disabledSites || []).includes(location.hostname); }
    lang() { return PLines.langFor(this.settings.lang.comments); }
    petCfg() {
      const t = PINISO.themeOf(this.settings);
      return Object.assign(PINISO.petOf(this.settings), { accent: t.accent, motion: this.settings.pet.motion });
    }
    meta() { return { title: (this.tx && this.tx.meta.title) || (this.session && this.session.title) || document.title, author: this.tx && this.tx.meta.author }; }
    line(key, vars) { return PLines.pick(this.lang(), key, Object.assign({ name: this.settings.pet.name }, vars || {})); }
    hasKey() {
      const a = this.settings.ai;
      if (a.provider === 'custom' ? !!a.customBaseUrl : !!(a.keys[a.provider] || '').trim()) return true;
      return a.device !== false && !!this.deviceOK; // no key, but Chrome's built-in AI is ready
    }

    ensureUI() {
      if (this.ui) return this.ui;
      this.ui = new PZ.UI(this);
      this.ui.mount();
      return this.ui;
    }

    // ------------------------------------------------ session lifecycle
    keyFor() {
      if (globalThis.PINISO_KEY_OVERRIDE) return globalThis.PINISO_KEY_OVERRIDE;
      if (PZ.site() === 'youtube') {
        const id = PZ.ytVideoId();
        if (!id || location.pathname.startsWith('/shorts')) return '';
        return 'yt:' + id;
      }
      return location.hostname.replace(/^www\./, '') + location.pathname.replace(/\/+$/, '');
    }
    cleanTitle() {
      let t = (this.tx && this.tx.meta.title) || document.title || 'Lecture';
      return t.replace(/^\(\d+\)\s*/, '').replace(/\s*[-|–]\s*(YouTube|Unacademy|Coursera|Udemy|Khan Academy)\s*$/i, '').trim();
    }
    onVideo(v) {
      clearTimeout(this._lostT);
      if (!v) { this._lostT = setTimeout(() => { this.video = null; this.checkKey(true); }, 5000); return; }
      this.video = v;
      this.checkKey(true);
    }
    // not started on this video. ask=true → it looks like studying: ask once with a small pop-up.
    // ask=false → a normal video: stay hidden and quiet (✨ Piniso it on YouTube / the toolbar icon starts it anyway)
    nap(key, ask) {
      this.napKey = key;
      this.napShown = false;
      if (!this.enabledHere() || this.session) return;
      if (!ask || this.offerNo.has(key)) { if (this.ui && !this.session) this.ui.show(false); return; }
      this.napShown = true;
      this.ensureUI();
      this.ui.show(true);
      this.ui.mood('thinking', 30000);
      const lg = this.lang();
      setTimeout(() => {
        if (this.napKey !== key || this.session || this.keyFor() !== key) return;
        const no = () => {
          this.offerNo.add(key); this.napShown = false;
          if (this.ui && !this.session) { this.ui.hideBubble(); setTimeout(() => !this.session && this.napKey === key && this.ui.show(false), 300); }
        };
        this.ui.say(lg === 'hinglish' ? 'Ye padhai wala video lag raha hai 📚 Notes, quiz aur focus mode chalu karun?' : 'This looks like a study video 📚 Want me to take notes, quiz you and block distractions?', {
          mood: 'thinking', ms: 25000, force: true,
          actions: [
            { label: lg === 'hinglish' ? '✨ Haan, shuru karo' : '✨ Yes, start', pri: true, onClick: () => this.pinisoIt(true) },
            { label: lg === 'hinglish' ? 'Abhi nahi' : 'Not now', onClick: no },
            { label: lg === 'hinglish' ? 'Hamesha khud shuru karo' : 'Always start on study videos', onClick: () => { this.setSetting({ brain: { start: 'auto' } }); this.pinisoIt(true); } }
          ]
        });
        // no answer → quietly go away (it never starts by itself)
        const gone = () => { if (this.session || this.napKey !== key) return; if (this.ui.bubble || this.ui.bubbleHover) { setTimeout(gone, 3000); return; } this.offerNo.add(key); this.napShown = false; this.ui.show(false); };
        setTimeout(gone, 27000);
      }, 1500);
    }
    studyThis() {
      const key = this.keyFor();
      if (key) this.studyOK.add(key);
      this.napKey = '';
      if (this.ui) this.ui.mood('excited', 1500);
      this.checkKey(true);
    }
    async checkKey(force) {
      if (!PZ.alive()) return;
      const show = this.video && this.enabledHere() && this.keyFor() && PZ.Extras.lectureLike(this, this.video);
      const key = show ? this.keyFor() : '';
      if (!force && this.session && key === this.session.key && this.tx && this.tx.video === this.video) return;
      if (this.session && (key !== this.session.key || (this.tx && this.tx.video !== this.video))) await this.endSession();
      if (key && this.video && !this.session) await this.startSession(key);
      if (!key && this.ui && !this.shortsMode && !(this.napShown && this.napKey === this.keyFor())) this.ui.show(false);
      if (key) this.napKey = '';
    }
    async startSession(key) {
      if (this._starting) return;
      this._starting = true;
      try {
        const v = this.video;
        let sess = await PStore.getSession(key);
        const isNew = !sess;
        if (!sess) sess = PStore.blankSession(key, { title: this.cleanTitle(), url: location.href.replace(/[?&]t=\d+s?/, ''), site: PZ.site() });
        this.session = sess;
        this.cursor = this.processedEndAt(v.t);
        this.scanT = v.t;
        this.flags = [];
        this.later = [];
        this.digests = 0;
        this.statusShown = '';
        this.quizFloor = Math.max(0, v.t - 60);
        this.sinceBreak = Math.min(this.sinceBreak, 0) || 0;
        this.ensureUI();
        this.ui.show(true);
        this.ui.place(true);
        this.applyZen();
        if (isNew) {
          const hr = new Date().getHours();
          await this.bumpStats((st, award) => { st.sessions++; award('first_session'); if (hr >= 23 || hr < 4) award('night_owl'); if (hr >= 4 && hr < 7) award('early_bird'); });
        }
        // hearing
        this.tx = new PZ.TranscriptManager(v, {
          onStatus: (st, d) => this.onTxStatus(st, d),
          onAdd: (cues, src) => this.onCues(cues, src)
        });
        this.tx.start();
        this.plus.onSessionStart(sess, isNew);
        // video events
        this.vh = {
          timeupdate: () => { if (!v.seeking && !this._seekFrom) this._prevT = v.t; },
          seeking: () => { if (this._seekFrom == null) this._seekFrom = this._prevT; },
          play: () => { this.updateMusic(); if (this.sleeping) this.wake(); },
          pause: () => this.updateMusic(),
          ended: () => this.onEnded(),
          seeked: () => { const from = this._seekFrom; this._seekFrom = null; this._prevT = v.t; try { this.plus.onSeeked(from, v.t); } catch (e) {} this.scanT = v.t; this.later = this.later.filter((x) => x.t > v.t - 20 && x.t < v.t + 400); if (v.t < this.cursor - 5 || v.t > this.cursor + this.settings.brain.commentEvery * 2) this.cursor = this.processedEndAt(v.t); }
        };
        Object.entries(this.vh).forEach(([e, f]) => v.on(e, f));
        // greeting (+ start ritual for fresh sessions)
        this.greeted = false;
        const lastRitual = (await PStore.get('pzRitualAt')).pzRitualAt || 0;
        if (this.settings.guardian.ritual && isNew && Date.now() - lastRitual > 2 * 3600000 && !this.screenMode) {
          PStore.set({ pzRitualAt: Date.now() });
          const wasPlaying = !v.paused;
          if (wasPlaying) v.pause();
          setTimeout(async () => { await PZ.Extras.ritual(this); if (wasPlaying) v.play(); this.greet(); }, 900);
        } else if (!isNew && sess.lastT > 30 && v.t < 15 && (!v.d || !isFinite(v.d) || v.d - sess.lastT > 40)) {
          // coming back to a video studied before: offer to continue where they stopped
          this.greeted = true;
          setTimeout(() => {
            if (this.session !== sess) return;
            const qs = (sess.quizzes || []).flatMap((q) => q.items || []);
            const extra = [sess.notes.length ? sess.notes.length + ' notes' : '', qs.length ? 'quiz ' + qs.filter((x) => x.correct).length + '/' + qs.length : ''].filter(Boolean).join(' · ');
            this.ui.say(`Welcome back! 👋 You stopped at **${PZ.fmt(sess.lastT)}**${sess.topic ? ' (' + sess.topic + ')' : ''}.${extra ? ' Last time: ' + extra + '.' : ''}`, {
              mood: 'happy', ms: 14000,
              actions: [{ label: 'Continue from ' + PZ.fmt(sess.lastT), pri: true, icon: 'play', onClick: () => { this.seek(sess.lastT); this.video.play(); } }, { label: 'Start over', onClick: () => {} }]
            });
          }, 1300);
        } else if (isNew && !(this.stats && this.stats.toured)) { this.greeted = true; setTimeout(() => this.session === sess && this.magic.tour(), 2200); }
        else setTimeout(() => this.greet(), 1200);
        this.ui.refresh();
        this.save();
      } finally { this._starting = false; }
    }
    async endSession() {
      if (!this.session) return;
      if (this.tx) this.tx.stop();
      if (this.video && this.vh) Object.entries(this.vh).forEach(([e, f]) => this.video.off && this.video.off(e, f));
      await this.flushStats();
      await this.save(true);
      this.session = null; this.tx = null;
      if (this.quizRunning) this.quizRunning.close(false);
      document.documentElement.classList.remove('pz-zen');
      this.musicReasons.clear(); this.updateMusic();
      if (this.ui) { this.ui.hideBubble(true); this.ui.refresh(); }
    }
    processedEndAt(t) {
      const r = (this.session.processed || []).find(([a, b]) => t >= a - 2 && t <= b + 2);
      return r ? r[1] : t;
    }
    markProcessed(a, b) {
      const P = this.session.processed;
      P.push([a, b]);
      P.sort((x, y) => x[0] - y[0]);
      const out = [];
      for (const r of P) { if (out.length && r[0] <= out[out.length - 1][1] + 3) out[out.length - 1][1] = Math.max(out[out.length - 1][1], r[1]); else out.push(r.slice()); }
      this.session.processed = out;
    }
    covered(a, b) { return (this.session.processed || []).some(([x, y]) => x <= a + 3 && y >= b - 3); }
    save(now) {
      if (!this.session) return Promise.resolve();
      const sess = this.session, v = this.video;
      if (v && v.t > 1) { sess.lastT = Math.round(v.t); sess.maxT = Math.max(sess.maxT || 0, sess.lastT); }
      if (v && v.d && isFinite(v.d)) sess.dur = Math.round(v.d);
      const m = this.meta(); if (m.author) sess.author = String(m.author).slice(0, 80);
      if (PZ.site() === 'youtube') sess.vid = PZ.ytVideoId();
      sess.study = true;
      if (now) { clearTimeout(this._saveT); return PStore.saveSession(this.session).catch(() => {}); }
      clearTimeout(this._saveT);
      this._saveT = setTimeout(() => PStore.saveSession(this.session).catch(() => {}), 1500);
      return Promise.resolve();
    }

    greet() {
      if (!this.session || this.greeted) return;
      this.greeted = true;
      this.ui.react('bigjump'); PAudio.sfx('boing');
      const hr = new Date().getHours();
      let text = this.line('start');
      if ((hr >= 23 || hr < 4) && Math.random() < 0.7) text = this.line('night', { n: hr > 12 ? hr - 12 : hr || 12 });
      else if (hr >= 4 && hr < 7 && Math.random() < 0.7) text = this.line('morning');
      if (!this.hasKey()) {
        this.ui.say(text + ' ' + this.line('noKey'), { mood: 'nervous', sticky: true, actions: [{ label: 'Add free key (1 min)', pri: true, icon: 'bolt', onClick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }] });
        this.noKeyShown = true;
        return;
      }
      this.ui.say(text, { mood: 'happy' });
    }
    onTxStatus(st, detail) {
      const map = { captions: 'ok', live: 'ok', texttrack: 'ok', listening: 'ok', screen: 'ok', searching: 'busy', remote: 'busy', 'needs-listen': 'warn', none: 'bad', error: 'bad' };
      this.ui && this.ui.setStatus(this.hasKey() ? map[st] || '' : 'warn', this.hasKey() ? (this.tx ? this.tx.label() : '') : 'Add API key');
      if (!this.ui || this.statusShown === st) return;
      const was = this.statusShown;
      this.statusShown = st;
      if (!this.hasKey()) return;
      // full captions just arrived: start writing notes right away instead of waiting for the next tick
      if ((st === 'captions' || st === 'texttrack') && !this.digests) setTimeout(() => { try { this.tick(); } catch (e) {} }, 400);
      setTimeout(() => {
        if (!this.session) return;
        if ((st === 'captions' || st === 'texttrack') && !was) this.ui.say(this.line('startCaptions'), { mood: 'listening', ms: 6000 });
        if (st === 'listening') this.ui.say(this.line('listening'), { mood: 'listening', ms: 5000 });
        if (st === 'needs-listen') this.listenHelp(true);
      }, st === 'needs-listen' ? 2600 : 2200);
      if (this.ui) this.ui.layoutRadial();
    }
    needsListen() { return !!(this.tx && this.tx.status === 'needs-listen'); }
    async listenHelp(soft) {
      const r = await PZ.bg({ type: 'stt:start' });
      if (r && r.ok) return;
      if (r && r.code === 'NO_STT') { this.ui.say(r.error, { mood: 'nervous', actions: [{ label: 'Open settings', pri: true, onClick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }] }); return; }
      this.ui.say(this.line('noCaptions'), {
        mood: 'confused', sticky: !soft, tag: 'listen',
        actions: [{ label: 'Got it', pri: true }, { label: 'Why?', onClick: () => this.ui.say('Browsers only let extensions hear a tab after you press their toolbar button or a shortcut — that keeps you safe. Click the Piniso icon (puzzle 🧩 menu → pin it) and press **Listen**, or press **Alt+Shift+L**.', { mood: 'idea', sticky: true, instant: true }) }]
      });
    }

    // ------------------------------------------------ main loop
    adShowing() { return PZ.site() === 'youtube' && !!document.querySelector('#movie_player.ad-showing'); }
    tick() {
      const now = Date.now();
      const dt = Math.min(6, (now - this.lastTick) / 1000);
      this.lastTick = now;
      const s = this.settings, sess = this.session, v = this.video;
      if (!sess || !v || !this.enabledHere()) return;
      if (!v.alive()) return;
      if (this.adShowing()) return;
      const t = v.t;
      const playing = !v.paused && !v.ended;
      const visible = !document.hidden || this.screenMode;
      if (this.v4 && now - (this._v4tick || 0) > 120000) { this._v4tick = now; try { this.v4.tick(); } catch (e) {} }
      if (playing && visible) {
        sess.watchSeconds += dt; this.pendingSec += dt; this.sinceBreak += dt; this.focusRun += dt;
        this.dirty = true;
        if (this.focusRun >= 45 * 60 && !(this.stats.badges || {}).no_escape) this.bumpStats((st, award) => award('no_escape'));
        if (Math.floor(sess.watchSeconds / 60) > Math.floor((sess.watchSeconds - dt) / 60)) { this.pendingXP += 1; sess.xpEarned += 1; }
      }
      if (document.hidden && this.awayStart && this.wasPlayingAway) { sess.awaySeconds += dt; }
      if (now - this.lastFlush > 30000) this.flushStats();
      try { this.plus.tick(t, playing, now); this.magic.tick(t, playing, now); this.magic.ytButton(); } catch (e) { console.warn('[Piniso] plus', e); }
      // tell Guardian we're studying (while playing, or while this lecture tab is open in front of you)
      if ((playing || document.visibilityState === 'visible') && now - (this._lastPing || 0) > (this._lastPing ? 60000 : 3000)) {
        this._lastPing = now;
        PZ.bg({ type: 'study:ping' }).then((r) => {
          if (r && r.newlyOn && this.ui && !this._gToast) {
            this._gToast = true;
            this.ui.toast(`🛡️ Guardian on — Instagram${r.shorts ? ', Shorts' : ''} & ${Math.max(0, r.sites - 1)} more sites blocked while you study`, { ms: 6000 });
          }
        });
      }
      if (this.sprintUntil) PZ.Extras.renderSprint(this);
      PZ.Extras.checkPre(this, t);
      if (this.dirty && now - (this._lastSave || 0) > 20000) { this._lastSave = now; this.dirty = false; this.save(); }

      // important moments (local, no AI) — full caption files are scanned as playback passes them
      if (this.tx && s.brain.autoImportant && playing && (this.tx.status === 'captions' || this.tx.status === 'texttrack') && t - this.scanT >= 0 && t - this.scanT < 40) {
        for (const c of this.tx.store.range(this.scanT, t)) {
          if (c.start < this.scanT - 0.5) continue;
          if (IMPORTANT.some((re) => re.test(c.text)) && now - this.lastFlagAt > 45000) { this.lastFlagAt = now; this.flagImportant(c); break; }
        }
      }
      this.scanT = t;

      // things scheduled for a playback time (comments / questions from notes written ahead)
      if (this.later.length && playing) {
        const due = this.later.filter((x) => t >= x.t);
        if (due.length) { this.later = this.later.filter((x) => t < x.t); due.forEach((x) => { try { x.fn(); } catch (e) { console.warn('[Piniso]', e); } }); }
      }
      // notes written ahead become visible as the video reaches them
      if (playing && t > (sess.maxT || 0)) sess.maxT = Math.round(t);
      if (this.ui && this.ui.deskOpen && (this.ui.tab === 'notes' || this.ui.tab === 'cards')) {
        const vis = this.visibleNotes().length;
        if (vis !== this._visN) { this._visN = vis; this.ui.refresh(['notes']); }
      }

      // auto notes + comments
      const fullTx = this.tx && (this.tx.status === 'captions' || this.tx.status === 'texttrack');
      if ((s.brain.commentsOn || s.brain.notesOn) && this.hasKey() && !this.busy && !PZ.Brain.coolingDown() && !this.quizRunning && this.tx && fullTx && s.brain.notesAhead !== false) {
        // the whole caption file is known: write notes one part AHEAD of playback, so they are ready on time
        const every = s.brain.commentEvery || 180;
        const d = (this.video && this.video.d) || Infinity;
        if (this.cursor < t - 8) this.cursor = this.processedEndAt(t);
        if (this.cursor < t + every && this.cursor < d - 5 && now - (this.lastDigestAt || 0) > (this.digests ? 25000 : 0)) {
          const t0 = this.cursor, t1 = Math.min(d, t0 + every);
          if (this.covered(t0, t1)) this.cursor = t1;
          else if (this.tx.store.words(t0, t1) >= 45) this.digest(t0, t1, true);
          else this.cursor = t1;
        }
      } else if ((s.brain.commentsOn || s.brain.notesOn) && this.hasKey() && !this.busy && !PZ.Brain.coolingDown() && !this.quizRunning && this.tx) {
        // live sources (audio / live captions): digest what was heard. First notes come sooner.
        const every = this.digests ? (s.brain.commentEvery || 180) : Math.min(75, s.brain.commentEvery || 180);
        if (t > this.cursor + every * 3) this.cursor = Math.max(this.cursor, t - every);
        if (t < this.cursor - 5) { /* re-watching, already done */ }
        else if (t - this.cursor >= every) {
          const t0 = this.cursor, t1 = t;
          if (this.covered(t0, t1)) this.cursor = t1;
          else {
            const words = this.tx.store.words(t0, t1);
            if (words >= (this.digests ? 45 : 60)) this.digest(t0, t1);
            else if (t - this.cursor >= every * 2.5) { this.cursor = t1; if ((s.brain.visionFallback || this.forceVision || this.tx.status === 'screen') && this.tx.status !== 'listening') this.snap(null, true); }
          }
        }
      }

      // quiz mode
      if (s.quiz.enabled && playing && !document.hidden && !this.busy && !this.quizRunning && !this.breakOv && this.hasKey() && !PZ.Brain.coolingDown()) {
        const last = Math.max(sess.lastQuizAt || 0, this.quizFloor || 0);
        if (t - last >= s.quiz.every && (!this.tx || this.tx.store.words(last, t) >= 80 || sess.notes.length >= 3)) this.quizNow(true);
      }
      // keep a tidy version of the notes up to date (background, rarely)
      if (s.brain.cleanAuto && !this.busy && this.hasKey() && !PZ.Brain.coolingDown() && !this.cleaning && this.visibleNotes().filter((n) => n.src !== 'user').length >= 8) {
        const have = (sess.clean && sess.clean.n) || 0, n = this.visibleNotes().length;
        if (n - have >= 12 && now - ((sess.clean && sess.clean.at) || 0) > 6 * 60000) this.makeClean(true);
      }

      // break reminder
      if (s.focus.breakEvery > 0 && this.sinceBreak >= s.focus.breakEvery * 60 && playing && !this.quizRunning && !this.breakOv && (this.plus.goodMomentForBreak() || this.sinceBreak >= s.focus.breakEvery * 60 + 90)) {
        this.sinceBreak = -10 * 60; // re-remind in 10 minutes if ignored
        this.ui.react('stretch');
        this.ui.say(this.line('breakTime', { n: s.focus.breakEvery }), { mood: 'nervous', sticky: true, actions: [{ label: `Take ${s.focus.breakLength} min break`, pri: true, icon: 'coffee', onClick: () => this.startBreak() }, { label: 'Later' }] });
      }

      // sleepy pet
      if (!playing && !this.sleeping && now - this.lastInteract > (s.focus.sleepAfter || 3) * 60000 && !this.quizRunning) {
        this.sleeping = true;
        this.ui.mood('sleep');
        if (Math.random() < 0.5) this.ui.say(this.line('sleep'), { mood: 'sleep', ms: 5000 });
        PAudio.sfx('snore');
      }
      this.updateMusic();
      if (this.ui && this.ui.deskOpen) this.ui.updateNow();
    }
    onCues(cues, src) {
      // progressive sources (live captions, audio): check fresh lines for "important" phrases
      if (!this.settings.brain.autoImportant || !this.video || src === 'captions' || src === 'texttrack') return;
      const t = this.video.t, now = Date.now();
      for (const c of cues) {
        if (Math.abs(c.start - t) > 40) continue;
        if (IMPORTANT.some((re) => re.test(c.text)) && now - this.lastFlagAt > 45000) { this.lastFlagAt = now; this.flagImportant(c); break; }
      }
    }
    onInteract() {
      this.lastInteract = Date.now();
      if (this.sleeping) this.wake();
    }
    wake() {
      this.sleeping = false;
      if (!this.ui) return;
      this.ui.mood('idle');
      this.ui.mood('shocked', 900);
      this.ui.react('jump');
      PAudio.sfx('yawn');
      if (Math.random() < 0.5) this.ui.say(this.line('wake'), { mood: 'happy', ms: 3500 });
    }

    // where playback is for a session (other saved sessions: where the student stopped)
    nowFor(sess) { if (sess && sess === this.session) return this.video ? Math.max(this.video.t, sess.maxT || 0) : Infinity; return sess && sess.lastT ? Math.max(sess.lastT, sess.maxT || 0) : Infinity; }
    visibleNotes() {
      const sess = this.session;
      if (!sess) return [];
      const t = this.nowFor(sess);
      return sess.notes.filter((n) => !n.ahead || n.t <= t + 2);
    }
    // run fn when playback reaches time t (or now, if already there)
    at(t, fn) {
      if (!this.video || this.video.t >= t - 1) { fn(); return; }
      this.later.push({ t, fn });
    }
    async digest(t0, t1, ahead) {
      const s = this.settings, sess = this.session;
      this.busy = true;
      this.lastDigestAt = Date.now();
      this.ui.setStatus('busy', 'Writing notes…');
      const text = this.tx.text(t0, t1, true);
      const flags = this.flags.filter((f) => f.t >= t0 - 8 && f.t <= t1 + 8);
      if (ahead && s.brain.autoImportant) {
        // full captions: find the teacher's "important" moments in this part right now
        for (const c of this.tx.store.range(t0, t1)) if (IMPORTANT.some((re) => re.test(c.text)) && !flags.some((f) => Math.abs(f.t - c.start) < 25)) flags.push({ t: c.start, by: 'teacher' });
      }
      const full = this.tx && (this.tx.status === 'captions' || this.tx.status === 'texttrack');
      const upcoming = full && s.study.prequestions && !this.pendingPre ? this.tx.text(t1 + 5, t1 + 200, false) : '';
      const r = await PZ.Brain.digest(s, sess, this.meta(), t0, t1, text, flags.slice(0, 4), PZ.words(upcoming) > 60 ? upcoming : '', { quiz: true });
      this.busy = false;
      this.onTxStatus(this.tx ? this.tx.status : 'searching');
      if (!this.session || this.session !== sess) return;
      if (!r.ok) return this.aiError(r);
      this.cursor = Math.max(this.cursor, t1);
      this.markProcessed(t0, t1);
      this.digests = (this.digests || 0) + 1;
      const d = r.data || {};
      // the AI's running topic name (for the next digest) vs. the topic shown to the student:
      // a part written AHEAD must not change what Piniso says you're on until you reach it
      if (d.topic) sess.aiTopic = String(d.topic).slice(0, 60);
      const topic = sess.aiTopic || sess.topic;
      const reachAt = (fn) => { if (ahead && t0 > (this.video ? this.video.t : 0) + 2) this.at(t0, () => { if (this.session === sess) fn(); }); else fn(); };
      reachAt(() => { if (topic) sess.topic = topic; });
      let added = [];
      if (s.brain.notesOn) {
        for (const n of (Array.isArray(d.notes) ? d.notes : []).slice(0, 8)) {
          if (!n || !n.text || String(n.text).trim().length < 8) continue;
          const t = isFinite(+n.t) ? PZ.clamp(+n.t, t0, t1) : t1;
          const note = { id: PZ.uid(), t, kind: ['point', 'definition', 'formula', 'example', 'tip', 'warning', 'steps'].includes(n.kind) ? n.kind : 'point', text: String(n.text).slice(0, 600), topic, src: 'ai', fresh: true, star: !!n.star };
          if (ahead && t > (this.video ? this.video.t : 0) + 2) note.ahead = true;
          sess.notes.push(note); added.push(note);
        }
        // old-style "important" list → star the nearest note
        (Array.isArray(d.important) ? d.important : []).forEach((im) => { const n = this.nearestNote(+im.t, 30, added); if (n) n.star = true; });
        // moments flagged (by you / the teacher) that the AI didn't star → star the nearest note
        flags.forEach((f) => { if (!added.some((n) => n.star && Math.abs(n.t - f.t) < 35)) { const n = this.nearestNote(f.t, 35, added); if (n) n.star = true; } });
        // replace "writing…" placeholders from starred moments in this part
        sess.notes = sess.notes.filter((n) => !(n.pending && n.t >= t0 - 5 && n.t <= t1 + 5 && added.some((x) => Math.abs(x.t - n.t) < 35)));
        const terms = (Array.isArray(d.terms) ? d.terms : []).slice(0, 5);
        reachAt(() => {
          for (const tm of terms) {
            if (!tm || !tm.term || !tm.meaning) continue;
            if (!sess.terms.some((x) => x.term.toLowerCase() === String(tm.term).toLowerCase())) sess.terms.push({ term: String(tm.term).slice(0, 80), meaning: String(tm.meaning).slice(0, 240) });
          }
        });
      }
      if (s.brain.cardsOn && Array.isArray(d.cards)) {
        const cs = d.cards.filter((c) => c && c.q && c.a).slice(0, 3).map((c) => ({ q: String(c.q).slice(0, 300), a: String(c.a).slice(0, 400), t: t1 }));
        // flashcards about a part you haven't watched appear only after you watch it
        const addCs = () => {
          const fresh = cs.filter((c) => !sess.cards.some((x) => x.q === c.q));
          fresh.forEach((c) => sess.cards.push(c));
          if (fresh.length) { PStore.addCards(fresh, { key: sess.key, title: sess.title, t: t1 }); this.ui && this.ui.refresh(['cards']); this.save(); }
        };
        if (ahead && t1 > (this.video ? this.video.t : 0) + 2) this.at(t1 - 2, () => { if (this.session === sess) addCs(); }); else addCs();
      }
      // questions for instant quizzes later
      if (Array.isArray(d.quiz) && d.quiz.length) {
        sess.qpool = (sess.qpool || []).concat(PZ.QuizRunner.normalize(d.quiz, s.quiz.types).map((q) => Object.assign(q, { t: isFinite(+q.t) ? PZ.clamp(+q.t, t0, t1) : t1, seg: t1 }))).slice(-40);
      }
      const nAdded = added.length;
      const showAt = ahead ? (added.length ? Math.min(...added.map((n) => n.t)) : t1) : 0;
      if (nAdded) {
        this.bumpStats((st) => { st.notes += nAdded; });
        this.at(showAt, () => { if (!this.ui) return; this.ui.pet.write(true); PAudio.sfx('scribble'); setTimeout(() => this.ui && this.ui.pet.write(false), 2200); });
      }
      if (s.brain.commentsOn && d.comment) {
        const comment = String(d.comment);
        const show = () => {
          if (this.session !== sess) return;
          sess.comments.push({ t: t1, text: comment });
          if (this.quizRunning || this.breakOv) return;
          this.ui.say(comment, {
            mood: PinisoPet.MOODS.includes(d.mood) ? d.mood : 'happy', time: t1, tag: 'recap', speak: this.wantSpeak(),
            actions: [{ label: 'Save', icon: 'notes', onClick: () => this.addNote({ t: t1, kind: 'tip', text: comment, src: 'comment' }) }, { label: { hinglish: 'Samjha nahi?', hindi: 'समझ नहीं आया?' }[this.lang()] || 'Didn’t get it?', icon: 'bulb', onClick: () => this.quick('simple') }]
          });
        };
        // a recap makes sense once that part has been watched
        if (ahead) this.at(Math.min(t1, (this.video && this.video.d) ? this.video.d - 3 : t1) - 4, show); else show();
      }
      if (d.prequestion) { const pq = d.prequestion; this.at(ahead ? t1 - 4 : 0, () => { if (!this.pendingPre && this.session === sess) PZ.Extras.setPre(this, pq, t1); }); }
      if (s.study.yourTurn && nAdded >= 2 && this.digests % Math.max(2, s.study.yourTurnEvery || 3) === 0) {
        this.at((ahead ? t1 : this.video.t) + 14, () => { if (!this.quizRunning && this.session === sess) PZ.Extras.yourTurn(this, added); });
      }
      this.updateYtMarks();
      this.ui.refresh(['notes', 'cards']);
      this.save();
    }
    nearestNote(t, within, pool) {
      if (!isFinite(t)) return null;
      let best = null, bd = within;
      (pool || this.session.notes).forEach((n) => { if (n.src === 'user' || n.pending) return; const dd = Math.abs(n.t - t); if (dd <= bd) { bd = dd; best = n; } });
      return best;
    }
    hideHere() {
      const list = new Set(this.settings.disabledSites || []);
      list.add(location.hostname);
      this.setSetting({ disabledSites: [...list] });
      this.ui.toast('Okay, I’ll stay away from ' + location.hostname + ' (turn me back on from the toolbar icon)');
      this.endSession().then(() => this.ui.show(false));
    }
    toggleTalk(mode) { if (this.talk.on || this.talk.starting) this.talk.stop(); else this.talk.start(mode); }
    startSprint(min) { PZ.Extras.startSprint(this, min); }
    aiError(r) {
      const L = this.ui;
      if (r.code === 'NO_KEY') {
        if (!this.noKeyShown) { this.noKeyShown = true; L.say(this.line('noKey'), { mood: 'nervous', sticky: true, actions: [{ label: 'Add free key', pri: true, onClick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }] }); }
        L.setStatus('warn', 'Add API key');
        return;
      }
      if (r.code === 'RATE_LIMIT') { if (Date.now() - this.rateShown > 5 * 60000) { this.rateShown = Date.now(); L.say(this.line('rateLimit'), { mood: 'sleepy', ms: 6000 }); } L.setStatus('warn', 'Resting (free limit)'); return; }
      if (r.code === 'BAD_KEY') { L.say(r.error, { mood: 'sad', sticky: true, instant: true, actions: [{ label: 'Fix key', pri: true, onClick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }] }); L.setStatus('bad', 'Key problem'); PZ.Brain.cooldownUntil = Date.now() + 120000; return; }
      if (r.code === 'BUSY') { L.setStatus('warn', 'AI busy — retrying soon'); PZ.Brain.cooldownUntil = Date.now() + 40000; return; }
      if (r.code === 'DEAD') { L.toast('Piniso was updated — refresh this page to continue.'); return; }
      L.setStatus('warn', 'AI hiccup');
      PZ.Brain.cooldownUntil = Date.now() + 30000;
    }
    flagImportant(c) {
      // the teacher said "important" / "exam" — the AI writes (or stars) a proper note for it
      const sess = this.session;
      if (this.flags.some((f) => Math.abs(f.t - c.start) < 30)) return;
      this.flags.push({ t: c.start, by: 'teacher' });
      if (this.covered(c.start - 2, c.start + 2)) { const n = this.nearestNote(c.start, 35); if (n) { n.star = true; this.ui.refresh(['notes']); this.updateYtMarks(); this.save(); } }
      if (sess.notes.some((n) => PZ.star(n) && Math.abs(n.t - c.start) < 30) && !this.covered(c.start - 2, c.start + 2)) return;
      this.ui.react('bigjump'); PAudio.sfx('chime');
      this.ui.say(this.line('important'), { mood: 'important', ms: 4500, tag: '⭐', time: c.start });
    }

    // ------------------------------------------------ notes actions
    addNote(n, quiet) {
      const sess = this.session;
      if (!sess) return;
      sess.notes.push(Object.assign({ id: PZ.uid(), topic: sess.topic, fresh: true }, n));
      if (!quiet) { PAudio.sfx('scribble'); this.ui.toast(this.line('saved'), { icon: 'check' }); }
      this.updateYtMarks();
      this.ui.refresh(['notes']);
      this.save();
    }
    addUserNote(text) { this.addNote({ t: this.video ? this.video.t : 0, kind: 'user', text, src: 'user' }); this.bumpStats((st) => { st.notes++; }); }
    deleteNote(id) { const s = this.session; s.notes = s.notes.filter((n) => n.id !== id); this.ui.refresh(['notes']); this.updateYtMarks(); this.save(); }
    editNote(id, text) { const n = this.session.notes.find((x) => x.id === id); if (n) n.text = text; this.ui.refresh(['notes']); this.save(); }
    starNote(id) { const n = this.session.notes.find((x) => x.id === id); if (n) { const on = !PZ.star(n); n.star = on; if (n.kind === 'important') n.kind = 'point'; PAudio.sfx('pop'); } this.ui.refresh(['notes']); this.updateYtMarks(); this.save(); }
    noteToCard(id) {
      const n = this.session.notes.find((x) => x.id === id);
      if (!n) return;
      const plain = PMd.plain(n.text);
      const m = plain.match(/^(.{3,80}?)\s*[:=—–-]\s+(.{3,})$/);
      const card = m ? { q: 'What is ' + m[1].trim() + '?', a: m[2].trim() } : { q: 'Explain: ' + plain.slice(0, 90) + (plain.length > 90 ? '…' : ''), a: n.text };
      this.addCard(card.q, card.a);
    }
    addCard(q, a) {
      const sess = this.session;
      if (!sess) return;
      sess.cards.push({ q, a, t: this.video ? this.video.t : 0 });
      PStore.addCards([{ q, a }], { key: sess.key, title: sess.title });
      this.ui.toast('Flashcard added 🃏');
      this.ui.refresh(['cards']);
      this.save();
    }
    chatToNote(m) { this.addNote({ t: m.t != null ? m.t : (this.video ? this.video.t : 0), kind: m.img ? 'snap' : 'doubt', text: m.content, img: m.img || null, src: 'chat' }); }
    async markMoment() {
      if (!this.session || !this.video) return;
      const sess = this.session, t = this.video.t;
      this.flags.push({ t, by: 'you' });
      this.ui.react('bigjump'); PAudio.sfx('ding'); this.ui.mood('important', 1800);
      this.ui.toast('Moment starred ⭐ at ' + PZ.fmt(t) + ' — writing a proper note');
      // already have an AI note here? just star it
      const near = this.nearestNote(t, 20);
      if (near && near.src === 'ai') { near.star = true; this.ui.refresh(['notes']); this.updateYtMarks(); this.save(); return; }
      const ph = { id: PZ.uid(), t, kind: 'point', star: true, pending: true, text: '✍️ *Writing a note for this moment…*', src: 'mark', topic: sess.topic };
      sess.notes.push(ph); this.ui.refresh(['notes']); this.updateYtMarks();
      const txt = this.tx ? this.tx.store.text(t - 40, t + 8, false) : '';
      let r = { ok: false };
      if (this.hasKey() && PZ.words(txt) >= 8) r = await PZ.Brain.moment(this.settings, sess, this.meta(), t, txt);
      if (this.session !== sess) return;
      const n = sess.notes.find((x) => x.id === ph.id);
      if (!n) return;
      const d = r.ok && r.data;
      if (d && d.text && String(d.text).trim().length > 6) {
        Object.assign(n, { text: String(d.text).slice(0, 600), kind: ['point', 'definition', 'formula', 'example', 'tip', 'warning', 'steps'].includes(d.kind) ? d.kind : 'point', pending: false, src: 'ai', fresh: true });
        PAudio.sfx('scribble');
      } else if (!this.hasKey() || !this.tx) {
        Object.assign(n, { text: '**Starred moment** — tap the time to rewatch.', pending: false });
      } else {
        // no words yet (or AI busy) — the next notes for this part will cover it
        Object.assign(n, { text: '**Starred moment** — I’ll fold this into the next notes.', pending: true });
      }
      this.ui.refresh(['notes']); this.save();
    }
    seek(t, keepPaused) { if (!this.video) return; this.video.seek(Math.max(0, t - 2)); if (!keepPaused) this.video.play(); this.cursor = this.processedEndAt(t); this.scanT = t; }

    updateYtMarks() {
      if (PZ.site() !== 'youtube' || !this.session || !this.video || !this.video.d) return;
      const bar = document.querySelector('#movie_player .ytp-progress-bar');
      if (!bar) return;
      let box = bar.querySelector('.pz-yt-marks');
      if (!box) { box = document.createElement('div'); box.className = 'pz-yt-marks'; bar.appendChild(box); }
      box.innerHTML = '';
      const d = this.video.d;
      this.visibleNotes().filter((n) => PZ.star(n)).forEach((n) => { const i = document.createElement('i'); i.style.left = PZ.clamp(n.t / d * 100, 0, 100) + '%'; box.appendChild(i); });
    }

    // ------------------------------------------------ ask / explain / snap
    async ask(text, withScreen, imgIn, scopeIn) {
      const sess = this.session;
      if (!sess) return this.ui.toast('Open a lecture first');
      const t = this.video ? this.video.t : 0;
      let img = imgIn || null;
      if (withScreen && !img) img = await this.captureFrame();
      sess.chat.push({ role: 'user', content: text, t, img: img ? await PZ.Video.thumb(img, 320) : null });
      this.ui.chatBusy = true; this.ui.openDesk('ask'); this.ui.mood('thinking', 60000);
      const hist = sess.chat.slice(-8, -1).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: PMd.plain(m.content).slice(0, 800) }));
      const scope = scopeIn || (this.ui && this.ui.askScope) || 'now';
      let ctx;
      if (scope === 'library') ctx = await this.libraryContext(text);
      else {
        ctx = this.timeline.context(scope, scope === 'now' ? 700 : 1000);
        if (scope !== 'now' && !scope.startsWith('range:') && sess.clean && sess.clean.md) ctx.clean = sess.clean.md;
        if (scope === 'now') ctx.notes = null;
      }
      const live = this.liveMsg(t);
      let r = await PZ.Brain.doubt(this.settings, sess, this.meta(), text, ctx, hist, img, live.onDelta);
      if (!r.ok && img && r.code === 'NO_VISION') r = await PZ.Brain.doubt(this.settings, sess, this.meta(), text, ctx, hist, null, live.onDelta);
      this.ui.chatBusy = false; this.ui.mood('idle');
      live.end();
      if (!r.ok) { sess.chat.push({ role: 'assistant', content: '😵 ' + (r.error || 'Could not answer right now.'), t }); this.aiError(r); }
      else {
        sess.chat.push({ role: 'assistant', content: r.text, t });
        this.ui.mood('idea', 2500); PAudio.sfx('pop');
        this.bumpStats((st) => { st.doubts++; st.xp += 3; }); sess.xpEarned += 3;
      }
      this.ui.refresh(['ask']);
      this.save();
    }
    // explain a specific stretch of the video (lost-here, rewinds)
    explainRange(t0, t1, question) {
      t0 = Math.max(0, Math.round(t0)); t1 = Math.max(t0 + 5, Math.round(t1));
      return this.ask(`${question} (part ${PZ.fmt(t0)}–${PZ.fmt(t1)})`, false, null, 'range:' + t0 + '-' + t1);
    }
    // Ask "📚 All my videos": find matching notes in every studied lecture
    async libraryContext(q) {
      const words = String(q).toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      const rows = (await PStore.listSessions()).filter((r) => r.study !== false && r.notes > 0).slice(0, 25);
      const hits = [];
      for (const r of rows) {
        const se = r.key === this.session.key ? this.session : await PStore.getSession(r.key);
        if (!se) continue;
        (se.notes || []).forEach((n) => {
          const txt = PMd.plain(n.text).toLowerCase();
          const sc = words.reduce((a, w) => a + (txt.includes(w) ? 1 : 0) + ((n.topic || '').toLowerCase().includes(w) ? 0.5 : 0), 0);
          if (sc > 0) hits.push({ sc, t: n.t, text: `[${se.title.slice(0, 50)} @ ${PZ.fmt(n.t)}] ${n.text}` });
        });
      }
      hits.sort((a, b) => b.sc - a.sc);
      return { text: '', label: 'ALL the student’s studied videos (library search)', notes: hits.slice(0, 25), where: this.timeline.whereAmI() + '\nYou are answering from notes across many lectures; say which video each fact comes from.' };
    }
    // start a quiz with ready questions (warm-up, mistakes …)
    startQuizWith(items, label) {
      if (!this.session || this.quizRunning || !items || !items.length) return;
      if (this.ui) this.ui.hideBubble(true);
      const t = this.video ? this.video.t : 0;
      this.quizRunning = new PZ.QuizRunner(this, { t0: t, t1: t, text: '', auto: false, items: items.map((q) => Object.assign({}, q)), label, exact: true });
      this.quizRunning.start();
    }
    // an answer bubble that fills in word by word while the AI is still writing
    liveMsg(t, label) {
      const ui = this.ui;
      let shown = false;
      const draw = PZ.throttle((txt) => { ui.streaming = { content: txt, t, label }; if (!shown) { shown = true; ui.chatBusy = false; } ui.updateStream(); }, 90);
      return {
        onDelta: (txt) => draw(txt),
        end: () => { ui.streaming = null; }
      };
    }
    async quick(mode) {
      const sess = this.session;
      if (!sess) return;
      const t = this.video ? this.video.t : 0;
      const span = { simple: 120, mnemonic: 240, example: 240, recap: 600, exam: 300 }[mode] || 180;
      const labels = { simple: '😵 Samjha nahi — explain it simply', mnemonic: '🧠 Give me a memory trick', example: '🌍 Real-life example please', recap: '🔁 Recap everything so far', exam: '🎯 What is important for the exam?' };
      sess.chat.push({ role: 'user', content: labels[mode] || mode, t });
      this.ui.chatBusy = true; this.ui.openDesk('ask'); this.ui.mood('thinking', 60000);
      const sc = (this.ui && this.ui.askScope) || 'now';
      const R = sc === 'now' || sc === 'library' ? { t0: Math.max(0, t - span), t1: t } : this.timeline.range(sc);
      const t1 = R.full ? R.t1 : Math.min(t, R.t1 != null ? R.t1 : t);
      const text = this.tx ? PZ.Timeline.sample(this.tx.text(R.t0, t1, true), R.full ? 1500 : 1000) : '';
      const live = this.liveMsg(t, mode);
      const r = await PZ.Brain.explain(this.settings, sess, this.meta(), mode, R.t0, t1, text, live.onDelta, this.timeline.whereAmI(!!R.full));
      this.ui.chatBusy = false; this.ui.mood('idle');
      live.end();
      if (!r.ok) { sess.chat.push({ role: 'assistant', content: '😵 ' + (r.error || 'Could not answer right now.'), t }); this.aiError(r); }
      else { sess.chat.push({ role: 'assistant', content: r.text, t, label: mode }); this.ui.mood('idea', 2500); PAudio.sfx('pop'); this.bumpStats((st) => { st.doubts++; st.xp += 2; }); sess.xpEarned += 2; }
      this.ui.refresh(['ask']);
      this.save();
    }
    async captureFrame(fromCommand) {
      const v = this.video;
      if (!v) return null;
      let img = await v.snap();
      if (!img) {
        const wasShown = this.ui.root.style.display !== 'none';
        this.ui.show(false);
        await PZ.sleep(80);
        const r = await PZ.bg({ type: 'snap:tab' });
        if (wasShown) this.ui.show(true);
        if (r && r.ok) img = await PZ.Video.cropShot(r.dataUrl, v.rect());
      }
      return img;
    }
    async snap(_unused, auto, fromCommand) {
      const sess = this.session, v = this.video;
      if (!sess || !v) return this.ui && this.ui.toast('Open a lecture first');
      if (this.snapping) return;
      this.snapping = true;
      try {
        const t = v.t;
        if (!auto) { this.ui.say(this.line('snap'), { mood: 'excited', ms: 2500 }); PAudio.sfx('click'); }
        const img = await this.captureFrame(fromCommand);
        if (!img) { if (!auto) this.ui.say('I could not see the screen 🙈 Press **Alt+Shift+S** on this tab and I can take the photo.', { mood: 'confused', instant: true, ms: 9000 }); return; }
        const thumb = await PZ.Video.thumb(img, 360);
        const ctx = this.tx ? this.tx.text(Math.max(0, t - 60), t, false) : '';
        if (!auto) { sess.chat.push({ role: 'user', content: '📸 Explain the board', t, img: thumb }); this.ui.chatBusy = true; this.ui.openDesk('ask'); }
        this.ui.mood('thinking', 60000);
        const r = await PZ.Brain.board(this.settings, this.meta(), t, ctx, img, { auto });
        this.ui.chatBusy = false; this.ui.mood('idle');
        if (!r.ok) {
          if (!auto) sess.chat.push({ role: 'assistant', content: '😵 ' + (r.error || 'Could not read the board.'), t });
          if (r.code !== 'NO_VISION') this.aiError(r);
        } else {
          const d = r.data || {};
          if (!auto) sess.chat.push({ role: 'assistant', content: (d.quip ? '*' + d.quip + '*\n\n' : '') + (d.explain || ''), t, img: null, label: 'board' });
          const notes = (Array.isArray(d.notes) ? d.notes : []).filter((n) => n && n.text).slice(0, 6);
          notes.forEach((n, i) => sess.notes.push({ id: PZ.uid(), t, kind: i === 0 ? 'snap' : (['formula', 'definition', 'point', 'diagram'].includes(n.kind) ? n.kind : 'point'), text: String(n.text).slice(0, 500), img: i === 0 ? thumb : null, topic: sess.topic, src: 'snap', fresh: true }));
          if (notes.length) { this.ui.pet.write(true); PAudio.sfx('scribble'); setTimeout(() => this.ui.pet.write(false), 2000); }
          if (auto && d.explain && this.settings.brain.commentsOn) this.ui.say(d.explain, { mood: 'idea', tag: '📸', time: t });
          this.bumpStats((st) => { st.snaps++; st.xp += 3; st.notes += notes.length; }); sess.xpEarned += 3;
        }
        this.ui.refresh(['ask', 'notes']);
        this.save();
      } finally { this.snapping = false; }
    }

    // ------------------------------------------------ quiz
    quizNow(auto, scope) {
      if (!this.session || !this.video) return this.ui && this.ui.toast('Open a lecture first');
      if (this.quizRunning) return;
      if (!this.hasKey()) return this.aiError({ code: 'NO_KEY' });
      const s = this.settings;
      // the student picks what to be quizzed on (Quiz tab); auto quizzes cover "since last quiz"
      scope = scope || (auto ? 'since' : (this.ui && this.ui.quizScope) || 'since');
      const C = this.timeline.context(scope, 1300);
      let { t0, t1 } = C;
      const text = C.text;
      if (PZ.words(text) < 40 && C.notes.length < 2) {
        if (!auto) this.ui.say('Thoda aur dekhne do, phir quiz banaunga 😅 (I need a few minutes of lecture first)', { mood: 'nervous', ms: 5000 });
        return;
      }
      this.ui.hideBubble(true);
      const items = this.takePool(t0, t1, s.quiz.count, scope !== 'since' && scope !== 'now');
      this.quizRunning = new PZ.QuizRunner(this, { t0, t1, text, auto, items, label: C.label, notes: C.notes });
      this.quizRunning.start();
    }
    // ready-made questions that were written together with the notes (instant quizzes)
    takePool(t0, t1, n, spread) {
      const sess = this.session, allowed = this.settings.quiz.types;
      const pool = (sess.qpool || []).filter((q) => !q.used && q.t <= t1 + 5 && q.t >= t0 - (spread ? 10 : 180) && allowed[q.type] !== false);
      let pick;
      if (spread && pool.length > n) { pool.sort((a, b) => a.t - b.t); pick = Array.from({ length: n }, (_, i) => pool[Math.floor((i + 0.5) * pool.length / n)]); }
      else pick = pool.sort((a, b) => b.t - a.t).slice(0, n).sort((a, b) => a.t - b.t);
      pick.forEach((q) => { q.used = true; });
      return pick.map((q) => Object.assign({}, q));
    }
    async voiceQuiz(items) {
      if (!this.session) return this.ui && this.ui.toast('Open a lecture first');
      if (this.talk.on || this.talk.starting) await this.talk.stop();
      if (this.quizRunning) this.quizRunning.close(false);
      const s = this.settings, t1 = this.video ? this.video.t : 0;
      let qs = (items || []).slice();
      const R = this.timeline.context((this.ui && this.ui.quizScope) || 'all', 1300);
      if (!qs.length) qs = this.takePool(R.t0, R.t1, 6, true);
      if (qs.length < 4) {
        // add flashcards from this lecture as spoken questions
        const used = new Set(qs.map((q) => q.q));
        this.session.cards.slice(-8).reverse().forEach((c) => { if (qs.length < 6 && !used.has(c.q)) qs.push({ type: 'short', q: c.q, answer: PMd.plain(c.a), t: c.t }); });
      }
      if (qs.length < 3 && this.hasKey()) {
        this.ui.toast('Making voice quiz questions…', { icon: 'mic' });
        const r = await PZ.Brain.quiz(s, this.session, this.meta(), R.t0, R.t1, R.text, 5, { label: R.label, notes: R.notes });
        if (r.ok) qs = qs.concat(PZ.QuizRunner.normalize(r.data && r.data.questions, s.quiz.types));
      }
      if (!qs.length) { this.ui.say('Thoda aur dekhne do, phir voice quiz karte hain 😅 (watch a few more minutes first)', { mood: 'nervous', ms: 5000 }); return; }
      if (this.video && !this.video.paused) this.video.pause();
      this.talk.start('vquiz', { questions: qs.slice(0, 8).map(PZ.QuizRunner.spoken) });
    }
    snoozeQuiz(sec) { if (this.session && this.video) this.session.lastQuizAt = this.video.t - this.settings.quiz.every + sec; }
    onQuizSkipped(o) { if (this.session) this.session.lastQuizAt = o.t1; this.ui.say(this.line('quizSkip'), { mood: 'sad', ms: 3000 }); this.save(); }
    onQuizAnswer(correct, score, q) {
      const xp = correct ? 10 : Math.round(score / 2);
      if (this.session) this.session.xpEarned += xp;
      this.bumpStats((st, award) => {
        st.quiz.total++; st.xp += xp;
        if (correct) { st.quiz.correct++; st.quiz.streak++; if (st.quiz.streak >= 5) award('quiz_ninja'); } else st.quiz.streak = 0;
      });
      if (xp) this.ui.toast(correct ? 'Correct!' : 'Partly right', { xp });
      this.ui.play(correct ? (Math.random() < 0.5 ? 'cheer' : 'clap') : score ? 'shrug' : 'facepalm');
    }
    onQuizDone(o, res) {
      const sess = this.session;
      if (!sess) return;
      sess.quizzes.push({ t0: o.t0, t1: o.t1, at: Date.now(), items: res, voice: !!o.voice });
      sess.lastQuizAt = o.t1;
      this.bumpStats((st) => PStore.bumpDay(st, 'quiz'));
      this.magic.markUsed(o.voice ? 'vquiz' : o.label === '60-second recall' ? 'recall' : 'quiz');
      const wrong = res.filter((r) => !r.correct).map((r) => ({ q: r.q, a: r.answer }));
      if (wrong.length) { wrong.forEach((c) => { if (!sess.cards.some((x) => x.q === c.q)) sess.cards.push(c); }); PStore.addCards(wrong, { key: sess.key, title: sess.title, t: o.t1 }); }
      if (res.length && res.every((r) => r.correct)) this.bumpStats((st, award) => award('perfect_quiz'));
      this.ui.refresh(['quiz', 'cards']);
      this.save();
    }

    // ------------------------------------------------ focus
    onVisibility() {
      const sess = this.session, v = this.video;
      if (!sess || !v || this.screenMode) return;
      if (document.hidden) {
        this.awayStart = Date.now();
        this.wasPlayingAway = !v.paused && !v.ended && !this.adShowing();
        if (this.wasPlayingAway) {
          sess.awayCount++;
          this.focusRun = 0;
          if (this.settings.focus.pauseOnLeave && !this.breakOv) { v.pause(); this.pausedByAway = true; }
        }
        this.save();
      } else if (this.awayStart) {
        const away = (Date.now() - this.awayStart) / 1000;
        this.awayStart = 0;
        if (this.wasPlayingAway && away > 3) {
          const pb = this.pausedByAway;
          this.ui.react(pb ? 'shake' : 'jump');
          PAudio.sfx('chime');
          this.ui.say(this.line(pb ? 'tabReturnPaused' : 'tabReturn', { away: PZ.fmtDur(away) }), {
            mood: away > 120 ? 'angry' : 'sad', moodMs: 3500,
            actions: pb ? [{ label: 'Resume', pri: true, icon: 'play', onClick: () => v.play() }] : []
          });
        }
        this.pausedByAway = false;
        this.ui.refresh(['focus']);
      }
    }
    focusScore() {
      const s = this.session;
      if (!s) return 100;
      const w = s.watchSeconds || 0, a = s.awaySeconds || 0;
      if (w + a < 30) return 100;
      return PZ.clamp(Math.round(100 * w / (w + a) - (s.awayCount || 0) * 2), 0, 100);
    }
    applyZen() {
      const on = this.session && this.settings.focus.zen && PZ.site() === 'youtube' && this.enabledHere();
      document.documentElement.classList.toggle('pz-zen', !!on);
    }
    shortsPolice() {
      if (!PZ.alive() || PZ.site() !== 'youtube' || !this.settings.shortsPolice || !this.enabledHere()) return;
      const onShorts = location.pathname.startsWith('/shorts');
      if (!onShorts) { if (this.shortsMode) { this.shortsMode = false; if (!this.session && this.ui) this.ui.show(false); } return; }
      this.shortsMode = true;
      this.ensureUI(); this.ui.show(true); this.ui.place(true);
      if (Date.now() - (this.lastShortsNag || 0) < 90000) return;
      this.lastShortsNag = Date.now();
      this.ui.react('shake'); PAudio.sfx('error');
      PStore.listSessions().then((list) => {
        const last = list.find((x) => x.url);
        this.ui.say(this.line('shorts'), { mood: 'angry', moodMs: 6000, actions: last ? [{ label: 'Back to my lecture', pri: true, icon: 'book', onClick: () => { location.href = last.url; } }, { label: '1 more 😅' }] : [{ label: 'Okay okay 😅' }] });
      });
    }
    startBreak() {
      if (this.breakOv) return;
      if (this.ui) this.ui.play('stretchUp');
      const v = this.video, s = this.settings;
      if (v && !v.paused) v.pause();
      this.ui.hideBubble(true);
      const total = (s.focus.breakLength || 5) * 60;
      let left = total;
      const pet = PinisoPet.create(PZ.h('div'), Object.assign({}, this.petCfg(), { size: 140 }));
      pet.setMood('music');
      const clock = PZ.h('div.clock', { text: PZ.fmt(left) });
      const tips = ['Look at something 20 feet away for 20 seconds 👀', 'Drink water 💧', 'Stand up and stretch 🙆', 'Roll your shoulders 5 times 🔄', 'Do NOT open Instagram 😤', 'Close your eyes and breathe slowly 🌬️'];
      const tip = PZ.h('div.hand', { text: tips[0] });
      const box = PZ.h('div.brk.paper', null, PZ.h('div.bp', null, pet.el), PZ.h('h3.sec', { html: 'Break <em>time</em>' }), clock, tip,
        PZ.h('div.row', { style: { justifyContent: 'center', marginTop: '14px' } }, PZ.h('button.btn', { text: 'End break early', onclick: () => done(true) })));
      this.musicFor('break', true);
      const ov = this.ui.overlay(box, { onClose: () => done(true, true) });
      this.breakOv = ov;
      let k = 0;
      const id = setInterval(() => {
        left--; clock.textContent = PZ.fmt(Math.max(0, left));
        if (left % 20 === 0) { k = (k + 1) % tips.length; tip.textContent = tips[k]; pet.react(['stretch', 'jump', 'wiggle', 'wave'][k % 4]); }
        if (left <= 0) done(false);
      }, 1000);
      const done = (early, fromClose) => {
        if (!this.breakOv) return;
        clearInterval(id);
        this.breakOv = null;
        this.sinceBreak = 0;
        this.musicFor('break', false);
        pet.destroy();
        if (!fromClose) ov.close();
        PAudio.sfx('ding');
        this.ui.say(this.line('breakDone'), { mood: 'excited', actions: v ? [{ label: 'Resume lecture', pri: true, icon: 'play', onClick: () => v.play() }] : [] });
        if (!early) this.bumpStats((st) => { st.xp += 5; });
      };
    }
    onEnded() {
      if (!this.session) return;
      this.save(true);
      this.ui.react('bigjump');
      this.ui.say(this.line('videoEnd'), { mood: 'celebrate', sticky: true, actions: [{ label: '⚡ 60-sec recall', pri: true, onClick: () => this.magic.recall() }, { label: 'Report card', icon: 'trophy', onClick: () => this.finish() }, { label: 'Later' }] });
      // a study queue? offer the next one (no autoplay rabbit hole)
      PStore.queue().then((q) => {
        if (!q.length || !this.ui) return;
        setTimeout(() => this.ui.toast('Up next: ' + String(q[0].title || 'next video').slice(0, 60), { icon: 'play', ms: 12000, action: { label: 'Play', onClick: async () => { const it = q.shift(); await PStore.saveQueue(q); location.href = it.url; } } }), 2500);
      });
    }
    async makeSummary(showReport) {
      const sess = this.session;
      if (!sess) return;
      if (!showReport && sess.notes.length < 2) { this.ui.toast('Need a few notes first 📝'); return; }
      this.ui.toast(showReport ? 'Making your report card…' : 'Making your cheat sheet…', { icon: 'sparkle' });
      this.ui.mood('thinking', 60000);
      await this.flushStats();
      const qs = (sess.quizzes || []).flatMap((q) => q.items);
      const statsLine = `watched ${Math.round(sess.watchSeconds / 60)} min, focus ${this.focusScore()}%, left the tab ${sess.awayCount} times, quiz ${qs.filter((x) => x.correct).length}/${qs.length}, notes ${sess.notes.length}`;
      let sum = null;
      if (this.hasKey() && sess.notes.length) {
        const r = await PZ.Brain.summary(this.settings, sess, this.meta(), statsLine);
        if (r.ok && r.data) { sum = r.data; sess.summary = sum; }
        else if (!r.ok) this.aiError(r);
        if (showReport && (!sess.clean || sess.notes.length - (sess.clean.n || 0) >= 3)) this.makeClean(true);
      }
      this.ui.mood('idle');
      if (!sess.finished && showReport) { sess.finished = true; sess.xpEarned += 20; this.bumpStats((st) => { st.xp += 20; }); }
      this.save();
      this.ui.refresh(['notes']);
      if (showReport) PZ.Report.show(this, sum);
      else if (sum) { this.ui.openDesk('notes'); this.ui.toast('Cheat sheet ready at the top of your notes ✨'); }
    }
    finish() { return this.makeSummary(true); }

    // tidy topic-wise notes written by the AI from all the rough notes
    async makeClean(auto) {
      const sess = this.session;
      if (!sess || this.cleaning) return;
      const notes = sess.notes.filter((n) => !n.pending);
      if (notes.length < 3) { if (!auto) this.ui.toast('Need a few notes first 📝'); return; }
      if (!this.hasKey()) { if (!auto) this.aiError({ code: 'NO_KEY' }); return; }
      this.cleaning = true;
      if (!auto) { this.ui.toast('Writing clean notes ✨', { icon: 'sparkle' }); this.ui.mood('thinking', 30000); this.magic.markUsed('clean'); }
      this.ui.refresh(['notes']);
      // only include notes the student has reached
      const view = Object.assign({}, sess, { notes: this.visibleNotes().filter((n) => !n.pending) });
      const r = await PZ.Brain.clean(this.settings, view, this.meta());
      this.cleaning = false;
      if (!auto) this.ui.mood('idle');
      if (this.session !== sess) return;
      if (!r.ok) { if (!auto) { this.ui.toast('Could not write clean notes right now'); this.aiError(r); } this.ui.refresh(['notes']); return; }
      sess.clean = { md: String(r.text || '').replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/, '').trim(), at: Date.now(), n: view.notes.length };
      if (!auto) { this.ui.notesView = 'clean'; this.ui.openDesk('notes'); PAudio.sfx('chime'); }
      this.ui.refresh(['notes']);
      this.save();
    }
    async makeCards() {
      const sess = this.session;
      if (!sess) return;
      if (this.visibleNotes().length < 2) { this.ui.toast('Need a few notes first 📝'); return; }
      if (!this.hasKey()) return this.aiError({ code: 'NO_KEY' });
      if (this.cardsBusy) return;
      this.cardsBusy = true; this.ui.refresh(['cards']);
      const view = Object.assign({}, sess, { notes: this.visibleNotes() });
      const r = await PZ.Brain.cards(this.settings, view, this.meta(), sess.cards);
      this.cardsBusy = false;
      if (this.session !== sess) return;
      if (!r.ok) { this.ui.toast('Could not make cards right now'); this.aiError(r); this.ui.refresh(['cards']); return; }
      const fresh = ((r.data && r.data.cards) || []).filter((c) => c && c.q && c.a && !sess.cards.some((x) => x.q === c.q)).slice(0, 12)
        .map((c) => ({ q: String(c.q).slice(0, 300), a: String(c.a).slice(0, 400), t: isFinite(+c.t) ? +c.t : (this.video ? this.video.t : 0) }));
      fresh.forEach((c) => sess.cards.push(c));
      if (fresh.length) { PStore.addCards(fresh, { key: sess.key, title: sess.title }); PAudio.sfx('scribble'); this.ui.toast(fresh.length + ' new flashcards 🃏'); }
      else this.ui.toast('No new cards — you already have them all 😎');
      this.ui.refresh(['cards']);
      this.save();
    }

    // ------------------------------------------------ stats
    async bumpStats(fn) {
      const settings = this.settings;
      const r = await PStore.updateStats((st, award) => { fn(st, award); st._settings = settings; }).catch(() => null);
      if (!r) return;
      this.stats = r.stats;
      if (r.newBadges.includes('mission') && this.ui) { this.ui.confetti(); PAudio.sfx('levelup'); this.ui.say('Daily mission complete! 🎯 **+50 XP** — aaj ka kaam done ✅', { mood: 'celebrate', ms: 7000 }); }
      if (r.levelUp && this.ui) {
        this.ui.confetti(); PAudio.sfx('levelup'); this.ui.react('bigjump'); this.ui.play('levelUp');
        this.ui.say(this.line('levelUp', { n: r.levelUp, title: PINISO.levelTitle(r.levelUp) }), { mood: 'celebrate', ms: 7000 });
      }
      for (const b of r.newBadges) { const B = PINISO.BADGES[b]; if (B && this.ui) setTimeout(() => this.ui.toast(`${B.icon} Badge unlocked: ${B.name}`, { ms: 4200 }), 600); }
      if (this.ui) this.ui.refresh(['focus']);
    }
    async flushStats() {
      this.lastFlush = Date.now();
      const sec = this.pendingSec, xp = this.pendingXP;
      if (sec < 1 && !xp) return;
      this.pendingSec = 0; this.pendingXP = 0;
      const goal = this.settings.focus.dailyGoal * 60;
      await this.bumpStats((st, award) => {
        const d = PStore.todayKey();
        const before = st.days[d] || 0;
        st.days[d] = before + sec; st.totalSeconds += sec; st.xp += xp;
        if (before < goal && st.days[d] >= goal) { award('goal_crusher'); this._goalHit = true; }
        const keys = Object.keys(st.days).sort();
        while (keys.length > 400) delete st.days[keys.shift()];
      });
      if (this._goalHit && this.ui) { this._goalHit = false; this.ui.confetti(); this.ui.say(`Daily goal done! ${this.settings.focus.dailyGoal} min 🎯🔥`, { mood: 'celebrate' }); }
    }

    // ------------------------------------------------ sound
    wantSpeak() { const s = this.settings.sound; return s.tts && (s.ttsWhen === 'always' || (this.video && this.video.paused)); }
    speak(text, force) {
      const s = this.settings.sound;
      if (!force && !this.wantSpeak()) return;
      const v = this.video;
      let restore = null;
      if (v && !v.paused) { const vol = v.volume; restore = vol; v.volume = vol * 0.35; }
      PAudio.speak(text, {
        lang: this.settings.lang.comments, voice: s.voice,
        onstart: () => this.ui && this.ui.pet.talk(true),
        onend: () => { this.ui && this.ui.pet.talk(false); if (restore != null && v) v.volume = restore; }
      });
    }
    musicFor(reason, on) { if (on) this.musicReasons.add(reason); else this.musicReasons.delete(reason); this.updateMusic(); }
    updateMusic() {
      const s = this.settings.sound;
      const mode = s.music;
      const v = this.video;
      const playing = v && !v.paused && !v.ended;
      let want = false;
      if (mode !== 'off' && this.session) {
        if (this.musicUser === 'off') want = false;
        else if (this.musicUser === 'on') want = true;
        else if (s.musicWhen === 'always') want = true;
        else if (s.musicWhen === 'paused') want = !playing || this.musicReasons.size > 0;
        else want = this.musicReasons.size > 0;
      }
      if (document.hidden && !this.musicReasons.size) want = false;
      if (want) { PAudio.music(mode); PAudio.duck(playing && !this.musicReasons.size); }
      else if (PAudio.playing()) PAudio.stopMusic();
      if (this.ui) this.ui.layoutRadial();
    }
    toggleMusic() {
      if (this.settings.sound.music === 'off') { this.setMusic('lofi', true); return; }
      this.musicUser = PAudio.playing() ? 'off' : 'on';
      this.updateMusic();
      this.ui.mood(PAudio.playing() ? 'music' : 'idle', 2500);
      this.ui.toast(PAudio.playing() ? 'Music on 🎧 (' + PINISO.MUSIC_MODES.find((m) => m[0] === this.settings.sound.music)[1] + ')' : 'Music off');
    }
    setMusic(mode, user) {
      if (user) this.musicUser = mode === 'off' ? 'off' : 'on';
      this.setSetting({ sound: { music: mode } });
      this.settings.sound.music = mode;
      this.updateMusic();
    }

    // ------------------------------------------------ settings + messages
    setSetting(patch) {
      this.settings = PINISO.deepMerge(this.settings, patch);
      PStore.saveSettings(patch);
      this.ui && this.ui.refresh();
    }
    onSettings(s) {
      const prevEnabled = this.enabledHere();
      this.settings = s;
      PAudio.setVolumes({ master: s.sound.master, sfx: s.sound.sfx ? s.sound.sfxVol : 0, music: s.sound.musicVol });
      if (this.ui) this.ui.applySettings(s);
      this.applyZen();
      this.updateMusic();
      if (prevEnabled !== this.enabledHere()) this.checkKey(true);
      if (this.tx) this.onTxStatus(this.tx.status);
      document.documentElement.classList.toggle('pz-hide-cc', !!(this.tx && this.tx.status === 'live' && s.focus.hideCaptions));
    }
    hotkeys(e) {
      // ⌘ Ctrl+K: the command bar (only where Piniso is already on the page)
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K') && this.ui && this.v4 && this.enabledHere()) {
        const t = e.composedPath && e.composedPath()[0];
        const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
        if (!typing || this.v4.pal) { e.preventDefault(); e.stopPropagation(); this.v4.palette(); return; }
      }
      if (!this.session || !e.altKey || !e.shiftKey) return;
      if (e.code === 'KeyM') { e.preventDefault(); e.stopPropagation(); this.action('mark'); }
      if (e.code === 'KeyK') { e.preventDefault(); e.stopPropagation(); if (this.v4) this.v4.palette(); else this.magic.open(); }
      if (e.code === 'KeyN') { e.preventDefault(); e.stopPropagation(); this.ui.toggleDesk('notes'); }
      if (e.code === 'KeyT') { e.preventDefault(); e.stopPropagation(); this.toggleTalk(); }
      if (e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); PZ.Extras.float(this); }
      if (e.code === 'KeyX') { e.preventDefault(); e.stopPropagation(); this.action('lost'); }
      if (e.code === 'KeyD') { e.preventDefault(); e.stopPropagation(); this.action('snipe'); }
      if (e.code === 'Slash') { e.preventDefault(); e.stopPropagation(); this.plus.shortcuts(); }
    }
    action(a) {
      const track = { notes: 'notes', ask: 'ask', quiz: 'quiz', snipe: 'snipe', snap: 'snipe', lost: 'lost', mark: 'mark', talk: 'talk', float: 'float', meme: 'meme', vquiz: 'vquiz', clean: 'clean', cards: 'makecards', music: 'music', fullscreen: 'fullscreen' }[a];
      if (track) this.magic.markUsed(track);
      switch (a) {
        case 'magic': this.magic.open(); break;
        case 'cmdk': if (this.v4) this.v4.palette(); break;
        case 'notes': this.ui.toggleDesk('notes'); break;
        case 'ask': this.ui.openDesk('ask'); break;
        case 'quiz': this.quizNow(false); break;
        case 'snap': this.snap(); break;
        case 'snipe': this.plus.snipe(); break;
        case 'lost': this.plus.lostHere(); break;
        case 'keys': this.plus.shortcuts(); break;
        case 'mark': this.markMoment(); break;
        case 'music': this.toggleMusic(); break;
        case 'listen': this.listenHelp(false); break;
        case 'talk': this.toggleTalk(); break;
        case 'float': PZ.Extras.float(this); break;
        case 'fullscreen': PZ.Extras.fullscreenWithMe(this); break;
        case 'meme': PZ.Extras.meme(this); break;
        case 'vquiz': this.voiceQuiz(); break;
        case 'clean': this.makeClean(false); break;
        case 'cards': this.makeCards(); break;
        default: break;
      }
    }
    onPoke() {
      if (!this.ui) return;
      PAudio.sfx('pop');
      if (this.sleeping) { this.wake(); return; }
      if (this.napKey && !this.session) { this.pinisoIt(true); return; }
      // a tap during the welcome tour ends it (it used to make taps do nothing)
      if (this.touring) { if (this.magic._tourRes) this.magic._tourRes('skip'); this.ui.hideBubble(true); this.touring = false; }
      // a tap on Piniso = all tools (the one place to find everything)
      this.ui.react(Math.random() < 0.5 ? 'poke' : 'wiggle');
      this.magic.open();
    }
    // ✨ the one action: turn everything on for this lecture
    pinisoIt(fromButton) {
      this.ensureUI();
      if (this.session) { this.magic.open(); return; }
      const key = this.keyFor();
      if (key) { this.studyOK.add(key); this.summonedKey = key; this.offerNo.delete(key); }
      this.napKey = ''; this.napShown = false;
      this.checkKey(true);
      setTimeout(() => {
        if (!this.session) { this.ui && this.ui.toast(this.video ? 'Starting… press play on the video ▶️' : 'Play a lecture video and I’ll jump in ✨'); return; }
        if (!this.settings.brain.notesOn || !this.settings.brain.commentsOn) this.setSetting({ brain: { notesOn: true, commentsOn: true } });
        this.ui.openDesk('notes');
        this.ui.react('bigjump'); PAudio.sfx('chime');
        this.ui.toast('✨ Piniso’d! Notes, quizzes & flashcards are on', { ms: 4500 });
      }, 900);
    }
    onPokeSpam() { this.ui.react('spin'); this.ui.mood('dizzy', 3000); PAudio.sfx('boing'); this.ui.say(this.line('pokeSpam'), { mood: 'dizzy', ms: 4000 }); }
    listeningLine() {
      if (!this.hasKey()) return 'Add an API key so I can write notes';
      if (!this.tx) return 'Getting ready…';
      return ({ captions: 'Reading captions… notes soon ✍️', live: 'Reading live captions… ✍️', texttrack: 'Reading subtitles… ✍️', listening: 'Listening to the teacher… 🎧', 'needs-listen': 'I can’t hear this video yet 🙉', searching: 'Looking for captions… 🔍', remote: 'Reading the embedded video…' })[this.tx.status] || 'Watching with you 👀';
    }

    onMessage(m, reply) {
      if (!m || !m.type) return false;
      switch (m.type) {
        case 'ping': {
          const sess = this.session;
          reply({ ok: true, active: !!sess, key: sess && sess.key, title: sess && sess.title, status: this.tx ? this.tx.label() : '', listen: this.needsListen(), notes: sess ? sess.notes.length : 0, minutes: sess ? Math.round(sess.watchSeconds / 60) : 0, focus: this.focusScore(), enabled: this.enabledHere(), site: location.hostname, hasVideo: !!this.video });
          return false;
        }
        case 'cmd': this.onCommand(m); reply && reply({ ok: true }); return false;
        case 'voice:evt':
          if (this.myTabId != null && m.tabId !== this.myTabId) return false;
          if (this.talk) this.talk.onEvent(m.evt);
          return false;
        case 'stt:text': if (this.tx) this.tx.onSttText(m); return false;
        case 'stt:state': if (this.tx) this.tx.onSttState(m); if (!m.on && m.error && this.ui && this.session) this.ui.say(m.error, { mood: 'confused', instant: true, ms: 8000 }); return false;
        case 'stt:error':
          if (m.code === 'RATE_LIMIT') { PZ.Brain.cooldownUntil = Date.now() + Math.max(60000, (m.retryAfter || 0) * 1000); this.aiError({ code: 'RATE_LIMIT' }); }
          else if (m.code === 'BAD_KEY' || m.code === 'NO_STT') this.aiError(m);
          return false;
        default: return false;
      }
    }
    onCommand(m) {
      this.ensureUI();
      const needSession = () => { if (!this.session) { this.ui.show(true); this.ui.say('Open a lecture video and I’ll jump in! 📺', { mood: 'confused', ms: 4000 }); return false; } return true; };
      switch (m.cmd) {
        case 'magic': this.ui.show(true); this.magic.open(); break;
        case 'cmdk': this.ui.show(true); if (this.v4) this.v4.palette(); break;
        case 'piniso-it': this.pinisoIt(true); break;
        case 'tool': this.ui.show(true); this.magic.run(m.id); break;
        case 'toggle-desk': if (needSession()) this.ui.toggleDesk(); break;
        case 'open-desk': if (needSession()) this.ui.openDesk(m.tab || 'notes'); break;
        case 'quiz-now': if (needSession()) this.quizNow(false); break;
        case 'snap': if (needSession()) this.snap(null, false, true); break;
        case 'mark-moment': if (needSession()) this.markMoment(); break;
        case 'finish': if (needSession()) this.finish(); break;
        case 'break': if (needSession()) this.startBreak(); break;
        case 'ask-selection': if (needSession()) this.ask('Explain this: “' + String(m.text || '').slice(0, 600) + '”', false); else this.ui.toast('Open a lecture first'); break;
        case 'note-selection': if (needSession()) this.addNote({ t: this.video ? this.video.t : 0, kind: 'user', text: String(m.text || '').slice(0, 800), src: 'selection' }); break;
        case 'refresh': this.summonedKey = this.keyFor(); this.checkKey(true); break;
        case 'talk': if (needSession()) { if (m.mode === 'vquiz') this.voiceQuiz(); else this.toggleTalk(m.mode); } break;
        case 'voice-quiz': if (needSession()) this.voiceQuiz(); break;
        case 'float': PZ.Extras.float(this); break;
        case 'sprint': this.startSprint(m.minutes || 25); break;
        default: break;
      }
    }

    // ------------------------------------------------ export
    toMarkdown() {
      const s = this.session;
      const out = [`# ${s.title}`, '', `Source: ${s.url}`, `Studied with Piniso · ${new Date().toLocaleDateString()}`, ''];
      if (s.summary && s.summary.recap) { out.push('## Recap', ...s.summary.recap.map((x) => '- ' + x), ''); }
      if (s.summary && s.summary.cheatsheet && s.summary.cheatsheet.length) { out.push('## Cheat sheet', ...s.summary.cheatsheet.map((x) => '- ' + x), ''); }
      if (s.clean && s.clean.md) { out.push('# Clean notes', '', s.clean.md, '', '# Timeline notes'); }
      let topic = null;
      s.notes.filter((n) => !n.pending).slice().sort((a, b) => a.t - b.t).forEach((n) => {
        const tp = n.topic || 'Notes';
        if (tp !== topic) { out.push('', '## ' + tp); topic = tp; }
        out.push(`- [${PZ.fmt(n.t)}] ${PZ.star(n) ? '⭐ ' : ''}${n.text.replace(/\n+/g, ' ')}`);
      });
      if (s.terms.length) out.push('', '## Key terms', ...s.terms.map((t) => `- **${t.term}**: ${t.meaning}`));
      if (s.cards.length) out.push('', '## Flashcards', ...s.cards.map((c) => `- Q: ${c.q}\n  A: ${c.a}`));
      return out.join('\n');
    }
    exportNotes(f) {
      const s = this.session;
      if (!s) return;
      const dl = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
      const safe = s.title.replace(/[^\wऀ-ॿ -]+/g, '').slice(0, 60).trim() || 'notes';
      if (f === 'md') { dl(`${safe} - Piniso notes.md`, this.toMarkdown(), 'text/markdown'); this.ui.toast('Markdown downloaded'); }
      else if (f === 'copy') { navigator.clipboard.writeText(this.toMarkdown()).then(() => this.ui.toast('Notes copied 📋'), () => this.ui.toast('Copy blocked here — use Markdown export')); }
      else if (f === 'anki') {
        const esc = (x) => '"' + PMd.plain(x).replace(/"/g, '""') + '"';
        dl(`${safe} - flashcards.csv`, s.cards.map((c) => esc(c.q) + ',' + esc(c.a)).join('\n'), 'text/csv');
        this.ui.toast('Anki CSV downloaded (File → Import in Anki)');
      } else if (f === 'pdf') {
        this.save(true).then(() => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/notes.html?key=' + encodeURIComponent(s.key)) }));
      } else if (f === 'booklet') {
        this.magic.markUsed('booklet');
        this.save(true).then(() => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/booklet.html?key=' + encodeURIComponent(s.key)) }));
      }
    }
  }

  const app = new App();
  PZ.app = app;
  app.init().catch((e) => console.warn('[Piniso] init failed', e));
})();
