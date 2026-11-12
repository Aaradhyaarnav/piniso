/* Piniso pages — shared helpers for popup, dashboard and notes page. */
(() => {
  const U = globalThis.PU = {};
  U.h = (sel, attrs, ...kids) => {
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
  U.I = (n, s) => PIcons.svg(n, s);
  U.esc = (s) => PMd.esc(s);
  U.applyTheme = (s) => {
    const t = PINISO.themeOf(s), r = document.documentElement;
    Object.entries({ '--paper': t.paper, '--paper2': t.paper2, '--ink': t.ink, '--muted': t.muted, '--line': t.line, '--acc': t.accent, '--acc-ink': t.accentInk })
      .forEach(([k, v]) => r.style.setProperty(k, v));
    r.classList.remove('c-sketchy', 'c-round', 'c-sharp', 'dark');
    r.classList.add('c-' + (s.ui.corners || 'sketchy'));
    if (t.dark) r.classList.add('dark');
    return t;
  };
  U.petCfg = (s) => Object.assign(PINISO.petOf(s), { accent: PINISO.themeOf(s).accent, motion: s.pet.motion });
  U.toast = (msg, ms = 2400) => {
    const t = U.h('div.toast', { text: msg });
    document.body.append(t);
    setTimeout(() => t.remove(), ms);
  };
  U.sw = (on, cb) => {
    const b = U.h('button.sw' + (on ? '.on' : ''), { role: 'switch', 'aria-checked': String(!!on) });
    b.addEventListener('click', () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); cb(v); });
    return b;
  };
  U.seg = (opts, cur, cb) => {
    const s = U.h('div.seg');
    opts.forEach(([v, lab]) => s.append(U.h('button' + (v === cur ? '.on' : ''), { text: lab, onclick: (e) => { [...s.children].forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); cb(v); } })));
    return s;
  };
  U.row = (label, sub, control) => {
    const r = U.h('div.setrow');
    r.append(U.h('div.lbl', { html: U.esc(label) + (sub ? `<small>${sub}</small>` : '') }));
    if (control) r.append(control);
    return r;
  };
  U.fmt = (sec) => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, z = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${z(m)}:${z(s)}` : `${m}:${z(s)}`;
  };
  U.dur = (sec) => {
    sec = Math.round(sec || 0);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  };
  U.ago = (ts) => {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' min ago';
    if (d < 86400) return Math.floor(d / 3600) + ' h ago';
    if (d < 86400 * 7) return Math.floor(d / 86400) + ' days ago';
    return new Date(ts).toLocaleDateString();
  };
  U.bg = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r || { ok: false }); }));
  U.videoUrlAt = (sess, t) => {
    try {
      const u = new URL(sess.url);
      if (/youtube\.com|youtu\.be/.test(u.hostname)) { u.searchParams.set('t', Math.max(0, Math.floor(t)) + 's'); return u.toString(); }
      return sess.url;
    } catch (e) { return sess.url || '#'; }
  };
})();
