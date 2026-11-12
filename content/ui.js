/* Piniso content — in-page UI: pet dock, radial menu, speech bubble, study desk, toasts. */
(() => {
  if (PZ.UI) return;
  const { h, esc } = { h: PZ.h, esc: PMd.esc };
  const I = (n, s) => PIcons.svg(n, s);
  const KIND = { point: '•', definition: '≡', formula: 'ƒ', example: '→', tip: '✎', warning: '!', important: '★', snap: '▣', doubt: '?', user: '✍', diagram: '◫', summary: '✓' };

  function injectPageCSS() {
    if (document.getElementById('pz-page-css')) return;
    const base = chrome.runtime.getURL('');
    const f = (fam, file, w, st = 'normal') => `@font-face{font-family:${fam};src:url(${base}assets/fonts/${file}) format("woff2");font-weight:${w};font-style:${st};font-display:swap}`;
    const css = [
      f('PinisoHand', 'caveat-latin-400-normal.woff2', 400), f('PinisoHand', 'caveat-latin-600-normal.woff2', 600), f('PinisoHand', 'caveat-latin-700-normal.woff2', 700),
      f('PinisoSans', 'dm-sans-latin-400-normal.woff2', 400), f('PinisoSans', 'dm-sans-latin-500-normal.woff2', 500), f('PinisoSans', 'dm-sans-latin-700-normal.woff2', 700),
      f('PinisoSerif', 'instrument-serif-latin-400-normal.woff2', 400), f('PinisoSerif', 'instrument-serif-latin-400-italic.woff2', 400, 'italic'),
      f('PinisoMono', 'jetbrains-mono-latin-400-normal.woff2', 400), f('PinisoMono', 'jetbrains-mono-latin-500-normal.woff2', 500),
      (globalThis.PINISO_KATEX_FONTS || '').split('__BASE__').join(base),
      'html.pz-hide-cc .ytp-caption-window-container{opacity:0!important}',
      'html.pz-zen ytd-watch-flexy #secondary,html.pz-zen ytd-watch-flexy #comments,html.pz-zen ytd-watch-flexy ytd-merch-shelf-renderer,html.pz-zen ytd-watch-flexy #related,html.pz-zen .ytp-ce-element,html.pz-zen .ytp-endscreen-content,html.pz-zen ytd-watch-flexy ytd-reel-shelf-renderer,html.pz-zen #below ytd-watch-next-secondary-results-renderer,html.pz-zen .ytp-pause-overlay{display:none!important}',
      'html.pz-zen ytd-watch-flexy:not([theater]):not([fullscreen]) #primary.ytd-watch-flexy{max-width:1100px!important;margin-left:auto!important;margin-right:auto!important}',
      '.pz-fill{position:fixed!important;inset:0!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;z-index:2147483000!important;background:#000!important}video.pz-fill{object-fit:contain!important}html.pz-filled,html.pz-filled body{overflow:hidden!important}',
      '#pz-it.pz-it-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 16px;margin-right:8px;border-radius:18px;background:linear-gradient(135deg,#FFD23F,#FF9F1C);color:#1c1b18;font:700 14px/36px Roboto,Arial,sans-serif;cursor:pointer;border:2px solid #1c1b18;box-shadow:2px 2px 0 #1c1b18;white-space:nowrap;transition:transform .15s}#pz-it.pz-it-btn:hover{transform:translateY(-1px) rotate(-1deg)}#pz-it.pz-it-btn:active{transform:translateY(1px);box-shadow:none}',
      '.pz-yt-marks{position:absolute;inset:0;pointer-events:none;z-index:40}.pz-yt-marks i{position:absolute;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:1px;transform:rotate(45deg);background:#FFD23F;box-shadow:0 0 0 1px #1c1b18}'
    ].join('\n');
    const st = document.createElement('style');
    st.id = 'pz-page-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  class UI {
    constructor(app) {
      this.app = app;
      this.tab = 'notes';
      this.deskOpen = false;
      this.radialOpen = false;
      this.bubbleTimer = 0;
      this.pos = null;
      this.chatBusy = false;
      this.includeScreen = false;
    }

    // ------------------------------------------------ mount + theme
    mount() {
      injectPageCSS();
      this.host = document.createElement('piniso-root');
      this.host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483600;contain:layout style';
      this.shadow = this.host.attachShadow({ mode: (this.app.settings.dev && this.app.settings.dev.openShadow) ? 'open' : 'closed' });
      const st = document.createElement('style');
      st.textContent = (globalThis.PINISO_CSS || '') + '\n' + (globalThis.PINISO_KATEX_CSS || '');
      this.shadow.appendChild(st);
      this.root = h('div.pz');
      this.shadow.appendChild(this.root);

      this.dock = h('div.dock');
      this.petWrap = h('div.petwrap');
      this.statusDot = h('i.statusdot');
      this.nameChip = h('span.namechip');
      this.radial = h('div.radial');
      this.dockMic = h('button.dockmic', { title: 'Talk with me (voice) — Alt+Shift+T', 'aria-label': 'Talk with me', html: I('mic', 15) });
      this.dockMic.addEventListener('pointerdown', (e) => e.stopPropagation());
      this.dockMic.addEventListener('click', (e) => { e.stopPropagation(); PAudio.sfx('pop'); this.app.toggleTalk(); });
      this.dock.append(this.radial, this.petWrap);
      this.petWrap.append(this.statusDot, this.nameChip, this.dockMic);
      this.root.append(this.dock);
      this.toasts = h('div.toasts');
      this.root.append(this.toasts);

      this.pet = PinisoPet.create(this.petWrap, Object.assign({}, this.app.petCfg()));
      this.petWrap.insertBefore(this.pet.el, this.statusDot);
      this.buildRadial();
      this.bindPet();

      (document.fullscreenElement || document.documentElement).appendChild(this.host);
      document.addEventListener('fullscreenchange', () => this.reparent());
      document.addEventListener('webkitfullscreenchange', () => this.reparent());
      window.addEventListener('resize', PZ.throttle(() => { this.place(true); this.placeDesk(); }, 120));
      document.addEventListener('mousemove', PZ.throttle((e) => {
        if (!this.pet || this.dragging) return;
        const r = this.pet.el.getBoundingClientRect();
        if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 260) this.pet.lookAtClient(e.clientX, e.clientY, 900);
      }, 90), { passive: true });
      PStore.get('pzpos').then((r) => { this.pos = (r.pzpos || {})[PZ.site()] || null; this.place(true); });
      this.posTimer = setInterval(() => this.place(), 600);
      this.applySettings(this.app.settings);
    }
    reparent() {
      if (PZ.Extras && PZ.Extras.onFullscreen(this.app)) return;
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      const target = fs && fs.tagName !== 'VIDEO' ? fs : document.documentElement;
      if (this.host.parentNode !== target) target.appendChild(this.host);
      setTimeout(() => this.place(true), 60);
    }
    destroy() { clearInterval(this.posTimer); this.pet && this.pet.destroy(); this.host && this.host.remove(); }
    show(on) { this.root.style.display = on ? '' : 'none'; }

    applySettings(s) {
      const t = PINISO.themeOf(s);
      const r = this.root;
      const grain = `url(${chrome.runtime.getURL('assets/grain.png')})`;
      Object.entries({ '--paper': t.paper, '--paper2': t.paper2, '--ink': t.ink, '--muted': t.muted, '--line': t.line, '--acc': t.accent, '--acc-ink': t.accentInk, '--grain': grain })
        .forEach(([k, v]) => r.style.setProperty(k, v));
      r.className = 'pz c-' + (s.ui.corners || 'sketchy') + ' v-' + (s.ui.font || 'hand') + (t.dark ? ' dark' : '');
      this.pattern = 'pat-' + (t.pattern || 'plain');
      if (this.deskBody) this.deskBody.className = 'body ' + this.pattern;
      if (this.pet) { this.pet.setConfig(this.app.petCfg()); this.petWrap.insertBefore(this.pet.el, this.statusDot); }
      this.nameChip.textContent = s.pet.name || 'Piniso';
      if (this.deskTitle) this.deskTitle.textContent = s.pet.name || 'Piniso';
      this.place(true);
      if (this.deskOpen) this.render();
    }

    // ------------------------------------------------ positioning
    petSize() { return this.app.settings.pet.size || 96; }
    place(force) {
      if (!this.petWrap || this.dragging) return;
      const W = innerWidth, H = innerHeight;
      const pw = this.petSize(), ph = Math.round(pw * PinisoPet.VBH / PinisoPet.VBW);
      let x, y;
      const fs = !!document.fullscreenElement;
      const v = this.app.video;
      if (this.pos && !fs) { x = this.pos.x * W; y = this.pos.y * H; }
      else if (this.app.settings.pet.position === 'video' && v && v.rect) {
        const r = v.rect();
        if (r.width > 200 && r.bottom > 80 && r.top < H - 80) { x = r.right - pw - 16; y = Math.min(r.bottom, H) - ph - 64; }
      }
      if (x === undefined) { x = W - pw - 24; y = H - ph - (fs ? 84 : 24); }
      x = PZ.clamp(x, 6, W - pw - 6); y = PZ.clamp(y, 6, H - ph - 6);
      if (!force && this._lx === x && this._ly === y) return;
      this._lx = x; this._ly = y;
      this.dock.style.left = x + 'px'; this.dock.style.top = y + 'px';
      this.petWrap.style.width = pw + 'px';
      this.layoutRadial();
      if (this.bubble) this.layoutBubble();
    }
    petRect() {
      const pw = this.petSize(), ph = Math.round(pw * PinisoPet.VBH / PinisoPet.VBW);
      return { x: this._lx || 0, y: this._ly || 0, w: pw, h: ph };
    }

    bindPet() {
      const w = this.petWrap;
      let sx, sy, ox, oy, moved = false, down = false, clicks = 0, clickT = 0, pokes = [];
      w.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        PAudio.unlock();
        down = true; moved = false; sx = e.clientX; sy = e.clientY; ox = this._lx; oy = this._ly;
        w.setPointerCapture(e.pointerId);
      });
      w.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 6) { moved = true; this.dragging = true; this.dock.classList.add('dragging'); this.setRadial(false); this.pet.setMood('shocked', 99999); this.hideBubble(); }
        if (moved) {
          const p = this.petRect();
          const x = PZ.clamp(ox + dx, 4, innerWidth - p.w - 4), y = PZ.clamp(oy + dy, 4, innerHeight - p.h - 4);
          this._lx = x; this._ly = y; this.dock.style.left = x + 'px'; this.dock.style.top = y + 'px';
        }
      });
      const up = (e) => {
        if (!down) return;
        down = false;
        if (moved) {
          this.dragging = false; this.dock.classList.remove('dragging');
          this.pet.setMood('happy', 1200); this.pet.react('squish'); PAudio.sfx('boing');
          this.pos = { x: this._lx / innerWidth, y: this._ly / innerHeight };
          PStore.get('pzpos').then((r) => { const all = r.pzpos || {}; all[PZ.site()] = this.pos; PStore.set({ pzpos: all }); });
          this.layoutRadial();
          return;
        }
        // click / double click / poke spam
        const now = Date.now();
        pokes = pokes.filter((t) => now - t < 3000); pokes.push(now);
        if (now - clickT < 320) { clicks = 0; clickT = 0; clearTimeout(this._clickTimer); this.toggleDesk(); return; }
        clickT = now;
        clearTimeout(this._clickTimer);
        this._clickTimer = setTimeout(() => {
          if (pokes.length >= 5) { pokes = []; this.app.onPokeSpam(); }
          else this.app.onPoke();
        }, 330);
      };
      w.addEventListener('pointerup', up);
      w.addEventListener('pointercancel', up);
      w.addEventListener('contextmenu', (e) => { e.preventDefault(); this.setRadial(!this.radialOpen); });
      this.dock.addEventListener('pointerenter', () => { clearTimeout(this._radT); if (!this.dragging) this._radT = setTimeout(() => this.setRadial(true), 260); });
      this.dock.addEventListener('pointerleave', () => { clearTimeout(this._radT); this._radT = setTimeout(() => this.setRadial(false), 900); });
    }

    // ------------------------------------------------ radial menu
    buildRadial() {
      const items = [
        ['sparkle', 'magic', 'All tools ✨'], ['notes', 'notes', 'Notes'], ['chat', 'ask', 'Ask a doubt'], ['quiz', 'quiz', 'Quiz me'],
        ['mic', 'talk', 'Talk (voice)'], ['camera', 'snipe', 'Doubt snipe'], ['flag', 'lost', 'I’m lost here']
      ];
      this.rbs = items.map(([ic, act, tip]) => {
        const b = h('button.rb', { 'data-act': act, 'aria-label': tip, html: I(ic, 18) + `<span class="tip">${tip}</span>` });
        b.addEventListener('click', (e) => { e.stopPropagation(); PAudio.sfx('pop'); this.app.action(act); if (act !== 'music' && act !== 'mark' && act !== 'lost') this.setRadial(false); });
        this.radial.append(b);
        return b;
      });
    }
    setRadial(on) {
      this.radialOpen = on;
      this.dock.classList.toggle('open', on);
      if (on && this.bubble && !this.bubble.classList.contains('sticky')) this.hideBubble();
      const listenBtn = this.rbs.find((b) => b.dataset.act === 'listen');
      if (listenBtn) listenBtn.hidden = !this.app.needsListen();
      this.layoutRadial();
    }
    layoutRadial() {
      if (!this.rbs) return;
      const p = this.petRect();
      const cx = p.w / 2, cy = p.h * 0.55;
      this.radial.style.left = '0px'; this.radial.style.top = '0px';
      const vis = this.rbs.filter((b) => !b.hidden);
      let toward = Math.atan2(innerHeight / 2 - (p.y + cy), innerWidth / 2 - (p.x + cx));
      const spread = Math.PI * 0.7;
      const R = Math.max(p.w * 0.58 + 36, (vis.length - 1) * 50 / spread);
      const angle = (i, tw) => tw - spread / 2 + (vis.length === 1 ? spread / 2 : (spread * i) / (vis.length - 1));
      const inside = (tw) => vis.every((_, i) => { const a = angle(i, tw); const X = p.x + cx + Math.cos(a) * R, Y = p.y + cy + Math.sin(a) * R; return X >= 24 && X <= innerWidth - 24 && Y >= 24 && Y <= innerHeight - 24; });
      // turn the arc until every button fits on screen (no pile-ups in corners)
      if (!inside(toward)) { for (let k = 1; k <= 26; k++) { if (inside(toward + k * 0.12)) { toward += k * 0.12; break; } if (inside(toward - k * 0.12)) { toward -= k * 0.12; break; } } }
      vis.forEach((b, i) => {
        const a = angle(i, toward);
        let x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        x = PZ.clamp(p.x + x, 24, innerWidth - 24) - p.x;
        y = PZ.clamp(p.y + y, 24, innerHeight - 24) - p.y;
        b.style.left = cx + 'px'; b.style.top = cy + 'px';
        // tooltip goes on the outer side so it never covers the next button
        b.dataset.side = x < cx - 4 ? 'l' : x > cx + 4 ? 'r' : (y < cy ? 't' : 'b');
        b.style.transform = this.radialOpen ? `translate(${x - cx}px,${y - cy}px) scale(1)` : 'translate(0,0) scale(.2)';
        b.style.transitionDelay = this.radialOpen ? i * 25 + 'ms' : '0ms';
      });
      const music = this.rbs.find((b) => b.dataset.act === 'music');
      if (music) music.classList.toggle('hot', PAudio.playing());
      const listen = this.rbs.find((b) => b.dataset.act === 'listen');
      if (listen) listen.classList.toggle('hot', this.app.needsListen());
    }

    // ------------------------------------------------ status + mood
    setStatus(kind, label) {
      this.statusDot.className = 'statusdot ' + (kind || '');
      this.statusDot.title = label || '';
      this.statusKind = kind; this.statusLabel = label;
      if (this.deskPill) this.renderPill();
    }
    pets() { return [this.pet, this.pipPet].filter(Boolean); }
    mood(m, ms) { this.pets().forEach((p) => p.setMood(m, ms)); }
    react(r) { this.pets().forEach((p) => p.react(r)); }
    // v4.1: a named move from the 3D animation library (2D pets do the closest classic reaction)
    play(name) { this.pets().forEach((p) => { try { if (p.play) p.play(name); } catch (e) {} }); }

    // ------------------------------------------------ bubble
    say(text, o = {}) {
      if (!text) return;
      // during the welcome tour, other chatter waits
      if (this.app.touring && !o.tour) { if ((o._tries || 0) < 12) setTimeout(() => this.say(text, Object.assign({}, o, { _tries: (o._tries || 0) + 1 })), 2500); return; }
      // the student is using the menu right now: wait a moment instead of covering the buttons
      if (this.radialOpen && !o.instant && (o._tries || 0) < 6) { setTimeout(() => this.say(text, Object.assign({}, o, { _tries: (o._tries || 0) + 1 })), 1500); return; }
      // the student is reading the current bubble (mouse on it): the new one waits its turn
      if (this.bubble && this.bubbleHover && !o.force) { this._sayQueue = (this._sayQueue || []).filter((q) => q.text !== text).concat([{ text, o }]).slice(-2); return; }
      this.bubbleHover = false;
      this.hideBubble(true);
      const s = this.app.settings;
      const b = h('div.bubble.b-' + (s.ui.bubble || 'sketch'));
      const who = h('div.who', { html: `${esc(s.pet.name || 'Piniso')}${o.tag ? `<span class="tag">${esc(o.tag)}</span>` : ''}${o.time != null ? `<span>· ${PZ.fmt(o.time)}</span>` : ''}` });
      const txt = h('div.txt');
      const x = h('button.x', { html: I('close', 13), 'aria-label': 'Close', onclick: () => this.hideBubble() });
      b.append(x, who, txt);
      if (o.input) {
        const row = h('div.binput');
        const inp = h('input', { placeholder: o.input.placeholder || '' });
        ['keydown', 'keyup', 'keypress'].forEach((ev) => inp.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Enter') go(); }));
        const go = () => { const v = inp.value.trim(); if (!v) return; this.hideBubble(); o.input.onSubmit(v); };
        row.append(inp, h('button.btn.sm.pri', { html: I('send', 13), onclick: go }));
        b.append(row);
        setTimeout(() => inp.focus(), 400);
      }
      if (o.actions && o.actions.length) {
        const acts = h('div.acts');
        o.actions.forEach((a) => acts.append(h('button' + (a.pri ? '.pri' : ''), { html: (a.icon ? I(a.icon, 13) : '') + esc(a.label), onclick: (e) => { e.stopPropagation(); if (!a.keep) b._onHide = null; a.onClick && a.onClick(); if (!a.keep) this.hideBubble(); } })));
        b.append(acts);
      }
      b._onHide = o.onHide || null;
      this.bubble = b;
      this.root.append(b);
      this.layoutBubble();
      if (o.mood) this.mood(o.mood, o.moodMs || 4500);
      const full = PMd.render(text);
      this.app.lastSaid = text;
      if (this.pipBubble) this.pipBubble.innerHTML = full;
      const plain = PMd.plain(text);
      const hasMath = /\$|\\\(|\\\[/.test(text);
      const s2 = this.app.settings.sound;
      if (o.instant || hasMath || plain.length > 260 || this.app.settings.pet.motion === 'calm') {
        txt.innerHTML = full;
        this.layoutBubble();
      } else {
        let i = 0;
        const caret = '<span class="caret"></span>';
        this.pet.talk(true);
        const step = () => {
          if (this.bubble !== b) return;
          i = Math.min(plain.length, i + 2);
          txt.innerHTML = esc(plain.slice(0, i)) + caret;
          if (s2.sfx && s2.blips && i % 4 === 0) PAudio.sfx('blip', { base: 560 });
          this.layoutBubble();
          if (i < plain.length) this._tw = setTimeout(step, 26);
          else { txt.innerHTML = full; this.pet.talk(false); this.layoutBubble(); }
        };
        step();
      }
      // time to READ it: typing time + ~4 words a second + a pause; never shorter than asked
      const typing = (o.instant || hasMath || plain.length > 260 || this.app.settings.pet.motion === 'calm') ? 0 : plain.length / 2 * 26;
      const words = plain.split(/\s+/).filter(Boolean).length;
      const readMs = typing + 3000 + words * 300 + (o.actions && o.actions.length ? 3000 : 0);
      const ms = Math.min(45000, Math.max(o.ms || 0, readMs));
      clearTimeout(this.bubbleTimer);
      // stays while the mouse is over it (or a button in it has focus); hides a little after the mouse leaves
      const over = () => { this.bubbleHover = true; clearTimeout(this.bubbleTimer); b.classList.add('hold'); };
      const leave = () => {
        this.bubbleHover = false; b.classList.remove('hold');
        if (o.sticky || this.bubble !== b) return;
        clearTimeout(this.bubbleTimer);
        this.bubbleTimer = setTimeout(() => this.hideBubble(), 2500);
      };
      b.addEventListener('pointerenter', over);
      b.addEventListener('pointerleave', leave);
      b.addEventListener('focusin', over);
      b.addEventListener('focusout', (e) => { if (!b.contains(e.relatedTarget)) leave(); });
      // if the mouse was already resting where the bubble appeared, count that as hovering
      b.addEventListener('pointermove', over, { once: true });
      if (!o.sticky) this.bubbleTimer = setTimeout(() => { if (!this.bubbleHover) this.hideBubble(); }, ms);
      if (o.speak) this.app.speak(plain);
    }
    hideBubble(now) {
      clearTimeout(this.bubbleTimer); clearTimeout(this._tw);
      if (this.pet) this.pet.talk(false);
      const b = this.bubble;
      if (!b) return;
      this.bubble = null; this.bubbleHover = false;
      if (b._onHide) { const f = b._onHide; b._onHide = null; try { f(); } catch (e) {} }
      if (now) b.remove();
      else { b.classList.add('out'); setTimeout(() => b.remove(), 220); }
      // anything that waited while the student was reading comes now
      const q = this._sayQueue; this._sayQueue = null;
      if (q && q.length && !now) setTimeout(() => q.forEach((x, i) => setTimeout(() => this.say(x.text, x.o), i * 400)), 600);
    }
    layoutBubble() {
      const b = this.bubble;
      if (!b) return;
      const p = this.petRect();
      const bw = b.offsetWidth || 280, bh = b.offsetHeight || 80;
      const rightSide = p.x + p.w / 2 > innerWidth / 2;
      let x = rightSide ? p.x + p.w * 0.45 - bw : p.x + p.w * 0.55;
      let y = p.y - bh - 4;
      let below = false;
      if (y < 8) { y = p.y + p.h + 10; below = true; }
      x = PZ.clamp(x, 8, innerWidth - bw - 8);
      y = PZ.clamp(y, 8, innerHeight - bh - 8);
      // don't cover the open desk: move the bubble beside it
      if (this.deskOpen && this.desk && !this.desk.classList.contains('min')) {
        const d = this.desk.getBoundingClientRect();
        const hit = x < d.right && x + bw > d.left && y < d.bottom && y + bh > d.top;
        if (hit) { if (d.left - bw - 12 >= 8) x = d.left - bw - 12; else if (d.right + bw + 12 <= innerWidth - 8) x = d.right + 12; y = PZ.clamp(Math.min(y, p.y - bh * 0.4), 8, innerHeight - bh - 8); }
      }
      b.style.left = x + 'px'; b.style.top = y + 'px';
      const tail = PZ.clamp((p.x + p.w / 2) - x - 7, 16, bw - 30);
      b.style.setProperty('--tail', (rightSide ? bw - tail - 14 : tail) + 'px');
      b.classList.toggle('tail-left', !rightSide);
      b.classList.toggle('tail-top', below);
      b.style.setProperty('--ox', rightSide ? '100%' : '0%');
      b.style.setProperty('--oy', below ? '0%' : '100%');
    }

    // ------------------------------------------------ toasts + confetti
    toast(text, o = {}) {
      const t = h('div.toast', { html: (o.icon ? I(o.icon, 15) : '') + `<span>${esc(text)}</span>` + (o.xp ? `<span class="xp">+${o.xp} XP</span>` : '') });
      if (o.action) t.append(h('button.tact', { text: o.action.label, onclick: () => { t.remove(); o.action.onClick(); } }));
      this.toasts.append(t);
      while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
      // long enough to read, and paused while the mouse is on it
      const ms = Math.max(o.ms || 0, 2200 + String(text).split(/\s+/).length * 260 + (o.action ? 2500 : 0));
      let timer;
      const go = (d) => { clearTimeout(timer); timer = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, d); };
      t.addEventListener('pointerenter', () => clearTimeout(timer));
      t.addEventListener('pointerleave', () => go(1800));
      go(ms);
    }
    confetti() {
      const c = h('div.confetti');
      const cols = ['#FF4D6D', '#FFD23F', '#3FA7FF', '#4DD48A', '#B07CFF', getComputedStyle(this.root).getPropertyValue('--acc')];
      for (let i = 0; i < 70; i++) {
        const el = h('i');
        el.style.left = Math.random() * 100 + 'vw';
        el.style.background = cols[i % cols.length];
        el.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
        el.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
        el.style.animationDelay = Math.random() * 0.4 + 's';
        el.style.width = 6 + Math.random() * 6 + 'px';
        c.append(el);
      }
      this.root.append(c);
      setTimeout(() => c.remove(), 2600);
    }

    // ------------------------------------------------ overlays
    overlay(content, o = {}) {
      const ov = h('div.ov');
      const v = this.app.video;
      const r = o.overVideo && v && v.rect ? v.rect() : null;
      if (r && r.width > 320 && r.height > 220) {
        Object.assign(ov.style, { left: Math.max(0, r.left) + 'px', top: Math.max(0, r.top) + 'px', width: Math.min(innerWidth, r.width) + 'px', height: Math.min(innerHeight - Math.max(0, r.top), r.height) + 'px' });
      } else Object.assign(ov.style, { inset: '0' });
      ov.append(content);
      this.root.append(ov);
      // the desk would sit half under the dimmed layer: tuck it away while a quiz / report is open
      const deskWas = this.desk && !this.desk.hidden;
      if (deskWas) this.desk.classList.add('tucked');
      if (this.bubble) this.hideBubble(true);
      const close = () => { ov.remove(); if (deskWas && this.desk) this.desk.classList.remove('tucked'); document.removeEventListener('keydown', onKey, true); o.onClose && o.onClose(); };
      const onKey = (e) => {
        if (!ov.isConnected) return;
        if (o.onKey && o.onKey(e)) { e.stopPropagation(); e.preventDefault(); return; }
        if (e.key === 'Escape') { e.stopPropagation(); close(); }
      };
      document.addEventListener('keydown', onKey, true);
      if (o.clickOut) ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
      return { el: ov, close };
    }
    miniPet(mood = 'happy', size = 80) {
      const d = h('div');
      d.innerHTML = PinisoPet.svgString(this.app.petCfg(), mood);
      d.style.width = size + 'px';
      return d;
    }

    // ------------------------------------------------ desk
    buildDesk() {
      if (this.desk) return;
      const s = this.app.settings;
      const d = this.desk = h('div.desk.paper');
      const mini = h('div.mini'); mini.innerHTML = PinisoPet.svgString(this.app.petCfg(), 'happy');
      this.deskTitle = h('b', { text: s.pet.name || 'Piniso' });
      this.deskSub = h('small');
      this.deskPill = h('span.pill');
      this.deskMic = h('button.ib.dmic', { title: 'Talk with me (voice)', html: I('mic', 17), onclick: () => this.app.toggleTalk() });
      const head = h('div.dh', null, mini, h('div.ttl', null, this.deskTitle, this.deskSub), this.deskPill, this.deskMic,
        h('button.ib', { title: 'Settings', html: I('gear', 17), onclick: () => PZ.bg({ type: 'open:options' }) }),
        h('button.ib', { title: 'Minimise', html: I('minus', 17), onclick: () => { d.classList.toggle('min'); } }),
        h('button.ib', { title: 'Close (Alt+Shift+P)', html: I('close', 17), onclick: () => this.closeDesk() }));
      this.deskPill.addEventListener('click', () => { if (this.app.needsListen()) this.app.action('listen'); });
      const tabs = h('div.tabs');
      this.tabBtns = {};
      [['notes', 'notes', 'Notes'], ['ask', 'chat', 'Ask'], ['quiz', 'quiz', 'Quiz'], ['cards', 'cards', 'Cards'], ['videos', 'tv', 'Videos'], ['focus', 'target', 'Focus']].forEach(([id, ic, lab]) => {
        const b = h('button.tab', { html: I(ic, 17) + lab, onclick: () => { this.tab = id; PAudio.sfx('click'); this.render(); } });
        this.tabBtns[id] = b; tabs.append(b);
      });
      this.deskBody = h('div.body.' + this.pattern);
      this.deskFoot = h('div.foot');
      d.append(head, tabs, this.deskBody, this.deskFoot);
      this.root.append(d);
      this.placeDesk();
      // drag by header
      let sx, sy, ox, oy, drag = false;
      head.addEventListener('pointerdown', (e) => { if (e.target.closest('button,.pill')) return; drag = true; sx = e.clientX; sy = e.clientY; const r = d.getBoundingClientRect(); ox = r.left; oy = r.top; head.setPointerCapture(e.pointerId); });
      head.addEventListener('pointermove', (e) => { if (!drag) return; d.style.left = PZ.clamp(ox + e.clientX - sx, 0, innerWidth - 120) + 'px'; d.style.top = PZ.clamp(oy + e.clientY - sy, 0, innerHeight - 60) + 'px'; d.style.right = 'auto'; });
      head.addEventListener('pointerup', () => { if (!drag) return; drag = false; const r = d.getBoundingClientRect(); this.deskPos = { x: r.left / innerWidth, y: r.top / innerHeight }; PStore.set({ pzdesk: this.deskPos }); });
      PStore.get('pzdesk').then((r) => { if (r.pzdesk) { this.deskPos = r.pzdesk; this.placeDesk(); } });
    }
    placeDesk() {
      const d = this.desk;
      if (!d) return;
      const w = Math.min(390, innerWidth - 24);
      if (this.deskPos) { d.style.left = PZ.clamp(this.deskPos.x * innerWidth, 0, innerWidth - w) + 'px'; d.style.top = PZ.clamp(this.deskPos.y * innerHeight, 0, innerHeight - 120) + 'px'; d.style.right = 'auto'; }
      else { d.style.right = '18px'; d.style.left = 'auto'; d.style.top = (innerHeight < 700 ? 12 : 76) + 'px'; }
      const top = parseFloat(d.style.top) || 0;
      d.style.height = Math.max(320, Math.min(640, innerHeight - top - 14)) + 'px';
      if (top + 320 > innerHeight) d.style.top = Math.max(0, innerHeight - 334) + 'px';
    }
    openDesk(tab) {
      this.buildDesk();
      if (tab) this.tab = tab;
      this.desk.hidden = false; this.desk.classList.remove('min');
      this.deskOpen = true;
      PAudio.sfx('whoosh');
      this.render();
    }
    micState(st) {
      const on = st === 'live' || st === 'connecting' || st === 'reconnecting';
      [this.dockMic, this.deskMic].forEach((b) => { if (b) { b.classList.toggle('live', st === 'live'); b.classList.toggle('wait', on && st !== 'live'); b.title = on ? 'End voice talk' : 'Talk with me (voice)'; } });
    }
    // live-typing AI answer in the Ask tab
    updateStream() {
      if (!this.deskOpen || this.tab !== 'ask' || !this.deskBody) return;
      const msgs = this.deskBody.querySelector('.msgs');
      if (!msgs) return;
      msgs.querySelectorAll('.typing').forEach((x) => x.closest('.msg') && x.closest('.msg').remove());
      let el = msgs.querySelector('.msg.bot.live');
      if (!el) { el = h('div.msg.bot.live'); msgs.append(el); }
      const m = this.streaming;
      if (!m) { el.remove(); return; }
      el.innerHTML = `<div class="who">${esc(this.app.settings.pet.name)}${m.label ? ' · ' + esc(m.label) : ''}</div>` + PMd.render(m.content) + '<span class="caret"></span>';
      const b = this.deskBody;
      if (b.scrollTop + b.clientHeight >= b.scrollHeight - 140) b.scrollTop = b.scrollHeight;
    }
    closeDesk() { if (!this.desk) return; this.desk.hidden = true; this.deskOpen = false; }
    toggleDesk(tab) { if (this.deskOpen && (!tab || tab === this.tab)) this.closeDesk(); else this.openDesk(tab); }
    updateNow() {
      const tl = this.deskBody && this.deskBody.querySelector('.tl');
      const v = this.app.video;
      if (!tl || !v) return;
      const d = v.d || 1, p = PZ.clamp(v.t / d * 100, 0, 100) + '%';
      const bar = tl.querySelector('.bar'), now = tl.querySelector('.now');
      if (bar) bar.style.width = p;
      if (now) now.style.left = p;
    }
    refresh(which) { if (this.deskOpen && (!which || which.includes(this.tab))) this.render(); if (this.deskOpen) this.renderCounts(); }

    renderPill() {
      const k = this.statusKind || '';
      const cls = k === 'ok' ? 'ok' : k === 'warn' ? 'warn' : k === 'bad' ? 'bad' : '';
      this.deskPill.className = 'pill ' + cls;
      this.deskPill.innerHTML = `<span class="d"></span>${esc(this.statusLabel || '…')}`;
      this.deskPill.title = this.app.needsListen() ? 'Click to let Piniso listen to the audio' : '';
    }
    renderCounts() {
      const sess = this.app.session;
      if (!sess || !this.tabBtns) return;
      const set = (id, n) => {
        const b = this.tabBtns[id];
        let c = b.querySelector('.cnt');
        if (n > 0) { if (!c) { c = h('span.cnt'); b.append(c); } c.textContent = n > 99 ? '99+' : n; } else if (c) c.remove();
      };
      set('notes', this.app.visibleNotes().filter((n) => !n.pending).length);
      set('cards', sess.cards.length);
    }
    render() {
      if (!this.desk) return;
      Object.entries(this.tabBtns).forEach(([id, b]) => b.classList.toggle('on', id === this.tab));
      const sess = this.app.session;
      this.deskSub.textContent = sess ? sess.title : 'Open a lecture video';
      this.renderPill();
      this.renderCounts();
      const scrollKeep = this._lastTab === this.tab ? this.deskBody.scrollTop : 0;
      this._lastTab = this.tab;
      const ae = this.shadow.activeElement;
      const draft = ae && ae.dataset && ae.dataset.k ? { k: ae.dataset.k, v: ae.value, a: ae.selectionStart, b: ae.selectionEnd } : null;
      const drafts = {};
      this.deskFoot.querySelectorAll('[data-k]').forEach((x) => { if (x.value) drafts[x.dataset.k] = x.value; });
      this.deskBody.innerHTML = ''; this.deskFoot.innerHTML = '';
      this.deskFoot.hidden = false;
      const fn = { notes: this.rNotes, ask: this.rAsk, quiz: this.rQuiz, cards: this.rCards, videos: this.rVideos, focus: this.rFocus }[this.tab] || this.rNotes;
      fn.call(this, sess);
      this.deskFoot.querySelectorAll('[data-k]').forEach((x) => { if (drafts[x.dataset.k]) x.value = drafts[x.dataset.k]; });
      if (draft) { const el = this.root.querySelector(`[data-k="${draft.k}"]`); if (el) { el.value = draft.v; el.focus(); try { el.setSelectionRange(draft.a, draft.b); } catch (e) {} } }
      if (this.tab === 'notes' && this._stickBottom !== false) this.deskBody.scrollTop = this.deskBody.scrollHeight;
      else if (this.tab !== 'ask') this.deskBody.scrollTop = scrollKeep;
    }

    // ---------- notes tab ----------
    timeline(sess) {
      const v = this.app.video;
      const d = (v && v.d) || Math.max(60, ...sess.notes.map((n) => n.t + 30));
      const tl = h('div.tl');
      const now = v ? v.t : 0;
      tl.append(h('div.bar', { style: { width: PZ.clamp(now / d * 100, 0, 100) + '%' } }), h('div.now', { style: { left: PZ.clamp(now / d * 100, 0, 100) + '%' } }));
      const marks = this.app.visibleNotes().filter((n) => PZ.star(n) || ['snap', 'doubt', 'user'].includes(n.kind)).map((n) => (PZ.star(n) ? Object.assign({}, n, { kind: 'important' }) : n)).concat((sess.quizzes || []).map((q) => ({ t: q.t1 || q.t, kind: 'quiz', text: 'Quiz' })));
      const topics = [];
      this.app.visibleNotes().forEach((n) => { if (n.topic && !topics.some((x) => x.topic === n.topic)) topics.push({ t: n.t, topic: n.topic }); });
      topics.forEach((tp) => marks.push({ t: tp.t, kind: 'topic', text: tp.topic }));
      marks.forEach((m) => {
        const b = h('button.mk.' + m.kind, { title: `${PZ.fmt(m.t)} — ${PMd.plain(m.text || m.kind).slice(0, 80)}`, style: { left: PZ.clamp(m.t / d * 100, 1, 99) + '%' } });
        if (m.kind === 'topic') { b.style.width = '4px'; b.style.height = '18px'; b.style.margin = '-9px 0 0 -2px'; b.style.borderRadius = '2px'; b.style.background = 'var(--ink)'; }
        b.addEventListener('click', () => this.app.seek(m.t));
        tl.append(b);
      });
      tl.addEventListener('click', (e) => { if (e.target !== tl && !e.target.classList.contains('bar')) return; const r = tl.getBoundingClientRect(); this.app.seek((e.clientX - r.left) / r.width * d); });
      return tl;
    }
    rNotes(sess) {
      const body = this.deskBody, app = this.app;
      if (!sess) { body.append(this.empty('No lecture yet', 'Open a YouTube / Unacademy lecture and I’ll start writing notes.')); return; }
      body.append(this.timeline(sess));
      const view = this.notesView || 'live';
      // view switch + filters
      const bar = h('div.nbar');
      bar.append(this.seg([['live', 'Live notes'], ['clean', '✨ Clean notes']], view, (v) => { this.notesView = v; this.render(); }));
      if (view === 'live') {
        const fl = h('div.nfilt');
        const F = this.noteFilter || 'all';
        [['all', 'All'], ['star', '⭐'], ['formula', 'Formulas'], ['definition', 'Definitions'], ['mine', 'Mine']].forEach(([k, lab]) => fl.append(h('button.chip.sm' + (F === k ? '.on' : ''), { text: lab, onclick: () => { this.noteFilter = k; this.render(); } })));
        const q = h('input.inp.nsearch', { 'data-k': 'nsearch', placeholder: 'Search notes…', value: this.noteQuery || '' });
        ['keydown', 'keyup', 'keypress'].forEach((ev) => q.addEventListener(ev, (e) => e.stopPropagation()));
        q.addEventListener('input', PZ.debounce(() => { this.noteQuery = q.value; this.render(); }, 250));
        bar.append(fl, q);
      }
      body.append(bar);
      if (view === 'clean') this.rClean(sess, body);
      else this.rLive(sess, body);
      // footer: own note + export
      const inp = h('input.inp', { 'data-k': 'note', placeholder: 'Write your own note… (Enter)' });
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && inp.value.trim()) { app.addUserNote(inp.value.trim()); inp.value = ''; } });
      inp.addEventListener('keyup', (e) => e.stopPropagation());
      inp.addEventListener('keypress', (e) => e.stopPropagation());
      const exp = h('button.btn.sm', { html: I('download', 14) + 'Export', onclick: (e) => this.exportMenu(e.currentTarget) });
      const cheat = h('button.btn.sm', { title: 'Make an exam cheat sheet + summary', html: I('sparkle', 14), onclick: () => app.makeSummary(false) });
      this.deskFoot.append(inp, cheat, exp);
      body.onscroll = () => { this._stickBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30; };
    }
    rLive(sess, body) {
      const app = this.app, F = this.noteFilter || 'all', Q = (this.noteQuery || '').trim().toLowerCase();
      if (sess.summary && (sess.summary.recap || sess.summary.cheatsheet) && F === 'all' && !Q) {
        const st = h('div.sticky');
        st.append(h('h5', { text: 'Exam cheat sheet' }));
        const ul = h('ul');
        (sess.summary.cheatsheet && sess.summary.cheatsheet.length ? sess.summary.cheatsheet : sess.summary.recap || []).slice(0, 12).forEach((x) => ul.append(h('li', { html: PMd.inline(x) })));
        st.append(ul);
        body.append(st);
      }
      // 🧭 revisit list (moments you marked "lost")
      const lost = (sess.lost || []).filter((x) => !x.done);
      if (lost.length && F === 'all' && !Q) {
        const rb = h('div.revisit', null, h('b', { text: `🧭 Revisit list (${lost.length})` }));
        lost.slice(-6).forEach((x) => rb.append(h('div.rv', null, h('button.ts', { text: PZ.fmt(x.t), onclick: () => app.seek(x.t - 20) }), h('span', { text: x.topic || 'Lost here' }), h('div.sp'), h('button.btn.sm', { html: I('bulb', 13) + 'Explain', onclick: () => app.plus.explainLost(x) }))));
        body.append(rb);
      }
      // 📌 formula strip
      const fx = [];
      app.visibleNotes().forEach((n) => (n.text.match(/\$[^$]{3,60}\$/g) || []).forEach((f) => { if (/[=<>≈∝]/.test(f) && !fx.some((y) => y.f === f)) fx.push({ f, t: n.t }); }));
      if (fx.length && F === 'all' && !Q) {
        const fs = h('div.fstrip', null, h('span.lab', { text: '📌 Formulas' }));
        fx.slice(-8).forEach((x) => { const b = h('button.fchip', { title: 'Jump to ' + PZ.fmt(x.t), onclick: () => app.seek(x.t) }); b.innerHTML = PMd.inline(x.f); fs.append(b); });
        body.append(fs);
      }
      let notes = app.visibleNotes();
      const total = notes.length;
      if (F === 'star') notes = notes.filter((n) => PZ.star(n));
      else if (F === 'formula') notes = notes.filter((n) => n.kind === 'formula' || /\$[^$]+\$/.test(n.text));
      else if (F === 'definition') notes = notes.filter((n) => n.kind === 'definition');
      else if (F === 'mine') notes = notes.filter((n) => ['user', 'mark', 'chat', 'selection', 'voice', 'comment'].includes(n.src));
      if (Q) notes = notes.filter((n) => PMd.plain(n.text).toLowerCase().includes(Q) || String(n.topic || '').toLowerCase().includes(Q));
      if (!total) {
        body.append(this.empty(app.listeningLine(), 'Notes appear here as the teacher teaches. You can also write your own below.'));
      } else if (!notes.length) {
        body.append(h('div.muted.small', { style: { padding: '16px 4px' }, text: 'No notes match this filter.' }));
      } else {
        notes = notes.slice().sort((a, b) => a.t - b.t);
        let grp = null, lastTopic = null;
        for (const n of notes) {
          const topic = n.topic || sess.topic || 'Notes';
          if (!grp || topic !== lastTopic) { grp = h('div.grp'); grp.append(h('h4', { text: topic })); body.append(grp); lastTopic = topic; }
          grp.append(this.noteRow(n));
        }
      }
      const ahead = sess.notes.filter((n) => n.ahead && app.video && n.t > app.video.t + 2).length;
      if (ahead && F === 'all' && !Q) body.append(h('div.ahead', { html: `✍️ <b>${ahead}</b> more notes are ready and will appear as the video reaches them.` }));
      if (sess.terms && sess.terms.length && F === 'all' && !Q) {
        const det = h('details.terms', { open: sess.terms.length < 9 });
        det.append(h('summary', { text: `Key terms (${sess.terms.length})` }));
        const dl = h('dl');
        sess.terms.forEach((t) => dl.append(h('dt', { html: PMd.inline(t.term) }), h('dd', { html: PMd.inline(t.meaning) })));
        det.append(dl); body.append(det);
      }
    }
    rClean(sess, body) {
      const app = this.app, c = sess.clean;
      const top = h('div.row', { style: { margin: '2px 0 8px' } });
      const stale = c ? app.visibleNotes().length - (c.n || 0) : 0;
      top.append(h('span.small.muted', { text: app.cleaning ? 'Writing clean notes…' : c ? `Updated ${new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${stale > 0 ? ' · ' + stale + ' new notes since' : ''}` : 'Tidy, topic-wise notes for revision' }), h('div.sp'),
        h('button.btn.sm' + (c ? '' : '.pri'), { html: I('sparkle', 14) + (c ? 'Update' : 'Make clean notes'), disabled: app.cleaning, onclick: () => app.makeClean(false) }));
      body.append(top);
      if (app.cleaning && !c) { body.append(h('div.cook', null, h('div.hand', { text: 'Arranging your notes topic-wise…' }), h('span.typing', { html: '<i></i><i></i><i></i>' }))); return; }
      if (!c || !c.md) { body.append(this.empty('Clean notes', 'I rewrite all the live notes into neat topic-wise notes with formulas, examples and an exam corner. They also update by themselves as the lecture goes on.')); return; }
      const box = h('div.clean');
      box.innerHTML = PMd.render(c.md).replace(/\(▶\s*((?:\d+:)?\d{1,2}:\d{2})\)/g, (_, ts) => `<button class="ts" data-ts="${ts}">${ts}</button>`);
      box.addEventListener('click', (e) => { const b = e.target.closest('[data-ts]'); if (!b) return; const p = b.dataset.ts.split(':').map(Number); app.seek(p.reduce((a, x) => a * 60 + x, 0)); });
      body.append(box);
      this._stickBottom = false;
    }
    noteRow(n) {
      const row = h('div.note.k-' + n.kind + (n.fresh ? '.fresh' : '') + (PZ.star(n) ? '.starred' : '') + (n.pending ? '.pending' : ''));
      n.fresh = false;
      row.append(h('button.ts', { text: PZ.fmt(n.t), title: 'Jump to this moment', onclick: () => this.app.seek(n.t) }), h('span.kd', { text: PZ.star(n) ? '⭐' : (KIND[n.kind] || '•') }));
      const nt = h('div.nt', { html: (n.img ? `<img class="shot" src="${esc(n.img)}" alt="board">` : '') + PMd.render(n.text) });
      row.append(nt);
      const na = h('div.na');
      na.append(
        h('button', { title: 'Edit', html: I('edit', 13), onclick: () => this.editNote(n, nt) }),
        h('button', { title: 'Make a flashcard', html: I('cards', 13), onclick: () => this.app.noteToCard(n.id) }),
        h('button', { title: 'Write it as a board-exam answer (3/5 marks)', html: I('edit', 13).replace('<svg', '<svg style="transform:scaleX(-1)"'), onclick: () => this.app.ask(`Write this as a model BOARD-EXAM answer: first a 3-mark version (3 points), then a 5-mark version (intro, 4-5 points, a diagram description or example, conclusion). Use exam keywords in bold. Topic: "${PMd.plain(n.text).slice(0, 300)}"`, false, null, 'now') }),
        h('button', { title: PZ.star(n) ? 'Unstar' : 'Star', html: I('star', 13), onclick: () => this.app.starNote(n.id) }),
        h('button', { title: 'Delete', html: I('trash', 13), onclick: () => this.app.deleteNote(n.id) })
      );
      row.append(na);
      return row;
    }
    editNote(n, nt) {
      const ta = h('textarea.inp', { text: n.text });
      ta.value = n.text;
      ta.style.minHeight = '60px';
      nt.replaceWith(ta);
      ta.focus();
      const done = () => { const v = ta.value.trim(); if (v) this.app.editNote(n.id, v); else this.render(); };
      ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); } if (e.key === 'Escape') this.render(); });
      ta.addEventListener('blur', done);
    }
    exportMenu(anchor) {
      const items = [['📘 Study booklet (printable)', 'booklet'], ['📄 Notes as PDF / print', 'pdf'], ['⬇️ Markdown file (.md)', 'md'], ['📋 Copy all notes', 'copy'], ['🃏 Flashcards for Anki (.csv)', 'anki']];
      const m = h('div.paper', { style: { position: 'fixed', padding: '6px', zIndex: 20, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px' } });
      items.forEach(([lab, f]) => m.append(h('button.btn.ghost.sm', { style: { justifyContent: 'flex-start' }, text: lab, onclick: () => { m.remove(); this.app.exportNotes(f); } })));
      this.root.append(m);
      const r = anchor.getBoundingClientRect();
      m.style.left = Math.min(r.left, innerWidth - 220) + 'px';
      m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + 'px';
      // close when clicking anywhere else. Our UI lives in a CLOSED shadow root, so a page-level listener can't
      // see inside it (that bug removed the menu before its buttons got the click). Listen inside the shadow too.
      const sh = m.getRootNode();
      const doc = m.ownerDocument;
      const off = () => { m.remove(); sh.removeEventListener('pointerdown', inside, true); doc.removeEventListener('pointerdown', outside, true); };
      const inside = (e) => { if (!e.composedPath().includes(m)) off(); };
      const outside = (e) => { if (!e.composedPath().includes(this.host)) off(); };
      setTimeout(() => { sh.addEventListener('pointerdown', inside, true); doc.addEventListener('pointerdown', outside, true); }, 10);
    }
    empty(title, sub) {
      const e = h('div.empty');
      const p = h('div.ep'); p.innerHTML = PinisoPet.svgString(this.app.petCfg(), 'writing');
      e.append(p, h('div.hand', { text: title }), h('div.small', { text: sub, style: { marginTop: '4px' } }));
      return e;
    }

    // ---------- ask tab ----------
    // "what part of the lecture?" picker for Ask / Quiz / voice
    scopePicker(kind) {
      const key = kind === 'ask' ? 'askScope' : 'quizScope';
      const cur = this[key] || (kind === 'ask' ? 'now' : 'since');
      const { base, topics } = this.app.timeline.scopeChoices(kind);
      const wrap = h('div.scope');
      wrap.append(h('span.lab', { text: kind === 'ask' ? 'Answer from' : 'Quiz me on' }));
      const row = h('div.chips');
      base.forEach(([k, lab]) => row.append(h('button.chip.sm' + (cur === k ? '.on' : ''), { text: lab, onclick: () => { this[key] = k; this.render(); } })));
      if (topics.length) {
        const sel = h('select.inp.ssel', { title: 'A topic or chapter' });
        sel.append(h('option', { value: '', text: '📘 Pick a topic…' }));
        topics.forEach(([k, lab]) => sel.append(h('option', { value: k, text: lab.length > 40 ? lab.slice(0, 39) + '…' : lab, selected: cur === k })));
        if (topics.some(([k]) => k === cur)) sel.classList.add('on');
        sel.onchange = () => { if (sel.value) { this[key] = sel.value; this.render(); } };
        ['keydown', 'keyup'].forEach((ev) => sel.addEventListener(ev, (e) => e.stopPropagation()));
        row.append(sel);
      }
      wrap.append(row);
      const R = this.app.timeline.range(cur);
      if (R.full) wrap.append(h('div.scopenote', { html: `🎬 Using <b>${esc(R.label.replace(/^the /, ''))}</b>` , title: 'Piniso may use parts you have not watched yet' }));
      else if (kind !== 'ask' || cur !== 'now') wrap.append(h('div.scopenote.muted', { text: cur === 'library' ? 'Searching the notes of all your videos.' : `Only ${R.label} (${PZ.fmt(R.t0)}–${PZ.fmt(R.t1)}). Nothing ahead of you.` }));
      return wrap;
    }
    rAsk(sess) {
      const body = this.deskBody;
      const quick = h('div.quick');
      if (sess) quick.append(this.scopePicker('ask'));
      const lg = this.app.lang();
      const q = [['😵', lg === 'hinglish' ? 'Samjha nahi' : lg === 'hindi' ? 'समझ नहीं आया' : 'Didn’t get it', 'simple'], ['🧠', 'Memory trick', 'mnemonic'], ['🌍', 'Real example', 'example'], ['📸', 'Explain board', 'snap'], ['🔁', 'Recap so far', 'recap'], ['🎯', 'Exam focus', 'exam'], ['🎙️', 'Talk instead', 'talk'], ['🤡', 'Meme this', 'meme']];
      const qrow = h('div.qrow');
      q.forEach(([e, lab, mode]) => qrow.append(h('button.chip.sm', { html: `${e} ${esc(lab)}`, onclick: () => ['snap', 'talk', 'meme'].includes(mode) ? this.app.action(mode) : this.app.quick(mode) })));
      quick.append(qrow);
      // mouse wheel scrolls the chip rows sideways
      const sideways = (el) => el && el.addEventListener('wheel', (e) => { if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      sideways(qrow); sideways(quick.querySelector('.scope .chips'));
      body.append(quick);
      const msgs = h('div.msgs');
      const chat = (sess && sess.chat) || [];
      if (!chat.length) msgs.append(this.empty('Koi doubt? Pucho!', 'Ask anything about the lecture. I know what the teacher just said.'));
      chat.forEach((m) => msgs.append(this.msgEl(m)));
      if (this.chatBusy) msgs.append(h('div.msg.bot', { html: '<div class="who">' + esc(this.app.settings.pet.name) + '</div><span class="typing"><i></i><i></i><i></i></span>' }));
      body.append(msgs);
      if (this.streaming) requestAnimationFrame(() => this.updateStream());
      requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
      const inp = h('textarea.inp', { 'data-k': 'ask', placeholder: 'Type your doubt… (Enter to send)', rows: 1, style: { minHeight: '38px', maxHeight: '110px' } });
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
      inp.addEventListener('keyup', (e) => e.stopPropagation());
      inp.addEventListener('keypress', (e) => e.stopPropagation());
      const scr = h('button.ib' + (this.includeScreen ? '.on' : ''), { title: 'Include a screenshot of the video', html: I('camera', 17), onclick: () => { this.includeScreen = !this.includeScreen; scr.classList.toggle('on', this.includeScreen); } });
      const send = () => { const v = inp.value.trim(); if (!v || this.chatBusy || this.streaming) return; inp.value = ''; this.app.ask(v, this.includeScreen); };
      this.deskFoot.append(scr, inp, h('button.btn.pri.sm', { html: I('send', 15), title: 'Send', onclick: send }));
      if (!this._askFocused) { this._askFocused = true; setTimeout(() => inp.focus(), 50); }
    }
    msgEl(m) {
      if (m.role === 'user') return h('div.msg.me', { html: (m.img ? `<img src="${esc(m.img)}">` : '') + PMd.render(m.content) });
      const el = h('div.msg.bot', { html: `<div class="who">${esc(this.app.settings.pet.name)}${m.label ? ' · ' + esc(m.label) : ''}</div>` + (m.img ? `<img src="${esc(m.img)}">` : '') + PMd.render(m.content) });
      const ma = h('div.ma');
      ma.append(h('button.btn.sm', { html: I('notes', 13) + 'Save to notes', onclick: (e) => { this.app.chatToNote(m); e.currentTarget.disabled = true; e.currentTarget.textContent = 'Saved ✓'; } }));
      if (this.app.settings.sound.tts !== undefined) ma.append(h('button.btn.sm.ghost', { html: I('volume', 13), title: 'Read aloud', onclick: () => this.app.speak(PMd.plain(m.content), true) }));
      el.append(ma);
      return el;
    }

    // ---------- quiz tab ----------
    rQuiz(sess) {
      const s = this.app.settings, body = this.deskBody;
      body.append(h('h3.sec', { html: 'Pop <em>quiz</em>' }));
      if (sess) body.append(this.scopePicker('quiz'));
      const ready = ((sess && sess.qpool) || []).filter((q) => !q.used && (!this.app.video || q.t <= this.app.video.t + 5)).length;
      const qrow = h('div.row', { style: { gap: '8px' } });
      qrow.append(h('button.btn.pri', { style: { flex: '1' }, html: I('quiz', 16) + 'Quiz me now', onclick: () => this.app.quizNow(false, this.quizScope || 'since') }),
        h('button.btn', { style: { flex: '1' }, html: I('mic', 16) + 'Voice quiz', title: 'Piniso asks out loud, you answer by speaking', onclick: () => this.app.action('vquiz') }));
      body.append(qrow);
      body.append(h('div.small.muted', { style: { marginTop: '6px' }, text: ready ? `⚡ ${ready} question${ready > 1 ? 's' : ''} already prepared — quiz starts instantly.` : 'Questions are prepared together with the notes, so quizzes start fast.' }));
      const rows = h('div', { style: { marginTop: '10px' } });
      rows.append(this.setRow('Quiz mode', 'Pause the video and quiz me while I watch (you can always skip).', this.sw(s.quiz.enabled, (v) => this.app.setSetting({ quiz: { enabled: v } }))));
      rows.append(this.setRow('How often', 'Minutes of video between quizzes', this.seg([[300, '5m'], [480, '8m'], [720, '12m'], [1200, '20m']], s.quiz.every, (v) => this.app.setSetting({ quiz: { every: v } }))));
      rows.append(this.setRow('Questions', '', this.seg([[1, '1'], [2, '2'], [3, '3'], [5, '5']], s.quiz.count, (v) => this.app.setSetting({ quiz: { count: v } }))));
      rows.append(this.setRow('Difficulty', '', this.seg([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], s.quiz.difficulty, (v) => this.app.setSetting({ quiz: { difficulty: v } }))));
      const types = h('div.row.wrap');
      [['mcq', 'MCQ'], ['tf', 'True / False'], ['short', 'One-word'], ['long', 'Written'], ['fill', '🧩 Blank'], ['fix', '🕵️ Mistake'], ['order', '🔢 Order'], ['match', '🔗 Match']].forEach(([k, lab]) => {
        const c = h('button.chip' + (s.quiz.types[k] ? '.on' : ''), { text: lab, onclick: () => { const t = Object.assign({}, s.quiz.types, { [k]: !s.quiz.types[k] }); if (!Object.values(t).some(Boolean)) t.mcq = true; this.app.setSetting({ quiz: { types: t } }); } });
        types.append(c);
      });
      rows.append(this.setRow('Question types', '', types));
      body.append(rows);
      const qs = (sess && sess.quizzes) || [];
      body.append(h('h3.sec', { html: 'Quiz <em>history</em>', style: { marginTop: '16px' } }));
      if (!qs.length) body.append(h('div.muted.small', { text: 'No quizzes yet for this video.' }));
      qs.slice().reverse().forEach((q) => {
        const right = q.items.filter((i) => i.correct).length;
        const box = h('div.note');
        box.append(h('button.ts', { text: PZ.fmt(q.t1 || 0), onclick: () => this.app.seek(q.t0 || 0) }));
        const txt = h('div.nt');
        txt.innerHTML = `<b>${right}/${q.items.length} correct</b>` + q.items.filter((i) => !i.correct).map((i) => `<div class="small muted">✗ ${PMd.inline(i.q)}</div>`).join('');
        box.append(txt);
        body.append(box);
      });
      this.deskFoot.hidden = true;
    }

    // ---------- cards tab ----------
    rCards(sess) {
      const body = this.deskBody, app = this.app;
      if (this.review) return this.rReview(body);
      const top = h('div.row', { style: { marginBottom: '8px' } });
      top.append(h('h3.sec', { html: 'Flash<em>cards</em>', style: { margin: 0 } }), h('div.sp'), h('button.btn.sm', { html: I('refresh', 14) + 'All decks', title: 'Revise cards from every lecture', onclick: () => PZ.bg({ type: 'open:options', hash: 'revise' }) }));
      body.append(top);
      const cards = (sess && sess.cards) || [];
      const acts = h('div.row', { style: { gap: '8px', marginBottom: '12px' } });
      acts.append(h('button.btn.pri', { style: { flex: '1' }, disabled: !cards.length, html: I('play', 15) + 'Revise (' + cards.length + ')', onclick: () => this.startReview() }),
        h('button.btn', { style: { flex: '1' }, disabled: !!app.cardsBusy, html: I('sparkle', 15) + (app.cardsBusy ? 'Making…' : 'Make more cards'), title: 'AI makes flashcards from your notes', onclick: () => app.makeCards() }));
      body.append(acts);
      if (!cards.length) body.append(this.empty('No cards yet', 'I add 1–3 cards with every set of notes. Press “Make cards from notes” to get a full deck now. Wrong quiz answers land here too.'));
      cards.slice().reverse().forEach((c) => {
        const fc = h('div.fc', { onclick: () => { fc.classList.toggle('flip'); PAudio.sfx('click'); } });
        fc.innerHTML = `<div class="in"><div class="f"><span class="lab">QUESTION</span><div>${PMd.render(c.q)}</div></div><div class="b"><span class="lab">ANSWER</span><div>${PMd.render(c.a)}</div></div></div>`;
        body.append(fc);
      });
      const q = h('input.inp', { 'data-k': 'cq', placeholder: 'Question' }), a = h('input.inp', { 'data-k': 'ca', placeholder: 'Answer' });
      [q, a].forEach((x) => { x.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') add(); }); x.addEventListener('keyup', (e) => e.stopPropagation()); });
      const add = () => { if (q.value.trim() && a.value.trim()) { app.addCard(q.value.trim(), a.value.trim()); q.value = ''; a.value = ''; } };
      this.deskFoot.append(q, a, h('button.btn.sm.pri', { html: I('plus', 14), onclick: add }));
    }
    // quick in-desk revision of this lecture's cards (uses the same spaced-repetition schedule)
    async startReview() {
      const sess = this.app.session;
      if (!sess || !sess.cards.length) return;
      const all = await PStore.cards();
      const mine = sess.cards.map((c) => all.find((x) => x.q.toLowerCase() === String(c.q).trim().toLowerCase()) || { q: c.q, a: c.a, local: true });
      const now = Date.now();
      mine.sort((a, b) => (a.due || 0) - (b.due || 0));
      const due = mine.filter((c) => !c.due || c.due <= now);
      this.review = { list: (due.length ? due : mine).slice(0, 20), i: 0, flip: false, right: 0 };
      this.render();
    }
    rReview(body) {
      const R = this.review, c = R.list[R.i];
      this.deskFoot.hidden = true;
      const head = h('div.row', { style: { marginBottom: '10px' } });
      head.append(h('b', { text: c ? `Card ${R.i + 1} / ${R.list.length}` : 'Done!' }), h('div.sp'), h('button.btn.sm.ghost', { text: 'Stop', onclick: () => { this.review = null; this.render(); } }));
      body.append(head);
      if (!c) {
        body.append(h('div.score', null, h('div.big', { text: `${R.right}/${R.list.length}` }), h('div.hand', { text: R.right === R.list.length ? 'Sab yaad hai! 🔥' : 'Kal phir dikhaunga jo bhool gaye 😉' })));
        body.append(h('button.btn.pri.wide', { text: 'Back to cards', onclick: () => { this.review = null; this.render(); } }));
        return;
      }
      const fc = h('div.fc.big' + (R.flip ? '.flip' : ''), { onclick: () => { R.flip = !R.flip; fc.classList.toggle('flip', R.flip); PAudio.sfx('click'); grades.hidden = !R.flip; hint.hidden = R.flip; } });
      fc.innerHTML = `<div class="in"><div class="f"><span class="lab">QUESTION</span><div>${PMd.render(c.q)}</div></div><div class="b"><span class="lab">ANSWER</span><div>${PMd.render(c.a)}</div></div></div>`;
      const hint = h('div.small.muted', { style: { textAlign: 'center' }, text: 'Think of the answer, then tap the card', hidden: R.flip });
      const grades = h('div.row.grades', { hidden: !R.flip });
      [[0, 'Forgot', 'bad'], [1, 'Hard', ''], [2, 'Good', 'ok'], [3, 'Easy', 'ok']].forEach(([g, lab, cls]) => grades.append(h('button.btn.sm' + (cls ? '.' + cls : ''), { text: lab, onclick: () => this.gradeCard(g) })));
      body.append(fc, hint, grades);
    }
    async gradeCard(g) {
      const R = this.review, c = R.list[R.i];
      if (!c) return;
      if (g >= 2) R.right++;
      if (!c.local) {
        const all = await PStore.cards();
        const x = all.find((y) => y.id === c.id);
        if (x) { PStore.schedule(x, g); await PStore.saveCards(all); }
      }
      this.app.bumpStats((st) => { if (g >= 2) st.xp += 1; st.reviews++; PStore.bumpDay(st, 'cards'); });
      if (!R.i) this.app.magic.markUsed('cards');
      PAudio.sfx(g === 0 ? 'womp' : 'ding');
      R.i++; R.flip = false;
      this.render();
    }

    // ---------- videos tab: continue studying, up next, suggestions ----------
    rVideos(sess) {
      const body = this.deskBody, app = this.app;
      this.deskFoot.hidden = true;
      body.append(h('h3.sec', { html: 'Study <em>videos</em>' }));
      body.append(h('div.small.muted', { style: { margin: '-4px 0 10px' }, text: 'Every video keeps its own notes and chat — pick up any of them exactly where you left.' }));
      const upBox = h('div.vsec'), contBox = h('div.vsec'), sugBox = h('div.vsec');
      body.append(upBox, contBox, sugBox);
      const thumb = (r) => {
        const box = h('div.vth');
        if (r.vid) { const img = h('img', { src: 'https://i.ytimg.com/vi/' + encodeURIComponent(r.vid) + '/mqdefault.jpg', alt: '', loading: 'lazy' }); img.onerror = () => img.remove(); box.append(img); }
        box.append(h('span.vic', { html: I('tv', 18) }));
        if (r.dur && r.lastT) box.append(h('i.vpr', { style: { width: PZ.clamp(r.lastT / r.dur * 100, 2, 100) + '%' } }));
        return box;
      };
      const urlAt = (r) => r.vid ? `https://www.youtube.com/watch?v=${encodeURIComponent(r.vid)}${r.lastT > 20 ? '&t=' + Math.max(0, r.lastT - 3) + 's' : ''}` : r.url;
      const ago = (ms) => { const m = (Date.now() - ms) / 60000; return m < 60 ? Math.max(1, Math.round(m)) + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
      const go = (url) => { if (url) location.href = url; };
      // up next
      PStore.queue().then((q) => {
        upBox.append(h('h4', { html: I('play', 14) + ' Up next' + (q.length ? ` <span class="muted">(${q.length})</span>` : '') }));
        if (!q.length) upBox.append(h('div.small.muted.vempty', { text: 'Add videos from “Suggested next” below, or right-click any video link → “Add to Piniso Up next”.' }));
        q.forEach((it, i) => {
          const row = h('div.vrow');
          row.append(thumb({ vid: it.vid }), h('div.vtx', null, h('b', { text: it.title || it.url }), h('span.small.muted', { text: it.author || (it.url || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) })),
            h('div.vbtns', null,
              h('button.btn.sm.pri', { html: I('play', 13) + 'Play', onclick: async () => { q.splice(i, 1); await PStore.saveQueue(q); go(it.url); } }),
              h('button.ib', { title: 'Remove', html: I('trash', 14), onclick: async () => { q.splice(i, 1); await PStore.saveQueue(q); this.render(); } })));
          upBox.append(row);
        });
      });
      // continue studying
      PStore.listSessions().then((list) => {
        const rows = list.filter((r) => r.study !== false && (!sess || r.key !== sess.key) && (r.notes > 0 || r.watch > 60)).slice(0, 12);
        contBox.append(h('h4', { html: I('book', 14) + ' Continue studying' }));
        if (!rows.length) contBox.append(h('div.small.muted.vempty', { text: 'Videos you study show up here.' }));
        rows.forEach((r) => {
          const row = h('div.vrow');
          const meta = [ago(r.updatedAt), r.notes ? r.notes + ' notes' : '', r.acc != null ? 'quiz ' + r.acc + '%' : ''].filter(Boolean).join(' · ');
          row.append(thumb(r), h('div.vtx', null, h('b', { text: r.title }), h('span.small.muted', { text: (r.topic ? r.topic + ' · ' : '') + meta })),
            h('div.vbtns', null,
              h('button.btn.sm', { html: I('play', 13) + (r.lastT > 20 ? PZ.fmt(r.lastT) : 'Open'), title: 'Continue where you stopped', onclick: () => go(urlAt(r)) }),
              h('button.ib', { title: 'Open notes', html: I('notes', 14), onclick: () => PZ.bg({ type: 'open:url', url: chrome.runtime.getURL('pages/notes.html?key=' + encodeURIComponent(r.key)) }) })));
          contBox.append(row);
        });
      });
      // suggestions from this YouTube page (study videos only)
      const sug = PZ.Extras.relatedStudy ? PZ.Extras.relatedStudy() : [];
      if (sug.length) {
        sugBox.append(h('h4', { html: I('sparkle', 14) + ' Suggested next (study only)' }));
        sug.slice(0, 5).forEach((it) => {
          const row = h('div.vrow');
          const add = h('button.btn.sm', { html: I('plus', 13) + 'Up next', onclick: async () => { await PStore.addToQueue(it); add.disabled = true; add.textContent = 'Added ✓'; PAudio.sfx('pop'); this.renderCounts(); } });
          row.append(thumb(it), h('div.vtx', null, h('b', { text: it.title }), h('span.small.muted', { text: it.author || '' })), h('div.vbtns', null, add));
          sugBox.append(row);
        });
      }
    }

    // ---------- focus tab ----------
    rFocus(sess) {
      const s = this.app.settings, body = this.deskBody, st = this.app.stats || {};
      const today = (st.days && st.days[PStore.todayKey()]) || 0;
      const lvl = PINISO.levelFromXP(st.xp || 0);
      const curX = PINISO.xpForLevel(lvl), nextX = PINISO.xpForLevel(lvl + 1);
      const L = h('div.lvl', { html: `<div class="row"><b style="font:400 20px var(--f-serif)">Level ${lvl} · ${esc(PINISO.levelTitle(lvl))}</b><span class="sp"></span><span class="small muted">${st.xp || 0} XP</span></div><div class="bar"><i style="width:${PZ.clamp(((st.xp || 0) - curX) / (nextX - curX) * 100, 2, 100)}%"></i></div>` });
      body.append(L);
      const focus = this.app.focusScore();
      const grid = h('div.stats');
      const stat = (ic, val, lab) => h('div.stat', { html: `<span class="ic">${I(ic, 16)}</span><b>${esc(val)}</b><span>${esc(lab)}</span>` });
      grid.append(
        stat('timer', PZ.fmtDur(sess ? sess.watchSeconds : 0), 'studied this video'),
        stat('target', focus + '%', 'focus score'),
        stat('flame', PStore.streak(st) + (PStore.streak(st) === 1 ? ' day' : ' days'), 'streak'),
        stat('bolt', `${Math.round(today / 60)}/${s.focus.dailyGoal}m`, 'today’s goal'),
        stat('eyeoff', String(sess ? sess.awayCount : 0), 'tab escapes'),
        stat('notes', String(sess ? sess.notes.length : 0), 'notes made')
      );
      body.append(grid);
      // 🎯 today's mission
      const M = PStore.mission(st.days ? st : { days: {} }, s, this._due || 0);
      PStore.dueCount().then((d) => { if (d !== this._due) { this._due = d; } });
      const mb = h('div.mission');
      mb.append(h('div.row', null, h('b', { text: '🎯 Today’s mission' }), h('div.sp'), h('span.small.muted', { text: M.allDone ? 'All done! +50 XP 🎉' : M.filter((x) => x.done).length + '/3' })));
      M.forEach((x) => mb.append(h('div.mi' + (x.done ? '.done' : ''), null, h('span', { text: x.done ? '✅' : x.icon }), h('span', { text: x.label }), h('div.sp'), h('span.small.muted', { text: `${Math.min(x.have, x.need)}/${x.need}` }))));
      if (M.exam) mb.append(h('div.exam', { html: `📅 <b>${esc(M.exam.name)}</b> in <b>${M.exam.days}</b> day${M.exam.days === 1 ? '' : 's'}` }));
      if ((st.freezes || 0) > 0) mb.append(h('div.small.muted', { text: `🧊 ${st.freezes} streak freeze${st.freezes > 1 ? 's' : ''} saved (protects your streak if you miss a day)` }));
      body.append(mb);
      // 🔒 focus lock
      const lk = h('div.row.lockrow', null, h('span.small', { html: '🔒 <b>Focus lock</b> (blocks Instagram, Shorts…)' }), h('div.sp'));
      [25, 50].forEach((m) => lk.append(h('button.btn.sm', { text: m + 'm', onclick: async () => { const r = await PZ.bg({ type: 'guardian:lock', minutes: m }); this.toast(r && r.ok ? `🔒 Locked for ${m} min` : 'Could not lock'); } })));
      body.append(lk);
      body.append(h('h3.sec', { html: 'Focus <em>shield</em>' }));
      const yt = PZ.site() === 'youtube';
      if (yt) body.append(this.setRow('Zen mode', 'Hide recommendations, comments and end screens', this.sw(s.focus.zen, (v) => this.app.setSetting({ focus: { zen: v } }))));
      body.append(this.setRow('Pause when I leave', 'Video pauses if you switch tabs', this.sw(s.focus.pauseOnLeave, (v) => this.app.setSetting({ focus: { pauseOnLeave: v } }))));
      body.append(this.setRow('Break reminder', 'Remind me to rest my eyes', this.seg([[0, 'Off'], [25, '25m'], [45, '45m'], [60, '60m']], s.focus.breakEvery, (v) => this.app.setSetting({ focus: { breakEvery: v } }))));
      if (yt) body.append(this.setRow('Hide captions Piniso turns on', '', this.sw(s.focus.hideCaptions, (v) => this.app.setSetting({ focus: { hideCaptions: v } }))));
      body.append(h('h3.sec', { html: 'Study <em>sounds</em>', style: { marginTop: '14px' } }));
      const mg = h('div.music');
      const em = { off: '🔇', lofi: '🎧', rain: '🌧️', brown: '🌊', forest: '🌲', space: '🌌', examhall: '⏱️' };
      PINISO.MUSIC_MODES.forEach(([k, lab]) => {
        const on = k === 'off' ? !PAudio.playing() : PAudio.mode === k && PAudio.playing();
        mg.append(h('button.mb' + (on ? '.on' : ''), { html: `<span class="em">${em[k]}</span>${esc(lab)}`, onclick: () => { this.app.setMusic(k, true); this.render(); } }));
      });
      body.append(mg);
      body.append(this.setRow('Play music', 'Lecture audio always stays clear', this.seg([['breaks', 'Breaks'], ['paused', 'When paused'], ['always', 'Always']], s.sound.musicWhen, (v) => this.app.setSetting({ sound: { musicWhen: v } }))));
      const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.sound.musicVol });
      vol.addEventListener('input', () => { PAudio.setVolumes({ music: +vol.value }); });
      vol.addEventListener('change', () => this.app.setSetting({ sound: { musicVol: +vol.value } }));
      body.append(this.setRow('Music volume', '', vol));
      body.append(this.setRow('Sound effects', 'Pops, dings, scribbles', this.sw(s.sound.sfx, (v) => this.app.setSetting({ sound: { sfx: v } }))));
      body.append(this.setRow('Piniso talks', 'Reads comments aloud (when video is paused)', this.sw(s.sound.tts, (v) => this.app.setSetting({ sound: { tts: v } }))));
      this.deskFoot.append(
        h('button.btn.sm', { html: I('coffee', 14) + 'Break', onclick: () => this.app.startBreak() }),
        h('button.btn.sm', { title: 'Keyboard shortcuts (Alt+Shift+/)', html: I('keyboard', 14), onclick: () => this.app.plus.shortcuts() }),
        h('div.sp'),
        h('button.btn.sm.pri', { html: I('trophy', 14) + 'Finish & report card', onclick: () => this.app.finish() })
      );
    }

    // ---------- small controls ----------
    setRow(label, sub, control) {
      const r = h('div.setrow');
      r.append(h('div.lbl', { html: esc(label) + (sub ? `<small>${esc(sub)}</small>` : '') }), control);
      if (control.tagName === 'INPUT') control.style.maxWidth = '150px';
      return r;
    }
    sw(on, cb) {
      const b = h('button.sw' + (on ? '.on' : ''), { role: 'switch', 'aria-checked': on ? 'true' : 'false' });
      b.addEventListener('click', () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); PAudio.sfx('click'); cb(v); });
      return b;
    }
    seg(opts, cur, cb) {
      const s = h('div.seg');
      opts.forEach(([v, lab]) => s.append(h('button' + (v === cur ? '.on' : ''), { text: lab, onclick: () => { [...s.children].forEach((x) => x.classList.remove('on')); s.children[opts.findIndex((o) => o[0] === v)].classList.add('on'); PAudio.sfx('click'); cb(v); } })));
      return s;
    }
  }

  PZ.UI = UI;
})();
