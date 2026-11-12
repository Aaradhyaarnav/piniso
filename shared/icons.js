/* Piniso — inline stroke icon set (24x24, uses currentColor). */
(() => {
  if (globalThis.PIcons) return;
  const P = {
    notes: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>',
    chat: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5H4.5z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.6"/>',
    quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><path d="M12 16.6h.01" stroke-width="2.6"/>',
    camera: '<path d="M4 8h3.2l1.6-2.5h6.4L16.8 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
    music: '<path d="M9 17.5V6l10-2v11"/><circle cx="6.8" cy="17.5" r="2.3"/><circle cx="16.8" cy="15" r="2.3"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    minus: '<path d="M5 12h14"/>',
    play: '<path d="M7.5 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M5 19.5h14"/>',
    copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="1.5"/><path d="M15.5 8V4.5h-11v11H8"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    edit: '<path d="M4.5 19.5l1-4.5 10-10 3.5 3.5-10 10z"/><path d="M13.5 7l3.5 3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    send: '<path d="M4 11.5l16-7-6.5 16-2.5-6.5z"/><path d="M11 14l9-9.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 9.5v4l2.5 2M9.5 3.5h5"/>',
    flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.2 2.6-4.8 3.4-8.4 1.9 1.4 2.5 3 2.6 4.6.9-.8 1.5-2 1.6-3.6 2.4 1.8 4.4 4.3 4.4 7.4 0 3.2-2.4 5.6-6 5.6z"/>',
    bolt: '<path d="M13.5 3L5.5 13.5h6L10.5 21l8-10.5h-6z"/>',
    headphones: '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 6 8.5 6a15 15 0 0 1-2.6 3.2M6.6 7.7C4.6 9.3 3.5 12 3.5 12s3.5 6 8.5 6c1.4 0 2.7-.4 3.8-1"/>',
    sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    cards: '<rect x="3.5" y="7" width="12" height="13" rx="1.5"/><path d="M8 7V4.5h12.5v13H15.5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevdown: '<path d="M6 9l6 6 6-6"/>',
    volume: '<path d="M4.5 9.5h3.5L12.5 5.5v13L8 14.5H4.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4.5 9.5h3.5L12.5 5.5v13L8 14.5H4.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    brain: '<path d="M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2.5V4.5zM14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5V4.5z"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M8.5 14.5a5.5 5.5 0 1 1 7 0c-.8.7-1 1.4-1 3h-5c0-1.6-.2-2.3-1-3z"/>',
    trophy: '<path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6.5H4.5a3 3 0 0 0 3 4M16.5 6.5h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5z"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.8-1 1.3-2-.6-1.3.1-2.5 1.6-2.5h2a3.6 3.6 0 0 0 3.6-3.6C20.5 7.3 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.4" r="1.1"/><circle cx="15" cy="7.6" r="1.1"/>',
    book: '<path d="M4.5 5.5c2.5-1 5-1 7.5.5v14c-2.5-1.5-5-1.5-7.5-.5zM19.5 5.5c-2.5-1-5-1-7.5.5v14c2.5-1.5 5-1.5 7.5-.5z"/>',
    shield: '<path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6.5z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M17.5 10h.01M7.5 14h9" stroke-width="2.2"/>',
    home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    ear: '<path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.5 3.5-3 6s-1.5 4-3.5 4-3-1.5-3-3"/><path d="M10 10a2 2 0 0 1 4 0c0 1.5-1.5 1.8-1.5 3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
    share: '<circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    pip: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><rect x="11.5" y="11.5" width="7" height="5.5" rx="1"/>',
    shieldx: '<path d="M12 3.5l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6.5z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
    tv: '<rect x="3.5" y="5.5" width="17" height="12" rx="2.5"/><path d="M8.5 21h7M10.5 9.5l4 2.5-4 2.5z"/>',
    coffee: '<path d="M5 9h11v5.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1 1 1 1 2s-1 1-1 2M12 3.5c0 1 1 1 1 2s-1 1-1 2"/>'
  };
  function svg(name, size = 18, extra = '') {
    const d = P[name] || P.sparkle;
    return `<svg class="pz-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  }
  globalThis.PIcons = { svg, names: Object.keys(P) };
})();
