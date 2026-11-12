/* Piniso — tiny safe Markdown + KaTeX renderer. Output is always escaped HTML. */
(() => {
  if (globalThis.PMd) return;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function math(tex, display) {
    try {
      if (globalThis.katex) {
        return globalThis.katex.renderToString(tex, { throwOnError: false, displayMode: !!display, output: 'html', strict: 'ignore', trust: false });
      }
    } catch (e) { /* fall through */ }
    return `<code class="pz-math">${esc(tex)}</code>`;
  }

  function inline(text) {
    const slots = [];
    const keep = (html) => { slots.push(html); return `\u0000${slots.length - 1}\u0000`; };
    let t = String(text == null ? '' : text);
    // math first (raw text)
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => keep(math(m.trim(), true)));
    t = t.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => keep(math(m.trim(), true)));
    t = t.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => keep(math(m.trim(), false)));
    t = t.replace(/(^|[^\\$\w])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g, (_, pre, m) => pre + keep(math(m, false)));
    t = t.replace(/`([^`\n]+)`/g, (_, m) => keep(`<code>${esc(m)}</code>`));
    t = esc(t);
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<mark class="pz-hl">$1</mark>');
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
    t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
    t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
    return t;
  }

  function render(text) {
    const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n');
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    let table = null;
    const closeTable = () => { if (table) { out.push('<table class="pz-tbl">' + table.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + inline(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table>'); table = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if (/^\s*\|.*\|\s*$/.test(line)) {
        close();
        const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        (table = table || []).push(cells);
        continue;
      }
      closeTable();
      if (!line.trim()) { close(); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${inline(m[1])}</li>`);
      } else if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        close(); out.push(m[1].length >= 3 ? `<h5>${inline(m[2])}</h5>` : `<h4>${inline(m[2])}</h4>`);
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      } else {
        close(); out.push(`<p>${inline(line)}</p>`);
      }
    }
    close(); closeTable();
    return out.join('');
  }

  // strip markdown / emoji for TTS or plain export
  const plain = (s) => String(s || '')
    .replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\*\*|__|`/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();

  globalThis.PMd = { esc, inline, render, plain, math };
})();
