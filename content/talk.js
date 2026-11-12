/* Piniso content — interactive voice Talk mode UI + tools the voice model can call. */
(() => {
  if (PZ.Talk) return;
  const { h } = PZ, esc = PMd.esc;
  const I = (n, s) => PIcons.svg(n, s);

  const LANG = {
    hinglish: 'Hinglish — Hindi and English mixed the way Indian students talk (Roman-script Hindi words are fine to speak). Technical terms in English.',
    english: 'simple, clear English (Indian English accent is fine). Easy words only.',
    hindi: 'simple Hindi. Keep technical terms and formulas in English.',
    auto: 'the same language the student speaks to you.'
  };
  const MODE = {
    buddy: 'STUDY BUDDY mode: be a friendly study buddy. Answer doubts clearly with everyday examples, then sometimes check understanding with one quick question.',
    teach: 'TEACH PINISO mode: pretend to be a curious student who does NOT understand the current topic yet. Ask the student to explain it to you simply. Ask "why?" and "what if…?" follow-ups, act confused about the tricky parts, and only at the end gently correct mistakes and give a 2-line summary. When they explain something well, call award_xp with 15 points.',
    socratic: 'SOCRATIC mode: never give the final answer directly. Guide with short questions, one small step at a time. Give a hint only after two wrong tries.',
    rapid: 'RAPID-FIRE QUIZ mode: first call get_lecture_context. Then ask 10 short questions about what was taught, one at a time, and wait for each answer. After each answer say right or wrong in a few words plus a one-line why. Call award_xp with 10 points for each correct answer. Keep the score out loud ("3 out of 4!"). Finish with the final score and a funny line.',
    vquiz: 'VOICE QUIZ mode: you are running a spoken quiz. Use the QUIZ QUESTIONS listed in the context below, in order (you may reword them to sound natural; for MCQ read the options as A, B, C, D). Ask ONE question, then stop and wait for the answer. Accept answers in any wording or language, and spelling/pronunciation slips. After each answer: say right or wrong in a few words + a one-line why, call award_xp with 10 points if correct (5 if partly right). Say the running score out loud. When all questions are done, call finish_voice_quiz with the score and the questions they got wrong, then give one funny line and ask if they want more.',
    coach: 'FOCUS COACH mode: in under a minute help the student plan: ask what they want to finish, suggest a focus sprint and start it with start_focus_sprint, remind them to keep the phone away. Strict but funny about distractions. Then wish them luck and stay quiet unless they talk.'
  };

  const TOOLS = [
    { name: 'pause_video', description: 'Pause the lecture video.', parameters: { type: 'object', properties: {} } },
    { name: 'play_video', description: 'Resume the lecture video.', parameters: { type: 'object', properties: {} } },
    { name: 'rewind', description: 'Jump back in the lecture by some seconds and play.', parameters: { type: 'object', properties: { seconds: { type: 'number', description: 'How many seconds to go back' } }, required: ['seconds'] } },
    { name: 'seek_to', description: 'Jump to an exact time in the lecture (seconds from start).', parameters: { type: 'object', properties: { seconds: { type: 'number' } }, required: ['seconds'] } },
    { name: 'get_lecture_context', description: 'Read what the teacher said + the notes for ANY part of the lecture the student has watched. Default: last 4 minutes. Use whole_video for "everything so far", a topic name, or from/to seconds for a specific part. Call it before answering lecture questions.', parameters: { type: 'object', properties: { minutes: { type: 'number', description: 'How many minutes back from now' }, from_seconds: { type: 'number' }, to_seconds: { type: 'number' }, topic: { type: 'string', description: 'A topic or chapter name from the context' }, whole_video: { type: 'boolean', description: 'Everything watched so far' }, include_unwatched: { type: 'boolean', description: 'Use the WHOLE video including parts not watched yet — only when the student has turned on Whole video or asks about later parts' } } } },
    { name: 'search_notes', description: 'Search the student\'s notes and the transcript for a word or idea; returns matching lines with times. Use to find WHERE something was taught.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    { name: 'show_card', description: 'Show a small card ON SCREEN while you talk: a formula, steps, a table, a diagram in words, or key points. Use it whenever math, formulas, spellings or lists are involved — say it out loud AND show it.', parameters: { type: 'object', properties: { title: { type: 'string' }, markdown: { type: 'string', description: 'Markdown; use $LaTeX$ for math' } }, required: ['markdown'] } },
    { name: 'get_my_mistakes', description: 'The questions the student got wrong recently (from quizzes). Use for revision.', parameters: { type: 'object', properties: {} } },
    { name: 'make_flashcard', description: 'Save a flashcard for revision.', parameters: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] } },
    { name: 'look_at_screen', description: 'See the current lecture screen/board as an image. Use when the student says this, board, diagram, slide or screen.', parameters: { type: 'object', properties: {} } },
    { name: 'add_note', description: 'Save a short note to the student notes.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'mark_important', description: 'Star the current moment of the lecture as important.', parameters: { type: 'object', properties: {} } },
    { name: 'start_quiz', description: 'Open an on-screen quiz about the last part of the lecture.', parameters: { type: 'object', properties: {} } },
    { name: 'award_xp', description: 'Give the student XP points for a correct answer or a good explanation.', parameters: { type: 'object', properties: { points: { type: 'number' }, reason: { type: 'string' } }, required: ['points'] } },
    { name: 'get_due_flashcards', description: 'Get up to 5 flashcards the student should revise now.', parameters: { type: 'object', properties: {} } },
    { name: 'start_focus_sprint', description: 'Start a focus sprint timer; distracting sites get blocked if Guardian is on.', parameters: { type: 'object', properties: { minutes: { type: 'number' } }, required: ['minutes'] } },
    { name: 'finish_voice_quiz', description: 'Call once when the voice quiz is over, to save the score.', parameters: { type: 'object', properties: { correct: { type: 'number' }, total: { type: 'number' }, missed: { type: 'array', items: { type: 'string' }, description: 'The questions the student got wrong' } }, required: ['correct', 'total'] } },
    { name: 'open_notes', description: 'Open the notes desk on screen.', parameters: { type: 'object', properties: {} } }
  ];

  class Talk {
    constructor(app) { this.app = app; this.on = false; this.lines = []; this.cur = { you: '', pz: '' }; this.lastSeq = -1; this.rapid = 0; }

    systemPrompt() {
      const app = this.app, s = app.settings, sess = app.session, v = app.video;
      const lg = s.lang.comments;
      const mode = this.modeNow || s.voice.mode;
      const T = app.timeline;
      const vis = sess ? app.visibleNotes().filter((n) => !n.pending) : [];
      const ctx = sess ? [
        `Lecture: "${app.meta().title}"`,
        T ? T.whereAmI(!!app.voiceFull) : '',
        vis.length ? 'NOTES SO FAR (time · note):\n' + vis.slice(-25).map((n) => `- ${PZ.fmt(n.t)} · ${PZ.star(n) ? '⭐ ' : ''}${PMd.plain(n.text).slice(0, 150)}`).join('\n') : 'No notes yet.',
        sess.clean && sess.clean.md ? 'CLEAN NOTES (summary of the lecture so far):\n' + PMd.plain(sess.clean.md).slice(0, 1400) : '',
        app.tx ? 'TEACHER, LAST 3 MINUTES: ' + app.tx.text(Math.max(0, (v ? v.t : 0) - 180), v ? v.t : 0, false).split(/\s+/).slice(-380).join(' ') : '',
        this.recent && this.recent.length ? 'OTHER LECTURES THE STUDENT STUDIED RECENTLY: ' + this.recent.join(' | ') : ''
      ].filter(Boolean).join('\n') : 'No lecture open right now.';
      return [
        `You are ${s.pet.name || 'Piniso'}, a tiny round jelly-blob study buddy holding a pencil. You are talking OUT LOUD with a student who is studying.`,
        `Speak in ${LANG[lg] || LANG.english}`,
        'Voice style: warm, playful, a little funny, but always useful and correct. Keep replies SHORT (1–3 sentences) unless the student asks for a full explanation. One question at a time. Never read long lists, tables or long formulas aloud — put them in show_card and say the gist.',
        'Be a smart tutor, not a search engine: connect answers to WHERE the student is in the lecture ("the teacher just did this at 12:40"), check understanding with a quick follow-up question now and then, and if they are confused, try a simpler analogy. Use the student\'s own notes and mistakes.',
        'Tools: get_lecture_context (any part they watched: minutes back, a topic, from/to seconds, or whole_video), search_notes (find where something was taught), show_card (formulas/steps on screen), seek_to / rewind (to replay the exact part), look_at_screen (board/diagram), add_note, make_flashcard, get_my_mistakes. Never invent what the teacher said — check with a tool, or say you are not sure.',
        app.voiceFull ? 'The student turned on WHOLE VIDEO: you may talk about any part, including parts not watched yet (use get_lecture_context with include_unwatched). Say the timestamp when you mention a later part.' : 'Do not spoil parts of the video the student has not reached; you may say "that comes in the next chapter". If they want later parts, tell them to tap "🎬 Whole video" in this panel.',
        'If the student goes off-topic for long, kindly bring them back to studying.',
        MODE[mode] || MODE.buddy,
        '--- CONTEXT ---', ctx,
        mode === 'vquiz' && this.questions && this.questions.length ? '--- QUIZ QUESTIONS ---\n' + this.questions.map((q, i) => `${i + 1}. [${q.type}] ${PMd.plain(q.q)}${q.options ? ' | options: ' + q.options.map((o, j) => 'ABCD'[j] + ') ' + PMd.plain(o)).join('  ') : ''} | correct answer: ${q.type === 'mcq' ? 'ABCD'[q.answer] + ') ' + PMd.plain(q.options[q.answer]) : q.type === 'tf' ? (q.answer ? 'True' : 'False') : PMd.plain(String(q.answer))}${q.explain ? ' | why: ' + PMd.plain(q.explain).slice(0, 160) : ''}`).join('\n') : ''
      ].join('\n');
    }

    async start(mode, extra) {
      const app = this.app;
      if (this.on || this.starting) return;
      app.ensureUI();
      this.modeNow = null; this.questions = null;
      if (app.magic) app.magic.markUsed(mode === 'vquiz' ? 'vquiz' : 'talk');
      if (mode === 'vquiz') { this.modeNow = 'vquiz'; this.questions = (extra && extra.questions) || []; this.vq = { t1: app.video ? app.video.t : 0 }; }
      else if (mode) app.setSetting({ voice: { mode } });
      this.starting = true;
      try { const cur = app.session && app.session.key; this.recent = (await PStore.listSessions()).filter((x) => x.key !== cur && x.study !== false).slice(0, 6).map((x) => x.title.slice(0, 70)); } catch (e) { this.recent = []; }
      this.buildPanel();
      this.setState('connecting');
      if (app.video && app.settings.voice.pauseVideo && !app.video.paused) { app.video.pause(); this.pausedVideo = true; }
      const r = await PZ.bg({ type: 'voice:start', system: this.systemPrompt(), tools: TOOLS, opener: this.modeNow === 'vquiz' ? '(The student started a VOICE QUIZ. Say one short funny line that the quiz is starting, then ask question 1.)' : '(The student just opened voice talk. Greet them in ONE short funny line in your language, then start your mode.)', ptt: app.settings.voice.ptt });
      this.starting = false;
      if (!r || !r.ok) {
        if (r && r.code === 'NEEDS_MIC') { this.setState('ended'); this.closePanel(); app.ui.say('I need microphone permission once 🎙️ A tab opened — click **Allow**, then press Talk again.', { mood: 'nervous', instant: true, ms: 9000 }); return; }
        this.setState('ended'); this.closePanel();
        app.ui.say((r && r.error) || 'Could not start voice talk.', { mood: 'sad', instant: true, sticky: true, actions: r && r.code === 'NO_VOICE_KEY' ? [{ label: 'Add free Gemini key', pri: true, onClick: () => PZ.bg({ type: 'open:options', hash: 'brain' }) }] : [] });
        return;
      }
      this.on = true;
      this.startedAt = Date.now();
      this.lines = []; this.cur = { you: '', pz: '' };
    }
    async stop() {
      if (!this.on && !this.panel) return;
      await PZ.bg({ type: 'voice:op', op: 'stop' });
      this.end();
    }
    end(err) {
      const app = this.app;
      const wasOn = this.on;
      this.on = false;
      if (app.ui && app.ui.micState) app.ui.micState('ended');
      this.flushCaptions();
      this.closePanel();
      app.ui && app.ui.pet && app.ui.pet.talk(false);
      if (wasOn && this.startedAt) {
        const secs = (Date.now() - this.startedAt) / 1000;
        app.bumpStats((st, award) => { st.voiceSeconds = (st.voiceSeconds || 0) + secs; st.xp += Math.round(secs / 60); if (st.voiceSeconds >= 1800) award('chatterbox'); if (app.settings.voice.mode === 'teach' && secs > 90) award('teacher'); if (this.rapid >= 8) award('rapid_king'); });
        app.save();
      }
      this.rapid = 0;
      if (err && err !== 'NEEDS_MIC') app.ui.toast('Voice ended: ' + String(err).slice(0, 120));
    }

    // ---------- events from the offscreen voice engine ----------
    onEvent(evt) {
      if (evt.seq != null) { if (evt.seq <= this.lastSeq) return; this.lastSeq = evt.seq; }
      const ui = this.app.ui;
      switch (evt.kind) {
        case 'state':
          this.setState(evt.state);
          if (evt.state === 'live') { PAudio.sfx('chime'); ui.mood('happy', 1500); }
          if (evt.state === 'ended') this.end(evt.error);
          break;
        case 'caption': this.caption(evt.who, evt.text); break;
        case 'turn': this.finishLine(evt.who); break;
        case 'interrupt': this.finishLine('pz'); break;
        case 'level': this.level(evt); break;
        case 'tool': this.runTool(evt.id, evt.name, evt.args || {}); break;
        case 'error': ui.toast(evt.error); break;
        default: break;
      }
    }
    level(e) {
      const pets = this.app.ui.pets();
      if (!pets.length) return;
      const speaking = e.speaking && e.pz > 0.02;
      pets.forEach((pet) => { pet.talk(speaking); if (!speaking && e.you > 0.06) pet.setMood('listening', 600); });
      if (this.ring) {
        const lv = Math.min(1, Math.max(e.you || 0, speaking ? e.pz : 0) * 2.2);
        this.ring.style.setProperty('--lv', lv.toFixed(2));
        this.ring.classList.toggle('pz-speaking', speaking);
        this.ring.classList.toggle('you-speaking', !speaking && (e.you || 0) > 0.05);
      }
    }
    caption(who, text) {
      if (!text) return;
      if (who === 'you' && this.cur.pz) this.finishLine('pz');
      if (who === 'pz' && this.cur.you) this.finishLine('you');
      this.cur[who] += text;
      this.renderCaptions();
    }
    finishLine(who) {
      const t = (this.cur[who] || '').trim();
      if (t) {
        this.lines.push({ who, text: t });
        const sess = this.app.session;
        if (sess) sess.chat.push({ role: who === 'you' ? 'user' : 'assistant', content: t, t: this.app.video ? this.app.video.t : 0, label: 'voice' });
      }
      this.cur[who] = '';
      this.renderCaptions();
    }
    flushCaptions() { this.finishLine('you'); this.finishLine('pz'); }

    // ---------- tools ----------
    async runTool(id, name, a) {
      const app = this.app, v = app.video;
      let result = 'done';
      try {
        switch (name) {
          case 'pause_video': if (v) { v.pause(); result = 'Paused at ' + PZ.fmt(v.t); } else result = 'No video open'; break;
          case 'play_video': if (v) { v.play(); result = 'Playing from ' + PZ.fmt(v.t) + '. (Mic stays on; ask the student to use headphones.)'; } else result = 'No video open'; break;
          case 'rewind': if (v) { const t = Math.max(0, v.t - (Number(a.seconds) || 30)); v.seek(t); v.play(); result = 'Rewound to ' + PZ.fmt(t); } break;
          case 'seek_to': if (v) { v.seek(Math.max(0, Number(a.seconds) || 0)); result = 'Jumped to ' + PZ.fmt(a.seconds); } break;
          case 'get_lecture_context': {
            let scope = 'm' + PZ.clamp(Math.round(Number(a.minutes) || 4), 1, 120);
            if (a.include_unwatched && app.voiceFull) scope = 'full';
            else if (a.whole_video) scope = app.voiceFull ? 'full' : 'all';
            else if (a.from_seconds != null || a.to_seconds != null) scope = 'range:' + Math.max(0, Math.round(Number(a.from_seconds) || 0)) + '-' + Math.round(Number(a.to_seconds) || (v ? v.t : 0));
            else if (a.topic) {
              const want = String(a.topic).toLowerCase();
              const tp = app.timeline.topics().find((x) => x.topic.toLowerCase().includes(want) || want.includes(x.topic.toLowerCase()));
              const ci = app.timeline.chapters().findIndex((c) => c.title.toLowerCase().includes(want));
              if (ci >= 0) scope = 'chapter:' + ci; else if (tp) scope = 'topic:' + tp.topic;
            }
            const C = app.timeline.context(scope, scope === 'all' || scope === 'full' ? 1600 : 1300);
            const notes = C.notes.slice(-30).map((n) => `[${PZ.fmt(n.t)}] ${PMd.plain(n.text).slice(0, 160)}`).join('\n');
            result = `Lecture "${app.meta().title}". ${C.where}\nPART: ${C.label} (${PZ.fmt(C.t0)}–${PZ.fmt(C.t1)}).\nTRANSCRIPT ([seconds] stamps${scope === 'all' || scope === 'full' ? ', sampled' : ''}):\n${C.text || '(no transcript available — suggest Listen mode or look_at_screen)'}\nNOTES FOR THIS PART:\n${notes || '(none)'}`;
            break;
          }
          case 'search_notes': {
            const q = String(a.query || '').toLowerCase().trim();
            const words = q.split(/\s+/).filter((w) => w.length > 2);
            const hit = (txt) => words.length && words.some((w) => txt.toLowerCase().includes(w));
            const ns = app.visibleNotes().filter((n) => hit(PMd.plain(n.text))).slice(0, 8).map((n) => `[${PZ.fmt(n.t)}] note: ${PMd.plain(n.text).slice(0, 150)}`);
            const cues = app.tx ? app.tx.store.range(0, v ? v.t : 0).filter((c) => hit(c.text)).slice(0, 8).map((c) => `[${PZ.fmt(c.start)}] teacher: ${c.text.slice(0, 140)}`) : [];
            result = ns.concat(cues).join('\n') || 'Nothing found for "' + q + '" in the part watched so far.';
            break;
          }
          case 'show_card': this.showCard(String(a.title || ''), String(a.markdown || '')); result = 'Shown on screen'; break;
          case 'get_my_mistakes': {
            const sess = app.session;
            const wrong = (sess ? sess.quizzes : []).flatMap((q) => q.items || []).filter((x) => !x.correct).slice(-8);
            result = wrong.length ? wrong.map((x, i) => `${i + 1}. ${PMd.plain(x.q)} → correct: ${PMd.plain(String(x.answer || ''))}${x.user ? ' (student said: ' + String(x.user).slice(0, 60) + ')' : ''}`).join('\n') : 'No mistakes recorded in this lecture yet.';
            break;
          }
          case 'make_flashcard': app.addCard(String(a.question || '').slice(0, 300), String(a.answer || '').slice(0, 400)); result = 'Flashcard saved'; break;
          case 'look_at_screen': {
            const img = await app.captureFrame();
            if (img) { await PZ.bg({ type: 'voice:op', op: 'image', dataUrl: await PZ.Video.thumb(img, 960) }); result = 'Sent you the current screen image. Describe and explain what is on it.'; }
            else result = 'Could not capture the screen. Ask the student to press Alt+Shift+S.';
            break;
          }
          case 'add_note': app.addNote({ t: v ? v.t : 0, kind: 'tip', text: String(a.text || '').slice(0, 500), src: 'voice' }); result = 'Saved to notes'; break;
          case 'mark_important': app.markMoment(); result = 'Starred'; break;
          case 'start_quiz': setTimeout(() => app.quizNow(false), 300); result = 'Quiz opened on screen'; break;
          case 'award_xp': {
            const pts = PZ.clamp(Math.round(Number(a.points) || 5), 1, 25);
            if (app.settings.voice.mode === 'rapid' || this.modeNow === 'vquiz') this.rapid++;
            app.bumpStats((st) => { st.xp += pts; });
            if (app.session) app.session.xpEarned += pts;
            app.ui.toast(a.reason ? String(a.reason).slice(0, 60) : 'Nice!', { xp: pts });
            app.ui.react('jump'); PAudio.sfx('ding');
            result = 'Awarded ' + pts + ' XP';
            break;
          }
          case 'get_due_flashcards': {
            const now = Date.now();
            const due = (await PStore.cards()).filter((c) => c.due <= now).slice(0, 5);
            result = due.length ? due.map((c, i) => `${i + 1}. Q: ${PMd.plain(c.q)} | A: ${PMd.plain(c.a)}`).join('\n') : 'No cards due right now.';
            break;
          }
          case 'start_focus_sprint': app.startSprint(PZ.clamp(Number(a.minutes) || 25, 5, 120)); result = 'Sprint started for ' + (a.minutes || 25) + ' minutes'; break;
          case 'open_notes': app.ui.openDesk('notes'); result = 'Notes open'; break;
          case 'finish_voice_quiz': {
            const total = PZ.clamp(Math.round(Number(a.total) || 0), 0, 50), correct = PZ.clamp(Math.round(Number(a.correct) || 0), 0, total);
            const missed = (Array.isArray(a.missed) ? a.missed : []).map(String);
            const qs = this.questions || [];
            const items = qs.slice(0, total || qs.length).map((q) => { const miss = missed.some((m) => m && (PMd.plain(q.q).toLowerCase().includes(m.toLowerCase().slice(0, 30)) || m.toLowerCase().includes(PMd.plain(q.q).toLowerCase().slice(0, 30)))); return { q: q.q, answer: q.type === 'mcq' ? q.options[q.answer] : q.type === 'tf' ? (q.answer ? 'True' : 'False') : q.answer, correct: !miss, voice: true }; });
            // if matching failed, trust the numbers
            let right = items.filter((x) => x.correct).length;
            for (let i = 0; i < items.length && right > correct; i++) if (items[i].correct) { items[i].correct = false; right--; }
            if (items.length) app.onQuizDone({ t0: this.vq ? Math.max(0, this.vq.t1 - 600) : 0, t1: this.vq ? this.vq.t1 : 0, voice: true }, items);
            app.ui.toast(`Voice quiz: ${correct}/${total} ✓`, { icon: 'quiz' });
            if (total && correct === total) { app.ui.confetti(); PAudio.sfx('levelup'); }
            result = 'Saved. Score ' + correct + '/' + total;
            break;
          }
          default: result = 'Unknown tool';
        }
      } catch (e) { result = 'Error: ' + e.message; }
      PZ.bg({ type: 'voice:op', op: 'tool', id, name, result });
      this.toolFlash(name);
    }
    toolFlash(name) {
      const map = { pause_video: '⏸ paused', play_video: '▶ playing', rewind: '⏪ rewound', seek_to: '⏩ jumped', get_lecture_context: '📖 reading the lecture', look_at_screen: '📸 looking at screen', add_note: '📝 note saved', mark_important: '⭐ starred', start_quiz: '❓ quiz', award_xp: '⚡ XP', search_notes: '🔎 searching notes', show_card: '🪧 on screen', get_my_mistakes: '📕 your mistakes', make_flashcard: '🃏 card saved', finish_voice_quiz: '🏁 score saved', get_due_flashcards: '🃏 cards', start_focus_sprint: '⏱ sprint', open_notes: '📝 notes' };
      if (this.toolEl) { this.toolEl.textContent = map[name] || name; this.toolEl.classList.remove('pz-flash'); void this.toolEl.offsetWidth; this.toolEl.classList.add('pz-flash'); }
    }

    // ---------- panel ----------
    buildPanel() {
      const ui = this.app.ui;
      if (this.panel) return;
      const s = this.app.settings;
      const p = this.panel = h('div.talk.paper');
      this.ring = h('div.torb', null, h('i'), h('i'), h('i'));
      this.stateEl = h('span.pill', { text: 'Connecting…' });
      this.timerEl = h('span.small.muted', { text: '0:00' });
      this.toolEl = h('span.ttool');
      const end = h('button.ib.tclose', { title: 'End talk (Alt+Shift+T)', 'aria-label': 'End talk', html: I('close', 17), onclick: () => this.stop() });
      // modes as chips (one tap to switch)
      const cur = this.modeNow || s.voice.mode;
      const modes = h('div.tmodes');
      PINISO.VOICE_MODES.forEach(([k, lab, desc]) => modes.append(h('button.chip.sm' + (cur === k ? '.on' : ''), { text: lab, title: desc || '', onclick: async () => { if (k === cur) return; await this.stop(); setTimeout(() => (k === 'vquiz' ? this.app.voiceQuiz() : this.start(k)), 300); } })));
      // what Piniso may talk about: only what you've watched (default) or the whole video
      const T = this.app.timeline, F = T ? T.fullReady() : { ok: false };
      if (F.ok && cur !== 'vquiz') {
        const full = !!this.app.voiceFull;
        modes.append(h('button.chip.sm.tfull' + (full ? '.on' : ''), { text: full ? '🎬 Whole video ✓' : '🎬 Whole video', title: full ? 'Piniso can talk about every part, even ones you have not watched. Tap to go back to “only what I watched”.' : 'Let Piniso use the full video, even parts you have not watched yet', onclick: async () => { this.app.voiceFull = !full; await this.stop(); setTimeout(() => this.start(cur), 300); } }));
      }
      this.boardEl = h('div.tboard', { hidden: true });
      this.capEl = h('div.tcap');
      // one-tap prompts
      const say = (text) => { this.caption('you', text); this.finishLine('you'); PZ.bg({ type: 'voice:op', op: 'text', text }); };
      const lg = this.app.lang();
      const sugg = h('div.tsugg');
      [['🔁', lg === 'hinglish' ? 'Abhi wala samjhao' : 'Explain the last part', 'Explain what the teacher just taught, simply, and show the key formula or points on screen.'],
        ['❓', 'Quiz me', 'Ask me one quick question about what I just watched.'],
        ['🧾', 'Sum up so far', 'Summarise the whole lecture so far in 4 points and show them on screen.'],
        ['⏭️', 'What’s next?', 'Where am I in the lecture, and what comes next?'],
        ['📕', 'My mistakes', 'Go over the questions I got wrong.']].forEach(([e, lab, text]) => sugg.append(h('button.chip.sm', { html: e + ' ' + esc(lab), onclick: () => say(text) })));
      this.micBtn = h('button.tbtn', { title: 'Mute / unmute mic', html: I('ear', 18), onclick: () => this.toggleMute() });
      const shot = h('button.tbtn', { title: 'Show Piniso the screen', html: I('camera', 18), onclick: () => this.runToolLocal('look_at_screen') });
      const typeBox = h('input.inp', { placeholder: 'or type to ' + (s.pet.name || 'Piniso') + '…' });
      ['keydown', 'keyup', 'keypress'].forEach((ev) => typeBox.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter' && typeBox.value.trim()) { say(typeBox.value.trim()); typeBox.value = ''; } }));
      const row = h('div.trow', null, this.micBtn, shot, typeBox);
      if (s.voice.ptt) {
        const ptt = h('button.tbtn.tptt', { text: 'Hold to talk' });
        const down = () => { ptt.classList.add('on'); PZ.bg({ type: 'voice:op', op: 'talking', on: true }); };
        const up = () => { ptt.classList.remove('on'); PZ.bg({ type: 'voice:op', op: 'talking', on: false }); };
        ptt.addEventListener('pointerdown', down); ptt.addEventListener('pointerup', up); ptt.addEventListener('pointerleave', up);
        row.append(ptt);
      }
      p.append(h('div.thead', null, this.ring, h('div.tttl', null, h('b', { text: 'Talking with ' + (s.pet.name || 'Piniso') }), h('div.row', null, this.stateEl, this.timerEl, this.toolEl)), end),
        modes, this.boardEl, this.capEl, sugg, row);
      ui.root.append(p);
      this.place();
      this.tick = setInterval(() => { if (this.startedAt) this.timerEl.textContent = PZ.fmt((Date.now() - this.startedAt) / 1000); this.place(); }, 1000);
      this.renderCaptions();
    }
    showCard(title, md) {
      if (!this.boardEl) return;
      this.boardEl.hidden = false;
      this.boardEl.innerHTML = '';
      const x = h('button.ib.tbx', { title: 'Hide', html: I('close', 13), onclick: () => { this.boardEl.hidden = true; } });
      const save = h('button.btn.sm.ghost', { html: I('notes', 13) + 'Save to notes', onclick: () => { this.app.addNote({ t: this.app.video ? this.app.video.t : 0, kind: /\$/.test(md) ? 'formula' : 'point', text: (title ? '**' + title + '** — ' : '') + md.slice(0, 600), src: 'voice' }); save.disabled = true; save.textContent = 'Saved ✓'; } });
      const body = h('div.tbody'); body.innerHTML = PMd.render(md.slice(0, 1500));
      this.boardEl.append(h('div.row', null, h('b', { text: title || 'On the board' }), h('div.sp'), save, x), body);
      this.boardEl.classList.remove('pop'); void this.boardEl.offsetWidth; this.boardEl.classList.add('pop');
      PAudio.sfx('pop');
      this.place();
    }
    runToolLocal(name) { this.runTool('local-' + Date.now(), name, {}); if (name === 'look_at_screen') setTimeout(() => PZ.bg({ type: 'voice:op', op: 'text', text: 'I just shared my screen with you. Explain what is on it.' }), 900); }
    place() {
      if (!this.panel) return;
      const pr = this.app.ui.petRect();
      const w = Math.min(370, innerWidth - 16), H = this.panel.offsetHeight || 300;
      const right = pr.x + pr.w / 2 > innerWidth / 2;
      let x = right ? pr.x - w - 12 : pr.x + pr.w + 12;
      let y = pr.y + pr.h - H;
      x = PZ.clamp(x, 8, innerWidth - w - 8); y = PZ.clamp(y, 8, innerHeight - H - 8);
      const ui = this.app.ui;
      if (ui.deskOpen && ui.desk && !ui.desk.classList.contains('tucked')) {
        const d = ui.desk.getBoundingClientRect();
        if (x < d.right && x + w > d.left && y < d.bottom && y + H > d.top) { if (d.left - w - 12 >= 8) x = d.left - w - 12; else if (d.right + 12 + w <= innerWidth - 8) x = d.right + 12; }
      }
      this.panel.style.left = x + 'px'; this.panel.style.top = y + 'px';
    }
    closePanel() { clearInterval(this.tick); if (this.panel) this.panel.remove(); this.panel = null; this.ring = null; }
    setState(st) {
      this.state = st;
      if (this.app.ui && this.app.ui.micState) this.app.ui.micState(st);
      if (!this.stateEl) return;
      const lab = { connecting: 'Connecting…', live: '● Live', reconnecting: 'Reconnecting…', ended: 'Ended' }[st] || st;
      this.stateEl.textContent = lab;
      this.stateEl.className = 'pill ' + (st === 'live' ? 'ok' : st === 'ended' ? 'bad' : '');
    }
    toggleMute() {
      this.muted = !this.muted;
      PZ.bg({ type: 'voice:op', op: 'mute', on: this.muted });
      this.micBtn.classList.toggle('off', this.muted);
      this.micBtn.innerHTML = I(this.muted ? 'mute' : 'ear', 18);
    }
    renderCaptions() {
      if (!this.capEl) return;
      if (!this.app.settings.voice.captions) { this.capEl.innerHTML = '<div class="muted small">Captions off</div>'; return; }
      const all = this.lines.slice(-6).concat(['you', 'pz'].filter((w) => this.cur[w]).map((w) => ({ who: w, text: this.cur[w], live: true })));
      if (!all.length) { this.capEl.innerHTML = `<div class="muted small">${this.state === 'live' ? 'Say something… 🎙️' : 'Getting my voice ready…'}</div>`; return; }
      this.capEl.innerHTML = all.map((l) => `<div class="tl-${l.who}${l.live ? ' live' : ''}"><b>${l.who === 'you' ? 'You' : esc(this.app.settings.pet.name)}</b> ${esc(l.text)}</div>`).join('');
      this.capEl.scrollTop = this.capEl.scrollHeight;
    }
  }

  PZ.Talk = Talk;
  PZ.TALK_TOOLS = TOOLS;
})();
