/* Piniso — timeline awareness: where the student is in the lecture, chapters, topics,
   and the "range" the student picks for quizzes, Ask and voice (not a fixed last-2-minutes). */
(() => {
  if (PZ.Timeline) return;

  // YouTube chapters (from the chapter list in the description, or plain timestamps in the description)
  function ytChapters() {
    const out = [];
    const toSec = (s) => String(s).trim().split(':').map(Number).reduce((a, x) => a * 60 + x, 0);
    document.querySelectorAll('ytd-macro-markers-list-item-renderer').forEach((el) => {
      const title = (el.querySelector('#details h4, h4') || {}).textContent;
      const time = (el.querySelector('#time') || {}).textContent;
      if (title && time && /\d+:\d{2}/.test(time)) out.push({ t: toSec(time.trim()), title: title.trim() });
    });
    if (out.length < 2) {
      out.length = 0;
      const d = document.querySelector('#description-inline-expander, ytd-text-inline-expander, #description');
      const text = d ? d.innerText || '' : '';
      text.split('\n').forEach((line) => {
        const m = line.trim().match(/^(?:[-•▶►]\s*)?((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—:|)]?\s*(.{2,90})$/);
        if (m) out.push({ t: toSec(m[1]), title: m[2].trim() });
      });
      if (out.length && out[0].t > 15) out.length = 0; // real chapter lists start at 0:00
    }
    const seen = new Set();
    return out.filter((c) => { const k = c.t; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t - b.t).slice(0, 80);
  }

  // keep at most maxWords, spread evenly over the whole range (not only the end)
  function sample(text, maxWords) {
    const lines = String(text || '').split('\n').filter(Boolean);
    const total = lines.reduce((a, l) => a + l.split(/\s+/).length, 0);
    if (total <= maxWords) return lines.join('\n');
    const keep = Math.max(0.05, maxWords / total);
    const out = []; let acc = 0;
    lines.forEach((l) => { acc += keep; if (acc >= 1) { acc -= 1; out.push(l); } });
    return out.join('\n');
  }

  class Timeline {
    constructor(app) { this.app = app; this._ch = null; this._chKey = ''; this._chAt = 0; }

    chapters() {
      const app = this.app;
      const key = app.session ? app.session.key : '';
      if (PZ.site() !== 'youtube') return (app.session && app.session.chapters) || [];
      if (this._chKey === key && this._ch && (this._ch.length || Date.now() - this._chAt < 20000)) return this._ch;
      this._chKey = key; this._chAt = Date.now();
      this._ch = ytChapters();
      if (app.session && this._ch.length) app.session.chapters = this._ch;
      return this._ch;
    }
    chapterAt(t) {
      const ch = this.chapters();
      let i = -1;
      ch.forEach((c, j) => { if (c.t <= t + 1) i = j; });
      return i >= 0 ? { i, of: ch.length, title: ch[i].title, t: ch[i].t, next: ch[i + 1] || null } : null;
    }
    // topics in teaching order, built from the notes the student has reached
    topics() {
      const out = [];
      this.app.visibleNotes().filter((n) => !n.pending).slice().sort((a, b) => a.t - b.t).forEach((n) => {
        const tp = n.topic || 'Intro';
        const last = out[out.length - 1];
        if (last && last.topic === tp) { last.t1 = Math.max(last.t1, n.t); last.n++; }
        else {
          const prev = out.find((x) => x.topic === tp);
          if (prev) { prev.t1 = Math.max(prev.t1, n.t); prev.n++; } else out.push({ topic: tp, t0: n.t, t1: n.t, n: 1 });
        }
      });
      return out;
    }
    // one paragraph that tells the AI exactly where the student is
    // can we use the WHOLE video, including parts not watched yet? (full captions or a chapter list)
    fullReady() {
      const app = this.app, v = app.video, t = v ? v.t : 0;
      const capEnd = app.tx && app.tx.store ? app.tx.store.lastEnd() : 0;
      const captions = capEnd > t + 90;
      return { ok: captions || this.chapters().length >= 2, captions, capEnd };
    }
    // every topic the notes know about, including parts written ahead (only for "whole video")
    allTopics() {
      const sess = this.app.session, out = [];
      ((sess && sess.notes) || []).filter((n) => !n.pending).slice().sort((a, b) => a.t - b.t).forEach((n) => {
        const tp = n.topic || 'Intro', prev = out.find((x) => x.topic === tp);
        if (prev) { prev.t1 = Math.max(prev.t1, n.t); prev.n++; } else out.push({ topic: tp, t0: n.t, t1: n.t, n: 1 });
      });
      return out;
    }
    whereAmI(full) {
      const app = this.app, v = app.video, sess = app.session;
      if (!sess) return '';
      const t = v ? v.t : 0, d = v && v.d && isFinite(v.d) ? v.d : 0;
      const ch = this.chapterAt(t);
      const tps = this.topics();
      const parts = [`Student is at ${PZ.fmt(t)}${d ? ' of ' + PZ.fmt(d) + ' (' + Math.round((t / d) * 100) + '% through)' : ''}${v && v.paused ? ', video paused' : ''}.`];
      if (ch) parts.push(`Current chapter (${ch.i + 1}/${ch.of}): "${ch.title}" from ${PZ.fmt(ch.t)}${ch.next ? `; next chapter "${ch.next.title}" at ${PZ.fmt(ch.next.t)}` : ''}.`);
      if (sess.topic) parts.push(`Topic right now: ${sess.topic}.`);
      if (tps.length) parts.push('Topics covered so far: ' + tps.slice(-12).map((x) => `${x.topic} (${PZ.fmt(x.t0)}–${PZ.fmt(x.t1)})`).join('; ') + '.');
      const ch2 = this.chapters();
      if (ch2.length) parts.push('All chapters: ' + ch2.slice(0, 30).map((c) => `${PZ.fmt(c.t)} ${c.title}`).join(' | ') + '.');
      const weak = (sess.quizzes || []).flatMap((q) => q.items || []).filter((x) => !x.correct).slice(-4).map((x) => PMd.plain(x.q).slice(0, 80));
      if (weak.length) parts.push('Recently got wrong: ' + weak.join(' / ') + '.');
      if (full) parts.push('The student CHOSE the whole video, including parts not watched yet — you may use them. When you use a later part, say where it comes (timestamp) so they can find it.');
      else parts.push('Do NOT reveal or assume things from parts of the video the student has not reached yet. If they ask about later parts, say it comes later and that they can pick "Whole video" to include it.');
      return parts.join('\n');
    }

    // scopes: 'now' | 'since' | 'm5' | 'm10' | 'm20' | 'all' | 'topic:<name>' | 'chapter:<i>' | 'range:<a>-<b>'
    range(scope) {
      const app = this.app, sess = app.session, t = app.video ? app.video.t : 0;
      scope = scope || 'now';
      const out = (t0, t1, label) => ({ t0: Math.max(0, Math.min(t0, t1)), t1: Math.max(t0, t1), label, scope });
      if (scope === 'now') return out(t - 240, t, 'around now');
      if (scope === 'since') {
        let t0 = Math.max(sess.lastQuizAt || 0, 0);
        if (t - t0 < 90) t0 = t - 300;
        return out(t0, t, 'since your last quiz (' + PZ.fmt(Math.max(0, t0)) + '–' + PZ.fmt(t) + ')');
      }
      const m = scope.match(/^m(\d+)$/);
      if (m) return out(t - +m[1] * 60, t, 'the last ' + m[1] + ' minutes');
      if (scope === 'all') return out(0, t, 'the whole video so far');
      if (scope === 'full') {
        const d = app.video && app.video.d && isFinite(app.video.d) ? app.video.d : 0;
        const F = this.fullReady();
        return Object.assign(out(0, Math.max(d, F.capEnd, t), 'the whole video (including parts not watched yet)'), { full: true });
      }
      if (scope.startsWith('topic:')) {
        const name = scope.slice(6), tp = this.topics().find((x) => x.topic === name);
        if (tp) return out(tp.t0 - 40, Math.min(t, tp.t1 + 40), 'the topic “' + name + '”');
        const fut = this.allTopics().find((x) => x.topic === name); // a later topic the student picked on purpose
        if (fut) return Object.assign(out(fut.t0 - 40, fut.t1 + 40, 'the topic “' + name + '” (not watched yet)'), { full: true });
      }
      if (scope.startsWith('chapter:')) {
        const ch = this.chapters(), i = +scope.slice(8), c = ch[i];
        if (c && c.t > t + 1) return Object.assign(out(c.t, ch[i + 1] ? ch[i + 1].t : Math.max(c.t + 600, this.fullReady().capEnd), 'chapter “' + c.title + '” (not watched yet)'), { full: true });
        if (c) return out(c.t, Math.min(t, ch[i + 1] ? ch[i + 1].t : t), 'chapter “' + c.title + '”');
      }
      const r = scope.match(/^range:(\d+)-(\d+)$/);
      if (r) return out(+r[1], Math.min(t, +r[2]), PZ.fmt(+r[1]) + '–' + PZ.fmt(Math.min(t, +r[2])));
      return out(t - 240, t, 'around now');
    }
    // the transcript + notes for a range, sized for an AI prompt
    context(scope, maxWords = 1100) {
      const app = this.app, R = this.range(scope);
      const raw = app.tx ? app.tx.text(R.t0, R.t1, true) : '';
      const pool = R.full ? ((app.session && app.session.notes) || []) : app.visibleNotes();
      const notes = pool.filter((n) => !n.pending && n.t >= R.t0 - 20 && n.t <= R.t1 + 5);
      let text = sample(raw, R.full ? Math.round(maxWords * 1.5) : maxWords);
      if (R.full) {
        const F = this.fullReady();
        if (!F.captions) {
          const dEl = PZ.site() === 'youtube' ? document.querySelector('#description-inline-expander, ytd-text-inline-expander, #description') : null;
          const desc = dEl ? String(dEl.innerText || '').trim().slice(0, 1500) : '';
          text += `\n(Transcript is only available up to ${PZ.fmt(F.capEnd)}. For later parts use the chapter list above${desc ? ' and this video description' : ''}.)` + (desc ? '\nVIDEO DESCRIPTION:\n' + desc : '');
        }
      }
      return Object.assign(R, { text, notes, where: this.whereAmI(!!R.full) });
    }
    // choices shown to the student
    scopeChoices(kind) {
      const F = this.fullReady();
      const base = kind === 'ask'
        ? [['now', '📍 Around now'], ['m10', 'Last 10 min'], ['all', 'Watched so far']]
        : [['since', 'Since last quiz'], ['m5', 'Last 5 min'], ['m15', 'Last 15 min'], ['all', 'Watched so far']];
      if (F.ok) base.push(['full', '🎬 Whole video']);
      if (kind === 'ask') base.push(['library', '📚 All my videos']);
      const t = this.app.video ? this.app.video.t : 0;
      const chs = this.chapters();
      let topics;
      if (chs.length) {
        topics = chs.filter((c) => c.t <= t + 1).slice(-10).map((c) => ['chapter:' + chs.indexOf(c), '🔖 ' + c.title]);
        if (F.ok) chs.filter((c) => c.t > t + 1).slice(0, 12).forEach((c) => topics.push(['chapter:' + chs.indexOf(c), '⏩ ' + c.title + ' (later)']));
      } else {
        const seen = this.topics();
        topics = seen.slice(-10).map((x) => ['topic:' + x.topic, '📘 ' + x.topic]);
        if (F.ok) this.allTopics().filter((x) => !seen.some((y) => y.topic === x.topic)).slice(0, 10).forEach((x) => topics.push(['topic:' + x.topic, '⏩ ' + x.topic + ' (later)']));
      }
      return { base, topics, full: F };
    }
  }
  Timeline.sample = sample;
  PZ.Timeline = Timeline;
})();
