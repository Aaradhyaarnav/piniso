/* Piniso content — pop quiz overlay. Never compulsory: Esc / ✕ / Skip always work. */
(() => {
  if (PZ.QuizRunner) return;
  const { h } = PZ, esc = PMd.esc;
  const I = (n, s) => PIcons.svg(n, s);
  const LET = ['A', 'B', 'C', 'D', 'E', 'F'];

  const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const clean = (w) => String(w).toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, '');
  // the correct answer as text (for results, flashcards and the booklet)
  const answerText = (q) => q.type === 'mcq' ? q.options[q.answer] : q.type === 'tf' ? (q.answer ? 'True' : 'False') : q.type === 'fix' ? `“${q.wrong}” → “${q.answer}”` : q.type === 'order' ? q.items.join(' → ') : q.type === 'match' ? q.pairs.map((p) => p[0] + ' = ' + p[1]).join('; ') : String(q.answer);
  // games can't be played by voice: turn them into spoken questions
  const spoken = (q) => {
    if (!q) return q;
    if (q.type === 'fill') return { type: 'short', q: q.q.replace(/_{3,}/g, 'blank') + ' — what fills the blank?', answer: q.answer, explain: q.explain, t: q.t };
    if (q.type === 'fix') return { type: 'short', q: 'Find the mistake: ' + q.q, answer: `“${q.wrong}” should be “${q.answer}”`, explain: q.explain, t: q.t };
    if (q.type === 'order') return { type: 'short', q: q.q + ': ' + shuffle(q.items).join(', '), answer: q.items.join(', then '), explain: q.explain, t: q.t };
    if (q.type === 'match') return { type: 'short', q: q.q + ': ' + q.pairs.map((p) => p[0]).join(', '), answer: q.pairs.map((p) => p[0] + ' goes with ' + p[1]).join('; '), explain: q.explain, t: q.t };
    return q;
  };

  function normalize(list, allowed) {
    const out = [];
    for (const q of list || []) {
      if (!q || !q.q) continue;
      let type = String(q.type || '').toLowerCase();
      if (type === 'true/false' || type === 'truefalse' || type === 'boolean') type = 'tf';
      if (type === 'multiple' || type === 'mcq_single') type = 'mcq';
      if (type === 'mcq') {
        const opts = (q.options || []).map(String).filter(Boolean).slice(0, 6);
        let a = q.answer;
        if (typeof a === 'string' && /^[A-F]$/i.test(a.trim())) a = LET.indexOf(a.trim().toUpperCase());
        if (typeof a === 'string' && !/^\d+$/.test(a)) { const i = opts.findIndex((o) => o.trim().toLowerCase() === a.trim().toLowerCase() || o.trim().toLowerCase().startsWith(a.trim().toLowerCase() + ')')); a = i; }
        if (typeof a === 'string' && /^[A-F]$/i.test(a)) a = LET.indexOf(a.toUpperCase());
        a = Number(a);
        // the AI also gives the correct option's text: trust it over the number (fixes 1-based / shifted answers)
        if (q.answer_text) {
          const at = String(q.answer_text).trim().toLowerCase().replace(/^[a-f][).:]\s*/, '');
          const j = opts.findIndex((o) => o.trim().toLowerCase().replace(/^[a-f][).:]\s*/, '') === at);
          if (j >= 0) a = j;
        }
        if (opts.length < 2 || !(a >= 0 && a < opts.length)) continue;
        out.push({ type, q: q.q, options: opts, answer: a, explain: q.explain || '', t: q.t });
      } else if (type === 'tf') {
        let a = q.answer;
        if (typeof a === 'string') a = /^(t|true|yes|sahi|correct)/i.test(a.trim());
        out.push({ type, q: q.q, answer: !!a, explain: q.explain || '', t: q.t });
      } else if (type === 'fill' || type === 'blank' || type === 'fill_blank') {
        // a sentence with a blank + word chips
        const ans = String(q.answer || q.answer_text || '').trim();
        let opts = (q.options || []).map(String).map((o) => o.trim()).filter(Boolean).slice(0, 5);
        if (!ans) continue;
        if (!opts.some((o) => o.toLowerCase() === ans.toLowerCase())) opts = opts.slice(0, 3).concat([ans]);
        if (opts.length < 2) continue;
        let qq = String(q.q);
        if (!/_{3,}/.test(qq)) { const re = new RegExp('\\b' + ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); if (re.test(qq)) qq = qq.replace(re, '____'); else continue; }
        out.push({ type: 'fill', q: qq, answer: ans, options: shuffle(opts), explain: q.explain || '', t: q.t });
      } else if (type === 'fix' || type === 'mistake' || type === 'spot') {
        // a statement with ONE wrong word: tap it
        const wrong = String(q.wrong || '').trim(), right = String(q.answer || q.right || '').trim();
        if (!wrong || !right || !new RegExp('\\b' + wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(String(q.q))) continue;
        out.push({ type: 'fix', q: String(q.q), wrong, answer: right, explain: q.explain || '', t: q.t });
      } else if (type === 'order' || type === 'sequence') {
        const items = (q.items || q.steps || []).map(String).map((x) => x.trim()).filter(Boolean).slice(0, 6);
        if (items.length < 3) continue;
        out.push({ type: 'order', q: q.q || 'Put these in the right order', items, explain: q.explain || '', t: q.t });
      } else if (type === 'match' || type === 'pairs') {
        const pairs = (q.pairs || []).filter((x) => Array.isArray(x) && x[0] && x[1]).map((x) => [String(x[0]).trim(), String(x[1]).trim()]).slice(0, 5);
        if (pairs.length < 3) continue;
        out.push({ type: 'match', q: q.q || 'Match the pairs', pairs, explain: q.explain || '', t: q.t });
      } else if (type === 'short' || type === 'long') {
        if (!q.answer) continue;
        out.push({ type, q: q.q, answer: String(q.answer), accept: q.accept || [], points: q.points || [], explain: q.explain || '', t: q.t });
      }
    }
    const ok = out.filter((q) => allowed[q.type] !== false);
    return ok.length ? ok : out;
  }

  class QuizRunner {
    constructor(app, o) {
      this.app = app; this.o = o;
      this.items = []; this.i = 0; this.answered = false;
      this.wasPlaying = false;
    }
    async start() {
      const app = this.app, v = app.video;
      PAudio.sfx('boing');
      this.card = h('div.qcard.paper');
      this.pet = PinisoPet.create(h('div'), Object.assign({}, app.petCfg(), { size: 74 }));
      this.pet.el.classList.add('qpet');
      this.pet.setMood('thinking');
      this.card.append(this.pet.el);
      this.content = h('div');
      this.card.append(this.content, h('button.ib.xbtn', { title: 'Close (Esc)', html: I('close', 17), onclick: () => this.close(true) }));
      this.ov = app.ui.overlay(this.card, { overVideo: true, onKey: (e) => this.key(e), onClose: () => this.closed() });
      if (v && !v.paused && (app.settings.quiz.autoPause || !this.o.auto)) { this.wasPlaying = true; v.pause(); }
      app.musicFor('quiz', true);
      const want = this.o.exact && this.o.items ? this.o.items.length : Math.max(1, app.settings.quiz.count);
      let items = (this.o.items || []).slice(0, want), quip = '';
      if (items.length < want) {
        // ready-made questions (written with the notes) cover part of it; ask the AI only for the rest
        this.renderLoading();
        const avoid = items.map((q) => q.q).concat((app.session.quizzes || []).slice(-3).flatMap((z) => (z.items || []).map((x) => x.q)));
        const r = await PZ.Brain.quiz(app.settings, app.session, app.meta(), this.o.t0, this.o.t1, this.o.text, want - items.length + 1, { label: this.o.label, notes: this.o.notes, avoid, difficulty: app.plus && app.plus.difficulty() });
        if (this.dead) return;
        if (!r.ok && !items.length) { this.renderError(r); return; }
        if (r.ok) {
          // drop near-duplicates (same key words as a question we already have)
          const STOP = new Set(['what', 'which', 'when', 'where', 'why', 'how', 'the', 'is', 'are', 'of', 'a', 'an', 'in', 'to', 'and', 'does', 'do', 'for', 'true', 'false', 'kya', 'hai', 'ka', 'ki', 'ke']);
          const words = (x) => new Set(PMd.plain(x).toLowerCase().replace(/^pool q\d+:\s*/, '').replace(/[^a-z0-9\u0900-\u097f ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
          const same = (a, b) => { let n = 0; a.forEach((w) => { if (b.has(w)) n++; }); return n / Math.max(1, Math.min(a.size, b.size)) >= 0.75; };
          const have = items.map((q) => words(q.q));
          const fresh = normalize(r.data && r.data.questions, app.settings.quiz.types).filter((q) => { const w = words(q.q); if (have.some((x) => same(x, w))) return false; have.push(w); return true; });
          items = items.concat(fresh).slice(0, want); quip = r.data && r.data.quip;
        }
      }
      this.items = items;
      if (!this.items.length) { this.renderError({ error: 'I could not make good questions from this part. Watch a bit more and try again!' }); return; }
      this.quip = quip || PLines.pick(app.lang(), 'quizIntro', { n: this.items.length });
      this.results = [];
      this.pet.setMood('excited', 1500);
      this.renderQ();
    }
    renderLoading() {
      this.content.innerHTML = '';
      this.content.append(
        h('div.qhead', null, h('span.k', { text: 'Pop quiz' }), h('span.small.muted', { text: `${PZ.fmt(this.o.t0)} – ${PZ.fmt(this.o.t1)}` })),
        h('div.cook', null, h('div.hand', { text: PLines.pick(this.app.lang(), 'thinking') }), h('span.typing', { html: '<i></i><i></i><i></i>' })),
        h('div.qfoot', null, h('div.sp'), h('button.btn.sm', { text: 'Skip quiz', onclick: () => this.close(true) }))
      );
    }
    renderError(r) {
      this.pet.setMood('nervous');
      this.content.innerHTML = '';
      this.content.append(
        h('div.qhead', null, h('span.k', { text: 'Pop quiz' })),
        h('div.qquip', { text: r.code === 'NO_KEY' ? PLines.pick(this.app.lang(), 'noKey') : r.code === 'RATE_LIMIT' ? PLines.pick(this.app.lang(), 'rateLimit') : 'Oops 😵' }),
        h('div.small.muted', { text: r.error || 'Something went wrong.' }),
        h('div.qfoot', null, r.code === 'NO_KEY' ? h('button.btn.sm.pri', { text: 'Add a free key', onclick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }) : null, h('div.sp'), h('button.btn.sm', { text: 'Close', onclick: () => this.close(false) }))
      );
    }
    progress() {
      const p = h('div.qprog');
      this.items.forEach((_, k) => p.append(h('i' + (k < this.i ? '.done' : k === this.i ? '.cur' : ''))));
      return p;
    }
    renderQ() {
      const q = this.items[this.i];
      this.answered = false;
      this.pet.setMood('thinking');
      const c = this.content;
      c.innerHTML = '';
      const typeLab = { mcq: 'Choose one', tf: 'True or false', short: 'One-word answer', long: 'Write your answer', fill: '🧩 Fill the blank', fix: '🕵️ Spot the mistake', order: '🔢 Put in order', match: '🔗 Match the pairs' }[q.type];
      c.append(...[
        h('div.qhead', null, h('span.k', { text: `Q${this.i + 1}/${this.items.length}` }), h('span.small.muted', { text: typeLab }), q.t != null ? h('button.ts', { text: PZ.fmt(q.t), title: 'Where this was taught', onclick: () => this.app.seek(q.t, true) }) : null,
          h('div.sp'), h('button.btn.sm.ghost.qvoice', { html: I('mic', 14) + 'Answer by voice', title: 'Piniso asks the rest of these questions out loud', onclick: () => this.toVoice() })),
        this.i === 0 ? h('div.qquip', { text: this.quip }) : null,
        this.progress(),
        /^(fill|fix)$/.test(q.type) ? null : h('div.qq', { html: PMd.render(q.q) })
      ].filter(Boolean));
      if (q.type === 'fill') this.renderFill(q, c);
      else if (q.type === 'fix') this.renderFix(q, c);
      else if (q.type === 'order') this.renderOrder(q, c);
      else if (q.type === 'match') this.renderMatch(q, c);
      else if (q.type === 'mcq') {
        const box = h('div.qopts');
        q.options.forEach((o, k) => box.append(h('button.qopt', { 'data-k': k, html: `<span class="l">${LET[k]}</span><span>${PMd.inline(o)}</span>`, onclick: () => this.pick(k) })));
        c.append(box);
      } else if (q.type === 'tf') {
        const box = h('div.qopts.qtf');
        box.append(h('button.qopt', { 'data-k': 1, html: '✓ True', onclick: () => this.pick(true) }), h('button.qopt', { 'data-k': 0, html: '✗ False', onclick: () => this.pick(false) }));
        c.append(box);
      } else {
        const inp = q.type === 'short' ? h('input.inp', { placeholder: 'Your answer…', style: { width: '100%' } }) : h('textarea.inp', { placeholder: 'Write in your own words (Hinglish is fine)…', style: { width: '100%', minHeight: '96px' } });
        ['keydown', 'keyup', 'keypress'].forEach((ev) => inp.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter' && (q.type === 'short' || e.ctrlKey)) { e.preventDefault(); this.submit(inp.value); } if (e.key === 'Escape') this.close(true); }));
        c.append(inp, h('div.qfoot', null, h('button.btn.pri', { html: I('check', 15) + 'Check', onclick: () => this.submit(inp.value) }), h('button.btn.ghost.sm', { text: 'Show answer', onclick: () => this.submit('') })));
        setTimeout(() => inp.focus(), 60);
        this.inp = inp;
      }
      c.append(this.footer());
    }
    // ---- 🧩 fill the blank: tap the right word chip ----
    renderFill(q, c) {
      const parts = String(q.q).split(/_{3,}/);
      const blank = h('span.blank', { text: '?' });
      const sent = h('div.qfill');
      parts.forEach((p, i) => { sent.append(h('span', { html: PMd.inline(p) })); if (i < parts.length - 1 && i === 0) sent.append(blank); });
      const words = h('div.qwords');
      q.options.forEach((o, k) => words.append(h('button.qword', { text: o, 'data-k': k, onclick: (e) => {
        if (this.answered) return;
        this.answered = true;
        const ok = clean(o) === clean(q.answer);
        blank.textContent = ok ? o : q.answer;
        blank.classList.add(ok ? 'ok' : 'no');
        words.querySelectorAll('.qword').forEach((b) => { b.disabled = true; if (clean(b.textContent) === clean(q.answer)) b.classList.add('ok'); });
        if (!ok) e.currentTarget.classList.add('no');
        this.result(ok, ok ? 10 : 0, q.explain || `**Answer:** ${q.answer}`, o);
      } })));
      c.append(sent, h('div.qhelp', { text: 'Tap the word that fits (or press 1–' + q.options.length + ')' }), words);
    }
    // ---- 🕵️ spot the mistake: tap the wrong word in the sentence ----
    renderFix(q, c) {
      const box = h('div.qfix');
      let tries = 0;
      String(q.q).split(/(\s+)/).forEach((tok) => {
        if (/^\s+$/.test(tok) || !tok) { box.append(tok); return; }
        const w = h('button.w', { text: tok, onclick: () => {
          if (this.answered) return;
          const ok = clean(tok) === clean(q.wrong) || (q.wrong.includes(' ') && q.wrong.toLowerCase().split(/\s+/).map(clean).includes(clean(tok)));
          if (ok) {
            this.answered = true; w.classList.add('ok');
            w.after(h('b', { style: { color: '#1f9d55', marginLeft: '4px' }, text: '→ ' + q.answer }));
            this.result(tries === 0, tries === 0 ? 10 : 5, q.explain || `“${q.wrong}” should be “${q.answer}”.`, tok, false, tries > 0);
          } else {
            tries++; w.classList.add('no'); PAudio.sfx('womp'); this.pet.react('shake');
            if (tries >= 2) {
              this.answered = true;
              box.querySelectorAll('.w').forEach((b) => { if (clean(b.textContent) === clean(q.wrong)) b.classList.add('hint'); });
              this.result(false, 0, q.explain || `The mistake was “${q.wrong}” — it should be “${q.answer}”.`, tok);
            }
          }
        } });
        box.append(w);
      });
      c.append(h('div.qhelp', { text: 'One word in this sentence is wrong. Tap it! (2 tries)' }), box);
    }
    // ---- 🔢 put in order: tap the steps from first to last ----
    renderOrder(q, c) {
      let shown = shuffle(q.items);
      for (let k = 0; k < 4 && shown.join('|') === q.items.join('|'); k++) shown = shuffle(q.items);
      const list = h('div.qorder');
      const picked = [];
      const undo = h('button.btn.sm.ghost', { text: '↩ Undo', onclick: () => {
        if (this.answered || !picked.length) return;
        const last = picked.pop();
        const el = [...list.children].find((x) => x.dataset.t === last && x.classList.contains('picked') && x.querySelector('.on').textContent == picked.length + 1);
        if (el) { el.classList.remove('picked'); el.querySelector('.on').textContent = ''; }
      } });
      shown.forEach((txt) => {
        const it = h('button.oi', { 'data-t': txt, onclick: () => {
          if (this.answered || it.classList.contains('picked')) return;
          picked.push(txt); it.classList.add('picked'); it.querySelector('.on').textContent = picked.length; PAudio.sfx('click');
          if (picked.length === q.items.length) {
            this.answered = true;
            let right = 0; picked.forEach((p, i) => { if (p === q.items[i]) right++; });
            [...list.children].forEach((el) => { const pos = picked.indexOf(el.dataset.t); el.classList.add(q.items[pos] === el.dataset.t ? 'ok' : 'no'); el.disabled = true; });
            const ok = right === q.items.length;
            this.result(ok, Math.round(right / q.items.length * 10), (q.explain ? q.explain + '\n' : '') + '**Right order:** ' + q.items.map((x, i) => `${i + 1}. ${x}`).join('  '), picked.join(' → '), false, !ok && right >= q.items.length / 2);
          }
        } }, h('span.on'), h('span', { text: txt }));
        list.append(it);
      });
      c.append(h('div.qhelp', { text: 'Tap the steps from FIRST to LAST' }), list, h('div.row', null, undo));
    }
    // ---- 🔗 match the pairs: tap a left card, then its partner ----
    renderMatch(q, c) {
      const L = h('div.mc'), R = h('div.mc');
      const rights = shuffle(q.pairs.map((p) => p[1]));
      const COLS = ['#FFD23F', '#3FA7FF', '#4DD48A', '#B07CFF', '#FF8FAE'];
      let sel = null, mistakes = 0, done = 0;
      q.pairs.forEach((p, i) => {
        const b = h('button.mi', { text: p[0], onclick: () => { if (this.answered || b.classList.contains('done')) return; L.querySelectorAll('.mi').forEach((x) => x.classList.remove('sel')); sel = { i, b }; b.classList.add('sel'); PAudio.sfx('click'); } });
        L.append(b);
      });
      rights.forEach((r) => {
        const b = h('button.mi', { text: r, onclick: () => {
          if (this.answered || !sel || b.classList.contains('done')) return;
          if (q.pairs[sel.i][1] === r) {
            const col = COLS[done % COLS.length];
            [sel.b, b].forEach((x) => { x.classList.remove('sel'); x.classList.add('done'); x.dataset.c = '1'; x.style.setProperty('--mc', col); });
            done++; sel = null; PAudio.sfx('ding'); this.pet.react('nod');
            if (done === q.pairs.length) {
              this.answered = true;
              const score = Math.max(0, 10 - mistakes * 3);
              this.result(mistakes === 0, score, (q.explain ? q.explain + '\n' : '') + (mistakes ? `${mistakes} wrong tr${mistakes > 1 ? 'ies' : 'y'} on the way.` : 'Perfect match! 🔗'), `${mistakes} mistakes`, false, mistakes > 0 && mistakes <= 2);
            }
          } else { mistakes++; b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 420); PAudio.sfx('womp'); }
        } });
        R.append(b);
      });
      c.append(h('div.qhelp', { text: 'Tap a card on the left, then its partner on the right' }), h('div.qmatch', null, L, R));
    }
    toVoice() {
      const rest = this.items.slice(this.i + (this.answered ? 1 : 0));
      if (this.results && this.results.length) this.app.onQuizDone(this.o, this.results);
      this.finished = true;
      this.wasPlaying = false; // the voice quiz keeps the video paused
      if (this.ov) this.ov.close();
      this.app.voiceQuiz(rest);
    }
    footer() {
      const f = h('div.qfoot');
      f.append(h('button.btn.sm.ghost', { text: 'Skip question', onclick: () => this.skip() }), h('div.sp'));
      if (this.o.auto) {
        f.append(h('button.tiny', { text: 'Remind me in 2 min', onclick: () => { this.app.snoozeQuiz(120); this.close(true); } }));
        f.append(h('button.tiny', { text: 'Turn off quiz mode', onclick: () => { this.app.setSetting({ quiz: { enabled: false } }); this.app.ui.toast('Quiz mode off. Turn it on again from the Quiz tab.'); this.close(true); } }));
      }
      return f;
    }
    key(e) {
      if (!this.items.length) return false;
      const q = this.items[this.i];
      if (this.answered && (e.key === 'Enter' || e.key === ' ')) { this.next(); return true; }
      if (this.answered) return false;
      if (q.type === 'mcq' && /^[1-6]$/.test(e.key)) { const k = +e.key - 1; if (k < q.options.length) { this.pick(k); return true; } }
      if (q.type === 'mcq' && /^[a-f]$/i.test(e.key) && !e.ctrlKey && !e.metaKey) { const k = LET.indexOf(e.key.toUpperCase()); if (k < q.options.length) { this.pick(k); return true; } }
      if (q.type === 'tf' && /^[tf]$/i.test(e.key)) { this.pick(e.key.toLowerCase() === 't'); return true; }
      if (q.type === 'fill' && /^[1-6]$/.test(e.key)) { const b = this.content.querySelectorAll('.qword')[+e.key - 1]; if (b) { b.click(); return true; } }
      return false;
    }
    pick(k) {
      if (this.answered) return;
      const q = this.items[this.i];
      const correct = q.type === 'tf' ? k === q.answer : k === q.answer;
      this.answered = true;
      this.content.querySelectorAll('.qopt').forEach((b) => {
        b.disabled = true;
        const bk = q.type === 'tf' ? b.dataset.k === '1' : +b.dataset.k;
        if (bk === q.answer) b.classList.add('right');
        else if (bk === k) b.classList.add('wrong');
      });
      const user = q.type === 'tf' ? (k ? 'True' : 'False') : q.options[k];
      this.result(correct, correct ? 10 : 0, q.explain, user);
    }
    async submit(text) {
      if (this.answered) return;
      const q = this.items[this.i];
      text = String(text || '').trim();
      this.answered = true;
      if (this.inp) this.inp.disabled = true;
      if (!text) { this.result(false, 0, `**Answer:** ${q.answer}${q.explain ? '\n' + q.explain : ''}`, '', true); return; }
      if (q.type === 'short' && PZ.Brain.quickCheck(q, text)) { this.result(true, 10, q.explain || `**Answer:** ${q.answer}`, text); return; }
      const wait = h('div.qfb', { html: '<span class="typing"><i></i><i></i><i></i></span> checking your answer…' });
      this.content.querySelector('.qfoot').before(wait);
      this.pet.setMood('thinking');
      const r = await PZ.Brain.grade(this.app.settings, q, text);
      wait.remove();
      if (this.dead) return;
      if (!r.ok || !r.data) { this.result(false, 0, `I could not check this right now. **Model answer:** ${q.answer}`, text, true); this.selfMark(); return; }
      const d = r.data, score = PZ.clamp(Number(d.score) || 0, 0, 10);
      const verdict = String(d.verdict || '').toLowerCase();
      const correct = verdict ? verdict === 'correct' && score >= 5 : score >= 7;
      const extra = (d.missing && d.missing.length ? '\n**Missing:** ' + d.missing.join('; ') : '') + `\n**Model answer:** ${q.answer}`;
      this.result(correct, correct ? Math.max(score, 7) : Math.min(score, verdict === 'partial' ? 6 : 3), (d.feedback || '') + extra, text, false, verdict === 'partial');
    }
    // the checker failed: let the student mark it honestly
    selfMark() {
      const fb = this.content.querySelector('.qfb');
      if (!fb) return;
      const row = h('div.row', { style: { gap: '6px', marginTop: '8px' } },
        h('span.small.muted', { text: 'Compare with the model answer:' }), h('div.sp'),
        h('button.btn.sm.ok', { text: 'I was right', onclick: () => { const r = this.results[this.results.length - 1]; if (r) { r.correct = true; r.score = 10; } this.app.onQuizAnswer(true, 10, this.items[this.i]); row.replaceWith(h('div.small', { text: 'Marked right ✓ (honesty mode 😇)' })); } }),
        h('button.btn.sm.bad', { text: 'I was wrong', onclick: () => row.replaceWith(h('div.small', { text: 'No problem — saved to flashcards 🃏' })) }));
      fb.append(row);
    }
    result(correct, score, explain, user, revealed, partial) {
      const q = this.items[this.i];
      const L = this.app.lang();
      this.results.push({ q: q.q, type: q.type, correct, score, user, t: q.t, answer: answerText(q) });
      if (correct) { PAudio.sfx('ding'); this.pet.setMood('celebrate', 2500); this.pet.react('jump'); }
      else if (partial) { PAudio.sfx('pop'); this.pet.setMood('proud', 2000); }
      else if (!revealed) { PAudio.sfx('womp'); this.pet.setMood('dizzy', 2200); this.pet.react('shake'); }
      const fb = h('div.qfb.' + (correct ? 'good' : 'bad'));
      const verdict = correct ? PLines.pick(L, 'quizCorrect') : partial ? `Half marks! ${score}/10 🤏` : revealed ? 'No worries, here it is 👇' : PLines.pick(L, 'quizWrong');
      const yours = !correct && user && (q.type === 'short' || q.type === 'long') ? `<div class="qyours"><span>Your answer</span> ${esc(String(user).slice(0, 200))}</div>` : '';
      fb.innerHTML = `<div class="v">${esc(verdict)}</div>${yours}${PMd.render(explain || '')}`;
      const foots = [...this.content.querySelectorAll('.qfoot')];
      const foot = foots[foots.length - 1];
      foots.slice(0, -1).forEach((f) => f.remove());
      foot.before(fb);
      foot.innerHTML = '';
      foot.append(h('div.sp'), h('button.btn.pri', { html: (this.i + 1 < this.items.length ? 'Next question' : 'See my score') + ' ' + I('chevron', 15), onclick: () => this.next() }));
      foot.querySelector('button').focus();
      this.app.onQuizAnswer(correct, score, q);
    }
    skip() {
      const q = this.items[this.i];
      if (!this.answered) this.results.push({ q: q.q, type: q.type, correct: false, score: 0, skipped: true, t: q.t, answer: answerText(q) });
      this.next();
    }
    next() {
      this.i++;
      if (this.i < this.items.length) this.renderQ();
      else this.renderScore();
    }
    renderScore() {
      const res = this.results;
      const right = res.filter((r) => r.correct).length;
      const L = this.app.lang();
      const good = right / Math.max(1, res.length) >= 0.6;
      this.pet.setMood(good ? 'celebrate' : 'nervous');
      if (right === res.length && res.length) { this.app.ui.confetti(); PAudio.sfx('levelup'); }
      const c = this.content;
      c.innerHTML = '';
      c.append(...[
        h('div.qhead', null, h('span.k', { text: 'Result' })),
        h('div.score', null, h('div.big', { text: `${right}/${res.length}` }), h('div.hand', { text: PLines.pick(L, good ? 'quizDoneGood' : 'quizDoneBad') })),
        res.some((r) => !r.correct) ? h('div.small.muted', { style: { textAlign: 'center' }, text: 'Missed ones are saved as flashcards for revision 🃏' }) : null,
        h('div.qfoot', null, h('div.sp'), h('button.btn.pri', { html: I('play', 15) + (this.wasPlaying ? 'Resume video' : 'Done'), onclick: () => this.close(false) }))
      ].filter(Boolean));
      this.app.onQuizDone(this.o, res);
      this.finished = true;
      setTimeout(() => { const b = c.querySelector('.btn.pri'); b && b.focus(); }, 50);
    }
    close(skipped) {
      if (this.dead) return;
      if (skipped && !this.finished) this.app.onQuizSkipped(this.o);
      this.ov && this.ov.close();
    }
    closed() {
      this.dead = true;
      this.pet && this.pet.destroy();
      this.app.musicFor('quiz', false);
      this.app.quizRunning = null;
      if (this.wasPlaying && this.app.video) this.app.video.play();
    }
  }

  PZ.QuizRunner = QuizRunner;
  PZ.normalizeQuiz = normalize;
  QuizRunner.normalize = normalize;
  QuizRunner.spoken = spoken;
  QuizRunner.answerText = answerText;
})();
