/* Piniso content — how Piniso "hears" the lecture.
   Order: YouTube caption file (caught from the player) → live on-screen captions → HTML5 text tracks
   → tab audio listening (speech-to-text with the user's key). */
(() => {
  if (PZ.TranscriptManager) return;

  const clean = (s) => String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[(music|applause|laughter|संगीत|silence|noise|inaudible)\]/gi, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();

  class Store {
    constructor() { this.cues = []; }
    get length() { return this.cues.length; }
    add(list) {
      const added = [];
      for (const c of list || []) {
        const text = clean(c.text);
        if (!text || !isFinite(c.start)) continue;
        const start = Math.max(0, +c.start), end = Math.max(start + 0.2, +c.end || start + 2);
        // dedupe
        let lo = 0, hi = this.cues.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (this.cues[mid].start < start) lo = mid + 1; else hi = mid; }
        const near = [this.cues[lo - 1], this.cues[lo]].filter(Boolean);
        if (near.some((x) => Math.abs(x.start - start) < 0.35 && x.text === text)) continue;
        const cue = { start, end, text };
        this.cues.splice(lo, 0, cue);
        added.push(cue);
      }
      return added;
    }
    range(t0, t1) { return this.cues.filter((c) => c.end > t0 && c.start < t1); }
    text(t0, t1, stamps = true) {
      const cs = this.range(t0, t1);
      if (!stamps) return cs.map((c) => c.text).join(' ');
      const lines = []; let cur = null;
      for (const c of cs) {
        if (!cur || c.start - cur.t >= 12) { cur = { t: Math.floor(c.start), parts: [] }; lines.push(cur); }
        cur.parts.push(c.text);
      }
      return lines.map((l) => `[${l.t}] ${l.parts.join(' ')}`).join('\n');
    }
    words(t0, t1) { return PZ.words(this.text(t0, t1, false)); }
    lastEnd() { return this.cues.length ? this.cues[this.cues.length - 1].end : 0; }
    clear() { this.cues = []; }
  }

  function parseJson3(body) {
    let j; try { j = JSON.parse(body); } catch (e) { return null; }
    if (!j || !Array.isArray(j.events)) return null;
    const out = [];
    for (const e of j.events) {
      if (!e.segs) continue;
      const text = e.segs.map((s) => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
      if (!text) continue;
      const start = (e.tStartMs || 0) / 1000;
      out.push({ start, end: start + (e.dDurationMs || 2500) / 1000, text });
    }
    return out;
  }
  function parseXml(body) {
    try {
      const doc = new DOMParser().parseFromString(body, 'text/xml');
      const out = [];
      doc.querySelectorAll('text').forEach((n) => {
        const s = parseFloat(n.getAttribute('start')); const d = parseFloat(n.getAttribute('dur') || '2.5');
        out.push({ start: s, end: s + d, text: n.textContent });
      });
      if (!out.length) doc.querySelectorAll('p').forEach((n) => {
        const s = parseFloat(n.getAttribute('t')) / 1000; const d = parseFloat(n.getAttribute('d') || '2500') / 1000;
        out.push({ start: s, end: s + d, text: n.textContent });
      });
      return out.length ? out : null;
    } catch (e) { return null; }
  }
  const parseAny = (b) => (b ? (parseJson3(b) || parseXml(b)) : null);

  class TranscriptManager {
    constructor(video, opt = {}) {
      this.video = video; this.opt = opt;
      this.store = new Store();
      this.status = 'searching';
      this.detail = '';
      this.meta = { title: '', author: '', description: '', length: 0 };
      this.cleanups = [];
      this.listening = false;
      this.weTurnedCC = false;
      this.stopped = false;
    }
    setStatus(s, detail = '') {
      this.status = s; this.detail = detail;
      this.opt.onStatus && this.opt.onStatus(s, detail);
      if (this.opt.agent && this.opt.onCues) this.opt.onCues([], { status: s, detail, meta: this.meta });
    }
    addCues(list, src) {
      const added = this.store.add(list);
      if (added.length) {
        this.opt.onAdd && this.opt.onAdd(added, src);
        if (this.opt.agent && this.opt.onCues) this.opt.onCues(added, { status: this.status, meta: this.meta });
      }
      return added;
    }
    label() {
      return ({
        searching: 'Looking for captions…', captions: 'Reading captions', live: 'Reading live captions',
        texttrack: 'Reading subtitles', listening: 'Listening to audio', screen: 'Reading the screen', 'needs-listen': 'Can’t hear — turn on Listen',
        none: 'No captions', remote: 'Reading embedded video', error: 'Hearing problem'
      })[this.status] || this.status;
    }
    async start() {
      if (this.video.kind === 'remote') return this.remote();
      if (PZ.site() === 'youtube') return this.youtube();
      return this.generic();
    }
    stop() {
      this.stopped = true;
      this.cleanups.forEach((f) => { try { f(); } catch (e) {} });
      this.cleanups = [];
      if (this.listening) this.stopListenSegments();
      if (this.weTurnedCC) PZ.mw.send('disableCC');
      document.documentElement.classList.remove('pz-hide-cc');
    }

    // ---------------- remote (video inside iframe) ----------------
    remote() {
      this.setStatus('remote');
      const off = (m) => {
        if (m.frameId !== this.video.frameId) return;
        if (m.meta && m.meta.meta && m.meta.meta.title) this.meta = m.meta.meta;
        if (m.meta && m.meta.status) { this.status = m.meta.status; this.opt.onStatus && this.opt.onStatus(this.status, m.meta.detail || ''); }
        if (m.cues && m.cues.length) this.addCues(m.cues, 'remote');
      };
      PZ.on('agent:tx', off);
      this.video.cmd('tx:start');
      setTimeout(() => { if (!this.store.length && this.status === 'remote') this.needsListen(); }, 12000);
    }

    // ---------------- YouTube ----------------
    async youtube() {
      const vid = PZ.ytVideoId();
      let info = null;
      for (let i = 0; i < 8 && !this.stopped; i++) {
        info = await PZ.mw.request('info', {}, 'info', 1500);
        if (info && (!vid || info.videoId === vid)) break;
        await PZ.sleep(700);
      }
      if (this.stopped) return;
      if (info) this.meta = { title: info.title, author: info.author, description: info.description, length: info.length, live: info.isLive };
      if (!info || !info.tracks || !info.tracks.length) {
        // maybe page script blocked; try live captions anyway, then audio
        return this.needsListen();
      }
      const tracks = info.tracks;
      const pick = tracks.find((t) => t.kind !== 'asr' && /^(en|hi)/.test(t.lang)) || tracks.find((t) => t.kind !== 'asr')
        || tracks.find((t) => /^(en|hi)/.test(t.lang)) || tracks[0];

      // 1. caption file the player already downloaded
      const cached = await PZ.mw.request('cached', { videoId: info.videoId }, 'cached', 1500, (d) => d && d.videoId === info.videoId);
      let cues = cached && parseAny(cached.body);
      // 2. direct download (works on older / unprotected videos)
      if (!cues || cues.length < 3) {
        const r = await PZ.mw.request('fetchTrack', { baseUrl: pick.baseUrl, videoId: info.videoId }, 'track', 6000, (d) => d && d.videoId === info.videoId);
        cues = r && parseAny(r.body);
      }
      // 3. ask the player to load captions, and catch its download
      if (!cues || cues.length < 3) {
        const caught = new Promise((res) => {
          const off = PZ.mw.on('timedtext', (d) => { if (!d.videoId || d.videoId === info.videoId) { off(); res(d); } });
          setTimeout(() => { off(); res(null); }, 9000);
        });
        const cc = await PZ.mw.request('enableCC', { lang: pick.lang }, 'cc', 2000);
        if (cc && !cc.wasOn) this.weTurnedCC = true;
        const d = await caught;
        cues = d && parseAny(d.body);
        if (cues && cues.length >= 3 && this.weTurnedCC) { PZ.mw.send('disableCC'); this.weTurnedCC = false; }
      }
      if (this.stopped) return;
      if (cues && cues.length >= 3) {
        this.addCues(cues, 'captions');
        this.setStatus('captions', pick.name || pick.lang);
        // keep catching (user switching caption language, etc.)
        const off = PZ.mw.on('timedtext', (d) => { if (d.videoId === info.videoId) { const more = parseAny(d.body); if (more) this.addCues(more, 'captions'); } });
        this.cleanups.push(off);
        return;
      }
      // 4. live on-screen captions
      this.liveCaptions();
    }

    liveCaptions() {
      PZ.mw.send('enableCC', { lang: '' });
      const s = PZ.app && PZ.app.settings;
      if (!s || s.focus.hideCaptions) document.documentElement.classList.add('pz-hide-cc');
      this.weTurnedCC = true;
      let last = [];
      const tick = () => {
        const segs = document.querySelectorAll('.ytp-caption-segment');
        if (!segs.length) return;
        const words = [...segs].map((x) => x.textContent).join(' ').trim().split(/\s+/).filter(Boolean);
        if (!words.length) return;
        let k = Math.min(last.length, words.length);
        for (; k > 0; k--) {
          let ok = true;
          for (let i = 0; i < k; i++) if (last[last.length - k + i] !== words[i]) { ok = false; break; }
          if (ok) break;
        }
        const fresh = words.slice(k);
        last = words;
        if (fresh.length) { const t = this.video.t; this.addCues([{ start: Math.max(0, t - 1.5), end: t, text: fresh.join(' ') }], 'live'); }
      };
      const id = setInterval(tick, 700);
      this.cleanups.push(() => clearInterval(id));
      this.setStatus('live');
      setTimeout(() => { if (!this.stopped && this.store.length < 2 && this.status === 'live') this.needsListen(); }, 20000);
    }

    // ---------------- other sites ----------------
    async generic() {
      const v = this.video;
      const el = v.el && v.el();
      if (el && el.srcObject && el.srcObject.getAudioTracks) {
        if (el.srcObject.getAudioTracks().length) return this.streamListen(el.srcObject);
        return this.setStatus('screen');
      }
      const tt = v.textTracks && v.textTracks();
      const tryTracks = () => {
        if (!tt) return false;
        let found = false;
        for (const tr of tt) {
          if (!/subtitles|captions/.test(tr.kind)) continue;
          if (tr.mode === 'disabled') tr.mode = 'hidden';
          if (tr.cues && tr.cues.length) {
            this.addCues([...tr.cues].map((c) => ({ start: c.startTime, end: c.endTime, text: c.text })), 'texttrack');
            found = true;
          }
          if (!tr.__pz) {
            tr.__pz = true;
            const on = () => { const act = tr.activeCues ? [...tr.activeCues] : []; this.addCues(act.map((c) => ({ start: c.startTime, end: c.endTime, text: c.text })), 'texttrack'); };
            tr.addEventListener('cuechange', on);
            this.cleanups.push(() => tr.removeEventListener('cuechange', on));
          }
        }
        return found;
      };
      for (let i = 0; i < 5 && !this.stopped; i++) {
        if (tryTracks()) { this.setStatus('texttrack'); break; }
        await PZ.sleep(1000);
      }
      if (this.stopped) return;
      if (tt) { const on = () => { if (tryTracks() && this.status !== 'texttrack') this.setStatus('texttrack'); }; tt.addEventListener('addtrack', on); this.cleanups.push(() => tt.removeEventListener('addtrack', on)); }
      if (this.status !== 'texttrack') this.needsListen();
    }

    // ---------------- shared window audio (Study Anything) ----------------
    streamListen(stream) {
      this.setStatus('listening');
      const ast = new MediaStream(stream.getAudioTracks());
      let ctx = null, an = null, curSeg = null;
      try { ctx = new AudioContext(); an = ctx.createAnalyser(); an.fftSize = 2048; ctx.createMediaStreamSource(ast).connect(an); if (ctx.state !== 'running') ctx.resume().catch(() => {}); } catch (e) {}
      const measuring = () => an && ctx && ctx.state === 'running';
      const meas = setInterval(() => {
        if (!an) return;
        const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b);
        let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
        const rms = Math.sqrt(s / b.length); if (curSeg && rms > curSeg.peak) curSeg.peak = rms;
      }, 200);
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
      const toB64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
      let timer = null, rec = null;
      const cycle = () => {
        if (this.stopped) return;
        if (this.video.paused || !ast.getAudioTracks().some((t) => t.readyState === 'live')) { timer = setTimeout(cycle, 2000); return; }
        const t0 = this.video.t, chunks = [];
        const seg = { peak: 0 };
        curSeg = seg;
        try { rec = new MediaRecorder(ast, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); } catch (e) { this.setStatus('screen'); return; }
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const myRec = rec;
        myRec.onstop = async () => {
          const t1 = this.video.t;
          if ((measuring() && seg.peak < 0.006) || !chunks.length) { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
          const blob = new Blob(chunks, { type: myRec.mimeType || mime });
          const prompt = ((this.meta.title || 'Lecture') + '. ' + this.store.text(Math.max(0, t1 - 60), t1, false).split(' ').slice(-30).join(' ')).slice(0, 380);
          const r = await PZ.bg({ type: 'stt:transcribe', b64: await toB64(blob), mime: blob.type, prompt });
          if (r && r.ok) this.onSttText({ t0, t1, text: r.text, segments: r.segments });
          else if (r && r.code) { this.detail = r.error; this.opt.onStatus && this.opt.onStatus(this.status, r.error); if (r.code === 'NO_STT' || r.code === 'BAD_KEY') { this.setStatus('screen', r.error); return; } }
        };
        rec.start();
        timer = setTimeout(() => { try { rec.stop(); } catch (e) {} cycle(); }, 24000);
      };
      cycle();
      this.cleanups.push(() => { clearTimeout(timer); clearInterval(meas); try { rec && rec.state !== 'inactive' && rec.stop(); } catch (e) {} try { ctx && ctx.close(); } catch (e) {} });
    }

    // ---------------- audio listening ----------------
    async needsListen() {
      if (this.stopped) return;
      const r = await PZ.bg({ type: 'stt:status' });
      if (r && r.on) this.beginListening();
      else this.setStatus('needs-listen');
    }
    beginListening() {
      if (this.listening || this.stopped) return;
      this.listening = true;
      this.setStatus('listening');
      const v = this.video;
      let lastT = v.t, segOpen = false, segStart = 0;
      const prompt = () => {
        const tail = this.store.text(Math.max(0, v.t - 60), v.t, false).split(' ').slice(-30).join(' ');
        return ((this.meta.title || document.title) + '. ' + tail).slice(0, 380);
      };
      const open = () => { if (segOpen || v.paused) return; segOpen = true; segStart = v.t; PZ.bg({ type: 'stt:seg', op: 'start', t: v.t, prompt: prompt() }); };
      const close = (t) => { if (!segOpen) return; segOpen = false; PZ.bg({ type: 'stt:seg', op: 'pause', t }); };
      const onPlay = () => open();
      const onPause = () => close(v.t);
      const onSeeking = () => { close(lastT); setTimeout(() => { if (!v.paused) open(); }, 400); };
      v.on('play', onPlay); v.on('playing', onPlay); v.on('pause', onPause); v.on('ended', onPause); v.on('seeking', onSeeking);
      const id = setInterval(() => {
        if (!segOpen && !v.paused) open();
        if (segOpen && v.t - segStart >= 24) { const t = v.t; PZ.bg({ type: 'stt:seg', op: 'cut', t, prompt: prompt() }); segStart = t; }
        if (Math.abs(v.t - lastT) < 3) lastT = v.t; else lastT = v.t;
      }, 1000);
      open();
      this.stopListenSegments = () => { clearInterval(id); close(v.t); v.off('play', onPlay); v.off('playing', onPlay); v.off('pause', onPause); v.off('ended', onPause); v.off('seeking', onSeeking); this.listening = false; };
    }
    onSttText(m) {
      const rate = this.video.rate || 1;
      if (m.segments && m.segments.length) {
        this.addCues(m.segments.map((s) => ({ start: Math.min(m.t1, m.t0 + s.start * rate), end: Math.min(m.t1, m.t0 + s.end * rate), text: s.text })), 'audio');
      } else if (m.text) {
        this.addCues([{ start: m.t0, end: m.t1, text: m.text }], 'audio');
      }
    }
    onSttState(m) {
      if (m.on) this.beginListening();
      else { if (this.listening) this.stopListenSegments(); if (this.status === 'listening') this.setStatus('needs-listen', m.error || ''); else if (m.error) this.setStatus(this.status, m.error); }
    }
    text(t0, t1, stamps = true) { return this.store.text(t0, t1, stamps); }
  }

  PZ.TranscriptManager = TranscriptManager;
  PZ.TranscriptStore = Store;
})();
