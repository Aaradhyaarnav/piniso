/* Piniso content — finds the lecture video and wraps it (local <video>, or a video inside an iframe via the background relay). */
(() => {
  if (PZ.Video) return;

  function bestVideo(root = document) {
    let best = null, bestA = 0;
    for (const v of root.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const a = r.width * r.height;
      if (r.width < 220 || r.height < 120) continue;
      if (getComputedStyle(v).visibility === 'hidden') continue;
      if (a > bestA) { best = v; bestA = a; }
    }
    return best;
  }

  function isBlack(ctx, w, h) {
    try {
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
      return sum / (n * 3) < 5;
    } catch (e) { return true; }
  }

  function snapVideo(v, maxW = 1280) {
    try {
      const w = v.videoWidth, h = v.videoHeight;
      if (!w || !h) return null;
      const s = Math.min(1, maxW / w);
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      if (isBlack(ctx, c.width, c.height)) return null;
      return c.toDataURL('image/jpeg', 0.82);
    } catch (e) { return null; } // cross-origin or DRM
  }

  // crop a full-tab screenshot down to the video rectangle
  function cropShot(dataUrl, rect, maxW = 1280) {
    return new Promise((res) => {
      if (!dataUrl) return res(null);
      const img = new Image();
      img.onload = () => {
        const k = img.width / window.innerWidth;
        const sx = Math.max(0, rect.left * k), sy = Math.max(0, rect.top * k);
        const sw = Math.min(img.width - sx, rect.width * k), sh = Math.min(img.height - sy, rect.height * k);
        if (sw < 40 || sh < 40) return res(dataUrl);
        const s = Math.min(1, maxW / sw);
        const c = document.createElement('canvas');
        c.width = Math.round(sw * s); c.height = Math.round(sh * s);
        c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
  }

  function thumb(dataUrl, maxW = 360) {
    return new Promise((res) => {
      if (!dataUrl) return res(null);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
  }

  class LocalVideo {
    constructor(v) { this.v = v; this.kind = 'local'; }
    get t() { return this.v.currentTime || 0; }
    get d() { const d = this.v.duration; return isFinite(d) ? d : 0; }
    get paused() { return this.v.paused; }
    get ended() { return this.v.ended; }
    get rate() { return this.v.playbackRate || 1; }
    get live() { return !isFinite(this.v.duration); }
    get volume() { return this.v.volume; }
    set volume(x) { try { this.v.volume = PZ.clamp(x, 0, 1); } catch (e) {} }
    play() { try { const p = this.v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    pause() { try { this.v.pause(); } catch (e) {} }
    seek(t) { try { this.v.currentTime = Math.max(0, t); } catch (e) {} }
    setRate(r) { try { this.v.playbackRate = r; } catch (e) {} }
    rect() {
      if (PZ.site() === 'youtube') {
        const p = document.getElementById('movie_player');
        if (p) { const r = p.getBoundingClientRect(); if (r.width > 100) return r; }
      }
      return this.v.getBoundingClientRect();
    }
    on(ev, cb) { this.v.addEventListener(ev, cb); }
    off(ev, cb) { this.v.removeEventListener(ev, cb); }
    alive() { return this.v.isConnected; }
    async snap() { return snapVideo(this.v); }
    textTracks() { return this.v.textTracks; }
    el() { return this.v; }
  }

  class RemoteVideo {
    constructor(frameId, info) {
      this.kind = 'remote'; this.frameId = frameId; this.info = info || {};
      this.s = { t: 0, d: 0, paused: true, ended: false, rate: 1, vol: 1, at: Date.now() };
      this.ls = {}; this.lastSeen = Date.now();
    }
    update(st) {
      const prev = this.s;
      const now = Date.now();
      const expect = prev.t + (prev.paused ? 0 : (now - prev.at) / 1000 * (prev.rate || 1));
      this.s = Object.assign({}, st, { at: now });
      this.lastSeen = now;
      if (prev.paused && !st.paused) this.fire('play');
      if (!prev.paused && st.paused) this.fire('pause');
      if (Math.abs(st.t - expect) > 2.5) this.fire('seeked');
      if (st.ended && !prev.ended) this.fire('ended');
      this.fire('timeupdate');
    }
    get t() { const s = this.s; return s.t + (s.paused ? 0 : Math.min(3, (Date.now() - s.at) / 1000) * (s.rate || 1)); }
    get d() { return this.s.d || 0; }
    get paused() { return !!this.s.paused; }
    get ended() { return !!this.s.ended; }
    get rate() { return this.s.rate || 1; }
    get live() { return !this.s.d; }
    get volume() { return this.s.vol; }
    set volume(x) { this.cmd('volume', { v: x }); }
    cmd(cmd, extra) { return PZ.bg(Object.assign({ type: 'agent:cmd', frameId: this.frameId, cmd }, extra || {})); }
    play() { this.cmd('play'); }
    pause() { this.cmd('pause'); this.s.paused = true; }
    seek(t) { this.cmd('seek', { t }); }
    iframe() {
      const src = this.info.src || '';
      const frames = [...document.querySelectorAll('iframe')];
      let best = null, bestA = 0;
      for (const f of frames) {
        const r = f.getBoundingClientRect(); const a = r.width * r.height;
        const fs = f.src || '';
        const match = src && fs && (fs.split('?')[0] === src.split('?')[0] || (this.info.vid && fs.includes(this.info.vid)));
        if (match) return f;
        if (a > bestA && r.width > 220) { best = f; bestA = a; }
      }
      return best;
    }
    rect() {
      const f = this.iframe();
      if (f) return f.getBoundingClientRect();
      const w = Math.min(960, innerWidth * 0.7), h = w * 9 / 16;
      return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h, right: (innerWidth + w) / 2, bottom: (innerHeight + h) / 2 };
    }
    on(ev, cb) { (this.ls[ev] = this.ls[ev] || []).push(cb); }
    off(ev, cb) { this.ls[ev] = (this.ls[ev] || []).filter((x) => x !== cb); }
    fire(ev) { (this.ls[ev] || []).slice().forEach((cb) => { try { cb(); } catch (e) {} }); }
    alive() { return Date.now() - this.lastSeen < 8000; }
    async snap() { const r = await this.cmd('snap'); return r && r.dataUrl ? r.dataUrl : null; }
    textTracks() { return null; }
    el() { return null; }
  }

  // ---------------- agent (runs inside iframes that hold the real video) ----------------
  const Agent = {
    v: null, timer: null, tx: null,
    start() {
      if (PZ.isTop) return;
      const scan = () => {
        if (!PZ.alive()) return clearInterval(this.timer);
        const v = bestVideo();
        if (v && v !== (this.v && this.v.v)) {
          this.v = new LocalVideo(v);
          const push = () => this.push();
          ['play', 'pause', 'seeked', 'ended', 'ratechange'].forEach((e) => v.addEventListener(e, push));
          this.hello();
        }
        if (this.v) this.push();
      };
      this.timer = setInterval(scan, 1000);
      scan();
      chrome.runtime.onMessage.addListener((m, s, reply) => {
        if (!m) return false;
        if (m.type === 'agent:discover') { if (this.v) this.hello(); return false; }
        if (m.type !== 'agent:cmd' || !this.v) return false;
        const v = this.v;
        switch (m.cmd) {
          case 'play': v.play(); break;
          case 'pause': v.pause(); break;
          case 'seek': v.seek(m.t); break;
          case 'volume': v.volume = m.v; break;
          case 'snap': v.snap().then((d) => reply({ ok: !!d, dataUrl: d })); return true;
          case 'tx:start':
            if (!this.tx && PZ.TranscriptManager) {
              this.tx = new PZ.TranscriptManager(v, {
                agent: true,
                onCues: (cues, meta) => PZ.bg({ type: 'agent:tx', cues, meta })
              });
              this.tx.start();
            }
            break;
          default: break;
        }
        reply({ ok: true });
        return false;
      });
    },
    hello() {
      const r = this.v.rect();
      PZ.bg({ type: 'agent:hello', info: { src: location.href, vid: PZ.ytVideoId(), w: r.width, h: r.height, title: document.title } });
    },
    push() {
      const v = this.v;
      if (!v || !v.alive()) return;
      PZ.bg({ type: 'agent:state', state: { t: v.t, d: v.d, paused: v.paused, ended: v.ended, rate: v.rate, vol: v.volume } });
    }
  };

  // ---------------- watcher used by the top frame ----------------
  const remotes = new Map();
  const Watch = {
    cur: null, cb: null, timer: null,
    start(cb) {
      this.cb = cb;
      chrome.runtime.onMessage.addListener((m) => {
        if (!m || !m.frameId) return false;
        if (m.type === 'agent:hello') {
          let r = remotes.get(m.frameId);
          if (!r) { r = new RemoteVideo(m.frameId, m.info); remotes.set(m.frameId, r); }
          r.info = m.info; r.lastSeen = Date.now();
        } else if (m.type === 'agent:state') {
          const r = remotes.get(m.frameId);
          if (r) r.update(m.state);
        } else if (m.type === 'agent:tx') {
          PZ.emit('agent:tx', m);
        }
        return false;
      });
      PZ.bg({ type: 'agent:discover' });
      const tick = () => {
        if (!PZ.alive()) return clearInterval(this.timer);
        const v = bestVideo();
        let next = null;
        if (v) next = this.cur && this.cur.kind === 'local' && this.cur.v === v ? this.cur : new LocalVideo(v);
        else {
          let best = null;
          for (const r of remotes.values()) if (r.alive() && (!best || (r.info.w * r.info.h > best.info.w * best.info.h))) best = r;
          next = best;
        }
        if (next !== this.cur) { this.cur = next; this.cb && this.cb(next); }
      };
      this.timer = setInterval(tick, 1200);
      tick();
    }
  };

  PZ.Video = { bestVideo, snapVideo, cropShot, thumb, LocalVideo, RemoteVideo, Agent, Watch };
})();
