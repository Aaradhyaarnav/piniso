/* Piniso content — shared utilities and namespace. */
(() => {
  if (globalThis.PZ) return;
  const PZ = globalThis.PZ = {};

  PZ.isTop = (() => { try { return window.top === window; } catch (e) { return false; } })();
  PZ.alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  PZ.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  PZ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PZ.words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

  PZ.fmt = (sec) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const z = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${z(m)}:${z(s)}` : `${m}:${z(s)}`;
  };
  PZ.fmtDur = (sec) => {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  PZ.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  PZ.throttle = (fn, ms) => { let last = 0; return (...a) => { const n = Date.now(); if (n - last >= ms) { last = n; fn(...a); } }; };

  PZ.bg = (msg) => new Promise((res) => {
    if (!PZ.alive()) return res({ ok: false, error: 'Piniso was updated. Refresh the page.', code: 'DEAD' });
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        const e = chrome.runtime.lastError;
        if (e) res({ ok: false, error: e.message, code: 'BG' }); else res(r || { ok: false, error: 'No answer' });
      });
    } catch (e) { res({ ok: false, error: String(e), code: 'DEAD' }); }
  });

  // streamed AI answer: onDelta(fullTextSoFar) is called as words arrive. Resolves like PZ.bg.
  PZ.stream = (msg, onDelta) => new Promise((res) => {
    if (!PZ.alive()) return res({ ok: false, error: 'Piniso was updated. Refresh the page.', code: 'DEAD' });
    let port, text = '', done = false;
    const finish = (r) => { if (done) return; done = true; try { port && port.disconnect(); } catch (e) {} res(r); };
    try { port = chrome.runtime.connect({ name: 'pz-ai' }); } catch (e) { return res({ ok: false, error: String(e), code: 'DEAD' }); }
    port.onMessage.addListener((m) => {
      if (m.d) { text += m.d; try { onDelta && onDelta(text); } catch (e) {} }
      else if (m.done) finish({ ok: true, text: m.text || text, model: m.model });
      else if (m.error) finish({ ok: false, error: m.error, code: m.code, retryAfter: m.retryAfter, partial: text });
    });
    port.onDisconnect.addListener(() => finish(text ? { ok: true, text } : { ok: false, error: 'Connection to Piniso lost.', code: 'BG' }));
    port.postMessage(msg);
  });

  PZ.star = (n) => !!(n && (n.star || n.kind === 'important'));

  // tiny DOM helper: h('div.cls#id', {attrs}, children...)
  PZ.h = (sel, attrs, ...kids) => {
    const m = sel.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i) || [];
    const el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, n) => { if (t === '.') el.classList.add(n); else el.id = n; });
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  };

  PZ.site = () => {
    const h = location.hostname;
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) return 'youtube';
    if (/unacademy\.com$/.test(h)) return 'unacademy';
    if (/pw\.live$/.test(h)) return 'pw';
    if (/khanacademy\.org$/.test(h)) return 'khan';
    if (/coursera\.org$/.test(h)) return 'coursera';
    if (/udemy\.com$/.test(h)) return 'udemy';
    return h.replace(/^www\./, '');
  };
  PZ.ytVideoId = () => {
    try {
      const u = new URL(location.href);
      if (u.pathname === '/watch') return u.searchParams.get('v') || '';
      const m = u.pathname.match(/^\/(?:embed|live|shorts|v)\/([\w-]{6,})/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  };

  // bridge to content/main-world.js (YouTube page world)
  const mwL = {};
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m.source !== 'piniso-main') return;
    (mwL[m.type] || []).slice().forEach((cb) => { try { cb(m.data); } catch (e) {} });
  });
  PZ.mw = {
    send(type, data) { window.postMessage(Object.assign({ source: 'piniso-iso', type }, data || {}), '*'); },
    on(type, cb) { (mwL[type] = mwL[type] || []).push(cb); return () => { mwL[type] = (mwL[type] || []).filter((x) => x !== cb); }; },
    request(type, data, reply, ms = 2500, match) {
      return new Promise((res) => {
        let off = null;
        const t = setTimeout(() => { off && off(); res(null); }, ms);
        off = PZ.mw.on(reply, (d) => { if (match && !match(d)) return; clearTimeout(t); off(); res(d); });
        PZ.mw.send(type, data);
      });
    }
  };

  // simple event bus
  const bus = {};
  PZ.on = (ev, cb) => { (bus[ev] = bus[ev] || []).push(cb); };
  PZ.emit = (ev, data) => { (bus[ev] || []).slice().forEach((cb) => { try { cb(data); } catch (e) { console.warn('[Piniso]', ev, e); } }); };

  PZ.uid = () => Math.random().toString(36).slice(2, 9);
  PZ.today = () => PStore.todayKey();
  PZ.log = (...a) => { if (PZ.debug) console.log('%c[Piniso]', 'color:#c80', ...a); };
})();
