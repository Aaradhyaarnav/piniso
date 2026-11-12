/* Piniso — the mascot. A squishy jelly blob holding a pencil.
   Pure SVG + JS physics (no images). Works in content scripts and extension pages. */
(() => {
  if (globalThis.PinisoPet) return;

  const VBW = 140, VBH = 150;
  const CX = 70, CY = 92, RX = 46, RY = 41, BASE_Y = 134;
  const EYE_L = [52, 82], EYE_R = [88, 82];

  const STYLE = `
  .pz-fx text{font-family:PinisoHand,'Comic Sans MS',cursive;font-weight:700}
  .pz-z{animation:pzZ 2.6s ease-in infinite;opacity:0}
  .pz-z.b{animation-delay:.85s}.pz-z.c{animation-delay:1.7s}
  @keyframes pzZ{0%{opacity:0;transform:translate(0,0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translate(16px,-28px) scale(1.25)}}
  .pz-tw{animation:pzTw 1.7s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  .pz-tw.b{animation-delay:.55s}.pz-tw.c{animation-delay:1.1s}
  @keyframes pzTw{0%,100%{opacity:.15;transform:scale(.45) rotate(0)}50%{opacity:1;transform:scale(1) rotate(25deg)}}
  .pz-up{animation:pzUp 2.2s ease-out infinite;opacity:0}
  .pz-up.b{animation-delay:.7s}.pz-up.c{animation-delay:1.4s}
  @keyframes pzUp{0%{opacity:0;transform:translateY(4px) scale(.7)}25%{opacity:1}100%{opacity:0;transform:translateY(-30px) scale(1.1)}}
  .pz-orbit{animation:pzOrbit 2.4s linear infinite;transform-origin:70px 52px}
  .pz-orbit.slow{animation-duration:9s}
  @keyframes pzOrbit{to{transform:rotate(360deg)}}
  .pz-bob{animation:pzBob 1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  @keyframes pzBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
  .pz-dot{animation:pzDot 1.2s ease-in-out infinite;opacity:.25}
  .pz-dot.b{animation-delay:.2s}.pz-dot.c{animation-delay:.4s}
  @keyframes pzDot{0%,100%{opacity:.25}40%{opacity:1}}
  .pz-fall{animation:pzFall 1.6s ease-in infinite;opacity:0}
  @keyframes pzFall{0%{opacity:0;transform:translateY(-10px) rotate(0)}15%{opacity:1}100%{opacity:0;transform:translateY(70px) rotate(300deg)}}
  .pz-wave{animation:pzWave 1.2s ease-out infinite;opacity:0}
  .pz-wave.b{animation-delay:.4s}
  @keyframes pzWave{0%{opacity:0;transform:translateX(0)}30%{opacity:1}100%{opacity:0;transform:translateX(8px)}}
  .pz-glow{animation:pzGlow 2.6s ease-in-out infinite}
  @keyframes pzGlow{0%,100%{opacity:.35}50%{opacity:.7}}
  .pz-steam{animation:pzSteam 1.4s ease-out infinite;opacity:0}
  .pz-steam.b{animation-delay:.5s}
  @keyframes pzSteam{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:.9}100%{opacity:0;transform:translateY(-14px) scale(1.2)}}
  `;

  // ---------------- geometry helpers ----------------
  function blobPath(t, amp, sx = 1, sy = 1) {
    const N = 12, pts = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 - Math.PI / 2;
      const w = 1 + amp * (0.6 * Math.sin(t * 1.7 + k * 1.31) + 0.4 * Math.sin(t * 2.9 + k * 2.17));
      const c = Math.cos(a), s = Math.sin(a);
      let x = CX + RX * c * w;
      // flatter, wider bottom = "sitting" jelly
      let y = s > 0 ? CY + RY * Math.pow(s, 0.72) * 0.98 * w : CY + RY * s * w * 1.02;
      if (s > 0.35) x = CX + RX * c * w * (1 + (s - 0.35) * 0.12);
      pts.push([x, y]);
    }
    let d = '';
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      if (i === 0) d += `M${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d + 'Z';
  }
  const star = (cx, cy, r, inner = 0.45, n = 5) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? r * inner : r;
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  };
  const heart = (cx, cy, s) => `M${cx} ${cy + s * 0.9}C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.8} ${cy - s * 1.3} ${cx} ${cy - s * 0.45}C${cx + s * 0.8} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;
  const spark4 = (cx, cy, r) => `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;

  // ---------------- parts ----------------
  function eyeMarkup(style, expr, c) {
    const o = c.outline;
    const W = '#FFFFFF';
    switch (expr) {
      case 'happy': return `<path d="M-8 3Q0-8 8 3" fill="none" stroke="${o}" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'closed': return `<path d="M-8 0Q0 5 8 0" fill="none" stroke="${o}" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'heart': return `<path d="${heart(0, 0, 8)}" fill="#FF4D6D" stroke="${o}" stroke-width="2"/>`;
      case 'star': return `<path d="${star(0, 0, 10, 0.48)}" fill="${c.pencil}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>`;
      case 'spiral': return `<path d="M0 0m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-6 0a5 5 0 1 1 10 0a7 7 0 1 1-14 0" fill="none" stroke="${o}" stroke-width="2.2" stroke-linecap="round"/>`;
      case 'wide': return `<ellipse rx="11" ry="12" fill="${W}" stroke="${o}" stroke-width="2.6"/><g class="pz-pupil"><circle r="3.2" fill="${o}"/></g>`;
      case 'cross': return `<path d="M-6-6L6 6M6-6L-6 6" stroke="${o}" stroke-width="3.2" stroke-linecap="round"/>`;
      default: break;
    }
    // open eyes in chosen style
    switch (style) {
      case 'dot': return `<g class="pz-pupil"><ellipse rx="4" ry="5.2" fill="${o}"/><circle cx="-1.3" cy="-2" r="1.4" fill="${W}"/></g>`;
      case 'sparkle': return `<ellipse rx="9.5" ry="10.5" fill="${W}" stroke="${o}" stroke-width="2.5"/><g class="pz-pupil"><circle r="6.2" fill="${o}"/><circle cx="-2.2" cy="-2.6" r="2.3" fill="${W}"/><circle cx="2.2" cy="2" r="1.1" fill="${W}"/><path d="${spark4(2.6, -3.4, 1.6)}" fill="${W}"/></g>`;
      case 'anime': return `<ellipse rx="9" ry="12.5" fill="${W}" stroke="${o}" stroke-width="2.5"/><g class="pz-pupil"><ellipse rx="6.2" ry="8.6" fill="${o}"/><ellipse cx="0" cy="3" rx="4" ry="4.6" fill="${c.accent}" opacity=".55"/><ellipse cx="-2" cy="-3.6" rx="2.4" ry="3" fill="${W}"/><circle cx="2.4" cy="3.2" r="1.1" fill="${W}"/></g>`;
      case 'sleepy': return `<ellipse rx="9.5" ry="10" fill="${W}" stroke="${o}" stroke-width="2.5"/><g class="pz-pupil"><circle cy="2.5" r="4.8" fill="${o}"/><circle cx="-1.6" cy=".6" r="1.5" fill="${W}"/></g><path d="M-10.5-1Q0-3 10.5-1L10.5-11-10.5-11Z" fill="${c.body}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/>`;
      default: return `<ellipse rx="9.5" ry="10.5" fill="${W}" stroke="${o}" stroke-width="2.5"/><g class="pz-pupil"><circle r="5.2" fill="${o}"/><circle cx="-1.9" cy="-2.1" r="1.9" fill="${W}"/></g>`;
    }
  }

  function mouthMarkup(shape, c) {
    const o = c.outline;
    const tongue = '#FF7A8A';
    switch (shape) {
      case 'grin': return `<path d="M60 98Q70 115 80 98Z" fill="${o}" stroke="${o}" stroke-width="2.5" stroke-linejoin="round"/><path d="M64.5 104.5Q70 110 75.5 104.5Q70 101.5 64.5 104.5Z" fill="${tongue}"/>`;
      case 'o': return `<ellipse cx="70" cy="102" rx="4.2" ry="5.4" fill="${o}"/>`;
      case 'flat': return `<path d="M64 102H76" stroke="${o}" stroke-width="3" stroke-linecap="round"/>`;
      case 'wavy': return `<path d="M60 102q2.5-3 5 0t5 0t5 0t5 0" fill="none" stroke="${o}" stroke-width="2.8" stroke-linecap="round"/>`;
      case 'frown': return `<path d="M62 105Q70 97 78 105" fill="none" stroke="${o}" stroke-width="3" stroke-linecap="round"/>`;
      case 'tongue': return `<path d="M61 99Q70 107 79 99" fill="none" stroke="${o}" stroke-width="3" stroke-linecap="round"/><path d="M71 103.5q4 0 4 4.2q0 3.4-3.4 3.4q-3.4 0-3.4-3.4v-3" fill="${tongue}" stroke="${o}" stroke-width="2"/>`;
      case 'cat': return `<path d="M61 99q4.5 5 9 0q4.5 5 9 0" fill="none" stroke="${o}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'open': return `<ellipse cx="70" cy="102" rx="5.6" ry="4.6" fill="${o}"/><ellipse cx="70" cy="104.4" rx="3.2" ry="1.8" fill="${tongue}"/>`;
      case 'smug': return `<path d="M63 102Q73 106 79 98" fill="none" stroke="${o}" stroke-width="3" stroke-linecap="round"/>`;
      default: return `<path d="M62 99Q70 107 78 99" fill="none" stroke="${o}" stroke-width="3" stroke-linecap="round"/>`;
    }
  }

  function browsMarkup(kind, c) {
    const s = `stroke="${c.outline}" stroke-width="3" stroke-linecap="round" fill="none"`;
    switch (kind) {
      case 'angry': return `<path d="M43 66L58 71.5" ${s}/><path d="M97 66L82 71.5" ${s}/>`;
      case 'worried': return `<path d="M44 71.5L58 66.5" ${s}/><path d="M96 71.5L82 66.5" ${s}/>`;
      case 'raised': return `<path d="M44 67Q51 62.5 58 66" ${s}/><path d="M82 66Q89 62.5 96 67" ${s}/>`;
      case 'focus': return `<path d="M44 69H58" ${s}/><path d="M82 69H96" ${s}/>`;
      default: return '';
    }
  }

  function hatMarkup(h, c) {
    const o = c.outline, a = c.accent;
    switch (h) {
      case 'sprout': return `<path d="M70 53Q69 44 71 37" fill="none" stroke="${o}" stroke-width="2.6" stroke-linecap="round"/><path d="M71 38Q61 26 52 33Q60 43 71 38Z" fill="#8BD45E" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M71 39Q80 25 90 31Q83 42 71 39Z" fill="#A7E27A" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M57 33.5Q63 35 68 37.5M76 36Q81 33 86 31.5" stroke="${o}" stroke-width="1.3" fill="none" opacity=".5"/>`;
      case 'cap': return `<path d="M42 62Q42 33 70 32Q98 33 98 62Q70 55 42 62Z" fill="${a}" stroke="${o}" stroke-width="2.8" stroke-linejoin="round"/><path d="M88 58Q109 54 117 63Q103 67 88 63Z" fill="${a}" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M70 33V57M55 36Q60 46 59 59" stroke="${o}" stroke-width="1.6" fill="none" opacity=".45"/><circle cx="70" cy="31.5" r="3" fill="${o}"/>`;
      case 'grad': return `<path d="M52 47V57Q70 64 88 57V47" fill="#26252B" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M36 43L70 31L104 43L70 55Z" fill="#26252B" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M70 43L98 46V60" fill="none" stroke="${a}" stroke-width="2.4" stroke-linecap="round"/><path d="M95.5 59.5h5l-1 7h-3z" fill="${a}" stroke="${o}" stroke-width="1.6"/><circle cx="70" cy="43" r="2.4" fill="${a}"/>`;
      case 'beanie': return `<path d="M42 61Q40 30 70 29Q100 30 98 61Z" fill="${a}" stroke="${o}" stroke-width="2.8" stroke-linejoin="round"/><path d="M40 55Q70 49 100 55L100 63Q70 57 40 63Z" fill="${c.body}" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M50 54v7M60 52.6v7M70 52.2v7M80 52.6v7M90 54v7" stroke="${o}" stroke-width="1.4" opacity=".4"/><circle cx="70" cy="27" r="6.5" fill="${c.body}" stroke="${o}" stroke-width="2.6"/>`;
      case 'bow': return `<g transform="translate(94 52) rotate(18)"><path d="M0 0L-15-9Q-19 0-15 9Z" fill="#FF5C8A" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M0 0L15-9Q19 0 15 9Z" fill="#FF5C8A" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><circle r="4.6" fill="#FF8FAE" stroke="${o}" stroke-width="2.4"/></g>`;
      case 'headphones': return `<path d="M27 86Q25 37 70 36Q115 37 113 86" fill="none" stroke="${o}" stroke-width="7" stroke-linecap="round"/><path d="M27 86Q25 37 70 36Q115 37 113 86" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round"/><rect x="17" y="74" width="15" height="26" rx="7" fill="${a}" stroke="${o}" stroke-width="2.6"/><rect x="108" y="74" width="15" height="26" rx="7" fill="${a}" stroke="${o}" stroke-width="2.6"/>`;
      case 'party': return `<path d="M56 54L71 14L85 54Q70 59 56 54Z" fill="${a}" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M62 38L80 42M59 47L83 51M66 27L76 30" stroke="${c.body}" stroke-width="3" opacity=".9"/><circle cx="71" cy="13" r="5" fill="#FF5C8A" stroke="${o}" stroke-width="2.4"/>`;
      case 'crown': return `<path d="M46 56L44 32L57 43L70 27L83 43L96 32L94 56Q70 60 46 56Z" fill="#FFD23F" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="57" cy="51" r="2.6" fill="#FF4D6D"/><circle cx="70" cy="49" r="3" fill="#3FA7FF"/><circle cx="83" cy="51" r="2.6" fill="#4DD48A"/>`;
      case 'wizard': return `<path d="M40 58Q70 50 100 58Q103 64 70 63Q37 64 40 58Z" fill="#5B4BD6" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M50 57Q62 30 70 18Q78 6 96 10Q83 16 82 30Q86 44 90 57Z" fill="#6E5BEA" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="${star(68, 40, 4.5)}" fill="#FFD23F"/><path d="${star(80, 26, 3)}" fill="#FFD23F"/><circle cx="62" cy="52" r="1.6" fill="#FFD23F"/>`;
      case 'halo': return `<ellipse class="pz-glow" cx="70" cy="34" rx="26" ry="8" fill="none" stroke="#FFE27A" stroke-width="8" opacity=".5"/><ellipse cx="70" cy="34" rx="24" ry="6.5" fill="none" stroke="#FFD23F" stroke-width="3.6"/>`;
      default: return '';
    }
  }

  function faceMarkup(f, c) {
    const o = c.outline;
    const [lx, ly] = EYE_L, [rx, ry] = EYE_R;
    switch (f) {
      case 'round': return `<circle cx="${lx}" cy="${ly}" r="13" fill="#fff" fill-opacity=".14" stroke="${o}" stroke-width="2.6"/><circle cx="${rx}" cy="${ry}" r="13" fill="#fff" fill-opacity=".14" stroke="${o}" stroke-width="2.6"/><path d="M65 81Q70 77.5 75 81M39 79L30 75M101 79L110 75" fill="none" stroke="${o}" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'square': return `<rect x="${lx - 13}" y="${ly - 10}" width="26" height="20" rx="4" fill="#fff" fill-opacity=".14" stroke="${o}" stroke-width="2.6"/><rect x="${rx - 13}" y="${ry - 10}" width="26" height="20" rx="4" fill="#fff" fill-opacity=".14" stroke="${o}" stroke-width="2.6"/><path d="M65 80H75M39 78L30 74M101 78L110 74" stroke="${o}" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'nerd': return `<circle cx="${lx}" cy="${ly}" r="13.5" fill="#fff" fill-opacity=".1" stroke="${o}" stroke-width="4"/><circle cx="${rx}" cy="${ry}" r="13.5" fill="#fff" fill-opacity=".1" stroke="${o}" stroke-width="4"/><rect x="64" y="76.5" width="12" height="8" rx="1.5" fill="#FFFDF2" stroke="${o}" stroke-width="1.8" transform="rotate(-8 70 80)"/><path d="M66.5 77.5l1 6M70 77l1 6M73.5 76.6l1 6" stroke="${o}" stroke-width="1" opacity=".6" transform="rotate(-8 70 80)"/><path d="M38.5 79L30 75M101.5 79L110 75" stroke="${o}" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'sun': return `<path d="M38 74H66Q66 92 53 92Q38 92 38 74Z" fill="#17161B" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M74 74H102Q102 92 89 92Q74 92 74 74Z" fill="#17161B" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M66 76H74M38 75L29 72M102 75L111 72" stroke="${o}" stroke-width="2.6" stroke-linecap="round"/><path d="M43 78L48 78M79 78L84 78" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
      case 'monocle': return `<circle cx="${rx}" cy="${ry}" r="13.5" fill="#fff" fill-opacity=".14" stroke="#C8A13A" stroke-width="3"/><path d="M100 90Q104 108 96 122" fill="none" stroke="#C8A13A" stroke-width="1.6" stroke-dasharray="2 2"/>`;
      case 'mustache': return `<path d="M70 95Q64 91 58 94Q52 98 47 95Q51 103 60 101Q66 100 70 97Q74 100 80 101Q89 103 93 95Q88 98 82 94Q76 91 70 95Z" fill="${o}"/>`;
      default: return '';
    }
  }

  function neckMarkup(n, c) {
    const o = c.outline, a = c.accent;
    switch (n) {
      case 'bowtie': return `<path d="M70 118L57 110V126Z" fill="#E63946" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M70 118L83 110V126Z" fill="#E63946" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="70" cy="118" r="3.6" fill="#FF6B76" stroke="${o}" stroke-width="2.2"/>`;
      case 'tie': return `<path d="M65 112H75L72.5 118H67.5Z" fill="${a}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/><path d="M67.5 118H72.5L76 131L70 136L64 131Z" fill="${a}" stroke="${o}" stroke-width="2.2" stroke-linejoin="round"/>`;
      case 'scarf': return `<path d="M36 108Q70 124 104 108L106 117Q70 133 34 117Z" fill="#E76F51" stroke="${o}" stroke-width="2.6" stroke-linejoin="round"/><path d="M86 118L92 136L101 133L96 115Z" fill="#E76F51" stroke="${o}" stroke-width="2.4" stroke-linejoin="round"/><path d="M48 114l-2 7M60 118l-1 7M74 119l1 7M88 116l2 6" stroke="#FFD6C9" stroke-width="2.2"/>`;
      case 'medal': return `<path d="M60 106L70 122L80 106" fill="none" stroke="#3F72FF" stroke-width="4" stroke-linejoin="round"/><circle cx="70" cy="125" r="7" fill="#FFD23F" stroke="${o}" stroke-width="2.4"/><path d="${star(70, 125, 3.6)}" fill="#E8A600"/>`;
      case 'idcard': return `<path d="M58 104L66 116M82 104L74 116" stroke="#3F72FF" stroke-width="2.6"/><rect x="60" y="115" width="20" height="14" rx="2" fill="#fff" stroke="${o}" stroke-width="2.2"/><rect x="62.5" y="118" width="5" height="6" rx="1" fill="${a}"/><text x="69.5" y="123.5" font-size="5.2" font-family="Arial" font-weight="700" fill="${o}">TOP</text><path d="M69.5 126H77" stroke="${o}" stroke-width="1.2" opacity=".5"/>`;
      default: return '';
    }
  }

  // held item drawn at hand origin, pointing up (-y)
  function holdMarkup(h, c) {
    const o = c.outline;
    switch (h) {
      case 'none': return '';
      case 'highlighter': return `<rect x="-6" y="-30" width="12" height="25" rx="2.5" fill="${c.accent}" stroke="${o}" stroke-width="2.2"/><path d="M-4.5-30L4.5-30L3-37L-3-37Z" fill="${c.accent}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="-14" width="12" height="4" fill="${o}" opacity=".18"/>`;
      case 'pen': return `<rect x="-4" y="-33" width="8" height="30" rx="3" fill="#2E5BFF" stroke="${o}" stroke-width="2.2"/><path d="M-2.6-33L2.6-33L0-41Z" fill="#D9DCE3" stroke="${o}" stroke-width="1.8" stroke-linejoin="round"/><path d="M4-26v12" stroke="#C9D2FF" stroke-width="2.2" stroke-linecap="round"/>`;
      case 'chai': return `<g transform="rotate(-18)"><path d="M-9-20H9L7-4Q0 0-7-4Z" fill="#FFFDF7" stroke="${o}" stroke-width="2.3" stroke-linejoin="round"/><path d="M-8-17H8" stroke="#B46A3C" stroke-width="3.4"/><path d="M8.5-15q6 1 4 7q-1.5 3-5 2" fill="none" stroke="${o}" stroke-width="2.2"/><path class="pz-steam" d="M-3-24q-3-4 0-8" fill="none" stroke="${o}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/><path class="pz-steam b" d="M3-24q-3-4 0-8" fill="none" stroke="${o}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/></g>`;
      case 'book': return `<g transform="rotate(-10)"><rect x="-11" y="-26" width="22" height="26" rx="2.5" fill="${c.accent}" stroke="${o}" stroke-width="2.3"/><path d="M-7-26V0" stroke="${o}" stroke-width="1.8"/><rect x="-3" y="-20" width="11" height="5" rx="1" fill="#FFFDF7" stroke="${o}" stroke-width="1.4"/></g>`;
      default: {
        const gold = h === 'golden';
        const bodyFill = gold ? '#F2C230' : c.pencil;
        return `<rect x="-4.8" y="-2.5" width="9.6" height="7.5" rx="2.6" fill="${gold ? '#FFE48A' : c.eraser}" stroke="${o}" stroke-width="2.1"/><rect x="-4.8" y="-7" width="9.6" height="5" fill="#CFCFD6" stroke="${o}" stroke-width="2.1"/><rect x="-4.8" y="-31" width="9.6" height="24" fill="${bodyFill}" stroke="${o}" stroke-width="2.1"/><path d="M-1.6-31V-7M1.6-31V-7" stroke="${o}" stroke-width="1" opacity=".22"/><path d="M-4.8-31H4.8L0-42Z" fill="#F4D3A6" stroke="${o}" stroke-width="2.1" stroke-linejoin="round"/><path d="M-1.7-37.6H1.7L0-42Z" fill="${o}"/>${gold ? `<path class="pz-tw" d="${spark4(6, -36, 3.5)}" fill="#FFE27A"/>` : ''}`;
      }
    }
  }

  function auraMarkup(a, c) {
    switch (a) {
      case 'glow': return `<ellipse class="pz-glow" cx="${CX}" cy="${CY + 4}" rx="62" ry="56" fill="${c.accent}" opacity=".4" filter="url(#pzBlur)"/>`;
      case 'sparkles': return `<path class="pz-tw" d="${spark4(18, 60, 5)}" fill="${c.accent}"/><path class="pz-tw b" d="${spark4(124, 70, 4)}" fill="${c.accent}"/><path class="pz-tw c" d="${spark4(116, 34, 3.2)}" fill="${c.accent}"/><path class="pz-tw b" d="${spark4(24, 30, 3)}" fill="${c.accent}"/>`;
      case 'orbit': return `<g class="pz-orbit slow"><path d="${star(70, 2, 4.5)}" fill="#FFD23F" stroke="${c.outline}" stroke-width="1.2"/><path d="${star(122, 52, 3.6)}" fill="${c.accent}"/><path d="${star(18, 52, 3.6)}" fill="#FF8FAE"/></g>`;
      default: return '';
    }
  }

  function fxMarkup(list, c) {
    const o = c.outline, out = [];
    for (const f of list) {
      switch (f) {
        case 'zzz': out.push(`<text class="pz-z" x="98" y="52" font-size="15" fill="${o}">z</text><text class="pz-z b" x="104" y="44" font-size="18" fill="${o}">z</text><text class="pz-z c" x="110" y="36" font-size="21" fill="${o}">Z</text>`); break;
        case 'sweat': out.push(`<path class="pz-bob" d="M104 58q5 7 0 10q-5-3 0-10Z" fill="#7EC8F2" stroke="${o}" stroke-width="1.6"/>`); break;
        case 'tear': out.push(`<path class="pz-up" style="animation-direction:reverse" d="M45 94q4 6 0 9q-4-3 0-9Z" fill="#7EC8F2" stroke="${o}" stroke-width="1.4"/>`); break;
        case 'sparkles': out.push(`<path class="pz-tw" d="${spark4(22, 56, 6)}" fill="${c.pencil}" stroke="${o}" stroke-width="1"/><path class="pz-tw b" d="${spark4(120, 46, 5)}" fill="${c.pencil}" stroke="${o}" stroke-width="1"/><path class="pz-tw c" d="${spark4(112, 112, 4)}" fill="${c.pencil}" stroke="${o}" stroke-width="1"/>`); break;
        case 'hearts': out.push(`<path class="pz-up" d="${heart(108, 56, 5)}" fill="#FF4D6D"/><path class="pz-up b" d="${heart(30, 62, 4)}" fill="#FF7A93"/><path class="pz-up c" d="${heart(116, 76, 3.5)}" fill="#FF4D6D"/>`); break;
        case 'question': out.push(`<text class="pz-bob" x="104" y="50" font-size="26" fill="${o}">?</text>`); break;
        case 'exclaim': out.push(`<text class="pz-bob" x="106" y="50" font-size="28" fill="#FF4D4D" stroke="${o}" stroke-width=".8">!</text>`); break;
        case 'steam': out.push(`<path class="pz-steam" d="M40 50q-5-6 0-11q5-5 0-10" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/><path class="pz-steam b" d="M100 50q5-6 0-11q-5-5 0-10" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/>`); break;
        case 'idea': out.push(`<g class="pz-bob"><path d="M102 40a9 9 0 1 1 12 0c-1.4 1.2-1.8 2.4-1.8 4.5h-8.4c0-2.1-.4-3.3-1.8-4.5z" fill="#FFE27A" stroke="${o}" stroke-width="2"/><path d="M104 47.5h8" stroke="${o}" stroke-width="2"/></g>`); break;
        case 'dots': out.push(`<g><ellipse cx="112" cy="44" rx="17" ry="11" fill="#fff" stroke="${o}" stroke-width="2"/><circle cx="99" cy="58" r="3" fill="#fff" stroke="${o}" stroke-width="1.6"/><circle class="pz-dot" cx="105" cy="44" r="2.4" fill="${o}"/><circle class="pz-dot b" cx="112" cy="44" r="2.4" fill="${o}"/><circle class="pz-dot c" cx="119" cy="44" r="2.4" fill="${o}"/></g>`); break;
        case 'music': out.push(`<text class="pz-up" x="104" y="60" font-size="16" fill="${o}">♪</text><text class="pz-up b" x="24" y="58" font-size="14" fill="${o}">♫</text>`); break;
        case 'confetti': {
          const cols = ['#FF4D6D', '#FFD23F', '#3FA7FF', '#4DD48A', '#B07CFF'];
          for (let i = 0; i < 10; i++) {
            const x = 12 + i * 12, d = (i * 0.17) % 1.6;
            out.push(`<rect class="pz-fall" style="animation-delay:${d.toFixed(2)}s" x="${x}" y="${i % 2 ? 6 : 16}" width="5" height="8" rx="1" fill="${cols[i % cols.length]}"/>`);
          }
          break;
        }
        case 'waves': out.push(`<path class="pz-wave" d="M120 78q5 6 0 12" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/><path class="pz-wave b" d="M126 74q7 10 0 20" fill="none" stroke="${o}" stroke-width="2.4" stroke-linecap="round"/>`); break;
        case 'dizzy': out.push(`<g class="pz-orbit"><path d="${star(70, 36, 5)}" fill="#FFD23F" stroke="${o}" stroke-width="1.2"/><path d="${star(104, 60, 4)}" fill="#FFD23F" stroke="${o}" stroke-width="1.2"/><path d="${star(36, 60, 4)}" fill="#FFD23F" stroke="${o}" stroke-width="1.2"/></g>`); break;
        case 'scribble': out.push(`<g class="pz-scrib"><path class="pz-tw" d="M118 122q3-4 6 0t6 0" fill="none" stroke="${o}" stroke-width="1.8" stroke-linecap="round"/><path class="pz-tw b" d="M114 130q3-3 6 0t6 0" fill="none" stroke="${o}" stroke-width="1.8" stroke-linecap="round"/></g>`); break;
        case 'star': out.push(`<path class="pz-bob" d="${star(110, 42, 10)}" fill="#FFD23F" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>`); break;
        default: break;
      }
    }
    return out.join('');
  }

  // mood → face recipe
  const MOODS = {
    idle: { eyes: null, mouth: 'smile', brows: '', fx: [], wob: 0.012 },
    happy: { eyes: 'happy', mouth: 'grin', brows: '', fx: [], cheeks: 1, wob: 0.02 },
    excited: { eyes: 'star', mouth: 'grin', brows: 'raised', fx: ['sparkles'], cheeks: 1, wob: 0.03 },
    thinking: { eyes: null, mouth: 'flat', brows: 'raised', fx: ['dots'], look: [0.7, -0.8], wob: 0.012 },
    writing: { eyes: null, mouth: 'cat', brows: 'focus', fx: ['scribble'], look: [0.8, 0.9], wob: 0.012 },
    listening: { eyes: null, mouth: 'smile', brows: '', fx: ['waves'], wob: 0.012 },
    sleepy: { eyes: null, eyeStyle: 'sleepy', mouth: 'flat', brows: '', fx: [], wob: 0.008 },
    sleep: { eyes: 'closed', mouth: 'o', brows: '', fx: ['zzz'], wob: 0.006, breathe: 0.03 },
    shocked: { eyes: 'wide', mouth: 'o', brows: 'raised', fx: ['exclaim'], wob: 0.035 },
    sad: { eyes: null, mouth: 'frown', brows: 'worried', fx: ['tear'], look: [0, 0.8], wob: 0.01 },
    angry: { eyes: null, mouth: 'frown', brows: 'angry', fx: ['steam'], wob: 0.02 },
    love: { eyes: 'heart', mouth: 'grin', brows: '', fx: ['hearts'], cheeks: 1, wob: 0.02 },
    dizzy: { eyes: 'spiral', mouth: 'wavy', brows: '', fx: ['dizzy'], wob: 0.04 },
    proud: { eyes: 'happy', mouth: 'smug', brows: '', fx: ['sparkles'], cheeks: 1, wob: 0.015 },
    confused: { eyes: null, mouth: 'wavy', brows: 'worried', fx: ['question'], wob: 0.015 },
    idea: { eyes: 'wide', mouth: 'grin', brows: 'raised', fx: ['idea'], wob: 0.02 },
    celebrate: { eyes: 'star', mouth: 'grin', brows: 'raised', fx: ['confetti', 'sparkles'], cheeks: 1, wob: 0.04 },
    music: { eyes: 'happy', mouth: 'cat', brows: '', fx: ['music'], wob: 0.02 },
    nervous: { eyes: null, mouth: 'wavy', brows: 'worried', fx: ['sweat'], wob: 0.02 },
    important: { eyes: 'wide', mouth: 'grin', brows: 'raised', fx: ['star'], wob: 0.03 },
    cool: { eyes: null, mouth: 'smug', brows: 'focus', fx: ['sparkles'], wob: 0.012 },
    tongue: { eyes: 'happy', mouth: 'tongue', brows: '', fx: [], cheeks: 1, wob: 0.02 }
  };

  function colorsOf(cfg) {
    return {
      body: cfg.body || '#FFFDF7', outline: cfg.outline || '#1C1B18', cheeks: cfg.cheeks || '#FF9BA8',
      pencil: cfg.pencil || '#FFC93C', eraser: cfg.eraser || '#FF7F8E', accent: cfg.accent || '#FFD23F'
    };
  }

  function skeleton(cfg, mood = 'idle') {
    const c = colorsOf(cfg);
    const m = MOODS[mood] || MOODS.idle;
    const eyeStyle = m.eyeStyle || cfg.eyes || 'round';
    const hat = cfg.hat || 'none';
    const sprouty = hat === 'headphones' ? '' : hatMarkup(hat, c);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VBW} ${VBH}" width="100%" height="100%" overflow="visible" class="pz-svg">
<style>${STYLE}</style>
<defs><filter id="pzBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
<g class="pz-aura">${auraMarkup(cfg.aura, c)}</g>
<ellipse class="pz-shadow" cx="${CX}" cy="${BASE_Y + 5}" rx="36" ry="6" fill="${c.outline}" opacity=".16"/>
<g class="pz-jump">
 <g class="pz-core">
  <ellipse cx="56" cy="${BASE_Y}" rx="9.5" ry="5.4" fill="${c.body}" stroke="${c.outline}" stroke-width="2.6"/>
  <ellipse cx="84" cy="${BASE_Y}" rx="9.5" ry="5.4" fill="${c.body}" stroke="${c.outline}" stroke-width="2.6"/>
  <g class="pz-arm-l" transform="translate(27 104)"><circle r="6.2" fill="${c.body}" stroke="${c.outline}" stroke-width="2.6"/></g>
  <path class="pz-bodypath" d="${blobPath(0, 0)}" fill="${c.body}" stroke="${c.outline}" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M42 74Q45 60 58 55" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" opacity=".55"/>
  <circle cx="40.5" cy="81" r="2" fill="#fff" opacity=".55"/>
  <g class="pz-cheeks" opacity="${m.cheeks ? 0.95 : 0.7}"><ellipse cx="43" cy="97" rx="7" ry="4.2" fill="${c.cheeks}"/><ellipse cx="97" cy="97" rx="7" ry="4.2" fill="${c.cheeks}"/></g>
  <g class="pz-brows">${browsMarkup(m.brows, c)}</g>
  <g class="pz-eye pz-eye-l" transform="translate(${EYE_L[0]} ${EYE_L[1]})">${eyeMarkup(eyeStyle, m.eyes, c)}</g>
  <g class="pz-eye pz-eye-r" transform="translate(${EYE_R[0]} ${EYE_R[1]})">${eyeMarkup(eyeStyle, m.eyes, c)}</g>
  <g class="pz-mouth">${mouthMarkup(m.mouth, c)}</g>
  <g class="pz-acc-face">${faceMarkup(cfg.face, c)}</g>
  <g class="pz-acc-neck">${neckMarkup(cfg.neck, c)}</g>
  <g class="pz-acc-hat">${hat === 'headphones' ? hatMarkup('headphones', c) : sprouty}</g>
  <g class="pz-arm-r" transform="translate(113 104) rotate(16)"><g class="pz-hold">${holdMarkup(cfg.hold || 'pencil', c)}</g><circle r="6.2" fill="${c.body}" stroke="${c.outline}" stroke-width="2.6"/></g>
 </g>
</g>
<g class="pz-fx">${fxMarkup(m.fx, c)}</g>
</svg>`;
  }

  // ---------------- live controller ----------------
  class Pet {
    constructor(host, cfg = {}) {
      this.cfg = Object.assign({}, cfg);
      this.el = document.createElement('div');
      this.el.className = 'pz-pet';
      this.el.style.cssText = 'position:relative;display:inline-block;line-height:0;user-select:none;-webkit-user-select:none;touch-action:none';
      host.appendChild(this.el);
      this.mood = 'idle';
      this.moodUntil = 0;
      this.baseMood = 'idle';
      this.t = 0;
      this.st = { y: 0, vy: 0, sx: 1, sy: 1, vsx: 0, vsy: 0, rot: 0, vrot: 0, shake: 0, armR: 16, armL: 0 };
      this.look = [0, 0]; this.lookTarget = [0, 0]; this.lookUntil = 0;
      this.blinkAt = performance.now() + 2000; this.blinking = 0;
      this.talking = false; this.talkFlip = 0;
      this.writing = false;
      this.waving = 0;
      this.paused = false;
      this.build();
      this.size(cfg.size || 96);
      this._loop = this._loop.bind(this);
      this._last = performance.now();
      this._raf = this.win().requestAnimationFrame(this._loop);
    }
    win() { return (this.el.ownerDocument && this.el.ownerDocument.defaultView) || window; }
    build() {
      this.el.innerHTML = skeleton(this.cfg, this.mood);
      const q = (s) => this.el.querySelector(s);
      this.n = {
        svg: q('svg'), body: q('.pz-bodypath'), core: q('.pz-core'), jump: q('.pz-jump'), shadow: q('.pz-shadow'),
        eyeL: q('.pz-eye-l'), eyeR: q('.pz-eye-r'), mouth: q('.pz-mouth'), brows: q('.pz-brows'), fx: q('.pz-fx'),
        armR: q('.pz-arm-r'), armL: q('.pz-arm-l'), cheeks: q('.pz-cheeks')
      };
      this._face = '';
      this.applyFace(true);
    }
    size(px) {
      this.px = px;
      this.el.style.width = px + 'px';
      this.el.style.height = Math.round(px * VBH / VBW) + 'px';
    }
    setConfig(cfg) {
      this.cfg = Object.assign({}, this.cfg, cfg);
      if (cfg.size) this.size(cfg.size);
      this.build();
    }
    setMood(mood, ms = 0) {
      if (!MOODS[mood]) mood = 'idle';
      if (ms > 0) { this.mood = mood; this.moodUntil = performance.now() + ms; }
      else { this.baseMood = mood; if (performance.now() > this.moodUntil) this.mood = mood; }
      this.applyFace();
    }
    currentMood() { return this.mood; }
    lookAt(dx, dy, ms = 1500) { this.lookTarget = [Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy))]; this.lookUntil = performance.now() + ms; }
    lookAtClient(x, y, ms = 1200) {
      const r = this.el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.55;
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
      this.lookAt((dx / d) * k, (dy / d) * k, ms);
    }
    talk(on) { this.talking = !!on; if (!on) this.applyFace(true); }
    write(on) { this.writing = !!on; this.applyFace(true); }
    react(kind) {
      const s = this.st;
      switch (kind) {
        case 'jump': if (s.y > -3) { s.vy = -5.2; s.vsy += 0.06; } break;
        case 'bigjump': if (s.y > -3) { s.vy = -7.5; s.vsy += 0.1; } break;
        case 'squish': s.sy = 0.78; s.sx = 1.18; break;
        case 'stretch': s.sy = 1.22; s.sx = 0.86; break;
        case 'shake': s.shake = 14; break;
        case 'spin': s.vrot = 34; break;
        case 'wiggle': s.vrot = 9; break;
        case 'nod': s.vsy -= 0.09; break;
        case 'wave': this.waving = 1400; break;
        case 'poke': s.sy = 0.84; s.sx = 1.12; if (s.y > -3) s.vy = -2.4; break;
        default: break;
      }
    }
    blink() { this.blinking = 140; }
    applyFace(force) {
      const m = MOODS[this.mood] || MOODS.idle;
      const c = colorsOf(Object.assign({}, this.cfg, { accent: this.cfg.accent }));
      const eyeStyle = m.eyeStyle || this.cfg.eyes || 'round';
      let eyes = m.eyes;
      if (this.blinking > 0 && (!eyes || eyes === 'wide')) eyes = 'closed';
      let mouth = m.mouth;
      if (this.talking) mouth = this.talkFlip ? 'open' : (m.mouth === 'frown' ? 'flat' : 'smile');
      const fx = m.fx.slice();
      if (this.writing && !fx.includes('scribble')) fx.push('scribble');
      const key = [this.mood, eyes, eyeStyle, mouth, m.brows, fx.join(','), this.cfg.eyes].join('|');
      if (!force && key === this._face) return;
      this._face = key;
      const em = eyeMarkup(eyeStyle, eyes, c);
      this.n.eyeL.innerHTML = em; this.n.eyeR.innerHTML = em;
      this.n.mouth.innerHTML = mouthMarkup(mouth, c);
      this.n.brows.innerHTML = browsMarkup(m.brows, c);
      this.n.fx.innerHTML = fxMarkup(fx, c);
      this.n.cheeks.setAttribute('opacity', m.cheeks ? 0.95 : 0.7);
      this.pupils = this.el.querySelectorAll('.pz-pupil');
    }
    pause(p) { this.paused = p; }
    _loop(now) {
      if (!this.el.isConnected) return;
      this._raf = this.win().requestAnimationFrame(this._loop);
      const dtRaw = now - this._last;
      const motion = this.cfg.motion || 'normal';
      const minFrame = motion === 'calm' ? 50 : 33;
      if (dtRaw < minFrame || this.paused || this.el.ownerDocument.hidden) return;
      this._last = now;
      const dt = Math.min(dtRaw, 80) / 16.67;
      this.t += dtRaw / 1000;
      const s = this.st;
      const m = MOODS[this.mood] || MOODS.idle;
      const k = motion === 'hyper' ? 1.6 : motion === 'calm' ? 0.5 : 1;

      if (this.moodUntil && now > this.moodUntil) { this.moodUntil = 0; this.mood = this.baseMood; this.applyFace(); }

      // blinking
      if (now > this.blinkAt) { this.blink(); this.blinkAt = now + 2200 + Math.random() * 4200; }
      if (this.blinking > 0) { this.blinking -= dtRaw; this.applyFace(); if (this.blinking <= 0) this.applyFace(true); }

      // talking mouth flap
      if (this.talking) { this.talkFlip = (Math.floor(this.t * 9) % 2); this.applyFace(); }

      // jump physics
      s.vy += 0.42 * dt; s.y += s.vy * dt;
      if (s.y > 0) { if (s.vy > 2) { s.sy = 1 - Math.min(0.25, s.vy * 0.035); s.sx = 1 + Math.min(0.2, s.vy * 0.028); } s.y = 0; s.vy = 0; }
      // squash springs
      const breathe = (m.breathe || 0.016) * Math.sin(this.t * 2.3);
      const tsx = 1 - breathe * 0.6, tsy = 1 + breathe;
      s.vsx += ((tsx - s.sx) * 0.22 - s.vsx * 0.24) * dt; s.sx += s.vsx * dt;
      s.vsy += ((tsy - s.sy) * 0.22 - s.vsy * 0.24) * dt; s.sy += s.vsy * dt;
      // rotation spring
      s.vrot += (-s.rot * 0.12 - s.vrot * 0.18) * dt; s.rot += s.vrot * dt * 0.5;
      let shakeX = 0;
      if (s.shake > 0) { shakeX = Math.sin(this.t * 60) * s.shake * 0.18; s.shake -= dt; }

      // tilt for confused
      const tilt = this.mood === 'confused' ? 8 : this.mood === 'proud' ? -5 : 0;

      const amp = (m.wob || 0.012) * k + Math.abs(s.vy) * 0.004;
      this.n.body.setAttribute('d', blobPath(this.t * k, amp));
      this.n.core.setAttribute('transform', `translate(${(shakeX).toFixed(2)} 0) rotate(${(s.rot + tilt).toFixed(2)} ${CX} ${BASE_Y}) translate(${CX} ${BASE_Y}) scale(${s.sx.toFixed(3)} ${s.sy.toFixed(3)}) translate(${-CX} ${-BASE_Y})`);
      this.n.jump.setAttribute('transform', `translate(0 ${s.y.toFixed(2)})`);
      const sh = Math.max(0.55, 1 + s.y / 60);
      this.n.shadow.setAttribute('rx', (36 * sh).toFixed(1));
      this.n.shadow.setAttribute('opacity', (0.16 * sh).toFixed(3));

      // gaze
      let tgt = this.lookTarget;
      if (now > this.lookUntil) {
        tgt = m.look || [Math.sin(this.t * 0.37) * 0.35, Math.sin(this.t * 0.23) * 0.2];
      }
      this.look[0] += (tgt[0] - this.look[0]) * 0.18 * dt;
      this.look[1] += (tgt[1] - this.look[1]) * 0.18 * dt;
      if (this.pupils) for (const p of this.pupils) p.setAttribute('transform', `translate(${(this.look[0] * 3.4).toFixed(2)} ${(this.look[1] * 3).toFixed(2)})`);

      // arms
      let armR = 16 + Math.sin(this.t * 1.8) * 4;
      const isWriting = this.writing || this.mood === 'writing';
      if (isWriting) armR = 118 + Math.sin(this.t * 22) * 9;
      else if (this.mood === 'celebrate' || this.mood === 'excited') armR = -10 + Math.sin(this.t * 10) * 18;
      else if (this.mood === 'thinking') armR = -28;
      s.armR += (armR - s.armR) * 0.3 * dt;
      this.n.armR.setAttribute('transform', `translate(113 ${104 + (isWriting ? 2 : 0)}) rotate(${s.armR.toFixed(1)})`);
      let armL = 0;
      if (this.waving > 0) { this.waving -= dtRaw; armL = Math.sin(this.t * 16) * 9; }
      const lx = 27 + (this.waving > 0 ? -6 : 0), ly = 104 + (this.waving > 0 ? -18 + armL : 0);
      this.n.armL.setAttribute('transform', `translate(${lx.toFixed(1)} ${ly.toFixed(1)})`);
    }
    destroy() { try { this.win().cancelAnimationFrame(this._raf); } catch (e) {} this.el.remove(); }
  }

  globalThis.PinisoPet = {
    create: (host, cfg) => new Pet(host, cfg),
    svgString: (cfg, mood = 'idle') => skeleton(cfg || {}, mood),
    MOODS: Object.keys(MOODS),
    VBW, VBH
  };
})();
