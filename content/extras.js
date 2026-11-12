/* Piniso content — v2 extras: any-site lecture detection, full screen, focus sprints, start ritual,
   pre-questions, "Your turn" summaries, meme maker, floating always-on-top Piniso (Document PiP). */
(() => {
  if (PZ.Extras) return;
  const { h } = PZ, esc = PMd.esc;
  const I = (n, s) => PIcons.svg(n, s);
  const X = {};

  // ---------------- where Piniso should appear ----------------
  X.studySite = () => PINISO.STUDY_SITES.test(location.hostname) || location.protocol === 'chrome-extension:';
  // Is this YouTube video for studying? true / false / null (can't tell yet)
  const STUDY_RE = /\b(class\s?\d{1,2}|std\s?\d{1,2}|grade\s?\d{1,2}|lectures?|chapters?|ch\s?\d+|lessons?|tutorials?|course|explained|explanation|physics|chemistry|maths?|mathematics|biology|botany|zoology|science|history|geography|economics|civics|polity|grammar|literature|accountancy|commerce|business studies|jee|neet|upsc|ssc|gate|cat exam|cuet|cbse|icse|ncert|board exams?|exam|one ?shot|revision|numericals?|pyqs?|derivations?|theorem|formulas?|concepts?|notes|crash course|how to|learn|study|semester|university|engineering|programming|coding|python|javascript|java|c\+\+|data structures?|algorithms?|machine learning|calculus|algebra|geometry|trigonometry|statistics|probability|ielts|toefl|sat|advanced placement|olympiad|mcqs?|worksheet|syllabus|kinematics|thermodynamics|electrostatics|optics|organic|inorganic|cell|genetics|ecology|integration|differentiation|matrices|vectors)\b/i;
  const FUN_RE = /\b(official (music )?video|music video|lyrics?|lyrical|songs?|full song|trailer|teaser|vlogs?|prank|gameplay|gaming|let'?s play|reaction|reacts?|memes?|comedy|stand ?up|roast|highlights|minecraft|bgmi|free ?fire|gta|valorant|fortnite|asmr|mukbang|unboxing|movie|web ?series|episode|bigg boss|cricket|ipl|match|compilation|lo-?fi|beats to|relax|sleep music|mrbeast|tiktok)\b/i;
  X.ytStudy = () => {
    if (PZ.site() !== 'youtube') return true;
    const id = PZ.ytVideoId();
    let genre = '';
    const idMeta = document.querySelector('meta[itemprop="identifier"], meta[itemprop="videoId"]');
    if (idMeta && idMeta.content === id) { const g = document.querySelector('meta[itemprop="genre"]'); genre = g ? g.content : ''; }
    const title = (document.querySelector('ytd-watch-metadata h1, h1.ytd-watch-metadata, #title h1') || {}).textContent || document.title || '';
    const chan = (document.querySelector('ytd-watch-metadata #channel-name a, #owner #channel-name a') || {}).textContent || '';
    const text = (title + ' ' + chan).replace(/\s+/g, ' ');
    const study = STUDY_RE.test(text), fun = FUN_RE.test(title);
    if (/^(Education|Science & Technology)$/i.test(genre)) return !fun || study;
    if (study && !fun) return true;
    if (fun && !study) return false;
    if (study && fun) return true;
    if (/^(Music|Gaming|Comedy|Entertainment|Film & Animation|Sports)$/i.test(genre)) return false;
    return title.length > 3 ? null : undefined; // unknown
  };

  // study videos in YouTube's "up next" sidebar
  X.relatedStudy = () => {
    if (PZ.site() !== 'youtube') return [];
    const out = [], seen = new Set([PZ.ytVideoId()]);
    document.querySelectorAll('#secondary a[href*="/watch?v="], #related a[href*="/watch?v="]').forEach((a) => {
      let id = ''; try { id = new URL(a.href, location.href).searchParams.get('v'); } catch (e) {}
      if (!id || seen.has(id)) return;
      const card = a.closest('ytd-compact-video-renderer, yt-lockup-view-model, ytd-rich-item-renderer, ytd-video-renderer') || a.parentElement;
      const tEl = card && card.querySelector('#video-title, h3, [title]');
      const title = ((tEl && (tEl.getAttribute('title') || tEl.textContent)) || a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim();
      if (title.length < 6) return;
      const chEl = card && card.querySelector('#channel-name, ytd-channel-name, .yt-content-metadata-view-model-wiz__metadata-text, .yt-content-metadata-view-model__metadata-text');
      if (!STUDY_RE.test(title) || FUN_RE.test(title)) return;
      seen.add(id);
      out.push({ url: 'https://www.youtube.com/watch?v=' + id, vid: id, title: title.slice(0, 120), author: chEl ? chEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '' });
    });
    return out.slice(0, 8);
  };

  // Should Piniso run on this video? It never starts by itself unless you allowed it:
  //  - you tapped ✨ Piniso it on this video, or studied it before → yes
  //  - looks like a study video → ASK first with a small pop-up (or start, if you chose "always")
  //  - normal video (music, vlogs, games…) → stay completely quiet; tap ✨ Piniso it to start anyway
  X.lectureLike = (app, v) => {
    if (!v) return false;
    if (v.kind === 'remote') return true;
    const key = app.keyFor();
    if (key && (app.summonedKey === key || app.studyOK.has(key) || app.knownKeys.has(key))) return true;
    let likely = false;
    if (PZ.site() === 'youtube') {
      const st = X.ytStudy();
      if (st === undefined) return false; // page still loading
      likely = st === true || (st !== false && v.d && isFinite(v.d) && v.d >= 900);
    } else {
      const el = v.el && v.el();
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 380 || r.height < 200) return false;
      const longEnough = v.d >= 180 || (v.live && el.currentTime > 30);
      const watched = el.currentTime > 8 || (el.played && el.played.length && el.played.end(el.played.length - 1) > 8);
      likely = (X.studySite() || longEnough) && watched && !(el.muted && el.autoplay);
      if (!likely) return false;
    }
    const b = app.settings.brain || {};
    const mode = b.start || 'ask';
    if (likely && (mode === 'auto' || (b.autoSites || []).includes(location.hostname))) return true;
    if (key && app.napKey !== key) app.nap(key, likely && mode === 'ask');
    return false;
  };

  // ---------------- full screen that keeps Piniso visible ----------------
  let filled = null, rewrapping = false, oldControls = null;
  X.fill = (el, on) => {
    if (filled && (!on || filled !== el)) {
      filled.classList.remove('pz-fill');
      if (filled.tagName === 'VIDEO' && oldControls !== null) filled.controls = oldControls;
      document.documentElement.classList.remove('pz-filled');
      filled = null;
    }
    if (on && el) {
      filled = el;
      el.classList.add('pz-fill');
      document.documentElement.classList.add('pz-filled');
      if (el.tagName === 'VIDEO') { oldControls = el.controls; el.controls = true; }
    }
  };
  X.onFullscreen = (app) => {
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (rewrapping) return true;
    if (fs && app.session && app.settings.fullscreenRewrap && (fs.tagName === 'VIDEO' || fs.tagName === 'IFRAME')) {
      rewrapping = true;
      const el = fs;
      document.exitFullscreen().catch(() => {}).then(() => {
        X.fill(el, true);
        return document.documentElement.requestFullscreen();
      }).catch(() => { app.ui.toast('Full screen with Piniso: press F11 for true full screen ⛶'); })
        .finally(() => { setTimeout(() => { rewrapping = false; app.ui.place(true); }, 300); });
      return true;
    }
    if (!fs && filled) X.fill(null, false);
    return false;
  };
  function playerBox(v) {
    let best = v, vr = v.getBoundingClientRect();
    for (let el = v.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width <= vr.width + 40 && r.height <= vr.height + 140 && r.width >= vr.width - 4) best = el; else break;
    }
    return best;
  }
  X.fullscreenWithMe = (app) => {
    const v = app.video;
    if (!v) return;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (PZ.site() === 'youtube') { const b = document.querySelector('.ytp-fullscreen-button'); if (b) { b.click(); return; } }
    const target = v.kind === 'remote' ? v.iframe() : playerBox(v.el());
    if (!target) return;
    X.fill(target, true);
    document.documentElement.requestFullscreen().catch(() => app.ui.toast('Press F11 for full screen — I’ll stay with you'));
  };

  // ---------------- focus sprints (flexible, with nudges) ----------------
  X.startSprint = (app, minutes) => {
    app.sprintUntil = Date.now() + minutes * 60000;
    app.sprintLen = minutes;
    PZ.bg({ type: 'sprint:set', until: app.sprintUntil });
    PAudio.sfx('levelup');
    app.ui.say(`${minutes}-minute focus sprint started ⏱️ ${app.settings.guardian.enabled ? 'Guardian is blocking distractions.' : ''} Let’s go!`, { mood: 'cool', ms: 5000 });
    X.renderSprint(app);
  };
  X.stopSprint = (app, done) => {
    if (!app.sprintUntil) return;
    app.sprintUntil = 0;
    PZ.bg({ type: 'sprint:set', until: 0 });
    if (app.sprintChip) { app.sprintChip.remove(); app.sprintChip = null; }
    if (done) {
      PAudio.sfx('ding'); app.ui.confetti();
      app.bumpStats((st) => { st.sprints = (st.sprints || 0) + 1; st.xp += 10; });
      app.ui.say('Sprint complete! 🎉 +10 XP. Take a short break or keep the flow going?', { mood: 'celebrate', sticky: true, actions: [{ label: 'Break', pri: true, icon: 'coffee', onClick: () => app.startBreak() }, { label: 'Another sprint', onClick: () => X.startSprint(app, app.sprintLen || 25) }, { label: 'Keep going' }] });
    }
  };
  X.renderSprint = (app) => {
    if (!app.sprintUntil) return;
    const left = (app.sprintUntil - Date.now()) / 1000;
    if (left <= 0) return X.stopSprint(app, true);
    if (!app.sprintChip) { app.sprintChip = h('span.sprint'); app.ui.petWrap.append(app.sprintChip); }
    app.sprintChip.textContent = '⏱ ' + PZ.fmt(left);
  };

  // ---------------- start-of-session ritual (implementation intentions + phone away) ----------------
  X.ritual = (app) => new Promise((res) => {
    const s = app.settings;
    const L = app.lang();
    const box = h('div.ritual.paper');
    const pet = h('div', { style: { width: '90px', position: 'absolute', right: '14px', top: '-18px' } });
    pet.innerHTML = PinisoPet.svgString(app.petCfg(), 'cool');
    const phone = h('input', { type: 'checkbox' });
    const goal = h('input.inp', { placeholder: 'e.g. finish this chapter + 10 flashcards', value: s.guardian.goal || '' });
    const planOpts = ['do 1 flashcard first', 'take 3 deep breaths', 'write the distraction down for later', 'drink water and come back'];
    let plan = s.guardian.plan || planOpts[0];
    const chips = h('div.row.wrap');
    planOpts.forEach((p) => chips.append(h('button.chip' + (p === plan ? '.on' : ''), { text: p, onclick: (e) => { plan = p; [...chips.children].forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
    const sprintSel = h('select.inp', { style: { flex: 'none' } });
    [[0, 'No timer'], [25, '25 min sprint'], [45, '45 min sprint'], [60, '60 min sprint']].forEach(([v, l]) => sprintSel.append(h('option', { value: v, text: l, selected: v === 25 })));
    [goal].forEach((x) => ['keydown', 'keyup', 'keypress'].forEach((ev) => x.addEventListener(ev, (e) => e.stopPropagation())));
    box.append(pet, h('h3', { html: L === 'hinglish' ? 'Shuru karne se <em>pehle</em>…' : 'Before we <em>start</em>…' }),
      h('label.chk', null, phone, h('span', { text: '📵 My phone is in another room (or on silent, face down)' })),
      h('label.f', { text: '🎯 Goal for this session' }), goal,
      h('label.f', { text: '🛡️ If I feel distracted, I will…' }), chips,
      h('div.row', { style: { marginTop: '14px' } }, sprintSel, h('div.sp'),
        h('button.btn.ghost.sm', { text: 'Skip', onclick: () => { ov.close(); res(false); } }),
        h('button.btn.pri', { html: I('play', 15) + 'Let’s go', onclick: () => {
          app.setSetting({ guardian: { goal: goal.value.trim(), plan } });
          if (phone.checked) app.bumpStats((st) => { st.phoneAway = (st.phoneAway || 0) + 1; st.xp += 3; });
          const m = Number(sprintSel.value);
          ov.close();
          if (m) X.startSprint(app, m);
          if (!s.guardian.enabled) setTimeout(() => app.ui.say('Want me to **block Insta, Reels & co.** while you study? 🛡️', { mood: 'cool', instant: true, ms: 9000, actions: [{ label: 'Set up Guardian', pri: true, onClick: () => PZ.bg({ type: 'open:options', hash: 'study' }) }, { label: 'Not now' }] }), 2500);
          res(true);
        } })),
      h('div.small.muted', { style: { marginTop: '10px' }, text: 'Science says: phone out of sight + an “if–then” plan = way fewer distractions.' }));
    const ov = app.ui.overlay(box, { clickOut: false });
  });

  // ---------------- pre-questions (asked before the content arrives) ----------------
  X.setPre = (app, pq, t1) => {
    if (!pq || !pq.q || !app.settings.study.prequestions) return;
    const at = isFinite(+pq.t) ? PZ.clamp(+pq.t, t1 + 20, t1 + 300) : t1 + 150;
    app.pendingPre = { q: String(pq.q).slice(0, 220), a: String(pq.a || '').slice(0, 300), t: at };
    setTimeout(() => {
      if (!app.pendingPre || app.quizRunning) return;
      app.ui.say('🤔 ' + app.pendingPre.q, { mood: 'thinking', tag: 'socho', ms: 12000, actions: [{ label: 'Tell me now', onClick: () => X.revealPre(app) }] });
    }, 9000);
  };
  X.checkPre = (app, t) => { if (app.pendingPre && t >= app.pendingPre.t && !app.quizRunning) X.revealPre(app); };
  X.revealPre = (app) => {
    const p = app.pendingPre; app.pendingPre = null;
    if (!p || !p.a) return;
    app.ui.say('💡 ' + (app.lang() === 'hinglish' ? 'Mere sawaal ka jawab: ' : 'Answer to my question: ') + p.a, { mood: 'idea', ms: 10000, actions: [{ label: 'Save', icon: 'notes', onClick: () => app.addNote({ t: p.t, kind: 'tip', text: `**Q:** ${p.q}\n**A:** ${p.a}`, src: 'pre' }) }] });
  };

  // ---------------- "Your turn" (generative note-taking) ----------------
  X.yourTurn = (app, lastNotes) => {
    const L = app.lang();
    app.ui.say(L === 'hinglish' ? '✍️ Your turn! Pichhle kuch minute ek line mein samjhao:' : '✍️ Your turn! Sum up the last few minutes in one line:', {
      mood: 'writing', sticky: true, tag: 'your turn',
      input: {
        placeholder: 'Type your one-line summary…',
        onSubmit: async (val) => {
          app.ui.say('Checking… 🧐', { mood: 'thinking', ms: 20000 });
          const q = { q: 'Summarise the last part of the lecture in one line.', answer: lastNotes.map((n) => PMd.plain(n.text)).join(' '), points: lastNotes.map((n) => PMd.plain(n.text).slice(0, 80)) };
          const r = await PZ.Brain.grade(app.settings, q, val);
          app.addNote({ t: app.video ? app.video.t : 0, kind: 'user', text: '**My summary:** ' + val, src: 'yourturn' }, true);
          const d = (r && r.data) || {};
          const sc = PZ.clamp(Number(d.score) || 5, 0, 10);
          app.bumpStats((st) => { st.xp += sc; st.notes++; });
          if (app.session) app.session.xpEarned += sc;
          app.ui.say(`${d.feedback || 'Nice summary!'} (${sc}/10)`, { mood: sc >= 7 ? 'proud' : 'nervous', ms: 9000 });
          if (sc) app.ui.toast('Your-turn summary', { xp: sc });
        }
      },
      actions: [{ label: 'Skip' }]
    });
  };

  // ---------------- meme maker ----------------
  X.meme = async (app) => {
    const sess = app.session;
    if (!sess || sess.notes.length < 2) return app.ui.toast('Need a few notes first 📝');
    app.ui.toast('Cooking a meme… 🤡');
    const user = `Make ONE funny, school-safe meme about a concept from these lecture notes that also helps remember it correctly.
NOTES:\n${sess.notes.slice(-15).map((n) => '- ' + PMd.plain(n.text).slice(0, 150)).join('\n')}
Return ONLY JSON: {"top":"top text, max 8 words","bottom":"bottom text with the actual fact, max 12 words","mood":"happy|shocked|cool|proud|dizzy|love|confused|celebrate"}. Use COMMENT language. No formulas in LaTeX — write them plainly like F = ma.`;
    const r = await PZ.bg({ type: 'ai:chat', json: true, maxTokens: 500, messages: [{ role: 'system', content: 'You write short, clever, kind study memes.' }, { role: 'user', content: user }] });
    if (!r.ok || !r.data) return app.aiError(r);
    const d = r.data;
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1080;
    const ctx = c.getContext('2d');
    const t = PINISO.themeOf(app.settings);
    ctx.fillStyle = t.paper; ctx.fillRect(0, 0, 1080, 1080);
    const svg = PinisoPet.svgString(app.petCfg(), PinisoPet.MOODS.includes(d.mood) ? d.mood : 'shocked');
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });
    if (img) ctx.drawImage(img, 240, 230, 600, 643);
    URL.revokeObjectURL(url);
    try { await document.fonts.load('700 80px PinisoSans'); } catch (e) {}
    const draw = (text, y, maxLines) => {
      ctx.font = '700 84px PinisoSans, Impact, Arial Black, sans-serif';
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 14;
      const words = String(text || '').toUpperCase().split(/\s+/); const lines = []; let cur = '';
      for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > 980 && cur) { lines.push(cur); cur = w; } else cur = tt; }
      if (cur) lines.push(cur);
      lines.slice(0, maxLines).forEach((l, i) => { const yy = y + i * 92; ctx.strokeStyle = '#111'; ctx.strokeText(l, 540, yy); ctx.fillStyle = '#fff'; ctx.fillText(l, 540, yy); });
      return lines.length;
    };
    draw(d.top, 120, 2);
    const n = Math.min(3, Math.ceil(String(d.bottom || '').length / 22));
    draw(d.bottom, 1040 - (n - 1) * 92, 3);
    ctx.font = '500 26px PinisoMono, monospace'; ctx.fillStyle = t.muted; ctx.textAlign = 'right'; ctx.fillText('made with piniso', 1060, 30);
    const png = c.toDataURL('image/png');
    const box = h('div.modal.paper.meme', { style: { width: 'min(520px,100%)' } }, h('img', { src: png }),
      h('div.row', { style: { justifyContent: 'center', marginTop: '12px' } },
        h('button.btn.pri', { html: I('download', 15) + 'Download', onclick: () => { const a = document.createElement('a'); a.href = png; a.download = 'piniso-meme.png'; a.click(); } }),
        h('button.btn', { html: I('refresh', 15) + 'Another one', onclick: () => { ov.close(); X.meme(app); } })),
      h('button.ib.xbtn', { html: I('close', 17), onclick: () => ov.close() }));
    const ov = app.ui.overlay(box, { clickOut: true });
    app.bumpStats((st, award) => award('meme_lord'));
  };

  // ---------------- floating, always-on-top Piniso (Document Picture-in-Picture) ----------------
  X.float = async (app) => {
    if (app.pip) { app.pip.close(); return; }
    if (!('documentPictureInPicture' in window)) { app.ui.toast('Floating Piniso needs Chrome or Edge 116+'); return; }
    let w;
    try { w = await documentPictureInPicture.requestWindow({ width: 300, height: 360 }); }
    catch (e) { app.ui.toast('Click the float button again (the browser needs a click to open it)'); return; }
    app.pip = w;
    const d = w.document;
    const base = chrome.runtime.getURL('');
    const fontCss = [['PinisoHand', 'caveat-latin-600-normal'], ['PinisoSans', 'dm-sans-latin-500-normal'], ['PinisoSerif', 'instrument-serif-latin-400-normal'], ['PinisoMono', 'jetbrains-mono-latin-500-normal']]
      .map(([f, file]) => `@font-face{font-family:${f};src:url(${base}assets/fonts/${file}.woff2) format("woff2")}`).join('');
    const st = d.createElement('style');
    st.textContent = fontCss + (globalThis.PINISO_CSS || '') + `
      html,body{margin:0;height:100%;background:var(--paper);overflow:hidden}
      .pz.pip{position:static;pointer-events:auto;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:10px;box-sizing:border-box;background:var(--paper);background-image:var(--grain)}
      .pip .pbub{width:100%;flex:1;min-height:0;overflow:auto;font-family:var(--f-voice);font-size:calc(var(--voice-size)*.9);line-height:1.2;padding:10px 12px;border:var(--bw) solid var(--ink);border-radius:var(--r1);background:var(--paper2);box-shadow:var(--sh2);margin-bottom:8px}
      .pip .pbub p{margin:0 0 .3em}
      .pip .pmeta{font:600 11px var(--f-mono);color:var(--muted);margin:4px 0}
      .pip .pbar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
      .pip .pbar button{width:38px;height:38px;border-radius:50%;border:var(--bw) solid var(--ink);background:var(--paper2);display:grid;place-items:center;padding:0;box-shadow:var(--sh2)}
      .pip .pbar button:hover{background:var(--acc)}`;
    d.head.append(st);
    d.title = (app.settings.pet.name || 'Piniso');
    const root = d.createElement('div');
    root.className = app.ui.root.className + ' pip';
    root.style.cssText = app.ui.root.style.cssText;
    d.body.append(root);
    const bub = d.createElement('div'); bub.className = 'pbub';
    bub.innerHTML = PMd.render(app.lastSaid || PLines.pick(app.lang(), 'start', { name: app.settings.pet.name }));
    const petHost = d.createElement('div');
    const meta = d.createElement('div'); meta.className = 'pmeta';
    const bar = d.createElement('div'); bar.className = 'pbar';
    const btn = (ic, title, fn) => { const b = d.createElement('button'); b.title = title; b.innerHTML = I(ic, 17); b.onclick = fn; bar.append(b); };
    btn('mic', 'Talk', () => app.toggleTalk());
    btn('camera', 'Explain the board', () => app.snap());
    btn('star', 'Star this moment', () => app.markMoment());
    btn('play', 'Play / pause lecture', () => { const v = app.video; if (v) v.paused ? v.play() : v.pause(); });
    btn('home', 'Back to the lecture tab', () => PZ.bg({ type: 'focus:tab' }));
    root.append(bub, petHost, meta, bar);
    const pet = PinisoPet.create(petHost, Object.assign({}, app.petCfg(), { size: 110 }));
    app.ui.pipPet = pet;
    app.ui.pipBubble = bub;
    pet.setMood('happy'); pet.react('bigjump');
    const timer = setInterval(() => {
      const v = app.video, s = app.session;
      meta.textContent = [s ? '⏱ ' + PZ.fmtDur(s.watchSeconds) : '', app.sprintUntil ? 'sprint ' + PZ.fmt((app.sprintUntil - Date.now()) / 1000) : '', v ? (v.paused ? '⏸ paused' : '▶ ' + PZ.fmt(v.t)) : ''].filter(Boolean).join(' · ');
    }, 1000);
    w.addEventListener('pagehide', () => { clearInterval(timer); pet.destroy(); app.ui.pipPet = null; app.ui.pipBubble = null; app.pip = null; });
  };

  PZ.Extras = X;
})();
