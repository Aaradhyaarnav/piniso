/* Piniso content — shareable study report card (1080×1350 PNG, Instagram portrait). */
(() => {
  if (PZ.Report) return;
  const { h } = PZ, esc = PMd.esc;
  const I = (n, s) => PIcons.svg(n, s);

  function grade(focus, quizPct) {
    const s = quizPct == null ? focus : focus * 0.5 + quizPct * 0.5;
    if (s >= 92) return ['A+', 'Topper energy'];
    if (s >= 85) return ['A', 'Seriously solid'];
    if (s >= 78) return ['B+', 'Almost topper'];
    if (s >= 70) return ['B', 'Good grind'];
    if (s >= 60) return ['C', 'Distraction survived'];
    return ['D', 'Reels won today'];
  }

  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

  function wrap(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  function sketchRect(ctx, x, y, w, hh, r, fill, ink, shadow) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x + r, y + 1); ctx.lineTo(x + w - r, y - 1); ctx.quadraticCurveTo(x + w + 1, y, x + w, y + r);
      ctx.lineTo(x + w + 1, y + hh - r); ctx.quadraticCurveTo(x + w, y + hh + 1, x + w - r, y + hh);
      ctx.lineTo(x + r, y + hh + 1); ctx.quadraticCurveTo(x - 1, y + hh, x, y + hh - r);
      ctx.lineTo(x - 1, y + r); ctx.quadraticCurveTo(x, y - 1, x + r, y + 1); ctx.closePath();
    };
    if (shadow) { ctx.save(); ctx.translate(7, 7); path(); ctx.fillStyle = ink; ctx.fill(); ctx.restore(); }
    path(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
  }

  async function draw(app, data) {
    const s = app.settings, t = PINISO.themeOf(s);
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    try { await Promise.all(['64px PinisoSerif', 'italic 64px PinisoSerif', '40px PinisoHand', '700 30px PinisoSans', '500 22px PinisoMono'].map((f) => document.fonts.load(f))); } catch (e) {}
    const SERIF = 'PinisoSerif, Georgia, serif', HAND = 'PinisoHand, "Segoe Print", cursive', SANS = 'PinisoSans, "Segoe UI", sans-serif', MONO = 'PinisoMono, Consolas, monospace';
    // paper
    ctx.fillStyle = t.paper; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = t.line; ctx.lineWidth = 2;
    for (let y = 120; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,90,90,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(86, 0); ctx.lineTo(86, H); ctx.stroke();
    const grain = await loadImg(chrome.runtime.getURL('assets/grain.png'));
    if (grain) { ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // tape
    ctx.save(); ctx.translate(W / 2, 30); ctx.rotate(-0.03); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-110, -22, 220, 44); ctx.restore();

    ctx.fillStyle = t.ink;
    ctx.font = `500 22px ${MONO}`; ctx.fillText('STUDY REPORT CARD', 120, 110);
    ctx.fillStyle = t.muted; ctx.font = `400 22px ${MONO}`;
    ctx.fillText(new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + '  ·  ' + (PZ.site()), 120, 146);

    // title
    ctx.fillStyle = t.ink; ctx.font = `400 68px ${SERIF}`;
    const tl = wrap(ctx, data.title, 600).slice(0, 3);
    tl.forEach((l, i) => ctx.fillText(i === 2 && wrap(ctx, data.title, 600).length > 3 ? l + '…' : l, 120, 236 + i * 72));

    // pet
    const svg = PinisoPet.svgString(Object.assign({}, app.petCfg()), data.mood);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const petImg = data.noPet ? null : await loadImg(url);
    URL.revokeObjectURL(url);
    if (petImg) ctx.drawImage(petImg, 742, 120, 290, 310);

    // grade stamp
    const gy = 470;
    ctx.save(); ctx.translate(880, gy + 90); ctx.rotate(-0.2);
    ctx.beginPath(); ctx.arc(0, 0, 96, 0, Math.PI * 2); ctx.fillStyle = t.accent; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = t.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = t.accentInk; ctx.textAlign = 'center';
    ctx.font = `400 92px ${SERIF}`; ctx.fillText(data.grade[0], 0, 30);
    ctx.font = `500 17px ${MONO}`; ctx.fillText('GRADE', 0, -48);
    ctx.restore(); ctx.textAlign = 'left';
    ctx.fillStyle = t.ink; ctx.font = `600 40px ${HAND}`; ctx.textAlign = 'center'; ctx.fillText(data.grade[1], 880, gy + 232); ctx.textAlign = 'left';

    // stats
    const stats = [
      ['STUDIED', data.minutes], ['FOCUS', data.focus + '%'], ['QUIZ', data.quiz],
      ['NOTES', String(data.notes)], ['TAB ESCAPES', String(data.escapes)], ['XP EARNED', '+' + data.xp]
    ];
    const bx = 120, by = 470, bw = 196, bh = 138, gap = 22;
    stats.forEach(([k, v], i) => {
      const x = bx + (i % 3) * (bw + gap), y = by + Math.floor(i / 3) * (bh + gap);
      sketchRect(ctx, x, y, bw, bh, 18, t.paper2, t.ink, true);
      ctx.fillStyle = t.muted; ctx.font = `500 17px ${MONO}`; ctx.fillText(k, x + 18, y + 34);
      ctx.fillStyle = t.ink; ctx.font = `400 56px ${SERIF}`; ctx.fillText(v, x + 18, y + 104);
    });

    // roast
    const ry = 820;
    ctx.fillStyle = t.ink; ctx.font = `600 48px ${HAND}`;
    const rl = wrap(ctx, '“' + data.roast + '”', 860).slice(0, 3);
    rl.forEach((l, i) => ctx.fillText(l, 120, ry + i * 54));

    // learned
    let ly = ry + rl.length * 54 + 50;
    ctx.font = `400 40px ${SERIF}`; ctx.fillText('What I learned', 120, ly);
    ctx.save(); ctx.fillStyle = t.accent; ctx.globalAlpha = 0.65; ctx.fillRect(116, ly + 8, ctx.measureText('What I learned').width + 10, 12); ctx.restore();
    ly += 52;
    ctx.font = `500 27px ${SANS}`;
    (data.learned || []).slice(0, 3).forEach((x) => {
      const lines = wrap(ctx, PMd.plain(x), 820).slice(0, 2);
      ctx.fillText('•', 120, ly);
      lines.forEach((l, i) => ctx.fillText(l, 150, ly + i * 34));
      ly += lines.length * 34 + 14;
    });

    // footer
    ctx.fillStyle = t.ink; ctx.fillRect(0, H - 96, W, 96);
    ctx.fillStyle = t.paper; ctx.font = `400 44px ${SERIF}`; ctx.fillText('piniso', 120, H - 36);
    ctx.font = `500 21px ${MONO}`; ctx.fillStyle = t.accent;
    ctx.fillText(`LVL ${data.level} · ${data.levelTitle.toUpperCase()} · 🔥 ${data.streak}-DAY STREAK`, 290, H - 42);
    return c;
  }

  async function show(app, sum) {
    const sess = app.session, st = app.stats || {};
    const qs = (sess.quizzes || []).flatMap((q) => q.items);
    const right = qs.filter((x) => x.correct).length;
    const focus = app.focusScore();
    const quizPct = qs.length ? Math.round(right / qs.length * 100) : null;
    const lvl = PINISO.levelFromXP(st.xp || 0);
    const data = {
      title: (sum && sum.title) || sess.title,
      minutes: PZ.fmtDur(sess.watchSeconds),
      focus, quiz: qs.length ? `${right}/${qs.length}` : '—',
      notes: sess.notes.length, escapes: sess.awayCount || 0, xp: sess.xpEarned || 0,
      grade: grade(focus, quizPct),
      roast: (sum && sum.roast) || localRoast(app, focus, quizPct),
      learned: (sum && sum.recap) || sess.notes.filter((n) => n.kind !== 'user').slice(-3).map((n) => n.text),
      level: lvl, levelTitle: PINISO.levelTitle(lvl), streak: PStore.streak(st),
      mood: focus >= 80 ? 'celebrate' : focus >= 60 ? 'proud' : 'nervous'
    };
    let canvas = await draw(app, data), url;
    try { url = canvas.toDataURL('image/png'); }
    catch (e) { data.noPet = true; canvas = await draw(app, data); url = canvas.toDataURL('image/png'); }
    PAudio.sfx('stamp');
    const box = h('div.modal.paper');
    const left = h('div', null, h('img.rc', { src: url, alt: 'Report card' }));
    const right2 = h('div');
    right2.append(h('h3.sec', { html: 'Your <em>report card</em>' }), h('div.hand', { text: data.grade[0] + ' — ' + data.grade[1], style: { marginBottom: '8px' } }));
    if (sum && sum.cheer) right2.append(h('p', { text: sum.cheer }));
    if (sum && sum.recap && sum.recap.length) { right2.append(h('b', { text: 'Recap' })); const ul = h('ul'); sum.recap.forEach((x) => ul.append(h('li', { html: PMd.inline(x) }))); right2.append(ul); }
    if (sum && sum.weak && sum.weak.length) { right2.append(h('b', { text: 'Revise these' })); const ul = h('ul'); sum.weak.forEach((x) => ul.append(h('li', { html: PMd.inline(x) }))); right2.append(ul); }
    // 14. focus replay: how the session actually went
    const log = (sess.focusLog || []).filter((x) => ['watch', 'paused', 'away'].includes(x.type));
    if (log.length > 1) {
      const end = Date.now(), t0 = log[0].at, total = Math.max(1, end - t0);
      const col = { watch: '#3BB273', paused: '#C9C2B2', away: '#FF5D5D' };
      const sum2 = { watch: 0, paused: 0, away: 0 };
      const bar = h('div.fbar');
      log.forEach((x, i) => { const d = (log[i + 1] ? log[i + 1].at : end) - x.at; sum2[x.type] += d; bar.append(h('i', { style: { width: (d / total * 100).toFixed(2) + '%', background: col[x.type] }, title: x.type + ' · ' + Math.round(d / 60000) + ' min at ' + PZ.fmt(x.t) })); });
      const rw = (sess.focusLog || []).filter((x) => x.type === 'rewind').length;
      const m = (k) => Math.round(sum2[k] / 60000);
      right2.append(h('div.frep', null, h('b', { text: 'Focus replay' }), bar,
        h('div.leg', { html: `<span><b style="background:${col.watch}"></b>watching ${m('watch')}m</span><span><b style="background:${col.paused}"></b>paused ${m('paused')}m</span><span><b style="background:${col.away}"></b>other tabs ${m('away')}m</span>${rw ? `<span>⏪ ${rw} rewinds</span>` : ''}` })));
    }
    const btns = h('div.row.wrap', { style: { marginTop: '12px' } });
    btns.append(
      h('button.btn.pri', { html: I('download', 15) + 'Download PNG', onclick: () => { const a = document.createElement('a'); a.href = url; a.download = `piniso-report-${Date.now()}.png`; a.click(); app.ui.toast('Saved! Post it and tag your study gang 😎'); } }),
      h('button.btn', { html: I('copy', 15) + 'Copy image', onclick: () => copyImage(canvas, app) }),
      h('button.btn', { html: I('print', 15) + 'Notes PDF', onclick: () => app.exportNotes('pdf') }),
      h('button.btn', { text: '🤡 Make a meme', onclick: () => { ov.close(); PZ.Extras.meme(app); } }),
      h('button.btn', { text: '📸 Share card', title: 'A pretty image of today’s top 3 learnings', onclick: () => app.plus.shareCard(sum) }),
      h('button.btn', { text: '🔊 Listen to recap', onclick: (e) => { const b = e.currentTarget; if (b.dataset.on) { app.plus.stopSpeak(); b.textContent = '🔊 Listen to recap'; delete b.dataset.on; return; } const text = [(sum && sum.title) || sess.title, ...((sum && sum.recap) || data.learned), ...((sum && sum.cheatsheet) || [])].map((x) => PMd.plain(String(x))).join('. '); if (app.plus.speak(text)) { b.dataset.on = 1; b.textContent = '⏹ Stop'; } } })
    );
    right2.append(btns);
    box.append(h('div.cols', null, left, right2), h('button.ib.xbtn', { html: I('close', 17), onclick: () => ov.close() }));
    const ov = app.ui.overlay(box, { clickOut: true, onClose: () => app.plus.stopSpeak() });
    if (data.grade[0].startsWith('A')) app.ui.confetti();
  }

  function copyImage(canvas, app) {
    canvas.toBlob(async (b) => {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); app.ui.toast('Copied! Paste it in WhatsApp / Insta 📋'); }
      catch (e) { app.ui.toast('Copy not allowed here — use Download instead.'); }
    }, 'image/png');
  }

  function localRoast(app, focus, quizPct) {
    const L = app.lang();
    const hi = L === 'hindi';
    if (focus >= 90) return hi ? 'इतना फोकस? फ़ोन भी शर्मिंदा है 😎' : L === 'hinglish' ? 'Itna focus? Phone bhi sharma gaya 😎' : 'So focused even your phone felt ignored 😎';
    if (focus >= 70) return L === 'hinglish' ? 'Thoda bhatke, par wapas aa gaye. Respect 🫡' : 'Wandered a bit, came back strong 🫡';
    if (quizPct != null && quizPct >= 80) return L === 'hinglish' ? 'Tab badalte rahe phir bhi quiz phod diya 🤯' : 'Kept switching tabs and STILL aced the quiz 🤯';
    return L === 'hinglish' ? 'Reels ne aaj jeet liya... kal hum jeetenge 💪' : 'Reels won today... tomorrow is ours 💪';
  }

  PZ.Report = { show, draw, grade };
})();
