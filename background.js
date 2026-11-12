/* Piniso — background service worker.
   AI router (user's own keys), speech-to-text, tab audio capture, screen snaps, commands, frame relay. */
importScripts('shared/defaults.js', 'shared/store.js', 'shared/device-ai.js');
const P = globalThis.PINISO;

const CONTENT_FILES = [
  'vendor/katex/katex.min.js', 'shared/defaults.js', 'shared/lines.js', 'shared/store.js', 'shared/md.js',
  'shared/icons.js', 'shared/pet.js', 'shared/audio.js', 'content/ui-css.js', 'content/v4-css.js', 'content/util.js', 'content/video.js',
  'content/transcript.js', 'content/timeline.js', 'content/brain.js', 'content/ui.js', 'content/quiz.js', 'content/report.js', 'content/talk.js', 'content/extras.js', 'content/plus.js', 'content/magic.js', 'content/v4.js', 'content/app.js', 'vendor/three/pz3.min.js', 'shared/pet3d.js'
];

// ------------------------------------------------------------------ install
chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#welcome') });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'pz-ask', title: 'Ask Piniso about “%s”', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'pz-note', title: 'Save “%s” to Piniso notes', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'pz-queue', title: 'Add to Piniso “Up next”', contexts: ['link'] });
  });
  updateBadge();
});
chrome.runtime.onStartup.addListener(() => { updateBadge(); syncEverywhere(); syncGuardian(); deviceStatus(); });
chrome.runtime.onInstalled.addListener(async (d) => {
  // v2.2: Guardian was off by default before, so distracting sites stayed open. Turn it on once (study time only),
  // unless the student changed it themselves.
  if (d.reason === 'update' && d.previousVersion && /^(1\.|2\.[01]\.)/.test(d.previousVersion)) {
    try { const s = await PStore.settings(); if (!s.guardian.enabled && !s.guardian.touched) await PStore.saveSettings({ guardian: { enabled: true, when: 'session' } }); } catch (e) {}
  }
  // v3.1: "pre-questions" asked about parts not watched yet felt like spoilers — off unless the student turns them on again
  if (d.reason === 'update' && d.previousVersion && /^(1\.|2\.|3\.0)/.test(d.previousVersion)) {
    try { await PStore.saveSettings({ study: { prequestions: false } }); } catch (e) {}
  }
  syncEverywhere(); syncGuardian(); chrome.alarms.create('pz-guardian', { periodInMinutes: 1 });
  setTimeout(() => deviceStatus(), 3000);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'pz-queue') { await queueLink(info.linkUrl); return; }
  if (!tab || !tab.id) return;
  await ensureContent(tab.id);
  sendTab(tab.id, { type: 'cmd', cmd: info.menuItemId === 'pz-ask' ? 'ask-selection' : 'note-selection', text: info.selectionText || '' });
});

async function queueLink(url) {
  if (!url) return;
  let vid = '', title = '', author = '';
  try { const u = new URL(url); vid = /youtu\.be$/.test(u.hostname) ? u.pathname.slice(1) : u.searchParams.get('v') || ''; if (vid) url = 'https://www.youtube.com/watch?v=' + vid; } catch (e) {}
  if (vid) {
    try { const r = await fetchT('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url), {}, 8000); if (r.ok) { const j = await r.json(); title = j.title || ''; author = j.author_name || ''; } } catch (e) {}
  }
  await PStore.addToQueue({ url, vid, title: title || url, author });
}

// ------------------------------------------------------------------ helpers
function err(code, message, extra = {}) { const e = new Error(message); e.code = code; Object.assign(e, extra); return e; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sendTab(tabId, msg, frameId = 0) {
  return chrome.tabs.sendMessage(tabId, msg, { frameId }).catch(() => null);
}
async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t;
}
async function ping(tabId) {
  try { const r = await chrome.tabs.sendMessage(tabId, { type: 'ping' }, { frameId: 0 }); return !!(r && r.ok); } catch (e) { return false; }
}
async function ensureContent(tabId) {
  if (await ping(tabId)) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_FILES });
    await sleep(250);
    return await ping(tabId);
  } catch (e) { return false; }
}
async function fetchT(url, opt = {}, ms = 60000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, Object.assign({}, opt, { signal: ctl.signal })); }
  catch (e) { throw err(e.name === 'AbortError' ? 'TIMEOUT' : 'NET', e.name === 'AbortError' ? 'The AI took too long to answer.' : 'Network problem: ' + e.message); }
  finally { clearTimeout(id); }
}

// ------------------------------------------------------------------ AI providers
function providerConf(s, prov) {
  const meta = P.PROVIDERS[prov];
  if (!meta) throw err('PROVIDER', 'Unknown AI provider: ' + prov);
  const base = (prov === 'custom' ? (s.ai.customBaseUrl || '') : meta.base).replace(/\/+$/, '');
  const key = (s.ai.keys[prov] || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = 'Bearer ' + key;
  if (prov === 'openrouter') { headers['HTTP-Referer'] = 'https://aaradhybadjatya.com'; headers['X-Title'] = 'Piniso'; }
  return { prov, base, key, headers };
}

function httpError(status, text, retryAfter) {
  let msg = text;
  try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error)) || j.message || text; } catch (e) {}
  msg = String(msg).slice(0, 300);
  if (status === 401 || status === 403) return err('BAD_KEY', 'Your API key was rejected. Check it in Piniso settings. (' + msg + ')', { status });
  if (status === 429) return err('RATE_LIMIT', 'Free limit reached for now. Piniso will retry soon. (' + msg + ')', { status, retryAfter });
  if (status === 404 || /model/i.test(msg) && status === 400) return err('MODEL', 'Model problem: ' + msg, { status });
  if (status >= 500 || /overloaded|high demand|unavailable/i.test(msg)) return err('BUSY', 'The AI company’s servers are busy right now (' + status + '). Piniso will switch model or retry.', { status });
  return err('HTTP', 'AI error ' + status + ': ' + msg, { status });
}

function chatBody(prov, model, messages, o) {
  const body = { model, messages };
  if (prov === 'openai') body.max_completion_tokens = o.maxTokens; else body.max_tokens = o.maxTokens;
  if (prov !== 'openai') body.temperature = o.temperature;
  if (o.json) body.response_format = { type: 'json_object' };
  if (prov === 'groq' && /gpt-oss|qwen3|deepseek|reason/i.test(model)) body.reasoning_effort = 'low';
  if (prov === 'openai' && /^(gpt-5|o\d)/i.test(model)) body.reasoning_effort = /nano|mini/.test(model) ? 'minimal' : 'low';
  if (prov === 'gemini' && /gemini-(2\.5|3|flash-latest|pro-latest)/i.test(model) && !/lite/i.test(model)) body.reasoning_effort = o.fast ? 'none' : 'low';
  if (o.stream) body.stream = true;
  return body;
}
// on HTTP 400, drop optional params one by one (some models reject them)
function stripOptional(attempt) {
  for (const k of ['reasoning_effort', 'response_format', 'temperature']) if (attempt[k] !== undefined) { delete attempt[k]; return true; }
  return false;
}

async function callChat(conf, model, messages, o) {
  const prov = conf.prov;
  const attempt = chatBody(prov, model, messages, o);
  let retried = false;
  for (let i = 0; i < 5; i++) {
    const r = await fetchT(conf.base + '/chat/completions', { method: 'POST', headers: conf.headers, body: JSON.stringify(attempt) }, o.timeout || 60000);
    if (r.ok) {
      const j = await r.json();
      const msg = j.choices && j.choices[0] && j.choices[0].message;
      let text = msg && msg.content;
      if (Array.isArray(text)) text = text.map((p) => (typeof p === 'string' ? p : p.text || '')).join('');
      text = String(text || '').trim();
      if (!text && msg && msg.reasoning && o.json) text = String(msg.reasoning).trim();
      const tokens = (j.usage && (j.usage.total_tokens || (j.usage.prompt_tokens || 0) + (j.usage.completion_tokens || 0))) || 0;
      PStore.addUsage(prov, model, tokens).catch(() => {});
      if (!text) throw err('EMPTY', 'The AI returned an empty answer.');
      return { text, model, tokens };
    }
    const t = await r.text();
    if ((r.status === 503 || r.status === 502 || r.status === 500) && !retried && !o.fast) { retried = true; await sleep(900); continue; }
    if (r.status === 400 && stripOptional(attempt)) continue;
    throw httpError(r.status, t, Number(r.headers.get('retry-after')) || 0);
  }
  throw err('HTTP', 'AI request failed.');
}

// streaming version (Server-Sent Events). onDelta(textPiece) is called as words arrive.
async function streamChat(conf, model, messages, o, onDelta) {
  const prov = conf.prov;
  const attempt = chatBody(prov, model, messages, Object.assign({}, o, { stream: true, json: false }));
  let r;
  for (let i = 0; i < 4; i++) {
    r = await fetchT(conf.base + '/chat/completions', { method: 'POST', headers: conf.headers, body: JSON.stringify(attempt) }, o.timeout || 45000);
    if (r.ok) break;
    const t = await r.text();
    if (r.status === 400 && stripOptional(attempt)) continue;
    throw httpError(r.status, t, Number(r.headers.get('retry-after')) || 0);
  }
  if (!r || !r.ok) throw err('HTTP', 'AI request failed.');
  const ct = r.headers.get('content-type') || '';
  if (!/event-stream/i.test(ct)) { // server ignored stream:true
    const j = await r.json().catch(() => ({}));
    const text = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
    if (!text) throw err('EMPTY', 'The AI returned an empty answer.');
    onDelta(text);
    return { text, model };
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', idle;
  const watchdog = () => { clearTimeout(idle); idle = setTimeout(() => { try { reader.cancel(); } catch (e) {} }, 25000); };
  watchdog();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      watchdog();
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) throw httpError(500, JSON.stringify(j));
        const d = j.choices && j.choices[0] && j.choices[0].delta;
        const piece = d && (typeof d.content === 'string' ? d.content : Array.isArray(d.content) ? d.content.map((p) => p.text || '').join('') : '');
        if (piece) { text += piece; onDelta(piece); }
      }
    }
  } finally { clearTimeout(idle); }
  text = text.trim();
  PStore.addUsage(prov, model, Math.round(text.length / 3) + 600).catch(() => {});
  if (!text) throw err('EMPTY', 'The AI returned an empty answer.');
  return { text, model };
}

function parseJSON(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (e) {}
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e) {}
  return null;
}

const modelCache = {};
async function listModels(prov, keyOverride, baseOverride) {
  const s = await PStore.settings();
  const conf = providerConf(s, prov);
  if (keyOverride !== undefined) { conf.key = keyOverride; conf.headers.Authorization = keyOverride ? 'Bearer ' + keyOverride : undefined; if (!keyOverride) delete conf.headers.Authorization; }
  if (baseOverride) conf.base = baseOverride.replace(/\/+$/, '');
  const ck = prov + '|' + conf.base + '|' + (conf.key || '').slice(-6);
  if (modelCache[ck] && Date.now() - modelCache[ck].at < 30 * 60000) return modelCache[ck].ids;
  const r = await fetchT(conf.base + '/models', { headers: conf.headers }, 20000);
  if (!r.ok) throw httpError(r.status, await r.text());
  const j = await r.json();
  const ids = ((j.data || j.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean)).sort();
  modelCache[ck] = { at: Date.now(), ids };
  return ids;
}

async function resolveVisionProvider(s) {
  if (s.ai.vision && s.ai.vision !== 'auto') return s.ai.vision;
  const main = s.ai.provider;
  if (main !== 'groq') return main;
  try { if (await groqVisionModel(s)) return 'groq'; } catch (e) {}
  if (s.ai.keys.gemini) return 'gemini';
  if (s.ai.keys.openai) return 'openai';
  if (s.ai.keys.openrouter) return 'openrouter';
  throw err('NO_VISION', 'To read the board, add a free Gemini key in Piniso settings (Groq has no image model right now).');
}
async function groqVisionModel(s) {
  const v = s.ai.visionModels.groq;
  if (v && v !== 'auto') return v;
  const ids = await listModels('groq');
  return ids.find((id) => /llama-4|scout|maverick|vision|-vl\b|vl-/i.test(id) && !/guard|whisper|tts/i.test(id)) || '';
}
async function resolveVisionModel(s, prov) {
  if (prov === 'groq') { const m = await groqVisionModel(s); if (!m) throw err('NO_VISION', 'No image model on Groq right now. Add a free Gemini key for board snaps.'); return m; }
  const v = s.ai.visionModels[prov];
  return v && v !== 'auto' ? v : s.ai.models[prov];
}

const SWITCHABLE = (e) => ['RATE_LIMIT', 'MODEL', 'EMPTY', 'TIMEOUT', 'BUSY'].includes(e.code) || e.status >= 500;
async function modelChain(prov, conf, first, fb) {
  const chain = [first, fb].filter(Boolean);
  const pref = {
    gemini: [/^gemini-flash-latest$/, /^gemini-flash-lite-latest$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-lite$/, /flash/],
    groq: [/gpt-oss-120b/, /gpt-oss-20b/, /llama.*70b/, /llama/, /qwen/],
    openrouter: [/:free$/],
    openai: [/gpt-5-mini/, /gpt-4\.1-mini/, /gpt-4o-mini/]
  }[prov] || [];
  if (pref.length) {
    try {
      const ids = (await listModels(prov, conf.key)).filter((i) => !/tts|image|embed|audio|vision-only|guard|whisper|live|realtime|transcribe/i.test(i));
      for (const re of pref) for (const id of ids.filter((x) => re.test(x)).sort().reverse()) if (!chain.includes(id)) chain.push(id);
    } catch (e) {}
  }
  return chain.slice(0, 4);
}

function fastModel(s, prov) {
  if ((s.ai.speed || 'fast') !== 'fast') return '';
  const f = (s.ai.fast || {})[prov];
  return f && f !== s.ai.models[prov] ? f : '';
}
async function resolveAI(o) {
  const s = await PStore.settings();
  let prov = s.ai.provider;
  if (o.vision) prov = await resolveVisionProvider(s);
  const conf = providerConf(s, prov);
  if (!conf.key && prov !== 'custom') throw err('NO_KEY', 'Add your free ' + P.PROVIDERS[prov].label + ' API key in Piniso settings.');
  if (prov === 'custom' && !conf.base) throw err('NO_KEY', 'Set your custom AI server address in Piniso settings.');
  const main = s.ai.models[prov] || '';
  const fast = o.vision ? '' : (o.fast ? fastModel(s, prov) : '');
  const model = o.vision ? await resolveVisionModel(s, prov) : (fast || main);
  // fast task: fall back to the main model; normal task: to the configured fallback
  const fb = o.vision ? '' : (fast ? main : (s.ai.fallback[prov] || ''));
  const opts = { json: !!o.json, maxTokens: o.maxTokens || 1400, temperature: o.temperature == null ? 0.6 : o.temperature, timeout: o.timeout, fast: !!o.fast };
  return { s, prov, conf, model, fb, opts };
}

// ------------------------------------------------------------------ on-device AI (no key needed)
// Chrome's built-in model. In the worker we use it directly when the API is there, otherwise through the offscreen page.
async function deviceCall(kind, messages, o, onDelta) {
  if (globalThis.PDevice && PDevice.available()) {
    return kind === 'stream' ? PDevice.stream(messages, o, onDelta) : PDevice.chat(messages, o);
  }
  await ensureOffscreen();
  lmBusy++;
  let r;
  try { r = await chrome.runtime.sendMessage({ type: 'off:lm', op: 'chat', messages, json: !!o.json }).catch((e) => ({ ok: false, error: String(e) })); } finally { lmBusy--; }
  if (!r || !r.ok) throw err((r && r.code) || 'NO_DEVICE', (r && r.error) || 'Built-in AI is not available.');
  if (kind === 'stream' && onDelta) onDelta(r.text);
  return { text: r.text, model: 'on-device' };
}
async function deviceStatus() {
  let st = null;
  try {
    if (globalThis.PDevice && PDevice.available()) st = await PDevice.status();
    else { await ensureOffscreen(); st = await chrome.runtime.sendMessage({ type: 'off:lm', op: 'status' }); await maybeCloseOffscreen(); }
  } catch (e) { st = null; }
  st = st || { status: 'unavailable', reason: 'Not supported here' };
  await chrome.storage.local.set({ deviceAI: { status: st.status, reason: st.reason || '', at: Date.now() } });
  return Object.assign({ ok: true }, st);
}
// no key: try the built-in model, else keep the friendly "add a key" error
async function viaDevice(o, noKeyErr, onDelta) {
  const s = await PStore.settings();
  if (s.ai.device === false || o.vision) throw noKeyErr;
  const { deviceAI } = await chrome.storage.local.get('deviceAI');
  if (!deviceAI || deviceAI.status !== 'available') throw noKeyErr;
  const res = await deviceCall(onDelta ? 'stream' : 'chat', o.messages, o, onDelta);
  if (!res.text) throw err('EMPTY', 'The built-in AI returned an empty answer.');
  PStore.addUsage('device', 'on-device', 0).catch(() => {});
  res.provider = 'device';
  if (o.json && !onDelta) {
    res.data = parseJSON(res.text);
    if (!res.data) throw err('BAD_JSON', 'The built-in AI answer could not be read. Trying again later.');
  }
  return res;
}

async function aiChat(o) {
  let rz;
  try { rz = await resolveAI(o); } catch (e) { if (e && e.code === 'NO_KEY') return viaDevice(o, e); throw e; }
  const { prov, conf, model, fb, opts } = rz;
  let res, lastErr = null, chain = [model, fb].filter(Boolean);
  for (let i = 0; i < chain.length; i++) {
    try { res = await callChat(conf, chain[i], o.messages, opts); if (i) res.fallback = true; break; }
    catch (e) {
      lastErr = e;
      if (!SWITCHABLE(e)) throw e;
      if (i === chain.length - 1 && chain.length < 4) { const more = await modelChain(prov, conf, model, fb); more.forEach((m) => { if (!chain.includes(m) && chain.length < 4) chain.push(m); }); }
    }
  }
  if (!res) throw lastErr || err('HTTP', 'AI request failed.');
  if (o.json) {
    let data = parseJSON(res.text);
    if (!data) {
      const retry = await callChat(conf, res.model, o.messages.concat([{ role: 'assistant', content: res.text.slice(0, 2000) }, { role: 'user', content: 'That was not valid JSON. Reply again with ONLY the valid JSON object, nothing else.' }]), opts);
      data = parseJSON(retry.text);
    }
    if (!data) throw err('BAD_JSON', 'The AI answer could not be read. Trying again later.');
    res.data = data;
  }
  res.provider = prov;
  return res;
}

async function aiStream(o, onDelta) {
  let rz;
  try { rz = await resolveAI(o); } catch (e) { if (e && e.code === 'NO_KEY') return viaDevice(o, e, onDelta); throw e; }
  const { prov, conf, model, fb, opts } = rz;
  let lastErr = null, chain = [model, fb].filter(Boolean), got = false;
  for (let i = 0; i < chain.length; i++) {
    try {
      const res = await streamChat(conf, chain[i], o.messages, opts, (p) => { got = true; onDelta(p); });
      res.provider = prov; if (i) res.fallback = true;
      return res;
    } catch (e) {
      lastErr = e;
      if (got || !SWITCHABLE(e)) throw e;
      if (i === chain.length - 1 && chain.length < 4) { const more = await modelChain(prov, conf, model, fb); more.forEach((m) => { if (!chain.includes(m) && chain.length < 4) chain.push(m); }); }
    }
  }
  throw lastErr || err('HTTP', 'AI request failed.');
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'pz-ai') return;
  let closed = false;
  port.onDisconnect.addListener(() => { closed = true; });
  const post = (m) => { if (!closed) try { port.postMessage(m); } catch (e) {} };
  port.onMessage.addListener((m) => {
    aiStream(m, (d) => post({ d })).then(
      (r) => post({ done: true, text: r.text, model: r.model }),
      (e) => post({ error: (e && e.message) || String(e), code: e && e.code, retryAfter: e && e.retryAfter })
    );
  });
});

async function testKey({ provider, key, base }) {
  const s = await PStore.settings();
  const conf = providerConf(s, provider);
  conf.key = (key || '').trim();
  if (conf.key) conf.headers.Authorization = 'Bearer ' + conf.key; else delete conf.headers.Authorization;
  if (provider === 'custom' && base) conf.base = base.replace(/\/+$/, '');
  let ids = [];
  try { ids = await listModels(provider, conf.key, provider === 'custom' ? conf.base : undefined); } catch (e) { if (e.code === 'BAD_KEY') throw e; }
  const model = s.ai.models[provider];
  const pick = ids.length && !ids.includes(model) ? (ids.find((i) => /gpt-oss-120b|flash-latest|gpt-5-mini|llama/i.test(i)) || ids[0]) : model;
  const chain = await modelChain(provider, conf, pick, s.ai.fallback[provider]);
  let busy = null;
  for (const m of chain) {
    try {
      const r = await callChat(conf, m, [{ role: 'user', content: 'Reply with exactly: ok' }], { maxTokens: 300, temperature: 0 });
      return { ok: true, model: r.model, sample: r.text.slice(0, 40), models: ids, suggested: pick !== model ? pick : '', busyModel: busy };
    } catch (e) {
      if (e.code === 'BAD_KEY') throw e;
      if (!SWITCHABLE(e)) throw e;
      busy = busy || m;
    }
  }
  // every model answered "busy" — the key itself was accepted
  return { ok: true, model: pick, busy: true, busyModel: busy, models: ids, warning: 'Your key is valid ✓ but Google/the provider is overloaded right now. Piniso will retry and switch models automatically — no action needed.' };
}

// ------------------------------------------------------------------ speech to text
function b64ToBlob(b64, mime) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime || 'audio/webm' });
}
async function sttProvider(s) {
  const p = s.ai.stt;
  if (p && p !== 'auto') return p;
  if (s.ai.keys.groq) return 'groq';
  if (s.ai.keys.openai) return 'openai';
  if (s.ai.keys.gemini) return 'gemini';
  throw err('NO_STT', 'Listening needs a free Groq key (or OpenAI / Gemini) in Piniso settings.');
}
async function transcribe({ b64, mime, prompt }) {
  const s = await PStore.settings();
  const prov = await sttProvider(s);
  const key = (s.ai.keys[prov] || '').trim();
  if (!key) throw err('NO_STT', 'Add your ' + P.PROVIDERS[prov].label + ' key to let Piniso listen.');
  if (prov === 'gemini') {
    const model = s.ai.sttModels.gemini || 'gemini-flash-latest';
    const r = await fetchT(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: (mime || 'audio/webm').split(';')[0], data: b64 } }, { text: 'Transcribe this lecture audio exactly as spoken (any language, keep Hindi in Devanagari or Roman as spoken). Return ONLY the transcript text. If there is no speech, return an empty string.' }] }] })
    }, 60000);
    if (!r.ok) throw httpError(r.status, await r.text());
    const j = await r.json();
    const text = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('').trim();
    PStore.addUsage('gemini', model + ' (listen)', (j.usageMetadata && j.usageMetadata.totalTokenCount) || 0).catch(() => {});
    return { text, segments: [] };
  }
  let model = s.ai.sttModels[prov];
  if (prov === 'groq' && (!model || model === 'auto')) {
    try { const ids = await listModels('groq', key); model = ids.find((i) => i === 'whisper-large-v3-turbo') || ids.find((i) => i === 'whisper-large-v3') || ids.find((i) => /whisper/i.test(i)) || 'whisper-large-v3'; }
    catch (e) { model = 'whisper-large-v3'; }
  }
  const base = prov === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const ext = /mp4/.test(mime || '') ? 'm4a' : /ogg/.test(mime || '') ? 'ogg' : 'webm';
  let fmt = 'verbose_json';
  for (let i = 0; i < 2; i++) {
    const fd = new FormData();
    fd.append('file', b64ToBlob(b64, mime), 'lecture.' + ext);
    fd.append('model', model);
    fd.append('response_format', fmt);
    fd.append('temperature', '0');
    if (prompt) fd.append('prompt', String(prompt).slice(0, 380));
    const r = await fetchT(base + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd }, 90000);
    if (r.ok) {
      const j = await r.json();
      PStore.addUsage(prov, model + ' (listen)', 0).catch(() => {});
      return { text: String(j.text || '').trim(), segments: (j.segments || []).map((x) => ({ start: x.start, end: x.end, text: String(x.text || '').trim(), nsp: x.no_speech_prob })) };
    }
    const t = await r.text();
    if (r.status === 400 && fmt === 'verbose_json') { fmt = 'json'; continue; }
    throw httpError(r.status, t);
  }
  throw err('HTTP', 'Transcription failed.');
}

// ------------------------------------------------------------------ tab audio capture
async function capState() { const r = await chrome.storage.session.get('capture'); return r.capture || null; }
async function setCapState(v) { await chrome.storage.session.set({ capture: v }); }

async function ensureOffscreen() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (ctx && ctx.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html', reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Listen to the lecture audio for notes, and run the voice talk mode (microphone + Piniso voice).'
  });
}
async function startListen(tabId) {
  const cur = await capState();
  if (cur && cur.tabId === tabId) { sendTab(tabId, { type: 'stt:state', on: true }); return { ok: true, already: true }; }
  if (cur) await stopListen();
  const s = await PStore.settings();
  try { await sttProvider(s); } catch (e) { sendTab(tabId, { type: 'stt:state', on: false, error: e.message, code: e.code }); return { ok: false, error: e.message, code: e.code }; }
  let streamId;
  try { streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }); }
  catch (e) {
    const m = { ok: false, code: 'NEEDS_GESTURE', error: 'Click the Piniso toolbar icon and press “Listen”, or press Alt+Shift+L on the video tab.' };
    sendTab(tabId, { type: 'stt:state', on: false, error: m.error, code: m.code });
    return m;
  }
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({ type: 'off:start', streamId, tabId }).catch((e) => ({ ok: false, error: String(e) }));
  if (!r || !r.ok) { sendTab(tabId, { type: 'stt:state', on: false, error: (r && r.error) || 'Could not start listening.' }); return r || { ok: false }; }
  await setCapState({ tabId, at: Date.now() });
  sendTab(tabId, { type: 'stt:state', on: true });
  return { ok: true };
}
async function stopListen() {
  const cur = await capState();
  await chrome.runtime.sendMessage({ type: 'off:stop' }).catch(() => {});
  await setCapState(null);
  if (cur) sendTab(cur.tabId, { type: 'stt:state', on: false });
  await maybeCloseOffscreen();
  return { ok: true };
}
let lmBusy = 0;
async function maybeCloseOffscreen() {
  const v = await voiceState();
  if (v || lmBusy) return;
  const c = await capState(); if (c) return;
  try { const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }); if (ctx.length) await chrome.offscreen.closeDocument(); } catch (e) {}
}

// ------------------------------------------------------------------ voice talk
async function voiceState() { const r = await chrome.storage.session.get('voice'); return r.voice || null; }
async function geminiLiveModel(key) {
  const r = await fetchT('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': key } }, 20000);
  if (!r.ok) throw httpError(r.status, await r.text());
  const j = await r.json();
  const live = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('bidiGenerateContent')).map((m) => m.name.replace(/^models\//, ''));
  if (!live.length) throw err('NO_LIVE', 'Your Gemini key has no live voice model available right now.');
  const ver = (n) => { const m = n.match(/(\d+)(?:\.(\d+))?/); return m ? Number(m[1]) + Number(m[2] || 0) / 10 : 0; };
  const score = (n) => ver(n) * 10 + (/native-audio|audio/.test(n) ? 4 : 0) + (/live/.test(n) ? 3 : 0) - (/exp/.test(n) ? 2 : 0) - (/lite/.test(n) ? 1 : 0) - (/tts|image|embed/.test(n) ? 50 : 0);
  live.sort((a, b) => score(b) - score(a));
  return live[0];
}
async function startVoice(m, sender) {
  const tabId = m.tabId || (sender.tab && sender.tab.id);
  const s = await PStore.settings();
  const v = s.voice || {};
  let provider = v.provider || 'auto';
  if (provider === 'auto') provider = s.ai.keys.gemini ? 'gemini' : s.ai.keys.openai ? 'openai' : '';
  if (!provider) return { ok: false, code: 'NO_VOICE_KEY', error: 'Voice talk needs a free Google Gemini key (or an OpenAI key). Add it in Piniso settings → AI brain & keys.' };
  const key = (s.ai.keys[provider] || '').trim();
  if (!key) return { ok: false, code: 'NO_VOICE_KEY', error: 'Add your ' + (provider === 'gemini' ? 'Gemini' : 'OpenAI') + ' key for voice talk.' };
  let model;
  try { model = provider === 'gemini' ? (v.geminiModel && v.geminiModel !== 'auto' ? v.geminiModel : await geminiLiveModel(key)) : (v.openaiModel || 'gpt-realtime-2'); }
  catch (e) { return { ok: false, error: e.message, code: e.code }; }
  await ensureOffscreen();
  const cfg = { provider, key, model, voice: provider === 'gemini' ? v.voice : v.openaiVoice, system: m.system, tools: m.tools, opener: m.opener, ptt: m.ptt, tabId };
  const r = await chrome.runtime.sendMessage({ type: 'off:voice', op: 'start', cfg }).catch((e) => ({ ok: false, error: String(e) }));
  if (r && r.code === 'NEEDS_MIC') {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/mic.html'), active: true });
    return r;
  }
  if (r && r.ok) await chrome.storage.session.set({ voice: { tabId, at: Date.now() } });
  return Object.assign({ provider, model }, r || { ok: false });
}

// ------------------------------------------------------------------ run on every website
async function syncEverywhere() {
  try {
    const s = await PStore.settings();
    const has = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    const want = s.everywhere && has;
    const cur = await chrome.scripting.getRegisteredContentScripts({ ids: ['pz-all'] }).catch(() => []);
    if (want && !cur.length) {
      await chrome.scripting.registerContentScripts([{ id: 'pz-all', matches: ['http://*/*', 'https://*/*'], excludeMatches: STUDY_MATCHES, js: CONTENT_FILES, runAt: 'document_idle', allFrames: true, persistAcrossSessions: true }]);
    } else if (!want && cur.length) {
      await chrome.scripting.unregisterContentScripts({ ids: ['pz-all'] });
    }
  } catch (e) { console.warn('[Piniso] everywhere', e); }
}
const STUDY_MATCHES = ['https://*.youtube.com/*', 'https://www.youtube-nocookie.com/*', 'https://*.unacademy.com/*', 'https://*.pw.live/*', 'https://*.khanacademy.org/*', 'https://*.coursera.org/*', 'https://*.udemy.com/*', 'https://*.vedantu.com/*', 'https://*.byjus.com/*', 'https://*.nptel.ac.in/*', 'https://*.edx.org/*'];
chrome.permissions.onAdded.addListener(() => { syncEverywhere(); syncGuardian(); });
chrome.permissions.onRemoved.addListener(() => { syncEverywhere(); syncGuardian(); });

// ------------------------------------------------------------------ Guardian (distraction blocker)
const G_BASE = 9000;
async function guardianActive(s) {
  const g = s.guardian || {};
  if (!g.enabled) return false;
  if (g.when === 'always') return true;
  const st = (await chrome.storage.session.get(['studyAt', 'sprintUntil']));
  if (g.when === 'schedule') {
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const p = (x) => { const [a, b] = String(x || '0:0').split(':').map(Number); return a * 60 + (b || 0); };
    const f = p(g.from), t = p(g.to);
    if (f <= t ? (mins >= f && mins < t) : (mins >= f || mins < t)) return true;
  }
  if ((st.sprintUntil || 0) > Date.now()) return true;
  return Date.now() - (st.studyAt || 0) < 15 * 60000;
}
async function syncGuardian() {
  try {
    const s = await PStore.settings();
    const active = await guardianActive(s);
    const old = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = old.filter((r) => r.id >= G_BASE).map((r) => r.id);
    const addRules = [];
    const { passes: passes_ = {} } = await chrome.storage.session.get('passes');
    if (active) {
      const passes = passes_;
      const now = Date.now();
      const perms = {};
      for (const raw of (s.guardian.sites || []).slice(0, 60)) {
        const d = String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        try { perms[d] = await chrome.permissions.contains({ origins: ['*://*.' + d + '/*'] }); } catch (e) { perms[d] = false; }
      }
      (s.guardian.sites || []).slice(0, 60).forEach((d, i) => {
        d = String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        if (!d || (passes[d] || 0) > now) return;
        const esc = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const canRedirect = perms[d];
        addRules.push({
          id: G_BASE + i, priority: 1,
          action: canRedirect ? { type: 'redirect', redirect: { regexSubstitution: chrome.runtime.getURL('pages/guardian.html') + '#\\0' } } : { type: 'block' },
          condition: { regexFilter: '^https?://([a-z0-9-]+\\.)*' + esc + '(/.*)?$', resourceTypes: ['main_frame'] }
        });
      });
    }
    if (active && s.guardian.shorts !== false && !((passes_ || {})['youtube.com/shorts'] > Date.now())) {
      addRules.push({ id: G_BASE + 99, priority: 2, action: { type: 'redirect', redirect: { regexSubstitution: chrome.runtime.getURL('pages/guardian.html') + '#\\0' } },
        condition: { regexFilter: '^https?://(www\\.|m\\.)?youtube\\.com/shorts(/.*)?$', resourceTypes: ['main_frame'] } });
    }
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
    const was = (await chrome.storage.session.get('guardianOn')).guardianOn;
    await chrome.storage.session.set({ guardianOn: active && addRules.length > 0 });
    // tabs that were ALREADY open on a blocked site (rules only stop new page loads)
    if (active && addRules.length) sweepTabs(s, passes_ || {}, !was);
  } catch (e) { console.warn('[Piniso] guardian', e); }
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'pz-guardian') syncGuardian(); });
// 🔔 evening revision reminder (once a day, only when cards are due)
chrome.alarms.get('pz-remind').then((a) => { if (!a) chrome.alarms.create('pz-remind', { periodInMinutes: 30 }); }).catch(() => {});
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== 'pz-remind') return;
  try {
    const s = await PStore.settings();
    if (s.focus.remind === false || !chrome.notifications) return;
    const hr = new Date().getHours();
    if (hr < 17 || hr > 21) return;
    const today = PStore.todayKey();
    const { remindDay } = await PStore.get('remindDay');
    if (remindDay === today) return;
    const due = await PStore.dueCount();
    if (due < 5) return;
    const st = await PStore.stats();
    const ex = s.exam || {};
    const days = ex.date ? Math.ceil((new Date(ex.date + 'T09:00') - Date.now()) / 86400000) : -1;
    await PStore.set({ remindDay: today });
    chrome.notifications.create('pz-remind', {
      type: 'basic', iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
      title: `${due} flashcards are waiting 🃏`,
      message: (days >= 0 ? `${ex.name || 'Exam'} in ${days} day${days === 1 ? '' : 's'}. ` : '') + `3 minutes now saves 30 later. Streak: ${PStore.streak(st)} 🔥`,
      priority: 0
    });
  } catch (e) {}
});
if (chrome.notifications) chrome.notifications.onClicked.addListener((id) => { if (id === 'pz-remind') { chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#revise') }); chrome.notifications.clear(id); } });

// alarms can disappear after a browser restart: make sure the Guardian clock is always running
chrome.alarms.get('pz-guardian').then((a) => { if (!a) chrome.alarms.create('pz-guardian', { periodInMinutes: 1 }); }).catch(() => {});

const cleanDomain = (raw) => String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
function blockedSite(s, url, passes) {
  let u; try { u = new URL(url); } catch (e) { return ''; }
  if (!/^https?:$/.test(u.protocol)) return '';
  const host = u.hostname.replace(/^www\./, '');
  if (s.guardian.shorts !== false && /(^|\.)youtube\.com$/.test(host) && /^\/shorts(\/|$)/.test(u.pathname)) return (passes['youtube.com/shorts'] || 0) > Date.now() ? '' : 'youtube.com/shorts';
  for (const raw of s.guardian.sites || []) {
    const d = cleanDomain(raw);
    if (d && (host === d || host.endsWith('.' + d))) return (passes[d] || 0) > Date.now() ? '' : d;
  }
  return '';
}
async function sweepTabs(s, passes, justStarted) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (!t.url || !blockedSite(s, t.url, passes)) continue;
      // don't yank the tab the student is looking at the instant a session starts? No — that IS the distraction.
      chrome.tabs.update(t.id, { url: chrome.runtime.getURL('pages/guardian.html') + '#' + t.url }).catch(() => {});
    }
  } catch (e) {}
}
// catches what network rules miss: back/forward cache, prerendered pages, in-app (SPA) navigation
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!info.url) return;
  const { guardianOn } = await chrome.storage.session.get('guardianOn');
  if (!guardianOn) return;
  const s = await PStore.settings();
  const { passes = {} } = await chrome.storage.session.get('passes');
  if (blockedSite(s, info.url, passes)) chrome.tabs.update(tabId, { url: chrome.runtime.getURL('pages/guardian.html') + '#' + info.url }).catch(() => {});
});
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.settings) { syncGuardian(); syncEverywhere(); } });
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const cur = await capState();
  if (cur && cur.tabId === tabId) stopListen();
});

async function onChunk(msg) {
  const { tabId, t0, t1, b64, mime, peak, prompt } = msg;
  if (!b64 || (peak !== undefined && peak < 0.012)) { sendTab(tabId, { type: 'stt:text', t0, t1, text: '', segments: [], silent: true }); return; }
  try {
    const r = await transcribe({ b64, mime, prompt });
    let text = r.text;
    if (/^(thank you|thanks for watching|subscribe|you)\.?$/i.test(text) && (peak || 0) < 0.05) text = '';
    const segs = (r.segments || []).filter((s) => !(s.nsp > 0.8));
    sendTab(tabId, { type: 'stt:text', t0, t1, text, segments: segs });
  } catch (e) {
    sendTab(tabId, { type: 'stt:error', code: e.code, error: e.message, retryAfter: e.retryAfter || 0 });
  }
}

// ------------------------------------------------------------------ snaps
async function snapVisible(windowId) {
  try { return { ok: true, dataUrl: await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 82 }) }; }
  catch (e) { return { ok: false, code: 'NEEDS_GESTURE', error: 'Press Alt+Shift+S to snap the board (the browser needs a key press for screenshots on this site).' }; }
}

// ------------------------------------------------------------------ badge
async function updateBadge() {
  try {
    const n = await PStore.dueCount();
    await chrome.action.setBadgeBackgroundColor({ color: '#1C1B18' });
    await chrome.action.setBadgeTextColor({ color: '#FFD23F' }).catch(() => {});
    await chrome.action.setBadgeText({ text: n > 0 ? String(n > 99 ? '99+' : n) : '' });
  } catch (e) {}
}
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.cards) updateBadge(); });

// ------------------------------------------------------------------ commands
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  tab = tab && tab.id ? tab : await activeTab();
  if (!tab || !tab.id) return;
  const ok = await ensureContent(tab.id);
  if (!ok) return;
  if (cmd === 'listen-tab') {
    const cur = await capState();
    if (cur && cur.tabId === tab.id) await stopListen(); else await startListen(tab.id);
    return;
  }
  if (cmd === 'snap-board') {
    const r = await snapVisible(tab.windowId);
    sendTab(tab.id, { type: 'cmd', cmd: 'snap', dataUrl: r.ok ? r.dataUrl : '' });
    return;
  }
  sendTab(tab.id, { type: 'cmd', cmd });
});

// ------------------------------------------------------------------ message router
const HANDLERS = {
  'ai:chat': (m) => aiChat(m).then((r) => ({ ok: true, text: r.text, data: r.data, model: r.model, provider: r.provider, fallback: !!r.fallback })),
  'ai:test': (m) => testKey(m),
  'device:status': () => deviceStatus(),
  'ai:models': (m) => listModels(m.provider, m.key, m.base).then((ids) => ({ ok: true, ids })),
  'stt:start': async (m, sender) => startListen(m.tabId || (sender.tab && sender.tab.id)),
  'stt:stop': () => stopListen(),
  'stt:status': async (m, sender) => { const c = await capState(); const tabId = m.tabId || (sender.tab && sender.tab.id); return { ok: true, on: !!(c && c.tabId === tabId), tabId: c && c.tabId }; },
  'stt:seg': async (m, sender) => {
    const c = await capState();
    if (!c || !sender.tab || c.tabId !== sender.tab.id) return { ok: false };
    chrome.runtime.sendMessage({ type: 'off:seg', op: m.op, t: m.t, prompt: m.prompt }).catch(() => {});
    return { ok: true };
  },
  'off:chunk': (m) => { onChunk(m); return { ok: true }; },
  'stt:transcribe': (m) => transcribe(m).then((r) => ({ ok: true, text: r.text, segments: r.segments })),
  'off:ended': async () => { const c = await capState(); await setCapState(null); if (c) sendTab(c.tabId, { type: 'stt:state', on: false, error: 'Listening stopped (the tab audio ended).' }); return { ok: true }; },
  'snap:tab': (m, sender) => snapVisible(sender.tab ? sender.tab.windowId : undefined),
  'open:options': (m) => { chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html' + (m.hash ? '#' + m.hash : '')) }); return { ok: true }; },
  'open:url': (m) => { chrome.tabs.create({ url: m.url }); return { ok: true }; },
  'inject': async (m) => ({ ok: await ensureContent(m.tabId) }),
  'badge': () => { updateBadge(); return { ok: true }; },
  'voice:start': (m, sender) => startVoice(m, sender),
  'voice:model': async () => {
    const s = await PStore.settings();
    const v = s.voice || {};
    let provider = v.provider === 'auto' || !v.provider ? (s.ai.keys.gemini ? 'gemini' : s.ai.keys.openai ? 'openai' : '') : v.provider;
    if (!provider) return { ok: false, error: 'Add a free Gemini key (or an OpenAI key) in AI brain & keys.' };
    if (provider === 'openai') return { ok: !!s.ai.keys.openai, provider, model: v.openaiModel, error: s.ai.keys.openai ? '' : 'No OpenAI key' };
    if (!s.ai.keys.gemini) return { ok: false, error: 'No Gemini key yet' };
    return { ok: true, provider, model: await geminiLiveModel(s.ai.keys.gemini) };
  },
  'voice:op': async (m) => {
    const r = await chrome.runtime.sendMessage(Object.assign({}, m, { type: 'off:voice' })).catch(() => ({ ok: false }));
    if (m.op === 'stop') { await chrome.storage.session.remove('voice'); }
    return r || { ok: false };
  },
  'voice:evt': async (m) => {
    if (m.evt && m.evt.kind === 'state' && m.evt.state === 'ended') { await chrome.storage.session.remove('voice'); }
    if (m.tabId) sendTab(m.tabId, m);
    return { ok: true };
  },
  'study:ping': async () => {
    const was = await guardianActiveCached();
    await chrome.storage.session.set({ studyAt: Date.now() });
    if (!was) await syncGuardian();
    const on = await guardianActiveCached();
    const s = await PStore.settings();
    return { ok: true, on, newlyOn: on && !was, sites: (s.guardian.sites || []).length, shorts: s.guardian.shorts !== false };
  },
  // hard "focus lock": Guardian on for N minutes no matter what; strict = no unlock passes
  'guardian:lock': async (m) => {
    const until = m.minutes ? Date.now() + m.minutes * 60000 : 0;
    await chrome.storage.session.set({ sprintUntil: until, lockStrict: !!(until && m.strict), passes: until && m.strict ? {} : (await chrome.storage.session.get('passes')).passes || {} });
    if (until) {
      const s = await PStore.settings(); if (!s.guardian.enabled) await PStore.saveSettings({ guardian: { enabled: true, touched: true } });
      PStore.updateStats((st) => { st.tricks = st.tricks || { used: {}, shown: {} }; st.tricks.used = st.tricks.used || {}; st.tricks.used.lock = (st.tricks.used.lock || 0) + 1; }).catch(() => {});
    }
    await syncGuardian();
    return { ok: true, until, on: await guardianActiveCached() };
  },
  'guardian:status': async () => {
    const s = await PStore.settings();
    const st = await chrome.storage.session.get(['guardianOn', 'sprintUntil', 'lockStrict', 'studyAt']);
    return { ok: true, enabled: !!s.guardian.enabled, when: s.guardian.when, on: !!st.guardianOn, lockUntil: (st.sprintUntil || 0) > Date.now() ? st.sprintUntil : 0, strict: !!st.lockStrict && (st.sprintUntil || 0) > Date.now(), studying: Date.now() - (st.studyAt || 0) < 15 * 60000, sites: (s.guardian.sites || []).length };
  },
  'sprint:set': async (m) => { await chrome.storage.session.set({ sprintUntil: m.until || 0 }); await syncGuardian(); return { ok: true }; },
  'guardian:pass': async (m) => {
    const lk = await chrome.storage.session.get(['lockStrict', 'sprintUntil']);
    if (lk.lockStrict && (lk.sprintUntil || 0) > Date.now()) return { ok: false, error: 'Focus lock is on — no passes until ' + new Date(lk.sprintUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const { passes = {} } = await chrome.storage.session.get('passes');
    passes[m.domain] = Date.now() + (m.minutes || 5) * 60000;
    await chrome.storage.session.set({ passes });
    await syncGuardian();
    chrome.alarms.create('pz-guardian', { periodInMinutes: 1 });
    return { ok: true };
  },
  'guardian:sync': async () => { await syncGuardian(); return { ok: true, on: (await chrome.storage.session.get('guardianOn')).guardianOn }; },
  'everywhere:sync': async () => { await syncEverywhere(); return { ok: true }; },
  'whoami': (m, sender) => ({ ok: true, tabId: sender.tab && sender.tab.id }),
  'focus:tab': async (m, sender) => { if (sender.tab) { await chrome.tabs.update(sender.tab.id, { active: true }); await chrome.windows.update(sender.tab.windowId, { focused: true }); } return { ok: true }; },
  // frame relay (video inside an iframe)
  'agent:hello': (m, s) => relayUp(m, s),
  'agent:state': (m, s) => relayUp(m, s),
  'agent:tx': (m, s) => relayUp(m, s),
  'agent:event': (m, s) => relayUp(m, s),
  'agent:cmd': async (m, sender) => {
    if (!sender.tab) return { ok: false };
    try { return await chrome.tabs.sendMessage(sender.tab.id, m, { frameId: m.frameId }); } catch (e) { return { ok: false, error: String(e) }; }
  },
  'agent:discover': (m, sender) => {
    if (!sender.tab) return { ok: false };
    chrome.tabs.sendMessage(sender.tab.id, { type: 'agent:discover' }).catch(() => {});
    return { ok: true };
  }
};
function relayUp(m, sender) {
  if (!sender.tab || !sender.frameId) return { ok: false };
  sendTab(sender.tab.id, Object.assign({}, m, { frameId: sender.frameId }), 0);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = msg && HANDLERS[msg.type];
  if (!h) return false;
  Promise.resolve().then(() => h(msg, sender)).then(
    (r) => sendResponse(r),
    (e) => sendResponse({ ok: false, error: (e && e.message) || String(e), code: e && e.code, retryAfter: e && e.retryAfter })
  );
  return true;
});

async function guardianActiveCached() { const r = await chrome.storage.session.get('guardianOn'); return !!r.guardianOn; }
