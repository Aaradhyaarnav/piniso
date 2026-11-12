/* Piniso PrintKit — real paper pages for printing and PDF.
   - paginate(): pours blocks (.blk) into fixed-size A4/Letter sheets, never cutting a block in half.
     Lists/tables marked .split are split item-by-item across pages; too-tall blocks shrink to fit.
   - downloadPDF(): one PDF page per sheet (html2canvas + jsPDF), with clickable links kept.
   - uni(): turns LaTeX-ish text (H^{+}, \rightarrow, CO_2) into clean Unicode for labels. */
(() => {
  const PAPER = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } };
  const MM = 96 / 25.4; // px per mm

  // ---------- text helpers ----------
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ' };
  const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', n: 'ₙ', m: 'ₘ' };
  const SYM = { rightarrow: '→', to: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftrightarrow: '⇔', rightleftharpoons: '⇌', times: '×', cdot: '·', div: '÷', pm: '±', approx: '≈', neq: '≠', ne: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥', propto: '∝', infty: '∞', degree: '°', circ: '°', Delta: 'Δ', delta: 'δ', alpha: 'α', beta: 'β', gamma: 'γ', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', omega: 'ω', Omega: 'Ω', phi: 'φ', sqrt: '√', partial: '∂', sum: 'Σ', int: '∫', uparrow: '↑', downarrow: '↓', ldots: '…', dots: '…', quad: ' ', ',': ' ' };
  function uni(t) {
    let s = String(t == null ? '' : t);
    s = s.replace(/\$+/g, '').replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1').replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2');
    s = s.replace(/\\([A-Za-z]+|,)/g, (m, w) => (SYM[w] != null ? SYM[w] : w));
    s = s.replace(/\^\{([^}]*)\}/g, (m, x) => [...x].map((c) => SUP[c] || c).join('')).replace(/\^([0-9+\-n])/g, (m, c) => SUP[c] || c);
    s = s.replace(/_\{([^}]*)\}/g, (m, x) => [...x].map((c) => SUB[c] || c).join('')).replace(/([A-Za-z\)])_([0-9])/g, (m, a, c) => a + (SUB[c] || c));
    s = s.replace(/\*\*|__|`/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    return s;
  }
  // wrap text to a pixel width using real font metrics
  const cvs = document.createElement('canvas').getContext('2d');
  function wrap(text, maxW, font, maxLines = 3) {
    cvs.font = font;
    const words = uni(text).split(' ');
    const lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (cvs.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); let last = keep[maxLines - 1]; while (last.length > 1 && cvs.measureText(last + '…').width > maxW) last = last.slice(0, -1); keep[maxLines - 1] = last.replace(/\s+\S*$/, '') + '…'; return keep; }
    return lines;
  }
  const textW = (t, font) => { cvs.font = font; return cvs.measureText(uni(t)).width; };

  // ---------- pagination ----------
  function makeSheet(o, n) {
    const p = PAPER[o.paper] || PAPER.A4;
    const s = document.createElement('div');
    s.className = 'sheet';
    s.style.width = p.w + 'mm'; s.style.height = p.h + 'mm';
    const body = document.createElement('div');
    body.className = 'sheet-body';
    body.style.padding = `${o.margin}mm ${o.margin}mm ${o.footer ? o.margin + 3 : o.margin}mm`;
    s.append(body);
    if (o.footer) {
      const f = document.createElement('div');
      f.className = 'sheet-foot';
      f.style.left = f.style.right = o.margin + 'mm';
      f.style.bottom = Math.max(4, o.margin - 7) + 'mm';
      f.innerHTML = `<span>${o.footer}</span><span class="pn"></span>`;
      s.append(f);
    }
    return { s, body };
  }
  const over = (body) => body.scrollHeight > body.clientHeight + 1;

  // blocks: array of elements with class .blk. Options: paper, margin(mm), footer(text), noFooterFirst
  function paginate(host, blocks, o) {
    host.innerHTML = '';
    host.classList.add('sheets');
    const sheets = [];
    let cur = null;
    const newSheet = () => { cur = makeSheet(o, sheets.length + 1); host.append(cur.s); sheets.push(cur.s); return cur; };
    newSheet();
    const empty = () => !cur.body.children.length;
    // move a block to a fresh page; a heading left alone above it goes along (no orphan headings)
    const moveToNew = (b) => {
      b.remove();
      if (empty()) { cur.body.append(b); return; }
      const carry = [];
      let prev = cur.body.lastElementChild;
      while (prev && prev.classList.contains('keepnext') && cur.body.children.length > carry.length + 1) { carry.unshift(prev); prev = prev.previousElementSibling; }
      carry.forEach((x) => x.remove());
      newSheet(); carry.forEach((x) => cur.body.append(x)); cur.body.append(b);
    };
    for (const b of blocks) {
      if (b.classList.contains('page-full')) { if (!empty()) newSheet(); cur.body.append(b); cur.s.classList.add('full'); newSheet(); continue; }
      if (b.dataset.break === 'before' && !empty()) newSheet();
      cur.body.append(b);
      if (b.classList.contains('fill')) {
        // grows to fill the rest of the page (needs at least its min-height)
        b.style.flex = '1 1 auto';
        if (over(cur.body)) { b.remove(); newSheet(); cur.body.append(b); }
        newSheet(); continue;
      }
      if (!over(cur.body)) continue;
      // doesn't fit
      if (b.classList.contains('split')) { splitInto(b); continue; }
      moveToNew(b);
      if (over(cur.body)) shrink(b, cur.body);
    }
    // drop empty sheets, number the rest
    const keep = sheets.filter((s) => s.querySelector('.sheet-body').children.length);
    sheets.filter((s) => !keep.includes(s)).forEach((s) => s.remove());
    keep.forEach((s, i) => { const pn = s.querySelector('.pn'); if (pn) pn.textContent = (i + 1) + ' / ' + keep.length; if (i === 0 && o.noFooterFirst) { const f = s.querySelector('.sheet-foot'); if (f) f.remove(); } });
    return keep;

    function splitInto(b) {
      // items = direct children marked .it ; the rest (titles) stays on the first part
      const items = [...b.querySelectorAll(':scope .it')];
      const list = items.length ? items[0].parentElement : null;
      if (!list || items.length < 2) { moveToNew(b); if (over(cur.body)) shrink(b, cur.body); return; }
      // remove items, add back one by one
      items.forEach((it) => it.remove());
      let part = b, plist = list, placed = 0;
      for (const it of items) {
        plist.append(it);
        if (over(cur.body)) {
          it.remove();
          if (!placed) { // not even one item fits here → whole block to the next page
            plist.append(it); moveToNew(part);
            if (over(cur.body)) shrink(part, cur.body);
            placed = 1; continue;
          }
          // continue on a new page with a copy of the block shell
          const shell = part.cloneNode(true);
          shell.querySelectorAll('.it').forEach((x) => x.remove());
          shell.classList.add('contd');
          const t = shell.querySelector('.bt'); if (t && !/contd/.test(t.textContent)) t.insertAdjacentHTML('beforeend', ' <small class="ctd">(contd.)</small>');
          newSheet(); cur.body.append(shell);
          part = shell; plist = shell.querySelector(listSelector(list)) || shell;
          plist.append(it);
          placed = 1;
          if (over(cur.body)) shrink(part, cur.body);
        } else placed++;
      }
    }
  }
  function listSelector(el) { return el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].join('.') : ''); }
  function shrink(b, body) {
    // a single block taller than a page: make its text smaller step by step (never below 70%), then cap pictures
    for (let z = 0.94; z >= 0.7 && over(body); z -= 0.06) b.style.fontSize = (z * 100).toFixed(0) + '%';
    if (over(body)) b.querySelectorAll('svg,img').forEach((g) => { g.style.maxHeight = Math.max(80, body.clientHeight * 0.5) + 'px'; g.style.width = 'auto'; g.style.maxWidth = '100%'; g.style.marginInline = 'auto'; g.style.display = 'block'; });
  }

  // ---------- PDF ----------
  async function downloadPDF(sheets, o, onProgress) {
    const { jsPDF } = window.jspdf;
    const p = PAPER[o.paper] || PAPER.A4;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [p.w, p.h], compress: true });
    if (o.title) pdf.setProperties({ title: o.title, creator: 'Piniso' });
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      onProgress && onProgress(i, sheets.length);
      const canvas = await window.html2canvas(s, { scale: o.scale || 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: document.documentElement.scrollWidth });
      if (i) pdf.addPage([p.w, p.h], 'p');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, p.w, p.h, undefined, 'FAST');
      // keep links clickable
      const sr = s.getBoundingClientRect();
      const k = p.w / sr.width;
      s.querySelectorAll('a[href^="http"]').forEach((a) => {
        const r = a.getBoundingClientRect();
        if (r.width && r.height) pdf.link((r.left - sr.left) * k, (r.top - sr.top) * k, r.width * k, r.height * k, { url: a.href });
      });
      await new Promise((r) => setTimeout(r, 0));
    }
    onProgress && onProgress(sheets.length, sheets.length);
    pdf.save((o.filename || 'piniso').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80) + '.pdf');
  }

  window.PrintKit = { PAPER, MM, uni, wrap, textW, paginate, downloadPDF };
})();
