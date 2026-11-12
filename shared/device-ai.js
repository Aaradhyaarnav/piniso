/* Piniso — on-device AI (Chrome's built-in model, "Gemini Nano", via the Prompt API).
   Used when the student has no API key: free, private, works offline after a one-time download.
   Runs wherever LanguageModel exists (extension pages / offscreen document). Small model:
   prompts are trimmed and answers are kept short. */
(() => {
  if (globalThis.PDevice) return;
  const LM = () => globalThis.LanguageModel;
  const OPTS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
  const MAX_IN = 5200; // characters sent to the small model per prompt
  let base = null, baseSys = '', downloading = 0;

  const clip = (s, n) => (s.length > n ? s.slice(0, Math.floor(n * 0.35)) + '\n…\n' + s.slice(-Math.floor(n * 0.62)) : s);
  const text = (c) => (Array.isArray(c) ? c.map((p) => (typeof p === 'string' ? p : p.text || '')).join('\n') : String(c || ''));

  async function status() {
    if (!LM()) return { ok: true, status: 'unavailable', reason: 'This browser has no built-in AI (needs Chrome 138+ on a capable PC).' };
    try {
      const a = await LM().availability(OPTS);
      return { ok: true, status: a, progress: downloading };
    } catch (e) { return { ok: true, status: 'unavailable', reason: String(e && e.message || e) }; }
  }
  // starts (or continues) the one-time model download; needs a user click the first time
  async function prepare(onProgress) {
    if (!LM()) throw Object.assign(new Error('No built-in AI in this browser.'), { code: 'NO_DEVICE' });
    const s = await LM().create(Object.assign({}, OPTS, {
      monitor(m) { m.addEventListener('downloadprogress', (e) => { downloading = Math.round((e.loaded || 0) * 100); onProgress && onProgress(downloading); }); }
    }));
    downloading = 100;
    return s;
  }
  async function session(sys) {
    if (base && baseSys === sys) return base.clone ? base.clone() : base;
    const s = await LM().create(Object.assign({}, OPTS, { initialPrompts: [{ role: 'system', content: clip(sys, 1600) }] }));
    if (s.clone) { base = s; baseSys = sys; return s.clone(); }
    return s;
  }
  function split(messages) {
    const sys = messages.filter((m) => m.role === 'system').map((m) => text(m.content)).join('\n');
    const rest = messages.filter((m) => m.role !== 'system');
    const last = rest.length ? text(rest[rest.length - 1].content) : '';
    const before = rest.slice(-5, -1).map((m) => (m.role === 'assistant' ? 'Piniso: ' : 'Student: ') + text(m.content).slice(0, 500)).join('\n');
    return { sys: sys || 'You are Piniso, a friendly study buddy.', user: clip((before ? 'Earlier chat:\n' + before + '\n\n' : '') + last, MAX_IN) };
  }
  async function guard(fn) {
    const st = await status();
    if (st.status !== 'available') throw Object.assign(new Error(st.status === 'unavailable' ? (st.reason || 'Built-in AI is not available on this PC.') : 'Built-in AI is still downloading (' + (downloading || 0) + '%). Try again soon.'), { code: st.status === 'unavailable' ? 'NO_DEVICE' : 'DEVICE_DOWNLOADING' });
    return fn();
  }
  async function chat(messages, o = {}) {
    return guard(async () => {
      const { sys, user } = split(messages);
      const s = await session(sys + (o.json ? '\nAlways answer with ONE valid JSON object and nothing else.' : '\nKeep answers short and clear.'));
      try {
        const opt = o.json ? { responseConstraint: { type: 'object' } } : {};
        const out = await s.prompt(user, opt);
        return { text: String(out || '').trim(), model: 'on-device' };
      } finally { try { s.destroy(); } catch (e) {} }
    });
  }
  async function stream(messages, o = {}, onDelta) {
    return guard(async () => {
      const { sys, user } = split(messages);
      const s = await session(sys + '\nKeep answers short and clear.');
      let all = '';
      try {
        const rs = s.promptStreaming(user);
        for await (const chunk of rs) {
          const c = String(chunk || '');
          // older Chrome sent the whole text so far, newer sends only the new part
          const piece = c.startsWith(all) ? c.slice(all.length) : c;
          all = c.startsWith(all) ? c : all + c;
          if (piece) onDelta(piece);
        }
        return { text: all.trim(), model: 'on-device' };
      } finally { try { s.destroy(); } catch (e) {} }
    });
  }
  globalThis.PDevice = { status, prepare, chat, stream, available: () => !!LM() };
})();
