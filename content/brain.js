/* Piniso content — prompts + AI tasks. All calls go through the background (keys never touch the page). */
(() => {
  if (PZ.Brain) return;

  const LANG_RULE = {
    hinglish: 'Hinglish: Hindi written in Roman letters mixed with English, the way Indian students chat (example: "Bhai ye formula yaad rakh, exam mein pakka aayega"). Keep technical terms in English.',
    english: 'Simple, clear English that a Class 10 student understands easily. No fancy words.',
    hindi: 'Simple Hindi in Devanagari script. Keep technical terms and formulas in English.',
    auto: 'The same language as the lecture transcript (use Hinglish if the teacher mixes Hindi and English).'
  };

  function persona(s) {
    const name = (s.pet && s.pet.name) || 'Piniso';
    const humor = s.humor == null ? 3 : s.humor;
    return [
      `You are ${name}, a tiny round blob study buddy holding a pencil, watching a lecture together with a student.`,
      'Your comments use funny, playful language (friendly desi-student humour, at most 2 emojis), but the CONTENT is always genuinely useful: a recap of what was just taught, the key idea, an exam tip, a memory trick, or a common mistake.',
      'Never filler. Never mean. Never invent facts beyond the lecture and well-established knowledge.',
      `Humour level: ${humor}/5 (0 = fully serious, 5 = very silly but still useful).`,
      `COMMENT language (for comments, chat answers, feedback, quips): ${LANG_RULE[s.lang.comments] || LANG_RULE.english}`,
      `NOTES language (for notes, questions, options, explanations, flashcards): ${LANG_RULE[s.lang.notes] || LANG_RULE.english}`,
      'Formatting: use **bold** for key words and $...$ LaTeX for math/chemistry formulas.'
    ].join('\n');
  }

  const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
  // notes the student has actually reached (notes written ahead stay hidden from every prompt except the next digest)
  const reached = (sess) => { const now = PZ.nowT ? PZ.nowT(sess) : Infinity; return (sess.notes || []).filter((x) => !x.pending && (!x.ahead || x.t <= now + 2)); };
  function notesBrief(sess, n = 12, len = 110, all) {
    return (all ? (sess.notes || []).filter((x) => !x.pending) : reached(sess)).filter((x) => x.kind !== 'user').slice().sort((a, b) => a.t - b.t).slice(-n).map((x) => `- ${clip(x.text, len)}`).join('\n') || '(none yet)';
  }
  function trimText(t, maxWords) {
    const w = String(t || '').split(/\s+/);
    return w.length > maxWords ? w.slice(w.length - maxWords).join(' ') : t;
  }

  // Two lanes: background jobs (auto notes, summaries) run one at a time so free limits are safe;
  // things the student is waiting for (Ask, quiz, grading) skip the line and run right away.
  let chain = Promise.resolve();
  const enqueue = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

  async function call(s, user, o = {}) {
    const messages = [{ role: 'system', content: persona(s) + (o.sysExtra ? '\n' + o.sysExtra : '') }];
    if (o.history) messages.push(...o.history);
    if (o.image) messages.push({ role: 'user', content: [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: o.image } }] });
    else messages.push({ role: 'user', content: user });
    const msg = { type: 'ai:chat', messages, json: !!o.json, maxTokens: o.maxTokens || 1400, temperature: o.temperature, vision: !!o.image, fast: !!o.fast };
    const run = () => (o.onDelta && !o.json ? PZ.stream(msg, o.onDelta).then((r) => (r.ok || r.code === 'NO_KEY' || r.code === 'BAD_KEY' || r.code === 'DEAD' ? r : PZ.bg(msg))) : PZ.bg(msg));
    return o.lane === 'bg' ? enqueue(run) : run();
  }

  const QDESC = { mcq: 'mcq = 4 options, exactly one correct', tf: 'tf = true/false statement', short: 'short = answer is 1-5 words or a number', long: 'long = explain in 2-4 sentences', fill: 'fill = a sentence with one key word replaced by ____ plus 4 word choices', fix: 'fix = a statement with exactly ONE wrong word; give that word and the right one', order: 'order = 3-5 steps/stages of a process listed in the correct order', match: 'match = 3-4 pairs (term ↔ meaning/unit/example)' };
  const QFORMAT = `{"type":"mcq","q":"","options":["","","",""],"answer":0,"answer_text":"the exact text of the correct option","explain":"why, 1-2 sentences","t":123}
{"type":"tf","q":"","answer":true,"explain":"","t":123}
{"type":"short","q":"","answer":"ideal short answer","accept":["other acceptable answers"],"explain":"","t":123}
{"type":"long","q":"","answer":"model answer","points":["key point","key point"],"t":123}
{"type":"fill","q":"sentence with ____ for the missing key word","answer":"missing word","options":["missing word","wrong 1","wrong 2","wrong 3"],"explain":"","t":123}
{"type":"fix","q":"a statement where exactly one word is wrong","wrong":"the wrong word exactly as written in q","answer":"the correct word","explain":"","t":123}
{"type":"order","q":"Put the steps of ... in order","items":["first","second","third","fourth"],"explain":"","t":123}
{"type":"match","q":"Match each ... with its ...","pairs":[["left","right"],["left","right"],["left","right"]],"explain":"","t":123}`;
  const qTypes = (s) => { const t = Object.entries(s.quiz.types).filter(([, v]) => v).map(([k]) => k); return t.length ? t : ['mcq']; };

  const NOTE_RULES = `HOW TO WRITE NOTES (most important):
- You are writing a topper's exam notes, NOT a transcript. NEVER copy or lightly edit the teacher's sentences. No "the teacher says", no "in this video", no greetings, no filler.
- First understand what was taught, then write each idea again in your own words, short and complete: a definition, a law, a formula (explain every symbol and give the unit), a reason (why / how), steps of a method, an example, an exam tip, or a common mistake.
- Merge things the teacher repeated. Fix speech-recognition errors and slips. If the teacher left an idea half-finished, complete it with standard textbook knowledge (only well-known facts).
- BAD (copied): "so basically friends inertia is like the body doesn't want to change its state you know".
- GOOD: "**Inertia** — a body resists any change in its state of rest or uniform motion; more mass ⇒ more inertia."
- BAD (vague): "Teacher explained Newton's second law." GOOD: "**Newton's 2nd law:** $F = ma$ ($F$ = net force in N, $m$ = mass in kg, $a$ = acceleration in m/s²)."
- Bold the key word at the start of a note. Use $LaTeX$ for every formula, unit or equation.`;

  const Brain = {
    cooldownUntil: 0,
    coolingDown() { return Date.now() < this.cooldownUntil; },
    noteError(r) {
      if (r && r.code === 'RATE_LIMIT') this.cooldownUntil = Date.now() + Math.max(45000, (r.retryAfter || 0) * 1000);
    },

    async digest(s, sess, meta, t0, t1, text, flags, upcoming, o = {}) {
      const imp = (flags || []).map((f) => `- around ${Math.round(f.t)}s${f.by === 'you' ? ' (the STUDENT starred this)' : ''}`).join('\n');
      const types = qTypes(s).filter((t) => t !== 'long');
      const wantQuiz = o.quiz !== false;
      const user = `LECTURE: "${clip(meta.title, 120)}"${meta.author ? ' by ' + meta.author : ''}
TOPIC SO FAR: ${sess.aiTopic || sess.topic || 'just started'}
NOTES ALREADY WRITTEN (do not repeat these):
${notesBrief(sess, 14, 90, true)}
${imp ? 'MOMENTS STRESSED AS IMPORTANT (give the note about each of these "star": true):\n' + imp + '\n' : ''}NEW TRANSCRIPT ${PZ.fmt(t0)}–${PZ.fmt(t1)} (each line starts with [seconds]):
${trimText(text, 1200)}
${upcoming ? '\nUPCOMING TRANSCRIPT (the student has NOT watched this yet — use it ONLY for "prequestion"):\n' + trimText(upcoming, 300) + '\n' : ''}
${NOTE_RULES}

Return ONLY a JSON object:
{"topic":"current topic in 3-6 words",
"comment":"1-2 sentences to the student in COMMENT language. Funny wording, useful substance (key idea / exam tip / memory trick). Max 230 characters.",
"mood":"happy|excited|thinking|proud|shocked|love|cool|confused|important",
"notes":[{"t":123,"kind":"definition|formula|point|steps|example|tip|warning","text":"the note in NOTES language","star":false}],
"terms":[{"term":"","meaning":"short meaning"}],
"cards":[{"q":"exam-style flashcard question","a":"crisp answer"}]${wantQuiz ? `,
"quiz":[2 questions in these formats: ${types.map((t) => QDESC[t]).join('; ')}]` : ''}${upcoming ? ',\n"prequestion":{"q":"one curiosity question (COMMENT language) that the UPCOMING part will answer","a":"the short answer from the upcoming part","t":123}' : ''}}
${wantQuiz ? 'Quiz formats:\n' + QFORMAT.split('\n').filter((l) => types.some((t) => l.includes('"' + t + '"'))).join('\n') + '\n' : ''}Rules: 2-7 notes with only NEW information, each under 230 characters. 0-3 terms. 1-3 cards about the most testable facts (always give at least 1 when there are notes).${wantQuiz ? ' Exactly 2 quiz questions about what was TAUGHT in this part (concepts, formulas, reasons — not trivia about the video); questions in NOTES language.' : ''} If the part is only greetings, ads, chit-chat or noise: notes [], cards [], quiz [], and a comment that playfully says nothing important yet. Use "t" values from the [seconds] stamps.`;
      const r = await call(s, user, { json: true, maxTokens: 2200, temperature: 0.4, lane: 'bg' });
      this.noteError(r);
      return r;
    },

    // one careful note for a moment the student / teacher marked
    async moment(s, sess, meta, t, text) {
      const user = `The student starred the moment ${PZ.fmt(t)} in the lecture "${clip(meta.title, 100)}".
What the teacher said just before and after (speech-to-text, may have errors):
${trimText(text, 260) || '(no transcript)'}
Recent notes: 
${notesBrief(sess, 5, 90)}
${NOTE_RULES}
Return ONLY JSON: {"kind":"definition|formula|point|steps|example|tip|warning","text":"ONE exam-ready note (under 260 characters, NOTES language) capturing the key idea of this moment"}
If nothing meaningful was said, return {"kind":"point","text":""}.`;
      return call(s, user, { json: true, maxTokens: 500, temperature: 0.3, fast: true });
    },

    // tidy, topic-wise version of all notes
    async clean(s, sess, meta) {
      const all = reached(sess).slice().sort((a, b) => a.t - b.t)
        .map((n) => `[${PZ.fmt(n.t)}]${PZ.star(n) ? ' ⭐' : ''} (${n.kind}) ${clip(n.text, 260)}`).join('\n');
      const terms = (sess.terms || []).map((t) => `- ${t.term}: ${t.meaning}`).join('\n');
      const user = `Turn these rough lecture notes into CLEAN study notes the student can revise from before an exam.
LECTURE: "${clip(meta.title, 120)}"
ROUGH NOTES (in teaching order, [time] stamps):
${clip(all, 9000)}
${terms ? 'KEY TERMS:\n' + clip(terms, 1500) : ''}

Write markdown in NOTES language:
- "## Topic" headings in teaching order; after each heading put the time it starts like (▶ 12:34).
- Under each topic: short bullets. **Bold** key words. Formulas with $LaTeX$ (explain symbols + units once). Group definitions, then laws/formulas, then examples.
- A small table (| a | b |) only when comparing 2+ things.
- End with "## ⭐ Exam corner" (the starred points + 3-5 likely exam questions) and "## ⚠️ Common mistakes" (if any).
- Remove repeats, fix errors, keep every useful fact. No intro or outro text. Under 700 words.`;
      const r = await call(s, user, { maxTokens: 2400, temperature: 0.3, lane: 'bg' });
      this.noteError(r);
      return r;
    },

    async cards(s, sess, meta, have) {
      const user = `Make 6-10 exam-style flashcards from these lecture notes ("${clip(meta.title, 100)}").
NOTES:
${notesBrief(sess, 50, 200)}
ALREADY HAVE (do not repeat):
${(have || []).slice(-30).map((c) => '- ' + clip(c.q, 90)).join('\n') || '(none)'}
Mix: definitions, formulas (ask for the formula or a quick use of it), reasons ("Why…?"), differences, and one-step numericals. Short questions, crisp answers, NOTES language, $LaTeX$ for math.
Return ONLY JSON: {"cards":[{"q":"","a":"","t":123}]} where t = the [seconds] of the related note if known.`;
      return call(s, user, { json: true, maxTokens: 1400, temperature: 0.4, fast: true });
    },

    async quiz(s, sess, meta, t0, t1, text, n, o = {}) {
      const types = qTypes(s);
      const user = `Make ${n || s.quiz.count} quiz question(s) from this part of the lecture so the student can check focus and understanding.
Allowed types: ${types.map((t) => QDESC[t]).join('; ')}. Mix the types if more than one.
Difficulty: ${o.difficulty || s.quiz.difficulty}. Ask about what was TAUGHT (concepts, formulas, reasons), never trivia about the video itself.
LECTURE "${clip(meta.title, 120)}" — the student chose: ${o.label || 'PART ' + PZ.fmt(t0) + '–' + PZ.fmt(t1)}.
Spread the questions over the WHOLE chosen part, not just its end.
TRANSCRIPT (${PZ.fmt(t0)}–${PZ.fmt(t1)}, sampled):
${trimText(text, 1300) || '(no transcript)'}
NOTES FOR THIS PART:
${o.notes ? o.notes.slice(-40).map((x) => '- [' + Math.round(x.t) + 's] ' + clip(x.text, 140)).join('\n') || '(none)' : notesBrief(sess, 14, 140)}

Return ONLY JSON:
{"quip":"one funny line in COMMENT language to start the quiz",
"questions":[
${QFORMAT.split('\n').filter((l) => types.some((t) => l.includes('"' + t + '"'))).join(',\n')}]}
${o.avoid && o.avoid.length ? 'ALREADY ASKED (do NOT repeat or rephrase these):\n' + o.avoid.slice(0, 12).map((x) => '- ' + clip(x, 100)).join('\n') + '\n' : ''}Only use the allowed types. Questions, options and explanations in NOTES language. "t" = the [seconds] where it was taught.`;
      const r = await call(s, user, { json: true, maxTokens: 1500, temperature: 0.4 });
      this.noteError(r);
      return r;
    },

    async grade(s, q, answer) {
      const user = `You are a STRICT but friendly exam checker. Decide if the student's answer is actually right.
QUESTION: ${q.q}
MODEL ANSWER: ${q.answer}
${q.accept && q.accept.length ? 'ALSO ACCEPTABLE: ' + q.accept.join(' | ') + '\n' : ''}${q.points && q.points.length ? 'KEY POINTS (needed for full marks): ' + q.points.join('; ') + '\n' : ''}STUDENT ANSWER: ${clip(answer, 1500)}

Rules:
- "correct" ONLY if the student's answer means the same thing as the model answer. Spelling mistakes, synonyms, Hindi/Hinglish and different wording are fine.
- "wrong" if it names a different concept/term/number, says the opposite, is too vague to be marked right in an exam, only repeats words from the question, or is a guess like "idk".
- A related-but-different term is WRONG (e.g. "refraction" when the answer is "dispersion", "mass" when the answer is "weight").
- Numbers must match (small rounding is fine). Missing or wrong unit when the unit matters = partial.
- For a written answer: score by how many key points are present; "partial" if some are missing.
First compare carefully in "check", then decide.
Return ONLY JSON: {"check":"one short sentence comparing the student answer with the model answer","verdict":"correct|partial|wrong","score":0-10,"feedback":"1-2 sentences in COMMENT language, light humour, say exactly what was right or wrong","missing":["missing key point"]}`;
      // grading needs care, so it uses the main model, not the quick one
      return call(s, user, { json: true, maxTokens: 600, temperature: 0 });
    },

    async explain(s, sess, meta, mode, t0, t1, text, onDelta, where) {
      const task = {
        simple: 'The student did NOT understand this part. Explain it again in very simple words, like to a 12-year-old: start with 1 everyday analogy, then the core idea in 2-4 short bullet points, then one line that starts with "Exam answer:" giving the exam-ready version.',
        mnemonic: 'Make 1-2 catchy memory tricks (mnemonic, rhyme, acronym or funny story) to remember the key facts/formulas from this part. Explain each trick in one line.',
        example: 'Give 2 real-life examples (preferably from Indian daily life) that show this concept, each in 2 lines, then one line linking back to the concept.',
        recap: 'Recap everything taught so far in 5-8 short bullet points, most important first.',
        exam: 'List what from this part is most likely to come in exams (definitions, formulas, diagrams, common question types) and one common mistake students make.'
      }[mode] || 'Explain this part clearly.';
      const src = mode === 'recap' ? `NOTES SO FAR:\n${notesBrief(sess, 40, 160)}\nLATEST TRANSCRIPT:\n${trimText(text, 500)}` : `LECTURE "${clip(meta.title, 100)}" PART ${PZ.fmt(t0)}–${PZ.fmt(t1)}:\n${trimText(text, 900) || '(no transcript)'}\nRECENT NOTES:\n${notesBrief(sess, 8)}`;
      const user = `${task}\nWrite in COMMENT language. Funny tone is fine but clarity comes first. Under 160 words. Use markdown bullets and $LaTeX$.\n${where ? '\nWHERE THE STUDENT IS:\n' + where + '\n' : ''}\n${src}`;
      const r = await call(s, user, { maxTokens: 900, onDelta, fast: true });
      this.noteError(r);
      return r;
    },

    async doubt(s, sess, meta, question, ctxText, history, image, onDelta) {
      const C = typeof ctxText === 'object' && ctxText ? ctxText : { text: ctxText, label: 'the last few minutes' };
      const user = `Context — lecture "${clip(meta.title, 100)}".
${C.where ? 'WHERE THE STUDENT IS:\n' + C.where + '\n' : ''}The student asked about: ${C.label || 'around now'}.
What the teacher said (${C.label || 'recently'}, [seconds] stamps):
${trimText(C.text, 1000) || '(no transcript available)'}
${C.clean ? 'CLEAN NOTES OF THE LECTURE SO FAR:\n' + clip(C.clean, 2500) + '\n' : ''}Notes ${C.notes ? 'for this part' : 'so far'}:
${C.notes ? C.notes.slice(-25).map((n) => '- [' + PZ.fmt(n.t) + '] ' + clip(n.text, 150)).join('\n') || '(none)' : notesBrief(sess, 10)}

Student's doubt: ${clip(question, 1200)}

Answer in COMMENT language: correct, step by step if needed, under 170 words, light humour. Use markdown and $LaTeX$.
Connect the answer to where the student is in the lecture (mention the time like (▶ 12:34) when you point to a part of the video). If the question is about something not taught yet, say it comes later (if you know from the chapters) and give a short preview.${image ? ' A screenshot of the lecture screen is attached; use it if relevant.' : ''}`;
      const r = await call(s, user, { maxTokens: 1000, history: (history || []).slice(-6), image, onDelta });
      this.noteError(r);
      return r;
    },

    async board(s, meta, t, ctxText, image, o) {
      const user = `This is a frame from the lecture "${clip(meta.title, 100)}" at ${PZ.fmt(t)}.
The teacher was saying: "${trimText(ctxText, 160) || '(unknown)'}"
Read what is on the board/screen (text, formulas, diagrams, tables).
Return ONLY JSON: {"explain":"clear explanation for the student in COMMENT language (light humour, useful, under 130 words, LaTeX ok)","notes":[{"kind":"formula|definition|point|diagram","text":"the board content, cleaned up, in NOTES language, LaTeX for math"}],"quip":"tiny funny line"}
If there is no readable study content, say so in "explain" and return "notes": [].`;
      return call(s, user, { json: true, maxTokens: 1100, image, lane: o && o.auto ? 'bg' : 'fg' });
    },

    async summary(s, sess, meta, statsLine) {
      const wrong = (sess.quizzes || []).flatMap((q) => (q.items || []).filter((i) => !i.correct).map((i) => '- ' + clip(i.q, 120))).slice(-10).join('\n') || '(none)';
      const user = `The study session is over. Using the notes below, return ONLY JSON:
{"title":"short title for this lecture","recap":["5-8 bullet points: the most important things learned"],"cheatsheet":["formulas, definitions and rules worth revising (use $LaTeX$)"],"weak":["topics to revise, based on quiz mistakes (can be empty)"],"roast":"one funny, kind line about the student's study stats, in COMMENT language","cheer":"one short encouraging line in COMMENT language"}
STATS: ${statsLine}
LECTURE: "${clip(meta.title, 120)}"
NOTES:
${notesBrief(sess, 60, 150)}
QUIZ MISTAKES:
${wrong}
Recap and cheatsheet in NOTES language.`;
      return call(s, user, { json: true, maxTokens: 1600, temperature: 0.5 });
    }
  };

  // local answer check for short questions (saves API calls)
  // instant local check for one-word answers. Only says "correct" when it is clearly the same answer;
  // anything unsure goes to the AI checker.
  Brain.quickCheck = (q, ans) => {
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097f.+\-/= ]/g, ' ').replace(/\b(the|a|an|of|is|it|its|called|known as)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const a = norm(ans);
    if (!a) return false;
    if (/\b(not|no|nahi|nahin|never|isn t|is not|idk|dont know|don t know)\b/.test(a)) return false;
    const opts = [q.answer].concat(q.accept || []).map(norm).filter(Boolean);
    const words = (x) => x.split(' ').filter(Boolean).length;
    for (const o of opts) {
      if (a === o) return true;
      if (a.replace(/ /g, '') === o.replace(/ /g, '')) return true;
      const na = parseFloat(a), no = parseFloat(o);
      if (!isNaN(na) && !isNaN(no) && /^[-+]?[\d.]/.test(a) && /^[-+]?[\d.]/.test(o)) {
        if (Math.abs(na - no) <= Math.abs(no) * 0.01 + 1e-9) {
          const ua = a.replace(/^[-+\d.e ]+/, '').trim(), uo = o.replace(/^[-+\d.e ]+/, '').trim();
          if (!ua || !uo || ua === uo) return true;
        }
        continue;
      }
      // "dispersion of light" for "dispersion": the answer word is there, with at most 2 extra words
      const re = new RegExp('(^| )' + o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
      if (o.length >= 4 && re.test(a) && words(a) <= words(o) + 2) return true;
    }
    return false;
  };

  PZ.Brain = Brain;
})();
