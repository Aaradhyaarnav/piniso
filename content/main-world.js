/* Piniso — runs in YouTube's page world. YouTube now protects its caption files with a
   proof-of-origin token, so instead of downloading captions ourselves we catch the caption
   file the YouTube player itself downloads, and pass it to Piniso's content script. */
(() => {
  if (window.__pinisoMain) return;
  window.__pinisoMain = true;
  const OUT = 'piniso-main', IN = 'piniso-iso';
  const post = (type, data) => { try { window.postMessage({ source: OUT, type, data }, '*'); } catch (e) {} };
  const cache = new Map(); // videoId -> { url, body, lang, at }

  const isTT = (u) => typeof u === 'string' && u.indexOf('/api/timedtext') !== -1;
  const vidOf = (u) => { try { return new URL(u, location.href).searchParams.get('v') || ''; } catch (e) { return ''; } };
  const langOf = (u) => { try { const q = new URL(u, location.href).searchParams; return q.get('tlang') || q.get('lang') || ''; } catch (e) { return ''; } };
  function got(url, body) {
    if (!body || body.length < 30) return;
    const v = vidOf(url);
    cache.set(v || '?', { url, body, lang: langOf(url), at: Date.now() });
    if (cache.size > 6) cache.delete(cache.keys().next().value);
    post('timedtext', { videoId: v, url, body, lang: langOf(url) });
  }

  try {
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const p = origFetch.apply(this, arguments);
      if (isTT(url)) p.then((r) => r.clone().text()).then((b) => got(url, b)).catch(() => {});
      return p;
    };
  } catch (e) {}
  try {
    const XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__pzUrl = String(u || ''); return XO.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
      if (isTT(this.__pzUrl)) {
        this.addEventListener('load', () => {
          try {
            const body = (this.responseType === '' || this.responseType === 'text') ? this.responseText
              : (typeof this.response === 'string' ? this.response : JSON.stringify(this.response));
            got(this.__pzUrl, body);
          } catch (e) {}
        });
      }
      return XS.apply(this, arguments);
    };
  } catch (e) {}

  const player = () => document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  function playerResponse() {
    const p = player();
    try { const r = p && p.getPlayerResponse && p.getPlayerResponse(); if (r && r.videoDetails) return r; } catch (e) {}
    return window.ytInitialPlayerResponse || null;
  }
  function info() {
    const pr = playerResponse();
    if (!pr) return null;
    const vd = pr.videoDetails || {};
    const ctr = ((pr.captions || {}).playerCaptionsTracklistRenderer || {});
    const tracks = (ctr.captionTracks || []).map((t) => ({
      baseUrl: t.baseUrl, lang: t.languageCode, kind: t.kind || '', vssId: t.vssId || '',
      name: (t.name && (t.name.simpleText || (t.name.runs || []).map((r) => r.text).join(''))) || t.languageCode
    }));
    const chapters = [];
    return {
      videoId: vd.videoId || '', title: vd.title || document.title, author: vd.author || '',
      length: Number(vd.lengthSeconds) || 0, description: String(vd.shortDescription || '').slice(0, 1200),
      tracks, isLive: !!vd.isLive, chapters
    };
  }
  function ccState() {
    const p = player();
    try { const t = p.getOption('captions', 'track'); return !!(t && t.languageCode); } catch (e) { return false; }
  }

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m.source !== IN) return;
    const p = player();
    switch (m.type) {
      case 'info': post('info', info()); break;
      case 'cached': {
        const c = cache.get(m.videoId);
        post('cached', c ? Object.assign({ videoId: m.videoId }, c) : { videoId: m.videoId, body: '' });
        break;
      }
      case 'fetchTrack': {
        let body = '';
        try {
          let u = m.baseUrl;
          u = /[?&]fmt=/.test(u) ? u.replace(/([?&])fmt=[^&]*/, '$1fmt=json3') : u + '&fmt=json3';
          const r = await fetch(u, { credentials: 'include' });
          body = r.ok ? await r.text() : '';
        } catch (e) {}
        post('track', { videoId: m.videoId, body });
        break;
      }
      case 'enableCC': {
        const was = ccState();
        try {
          if (p && p.loadModule) p.loadModule('captions');
          if (p && p.setOption && m.lang) p.setOption('captions', 'track', { languageCode: m.lang });
          else if (p && p.toggleSubtitlesOn) p.toggleSubtitlesOn();
        } catch (e) {}
        post('cc', { wasOn: was, on: true });
        break;
      }
      case 'disableCC': {
        try { if (p && p.setOption) p.setOption('captions', 'track', {}); if (p && p.unloadModule) p.unloadModule('captions'); } catch (e) {}
        post('cc', { on: false });
        break;
      }
      case 'ccState': post('cc', { on: ccState() }); break;
      default: break;
    }
  });

  document.addEventListener('yt-navigate-finish', () => post('nav', { href: location.href }));
  post('ready', {});
})();
