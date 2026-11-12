/* Piniso — sound engine. Everything is synthesized with Web Audio (no audio files, no copyright issues). */
(() => {
  if (globalThis.PAudio) return;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class Engine {
    constructor() {
      this.ctx = null;
      this.vol = { master: 0.7, sfx: 0.6, music: 0.35 };
      this.mode = 'off';
      this.cur = null;
      this.ducked = false;
      this.buffers = {};
      this.lastBlip = 0;
    }
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch (e) { return null; }
        const c = this.ctx;
        this.master = c.createGain(); this.master.gain.value = this.vol.master;
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 3;
        this.master.connect(this.comp); this.comp.connect(c.destination);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.vol.music;
        this.duckGain = c.createGain(); this.duckGain.gain.value = 1;
        this.tape = c.createBiquadFilter(); this.tape.type = 'lowpass'; this.tape.frequency.value = 4200;
        this.musicBus.connect(this.tape); this.tape.connect(this.duckGain); this.duckGain.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    unlock() { this.ensure(); }
    setVolumes(v = {}) {
      Object.assign(this.vol, v);
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
      this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
      this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.1);
    }
    duck(on) {
      this.ducked = !!on;
      if (!this.ctx) return;
      this.duckGain.gain.setTargetAtTime(on ? 0.22 : 1, this.ctx.currentTime, 0.35);
    }
    noise(kind = 'white') {
      if (this.buffers[kind]) return this.buffers[kind];
      const c = this.ctx, len = c.sampleRate * 3, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else if (kind === 'crackle') { d[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0; }
        else d[i] = w;
      }
      this.buffers[kind] = b;
      return b;
    }
    // ---- primitives ----
    tone(freq, at, dur, gain, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, at);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + (o.glide || dur));
      if (o.detune) osc.detune.value = o.detune;
      const atk = o.attack || 0.005;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      let node = osc;
      if (o.filter) { const f = c.createBiquadFilter(); f.type = o.filter.type || 'lowpass'; f.frequency.value = o.filter.f; f.Q.value = o.filter.q || 0.7; node.connect(f); node = f; }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(at); osc.stop(at + dur + 0.05);
      return osc;
    }
    burst(at, dur, gain, o = {}) {
      const c = this.ctx, src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      src.buffer = this.noise(o.kind || 'white');
      src.loop = true;
      f.type = o.ftype || 'bandpass'; f.frequency.value = o.f || 2000; f.Q.value = o.q || 0.8;
      if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(at, Math.random() * 2); src.stop(at + dur + 0.05);
    }
    // ---- sound effects ----
    sfx(name, opt = {}) {
      if (!this.ensure()) return;
      const t = this.ctx.currentTime + 0.01;
      switch (name) {
        case 'pop': this.tone(520, t, 0.12, 0.35, { to: 1250, glide: 0.06 }); break;
        case 'click': this.burst(t, 0.03, 0.25, { f: 3200, q: 2 }); break;
        case 'ding':
          [[1318.5, 0], [1975.5, 0.09]].forEach(([f, d]) => { this.tone(f, t + d, 0.9, 0.22); this.tone(f * 2.01, t + d, 0.4, 0.05); });
          break;
        case 'womp':
          this.tone(330, t, 0.28, 0.25, { type: 'triangle', to: 240 });
          this.tone(260, t + 0.3, 0.5, 0.25, { type: 'triangle', to: 150 });
          break;
        case 'scribble':
          for (let i = 0; i < 6; i++) this.burst(t + i * 0.06 + Math.random() * 0.02, 0.05, 0.12 + Math.random() * 0.06, { f: 3200 + Math.random() * 1800, q: 1.5, kind: 'pink' });
          break;
        case 'whoosh': this.burst(t, 0.35, 0.18, { f: 300, fto: 3500, q: 0.6, attack: 0.08, kind: 'pink' }); break;
        case 'levelup': [72, 76, 79, 84, 88].forEach((m, i) => this.tone(mtof(m), t + i * 0.08, 0.35, 0.16, { type: 'square', filter: { f: 2600 } })); break;
        case 'boing': this.tone(180, t, 0.4, 0.3, { to: 520, glide: 0.25 }); break;
        case 'tick': this.burst(t, 0.02, 0.2, { f: 2800, q: 3 }); break;
        case 'snore': this.burst(t, 1.2, 0.08, { f: 260, q: 2, attack: 0.6, kind: 'brown' }); break;
        case 'chime': [79, 84].forEach((m, i) => this.tone(mtof(m), t + i * 0.16, 1.1, 0.16)); break;
        case 'confetti': for (let i = 0; i < 9; i++) this.tone(1800 + Math.random() * 2200, t + i * 0.035, 0.08, 0.06); break;
        case 'stamp': this.tone(110, t, 0.25, 0.5, { to: 50 }); this.burst(t, 0.12, 0.2, { f: 900, q: 0.8 }); break;
        case 'error': this.tone(220, t, 0.15, 0.2, { type: 'square', filter: { f: 1200 } }); this.tone(196, t + 0.16, 0.22, 0.2, { type: 'square', filter: { f: 1200 } }); break;
        case 'yawn': this.tone(420, t, 0.9, 0.14, { type: 'triangle', to: 220, glide: 0.8, attack: 0.15 }); break;
        case 'blip': {
          const now = performance.now();
          if (now - this.lastBlip < 55) return;
          this.lastBlip = now;
          const base = opt.base || 620;
          this.tone(base + Math.random() * 220, t, 0.05, 0.07, { type: 'square', filter: { f: 1800 } });
          break;
        }
        default: break;
      }
    }
    // ---- music ----
    music(mode) {
      if (mode === this.mode && this.cur) return;
      this.stopMusic();
      this.mode = mode || 'off';
      if (this.mode === 'off') return;
      if (!this.ensure()) return;
      const fn = this['_' + this.mode];
      if (fn) this.cur = fn.call(this);
    }
    stopMusic() {
      if (this.cur) { try { this.cur.stop(); } catch (e) {} }
      this.cur = null; this.mode = 'off';
    }
    playing() { return !!this.cur; }

    _loopNoise(kind, gain, ftype, f, q = 0.7) {
      const c = this.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = this.noise(kind); src.loop = true;
      fl.type = ftype; fl.frequency.value = f; fl.Q.value = q;
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, c.currentTime, 0.8);
      src.connect(fl); fl.connect(g); g.connect(this.musicBus);
      src.start();
      return { src, g, fl, stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.3); setTimeout(() => { try { src.stop(); } catch (e) {} }, 1200); } };
    }
    _sched(stepDur, onStep) {
      const c = this.ctx;
      let next = c.currentTime + 0.1, step = 0, alive = true;
      const id = setInterval(() => {
        if (!alive) return;
        while (next < c.currentTime + 0.35) { onStep(step, next); next += typeof stepDur === 'function' ? stepDur(step) : stepDur; step++; }
      }, 60);
      return { stop: () => { alive = false; clearInterval(id); } };
    }
    _lofi() {
      const c = this.ctx, bpm = 74, s16 = 60 / bpm / 4;
      const chords = [[50, 53, 57, 60, 64], [53, 59, 62, 64], [52, 55, 59, 62], [52, 55, 57, 60]];
      const bass = [38, 43, 36, 45];
      const penta = [72, 74, 76, 79, 81, 84];
      const ep = (m, at, dur, gain) => {
        const f = mtof(m);
        this.tone(f, at, dur, gain, { attack: 0.02, bus: this.musicBus, filter: { f: 1500 } });
        this.tone(f, at, dur * 0.8, gain * 0.4, { type: 'triangle', detune: 6, attack: 0.02, bus: this.musicBus, filter: { f: 1200 } });
      };
      const vinyl = this._loopNoise('brown', 0.05, 'lowpass', 900);
      const crack = this._loopNoise('crackle', 0.5, 'highpass', 1400);
      const seq = this._sched((st) => s16 * (st % 2 === 0 ? 1.16 : 0.84), (st, at) => {
        const s = st % 16, bar = Math.floor(st / 16) % 4;
        if (s === 0 || s === 6) chords[bar].forEach((m, i) => ep(m, at + i * 0.014, s === 0 ? 2.4 : 1.1, s === 0 ? 0.055 : 0.035));
        if (s === 0 || s === 10) this.tone(mtof(bass[bar]), at, 0.9, 0.16, { attack: 0.01, bus: this.musicBus, filter: { f: 400 } });
        if (s === 0 || s === 8 || (s === 11 && Math.random() < 0.4)) this.tone(140, at, 0.32, 0.5, { to: 46, glide: 0.11, bus: this.musicBus });
        if (s === 4 || s === 12) { this.burst(at, 0.16, 0.11, { f: 1900, q: 0.7, bus: this.musicBus }); this.tone(190, at, 0.07, 0.07, { type: 'triangle', bus: this.musicBus }); }
        if (s % 2 === 0) this.burst(at, s % 4 === 2 && Math.random() < 0.15 ? 0.18 : 0.035, 0.035, { ftype: 'highpass', f: 7000, bus: this.musicBus });
        if (s % 2 === 0 && Math.random() < 0.16) this.tone(mtof(penta[Math.floor(Math.random() * penta.length)]), at, 0.9, 0.035, { attack: 0.03, bus: this.musicBus, filter: { f: 2400 } });
      });
      return { stop: () => { seq.stop(); vinyl.stop(); crack.stop(); } };
    }
    _rain() {
      const base = this._loopNoise('pink', 0.55, 'lowpass', 1600);
      const hiss = this._loopNoise('white', 0.03, 'highpass', 6000);
      const drops = this._sched(() => 0.04 + Math.random() * 0.16, (st, at) => {
        this.burst(at, 0.03 + Math.random() * 0.03, 0.02 + Math.random() * 0.04, { f: 1800 + Math.random() * 4000, q: 4, bus: this.musicBus });
      });
      return { stop: () => { base.stop(); hiss.stop(); drops.stop(); } };
    }
    _brown() {
      const b = this._loopNoise('brown', 0.75, 'lowpass', 520);
      return { stop: () => b.stop() };
    }
    _forest() {
      const c = this.ctx;
      const wind = this._loopNoise('brown', 0.28, 'lowpass', 420);
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 0.12; lfo.connect(lg); lg.connect(wind.g.gain); lfo.start();
      const birds = this._sched(() => 1.8 + Math.random() * 4.5, (st, at) => {
        const n = 2 + Math.floor(Math.random() * 4), f0 = 2300 + Math.random() * 1500;
        for (let i = 0; i < n; i++) this.tone(f0, at + i * 0.13, 0.09, 0.05, { to: f0 * (1.3 + Math.random() * 0.4), glide: 0.06, bus: this.musicBus });
      });
      return { stop: () => { wind.stop(); birds.stop(); try { lfo.stop(); } catch (e) {} } };
    }
    _space() {
      const c = this.ctx, out = c.createGain(), lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 600; out.gain.value = 0;
      out.gain.setTargetAtTime(0.07, c.currentTime, 2);
      lp.connect(out); out.connect(this.musicBus);
      const oscs = [55, 82.4, 110.3, 164.8].map((f, i) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 7; o.connect(lp); o.start(); return o; });
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.04; lg.gain.value = 320; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      const pent = [69, 72, 74, 76, 79, 81];
      const pads = this._sched(() => 3 + Math.random() * 3, (st, at) => {
        this.tone(mtof(pent[Math.floor(Math.random() * pent.length)]), at, 5, 0.035, { attack: 1.6, bus: this.musicBus });
      });
      return { stop: () => { pads.stop(); out.gain.setTargetAtTime(0, c.currentTime, 0.4); setTimeout(() => { oscs.forEach((o) => { try { o.stop(); } catch (e) {} }); try { lfo.stop(); } catch (e) {} }, 1500); } };
    }
    _examhall() {
      const room = this._loopNoise('brown', 0.05, 'lowpass', 300);
      let next = 0;
      const ticks = this._sched(0.5, (st, at) => {
        if (st % 2 === 0) this.burst(at, 0.025, 0.12, { f: st % 4 === 0 ? 2600 : 2100, q: 5, bus: this.musicBus });
        if (st >= next) {
          next = st + 12 + Math.floor(Math.random() * 20);
          const kind = Math.random();
          if (kind < 0.7) for (let i = 0; i < 3; i++) this.burst(at + i * 0.12, 0.18, 0.035, { f: 3000, q: 0.9, kind: 'pink', attack: 0.04, bus: this.musicBus });
          else { this.burst(at, 0.015, 0.1, { f: 4000, q: 4, bus: this.musicBus }); this.burst(at + 0.09, 0.015, 0.1, { f: 3600, q: 4, bus: this.musicBus }); }
        }
      });
      return { stop: () => { room.stop(); ticks.stop(); } };
    }

    // ---- voice (text-to-speech) ----
    voices() { try { return speechSynthesis.getVoices(); } catch (e) { return []; } }
    speak(text, o = {}) {
      try {
        if (!('speechSynthesis' in globalThis)) return false;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const vs = this.voices();
        let v = o.voice ? vs.find((x) => x.name === o.voice) : null;
        if (!v) {
          const want = o.lang === 'hindi' ? ['hi-IN'] : ['en-IN', 'en-GB', 'en-US'];
          for (const w of want) { v = vs.find((x) => x.lang === w && /female|natural|neural|swara|neerja/i.test(x.name)) || vs.find((x) => x.lang === w); if (v) break; }
        }
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = o.rate || 1.04; u.pitch = o.pitch || 1.25; u.volume = Math.min(1, (this.vol.master || 0.7) + 0.2);
        u.onstart = o.onstart || null; u.onend = o.onend || null; u.onerror = o.onend || null;
        speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    }
    stopSpeaking() { try { speechSynthesis.cancel(); } catch (e) {} }
  }

  globalThis.PAudio = new Engine();
})();
