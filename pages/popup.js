/* Piniso popup */
(async () => {
  const { h, I } = PU;
  const s = await PStore.settings();
  const st = await PStore.stats();
  PU.applyTheme(s);
  const pet = PinisoPet.create(document.getElementById('pet'), Object.assign(PU.petCfg(s), { size: 62 }));
  document.getElementById('name').textContent = s.pet.name || 'Piniso';
  document.getElementById('gear').innerHTML = I('gear', 18);
  document.getElementById('gear').onclick = () => openDash('');
  document.getElementById('dash').onclick = () => openDash('');
  const hr = new Date().getHours();
  document.getElementById('hello').textContent = hr < 5 ? 'still awake? 🌙' : hr < 12 ? 'good morning! ☀️' : hr < 17 ? 'afternoon grind 💪' : hr < 21 ? 'evening study time 📚' : 'night owl mode 🦉';
  pet.setMood('happy', 1800);

  function openDash(hash) { chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html' + (hash ? '#' + hash : '')) }); window.close(); }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let info = null;
  if (tab && tab.id) { try { info = await chrome.tabs.sendMessage(tab.id, { type: 'ping' }, { frameId: 0 }); } catch (e) { info = null; } }
  const listen = tab ? await PU.bg({ type: 'stt:status', tabId: tab.id }) : null;
  const wrap = document.getElementById('wrap');
  const a = s.ai;
  const hasKey = a.provider === 'custom' ? !!a.customBaseUrl : !!(a.keys[a.provider] || '').trim();

  const devOK = a.device !== false && ((await PStore.get('deviceAI')).deviceAI || {}).status === 'available';
  if (!hasKey && devOK) wrap.append(h('div.warn.ok', { html: '🖥️ <span class="sp">Using the AI built into Chrome (no key). Add a free key for smarter notes.</span>' }, h('button.btn.sm', { text: 'Add', onclick: () => openDash('brain') })));
  if (!hasKey && !devOK) {
    wrap.append(h('div.warn', { html: I('bolt', 16) + '<span class="sp">Add a free API key so I can make notes & quizzes.</span>' }, h('button.btn.sm', { text: 'Add', onclick: () => openDash('brain') })));
  }

  const send = (cmd, extra) => tab && chrome.tabs.sendMessage(tab.id, Object.assign({ type: 'cmd', cmd }, extra || {}), { frameId: 0 }).catch(() => {});

  if (info && info.active) {
    const box = h('div.now.paper');
    box.append(h('div.row', null, h('span.pill.' + (info.listen ? 'acc' : 'ok'), { text: info.status || 'Watching' }), h('span.sp'), h('span.small.muted', { text: `${info.minutes} min · ${info.notes} notes · ${info.focus}% focus` })));
    box.append(h('div.t', { style: { marginTop: '8px' }, text: info.title || 'Lecture' }));
    const acts = h('div.acts');
    const listenOn = listen && listen.on;
    acts.append(
      h('button.btn' + (info.listen && !listenOn ? '.pri.full' : '.full'), {
        html: I('headphones', 15) + (listenOn ? 'Stop listening to audio' : 'Listen to this video’s audio'),
        title: 'For videos without captions (Unacademy etc.)',
        onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          const r = await PU.bg({ type: listenOn ? 'stt:stop' : 'stt:start', tabId: tab.id });
          if (r && r.ok === false) { b.disabled = false; PU.toast(r.error || 'Could not start'); } else window.close();
        }
      }),
      h('button.btn.pri.full.hero', { html: '✨ All Piniso tools', title: 'Meme maker, PDF booklet, voice quiz, doubt snipe… everything', onclick: () => { send('magic'); window.close(); } }),
      h('button.btn', { html: I('notes', 15) + 'Notes', onclick: () => { send('open-desk', { tab: 'notes' }); window.close(); } }),
      h('button.btn', { html: I('quiz', 15) + 'Quiz me', onclick: () => { send('open-desk', { tab: 'quiz' }); window.close(); } }),
      h('button.btn', { html: I('mic', 15) + 'Talk', onclick: () => { send('talk'); window.close(); } }),
      h('button.btn', { html: I('flag', 15) + 'I’m lost', onclick: () => { send('tool', { id: 'lost' }); window.close(); } }),
      h('button.btn.full', { html: I('trophy', 15) + 'Finish & report card', onclick: () => { send('finish'); window.close(); } })
    );
    box.append(acts);
    wrap.append(box);
  } else if (tab && /^https?:/.test(tab.url || '')) {
    const box = h('div.now.paper');
    box.append(h('div.hand', { text: info && info.hasVideo === false ? 'No lecture video here yet 👀' : 'Don’t just watch it — Piniso it.' }),
      h('div.small.muted', { style: { margin: '2px 0 10px' }, text: 'I work on YouTube, Unacademy, PW, Khan Academy, Coursera, Udemy and more. On other sites, start me here:' }),
      h('button.btn.pri.wide.hero', {
        html: '✨ Piniso it',
        title: 'Turn on notes, quizzes & flashcards for the video on this page',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          let ok = !!(info && info.ok);
          if (!ok) { const r = await PU.bg({ type: 'inject', tabId: tab.id }); ok = r && r.ok; }
          if (ok) { setTimeout(() => send('piniso-it'), ok && info ? 50 : 600); setTimeout(() => window.close(), 700); } else PU.toast('Could not start on this page');
        }
      }));
    wrap.append(box);
  } else {
    wrap.append(h('div.now.paper', null, h('div.hand', { text: 'Open a lecture video 📺' }), h('div.small.muted', { text: 'I pop up automatically on YouTube, Unacademy and other study sites.' })));
  }

  // continue studying (last study videos, each with its own notes + chat)
  const recent = (await PStore.listSessions()).filter((r) => r.study !== false && (r.notes > 0 || r.watch > 60) && !(info && info.active && info.key === r.key)).slice(0, 3);
  if (recent.length) {
    const cb = h('div.cont.paper');
    cb.append(h('div.small.muted', { style: { marginBottom: '6px', fontWeight: 700 }, text: 'CONTINUE STUDYING' }));
    recent.forEach((r) => {
      const url = r.vid ? `https://www.youtube.com/watch?v=${encodeURIComponent(r.vid)}${r.lastT > 20 ? '&t=' + Math.max(0, r.lastT - 3) + 's' : ''}` : r.url;
      const pct = r.dur && r.lastT ? Math.min(100, Math.round(r.lastT / r.dur * 100)) : 0;
      cb.append(h('button.crow', { title: r.title, onclick: () => { chrome.tabs.create({ url }); window.close(); } },
        h('span.ct', { text: r.title }), h('span.cm', { text: (r.lastT > 20 ? '▶ ' + PU.fmt(r.lastT) : '▶') + (r.notes ? ' · ' + r.notes + ' notes' : '') }),
        pct ? h('i.cp', { style: { width: pct + '%' } }) : null));
    });
    wrap.append(cb);
  }
  const anyBtn = h('button.btn.wide', { html: I('pip', 15) + 'Study a desktop app / any window', onclick: () => { chrome.tabs.create({ url: chrome.runtime.getURL('pages/anywhere.html') }); window.close(); } });
  // 🎯 daily mission (+ exam countdown)
  {
    const due0 = await PStore.dueCount();
    const M = PStore.mission(st, s, due0);
    const mb = h('div.mis.paper');
    mb.append(h('div.mh', null, h('b', { text: '🎯 Today’s mission' }), h('span.small.muted', { text: M.allDone ? 'done! +50 XP 🎉' : M.filter((x) => x.done).length + '/3' })));
    M.forEach((x) => mb.append(h('button.mi' + (x.done ? '.done' : ''), {
      onclick: () => { if (x.id === 'cards') chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#revise') }); else if (x.id === 'quiz' && info && info.active) send('quiz-now'); window.close(); }
    }, h('span', { text: x.done ? '✅' : x.icon }), h('span.ml', { text: x.label }), h('span.small.muted', { text: `${Math.min(x.have, x.need)}/${x.need}` }))));
    if (M.exam) mb.append(h('div.ex', { html: `📅 <b>${PU.esc(M.exam.name)}</b> in <b>${M.exam.days}</b> day${M.exam.days === 1 ? '' : 's'} — <a href="#" id="cram">night-before mode</a>` }));
    wrap.append(mb);
    const cl = mb.querySelector('#cram'); if (cl) cl.onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: chrome.runtime.getURL('pages/cram.html') }); };
  }
  // Guardian: clear status + a one-tap hard lock that works even without a video
  const G = (await PU.bg({ type: 'guardian:status' })) || {};
  const gBox = h('div.gcard.paper');
  const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const gLine = !G.enabled ? '🛡️ Guardian is <b>off</b>'
    : G.lockUntil ? `🔒 <b>Focus lock</b> until ${hm(G.lockUntil)}${G.strict ? ' (no unlocking)' : ''}`
    : G.on ? '🛡️ <b>Blocking</b> Instagram, Shorts & ' + Math.max(0, (G.sites || 1) - 1) + ' more'
    : G.when === 'always' ? '🛡️ Guardian on' : '🛡️ Guardian <b>ready</b> — starts when a lecture is open';
  gBox.append(h('div.gl', { html: gLine }));
  const lockRow = h('div.lrow');
  if (G.lockUntil) lockRow.append(h('button.btn.sm', { text: 'End lock', disabled: G.strict, title: G.strict ? 'Strict lock can’t be ended early' : '', onclick: async () => { await PU.bg({ type: 'guardian:lock', minutes: 0 }); location.reload(); } }));
  else {
    lockRow.append(h('span.small.muted', { text: 'Lock now:' }));
    [25, 50, 90].forEach((m) => lockRow.append(h('button.btn.sm', { text: m + ' min', onclick: async () => { await PU.bg({ type: 'guardian:lock', minutes: m, strict: strictCb.checked }); PU.toast('🔒 Locked for ' + m + ' min'); setTimeout(() => location.reload(), 700); } })));
  }
  const strictCb = h('input', { type: 'checkbox' });
  if (!G.lockUntil) lockRow.append(h('label.small', { title: 'No unlock passes until the lock ends' }, strictCb, ' strict'));
  gBox.append(lockRow);
  wrap.append(gBox);
  // today ring
  const today = (st.days[PStore.todayKey()] || 0) / 60;
  const goal = s.focus.dailyGoal || 60;
  const pct = Math.min(1, today / goal);
  const lvl = PINISO.levelFromXP(st.xp);
  const cur = PINISO.xpForLevel(lvl), nxt = PINISO.xpForLevel(lvl + 1);
  const due = await PStore.dueCount();
  const ring = `<svg class="ring" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="35" cy="35" r="28" fill="none" stroke="var(--ink)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(176 * pct).toFixed(1)} 176" transform="rotate(-90 35 35)"/><text x="35" y="40" text-anchor="middle" font-family="PinisoSerif,Georgia" font-size="17" fill="var(--ink)">${Math.round(pct * 100)}%</text></svg>`;
  const todayBox = h('div.today.paper', { html: ring });
  todayBox.append(h('div.sp', null,
    h('div', { html: `<b>${Math.round(today)}</b> <span class="muted">/ ${goal} min today</span>` }),
    h('div.small', { html: `🔥 <b style="font:inherit;font-weight:700">${PStore.streak(st)}</b>-day streak · Lv ${lvl} ${PU.esc(PINISO.levelTitle(lvl))}` }),
    (() => { const ST = [[0, '🌰', 'Seed'], [2, '🌱', 'Sprout'], [10, '🌿', 'Sapling'], [30, '📚', 'Scholar'], [80, '🦉', 'Sage'], [200, '👑', 'Legend']]; const hrs = (st.totalSeconds || 0) / 3600; let k = 0; ST.forEach((x, i) => { if (hrs >= x[0]) k = i; }); const n = ST[k + 1]; return h('div.small.muted', { text: `${ST[k][1]} Piniso is a ${ST[k][2]}` + (n ? ` · ${(n[0] - hrs).toFixed(1)} h to ${n[2]} ${n[1]}` : '') }); })(),
    h('div.bar', { style: { marginTop: '6px', height: '10px' }, html: `<i style="width:${Math.max(3, Math.min(100, (st.xp - cur) / (nxt - cur) * 100))}%"></i>` })
  ));
  wrap.append(todayBox);
  if (due > 0) wrap.append(h('button.btn.wide', { html: I('cards', 15) + `Revise ${due} flashcard${due > 1 ? 's' : ''} due`, onclick: () => openDash('revise') }));

  // toggles
  const tg = h('div.tg.paper', { style: { padding: '4px 14px' } });
  const host = tab && tab.url && /^https?:/.test(tab.url) ? new URL(tab.url).hostname : '';
  if (host) tg.append(PU.row('Piniso on ' + host.replace(/^www\./, ''), '', PU.sw(!(s.disabledSites || []).includes(host), async (v) => {
    const cur = await PStore.settings();
    const list = new Set(cur.disabledSites || []);
    if (v) list.delete(host); else list.add(host);
    await PStore.saveSettings({ disabledSites: [...list] });
  })));
  tg.append(PU.row('Quiz mode', 'pauses video for pop quizzes', PU.sw(s.quiz.enabled, (v) => PStore.saveSettings({ quiz: { enabled: v } }))));
  tg.append(PU.row('Zen mode', 'hide YouTube distractions', PU.sw(s.focus.zen, (v) => PStore.saveSettings({ focus: { zen: v } }))));
  const sel = h('select.inp', { style: { padding: '5px 8px', fontSize: '12.5px' } });
  PINISO.MUSIC_MODES.forEach(([k, lab]) => sel.append(h('option', { value: k, text: lab, selected: s.sound.music === k })));
  sel.onchange = () => PStore.saveSettings({ sound: { music: sel.value } });
  tg.append(PU.row('Study sound', '', sel));
  // less-used settings live behind one tap (keeps the popup short)
  const det = h('details.more.paper', null, h('summary', { text: '⚙️ Quick settings & more' }), tg, anyBtn,
    h('div.small.muted', { style: { textAlign: 'center', marginTop: '8px' }, html: 'Tap Piniso on a lecture = every tool · <span class="kbd">Alt+Shift+K</span>' }));
  wrap.append(det);
  // order: what to do now → today → focus → continue → stats
  const cont = wrap.querySelector('.cont');
  if (cont && todayBox.parentNode === wrap) wrap.insertBefore(cont, todayBox);
})();
