/* Piniso 3D — the mascot as a live 3D clay toy (model built in Blender, see tools/build_piniso.py).
   Drawn with a small three.js build (vendor/three/pz3.min.js) at up to 60 FPS. Same API as the 2D pet
   (setMood, react, talk, write, lookAt, lookAtClient, setConfig, destroy) plus play(move) and 50+ moves.
   If WebGL or the model is not available, the 2D pet keeps working underneath — nothing breaks. */
(() => {
  if (!globalThis.PinisoPet || globalThis.PinisoPet.is3D) return;
  const P2 = globalThis.PinisoPet;
  const create2d = P2.create;
  const MODEL = () => (globalThis.chrome && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('assets/3d/piniso.glb') : '../assets/3d/piniso.glb');
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = { out: (p) => 1 - Math.pow(1 - p, 3), inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2), back: (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); } };
  const bell = (p) => Math.sin(Math.PI * clamp(p, 0, 1));      // 0 → 1 → 0
  const pulse = (p, n) => Math.sin(Math.PI * clamp(p, 0, 1) * n); // n bumps

  // ---------------------------------------------------------------- face for every mood
  // eyes: open | wide | happy | closed | star | heart | spiral | cross | sleepy
  const FACE = {
    idle: { eyes: 'open', mouth: 'smile', brows: '' },
    happy: { eyes: 'happy', mouth: 'grin', brows: '', fx: '' },
    excited: { eyes: 'star', mouth: 'grin', brows: 'raised', fx: 'sparkle', bounce: 1 },
    thinking: { eyes: 'open', mouth: 'flat', brows: 'raised', fx: 'dots', look: [0.7, -0.8] },
    writing: { eyes: 'open', mouth: 'cat', brows: 'focus', fx: '', look: [0.8, 0.9] },
    listening: { eyes: 'open', mouth: 'smile', brows: '' },
    sleepy: { eyes: 'sleepy', mouth: 'flat', brows: '' },
    sleep: { eyes: 'closed', mouth: 'o', brows: '', fx: 'zzz', breathe: 1 },
    shocked: { eyes: 'wide', mouth: 'o', brows: 'raised', fx: 'exclaim' },
    sad: { eyes: 'open', mouth: 'frown', brows: 'worried', fx: 'tear', look: [0, 0.8] },
    angry: { eyes: 'open', mouth: 'frown', brows: 'angry', fx: 'steam' },
    love: { eyes: 'heart', mouth: 'grin', brows: '', fx: 'heart', bounce: 1 },
    dizzy: { eyes: 'spiral', mouth: 'wavy', brows: '', fx: 'dizzy' },
    proud: { eyes: 'happy', mouth: 'smug', brows: '', fx: 'sparkle' },
    confused: { eyes: 'open', mouth: 'wavy', brows: 'worried', fx: 'question' },
    idea: { eyes: 'wide', mouth: 'grin', brows: 'raised', fx: 'idea' },
    celebrate: { eyes: 'star', mouth: 'grin', brows: 'raised', fx: 'confetti', bounce: 2 },
    music: { eyes: 'happy', mouth: 'cat', brows: '', fx: 'note', bounce: 1 },
    nervous: { eyes: 'open', mouth: 'wavy', brows: 'worried', fx: 'sweat' },
    important: { eyes: 'wide', mouth: 'grin', brows: 'raised', fx: 'star' },
    cool: { eyes: 'open', mouth: 'smug', brows: 'focus', fx: 'sparkle' },
    tongue: { eyes: 'happy', mouth: 'tongue', brows: '' }
  };
  // a little "entrance" move whenever a mood starts
  const MOOD_MOVE = { celebrate: 'tada', love: 'heartbeat', shocked: 'startle', sad: 'sigh', dizzy: 'wobble', idea: 'eureka', excited: 'hop', proud: 'proudPuff', confused: 'headTilt', angry: 'stomp', nervous: 'shiver', important: 'point', music: 'groove', happy: 'giggle', sleepy: 'yawn', cool: 'coolLean', tongue: 'blep' };

  // ---------------------------------------------------------------- the move library
  // every move gets p (0..1) and writes ADDITIVE offsets into o:
  // y (jump), sx/sy (squash), rx/ry/rz (body turn), aL/aR (arm swing up), aLx/aRx (arm forward), px/py (look),
  // leaf (sprout wiggle), eyes/mouth (face override), fx (one-shot particles at the start)
  const M = {};
  const def = (name, d, f, o = {}) => { M[name] = Object.assign({ d, f }, o); };
  def('jump', 0.7, (p, o) => { o.y += 0.55 * Math.sin(Math.PI * p); const s = p < 0.15 ? -bell(p / 0.15) : p > 0.85 ? -bell((p - 0.85) / 0.15) : bell((p - 0.15) / 0.7) * 0.5; o.sy += s * 0.16; o.sx -= s * 0.1; o.leaf += Math.sin(p * TAU * 2) * 0.4; });
  def('bigjump', 1.0, (p, o) => { M.jump.f(p, o); o.y += 0.45 * Math.sin(Math.PI * p); o.aL += bell(p) * 1.6; o.aR += bell(p) * 1.2; });
  def('hop', 0.45, (p, o) => { o.y += 0.28 * Math.sin(Math.PI * p); o.sy += (p < 0.2 ? -0.12 : 0.06) * bell(p); });
  def('squish', 0.5, (p, o) => { const s = Math.exp(-5 * p) * Math.cos(p * 18); o.sy -= 0.24 * s; o.sx += 0.18 * s; });
  def('stretch', 0.6, (p, o) => { const s = Math.exp(-4 * p) * Math.cos(p * 14); o.sy += 0.22 * s; o.sx -= 0.14 * s; });
  def('shake', 0.5, (p, o) => { o.rz += Math.sin(p * 60) * 0.12 * (1 - p); o.ry += Math.sin(p * 50) * 0.1 * (1 - p); });
  def('spin', 0.9, (p, o) => { o.ry += TAU * ease.inOut(p); o.y += 0.15 * bell(p); });
  def('wiggle', 0.6, (p, o) => { o.rz += Math.sin(p * 28) * 0.14 * (1 - p); });
  def('nod', 0.5, (p, o) => { o.rx += 0.18 * pulse(p, 2); });
  def('shakeNo', 0.7, (p, o) => { o.ry += Math.sin(p * TAU * 3) * 0.35 * (1 - p * 0.4); });
  def('poke', 0.45, (p, o) => { const s = Math.exp(-6 * p) * Math.cos(p * 20); o.sy -= 0.16 * s; o.sx += 0.12 * s; o.y += 0.08 * bell(p); o.eyes = p < 0.5 ? 'closed' : null; });
  def('wave', 1.4, (p, o) => { o.aL += 2.2 * bell(Math.min(1, p * 1.4)); o.aLw = Math.sin(p * TAU * 4) * 0.45; o.rz += Math.sin(p * TAU * 2) * 0.03; });
  def('waveBoth', 1.4, (p, o) => { M.wave.f(p, o); o.aR += 2.0 * bell(Math.min(1, p * 1.4)); o.aRw = -Math.sin(p * TAU * 4) * 0.45; o.mouth = 'grin'; });
  def('tada', 1.3, (p, o) => { o.y += 0.5 * bell(Math.min(1, p * 1.6)); o.aL += 2.4 * bell(p); o.aR += 2.0 * bell(p); o.ry += p < 0.6 ? TAU * ease.out(p / 0.6) : TAU; o.sy += 0.1 * bell(p); o.eyes = 'star'; o.mouth = 'grin'; }, { fx: 'confetti' });
  def('heartbeat', 1.2, (p, o) => { const b = Math.max(pulse(p * 2 % 1, 1), 0) * (p < 0.5 ? 1 : 0.8); o.sx += 0.1 * b; o.sy += 0.1 * b; o.eyes = 'heart'; }, { fx: 'heart' });
  def('startle', 0.8, (p, o) => { o.y += 0.35 * bell(Math.min(1, p * 2.2)); o.sy += 0.18 * bell(Math.min(1, p * 2.2)); o.aL += 1.6 * bell(p); o.aR += 1.2 * bell(p); o.eyes = 'wide'; o.mouth = 'o'; }, { fx: 'exclaim' });
  def('sigh', 1.4, (p, o) => { o.sy -= 0.08 * bell(p); o.rx += 0.12 * bell(p); o.y -= 0.03 * bell(p); o.eyes = p > 0.2 && p < 0.8 ? 'closed' : null; });
  def('wobble', 1.6, (p, o) => { o.rz += Math.sin(p * TAU * 3) * 0.2 * (1 - p * 0.5); o.ry += Math.sin(p * TAU * 2) * 0.3; o.eyes = 'spiral'; });
  def('eureka', 1.0, (p, o) => { o.y += 0.3 * bell(Math.min(1, p * 2)); o.aR += 2.6 * bell(p); o.aRx += 0.4 * bell(p); o.eyes = 'wide'; o.mouth = 'grin'; }, { fx: 'idea' });
  def('proudPuff', 1.1, (p, o) => { o.sx += 0.08 * bell(p); o.sy += 0.06 * bell(p); o.rx -= 0.18 * bell(p); o.eyes = 'happy'; o.mouth = 'smug'; }, { fx: 'sparkle' });
  def('headTilt', 1.1, (p, o) => { o.rz += 0.22 * bell(p); o.py -= 0.6 * bell(p); o.aR += 0.9 * bell(p); });
  def('stomp', 0.9, (p, o) => { const q = (p * 3) % 1; o.y += 0.1 * bell(q); o.sy -= 0.1 * (q > 0.8 ? bell((q - 0.8) / 0.2) : 0); o.rz += (Math.floor(p * 3) % 2 ? 1 : -1) * 0.06; }, { fx: 'steam' });
  def('shiver', 1.0, (p, o) => { o.rz += Math.sin(p * 90) * 0.035; o.sx += Math.sin(p * 80) * 0.015; }, { fx: 'sweat' });
  def('point', 1.0, (p, o) => { o.aR += 1.7 * bell(Math.min(1, p * 1.5)); o.aRx += 0.8 * bell(p); o.rz -= 0.08 * bell(p); }, { fx: 'star' });
  def('groove', 2.0, (p, o) => { o.rz += Math.sin(p * TAU * 4) * 0.12; o.y += Math.abs(Math.sin(p * TAU * 4)) * 0.08; o.aL += 0.8 + Math.sin(p * TAU * 4) * 0.5; o.aR += 0.8 - Math.sin(p * TAU * 4) * 0.5; o.eyes = 'happy'; }, { fx: 'note' });
  def('giggle', 0.9, (p, o) => { o.sy += Math.sin(p * 50) * 0.03 * (1 - p); o.rz += Math.sin(p * 30) * 0.04; o.eyes = 'happy'; o.mouth = 'grin'; });
  def('yawn', 2.0, (p, o) => { const b = bell(clamp((p - 0.1) / 0.7, 0, 1)); o.sy += 0.12 * b; o.sx -= 0.04 * b; o.aL += 2.2 * b; o.aR += 1.6 * b; o.rx -= 0.2 * b; o.eyes = b > 0.3 ? 'closed' : null; o.mouth = b > 0.25 ? 'open' : null; });
  def('coolLean', 1.2, (p, o) => { o.rz -= 0.14 * bell(p); o.ry += 0.3 * bell(p); o.mouth = 'smug'; });
  def('blep', 1.0, (p, o) => { o.mouth = 'tongue'; o.eyes = 'happy'; o.rz += 0.08 * bell(p); });
  def('twirl', 1.1, (p, o) => { o.ry -= TAU * ease.inOut(p); o.aL += 1.4 * bell(p); o.aR += 1.4 * bell(p); o.y += 0.1 * bell(p); });
  def('backflip', 1.3, (p, o) => { const q = clamp((p - 0.15) / 0.7, 0, 1); o.y += 1.1 * bell(q); o.rx -= TAU * ease.inOut(q); o.sy -= 0.15 * (p < 0.15 ? bell(p / 0.15) : p > 0.85 ? bell((p - 0.85) / 0.15) : 0); o.eyes = q > 0 && q < 1 ? 'closed' : 'star'; });
  def('frontflip', 1.3, (p, o) => { M.backflip.f(p, o); o.rx = -o.rx; });
  def('superjump', 1.6, (p, o) => { const q = clamp((p - 0.2) / 0.65, 0, 1); o.sy -= 0.28 * (p < 0.2 ? bell(p / 0.2) : 0); o.sx += 0.18 * (p < 0.2 ? bell(p / 0.2) : 0); o.y += 1.6 * bell(q); o.ry += TAU * 2 * ease.inOut(q); o.aL += 2.4 * bell(q); o.aR += 2.4 * bell(q); }, { fx: 'sparkle' });
  def('peek', 1.8, (p, o) => { const d = p < 0.3 ? ease.inOut(p / 0.3) : p < 0.7 ? 1 : 1 - ease.inOut((p - 0.7) / 0.3); o.y -= 0.9 * d; o.sy -= 0.1 * d; o.eyes = d > 0.9 ? 'wide' : null; o.px += Math.sin(p * TAU) * 0.6; });
  def('bow', 1.4, (p, o) => { o.rx += 0.5 * bell(p); o.aL += 0.6 * bell(p); o.eyes = 'closed'; });
  def('salute', 1.3, (p, o) => { o.aL += 2.7 * bell(Math.min(1, p * 1.3)); o.aLx += 0.9 * bell(p); o.sy += 0.04 * bell(p); o.mouth = 'flat'; o.brows = 'focus'; });
  def('lookAround', 2.2, (p, o) => { o.px += Math.sin(p * TAU) * 0.9; o.ry += Math.sin(p * TAU) * 0.35; o.py += Math.sin(p * TAU * 2) * 0.2; });
  def('bounce3', 1.2, (p, o) => { const q = (p * 3) % 1; o.y += 0.22 * bell(q); o.sy += (q < 0.12 || q > 0.88 ? -0.12 : 0.05); });
  def('cheer', 1.4, (p, o) => { M.bounce3.f(p, o); o.aL += 2.3 + Math.sin(p * TAU * 6) * 0.3; o.aR += 2.3 - Math.sin(p * TAU * 6) * 0.3; o.eyes = 'happy'; o.mouth = 'grin'; }, { fx: 'confetti' });
  def('facepalm', 1.6, (p, o) => { const b = bell(p); o.aL += 2.3 * b; o.aLx += 1.2 * b; o.rx += 0.15 * b; o.eyes = 'closed'; o.mouth = 'wavy'; });
  def('sneeze', 1.4, (p, o) => { if (p < 0.6) { const b = ease.inOut(p / 0.6); o.rx -= 0.25 * b; o.sy += 0.1 * b; o.eyes = 'closed'; o.mouth = 'open'; } else { const b = Math.exp(-6 * (p - 0.6)); o.rx += 0.35 * b; o.sy -= 0.12 * b; o.eyes = 'cross'; } });
  def('sleepNod', 3.0, (p, o) => { o.rx += 0.18 * ease.inOut(clamp(p * 1.4, 0, 1)) * (p < 0.85 ? 1 : 0); if (p > 0.85) { o.y += 0.08 * bell((p - 0.85) / 0.15); o.eyes = 'wide'; } else o.eyes = 'closed'; });
  def('jelly', 1.2, (p, o) => { const s = Math.exp(-3 * p) * Math.sin(p * 30); o.sx += 0.15 * s; o.sy -= 0.15 * s; o.rz += 0.05 * s; });
  def('think', 2.0, (p, o) => { const b = bell(p); o.aR += 1.3 * b; o.aRx += 0.9 * b; o.px += 0.7 * b; o.py -= 0.8 * b; o.rz += 0.06 * b; o.brows = 'raised'; o.mouth = 'flat'; }, { fx: 'dots' });
  def('shrug', 1.2, (p, o) => { const b = bell(p); o.aL += 1.2 * b; o.aR += 1.2 * b; o.y += 0.06 * b; o.rz += 0.06 * b; o.mouth = 'wavy'; o.brows = 'raised'; });
  def('faint', 2.4, (p, o) => { const a = p < 0.45 ? ease.inOut(p / 0.45) : p < 0.65 ? 1 : 1 - ease.back((p - 0.65) / 0.35); o.rz += 1.25 * clamp(a, 0, 1.2); o.y -= 0.1 * a; o.eyes = a > 0.5 ? 'cross' : 'wide'; o.mouth = 'o'; });
  def('roll', 1.6, (p, o) => { o.rz -= TAU * ease.inOut(p); o.x += Math.sin(Math.PI * p) * 0.4; o.y += 0.3 * bell(p); });
  def('clap', 1.2, (p, o) => { o.aL += 1.4; o.aR += 1.0; o.aLx += 0.9 + Math.abs(Math.sin(p * TAU * 4)) * 0.6; o.aRx += 0.9 + Math.abs(Math.sin(p * TAU * 4)) * 0.6; o.eyes = 'happy'; o.mouth = 'grin'; });
  def('tiptoe', 2.0, (p, o) => { o.x += Math.sin(p * TAU) * 0.35; o.y += Math.abs(Math.sin(p * TAU * 4)) * 0.06; o.rz += Math.sin(p * TAU * 4) * 0.06; o.mouth = 'cat'; });
  def('scribble', 1.6, (p, o) => { o.aR += 1.0 + Math.sin(p * 80) * 0.15; o.aRx += 0.8 + Math.cos(p * 70) * 0.15; o.px += 0.7; o.py += 0.8; o.brows = 'focus'; o.mouth = 'cat'; });
  def('read', 2.4, (p, o) => { o.aR += 0.8; o.aRx += 0.6; o.px += Math.sin(p * TAU * 3) * 0.5 + 0.3; o.py += 0.6; o.rx += 0.08; });
  def('sip', 2.0, (p, o) => { const b = bell(clamp((p - 0.1) / 0.6, 0, 1)); o.aR += 2.0 * b; o.aRx += 0.9 * b; o.eyes = b > 0.6 ? 'happy' : null; o.mouth = b > 0.6 ? 'o' : null; });
  def('zoom', 1.0, (p, o) => { o.ry += TAU * 3 * ease.inOut(p); o.sx += 0.15 * bell(p); o.sy -= 0.1 * bell(p); });
  def('levelUp', 1.8, (p, o) => { M.superjump.f(p, o); o.eyes = 'star'; o.mouth = 'grin'; }, { fx: 'confetti' });
  def('celebrate', 2.0, (p, o) => { M.cheer.f(p, o); if (p > 0.5) M.spin.f((p - 0.5) * 2, o); }, { fx: 'confetti' });
  def('sad', 1.8, (p, o) => { o.sy -= 0.07 * bell(p); o.rx += 0.25 * bell(p); o.aL -= 0.3 * bell(p); o.aR -= 0.3 * bell(p); o.eyes = 'open'; o.mouth = 'frown'; o.brows = 'worried'; }, { fx: 'tear' });
  def('dance', 3.2, (p, o) => { const b = p * 8; o.y += Math.abs(Math.sin(b * Math.PI)) * 0.14; o.rz += Math.sin(b * Math.PI) * 0.15; o.ry += Math.sin(b * Math.PI / 2) * 0.45; o.aL += 1.2 + Math.sin(b * Math.PI) * 0.9; o.aR += 1.2 - Math.sin(b * Math.PI) * 0.9; o.eyes = 'happy'; o.mouth = p % 0.25 < 0.12 ? 'grin' : 'cat'; if (p > 0.8) M.spin.f((p - 0.8) * 5, o); }, { fx: 'note' });
  def('robot', 2.4, (p, o) => { const step = Math.floor(p * 8) / 8; o.ry += Math.sin(step * TAU) * 0.5; o.aL += (Math.floor(p * 8) % 2) * 1.5; o.aR += ((Math.floor(p * 8) + 1) % 2) * 1.5; o.mouth = 'flat'; o.brows = 'focus'; });
  def('swim', 2.0, (p, o) => { o.rz += Math.sin(p * TAU * 2) * 0.2; o.aL += 1.5 + Math.sin(p * TAU * 4) * 1.2; o.aR += 1.5 - Math.sin(p * TAU * 4) * 1.2; o.y += 0.2 + Math.sin(p * TAU * 2) * 0.1; o.mouth = 'o'; });
  def('meditate', 3.0, (p, o) => { o.y += 0.25 * ease.inOut(bell(p)) + Math.sin(p * TAU * 2) * 0.03; o.aL += 0.7; o.aR += 0.7; o.eyes = 'closed'; o.mouth = 'smile'; }, { fx: 'sparkle' });
  def('drumroll', 1.6, (p, o) => { o.aL += 0.9 + Math.abs(Math.sin(p * 60)) * 0.5; o.aR += 0.9 + Math.abs(Math.cos(p * 60)) * 0.5; o.sy += Math.sin(p * 60) * 0.015; o.brows = 'focus'; });
  def('highfive', 1.2, (p, o) => { o.aR += 2.5 * bell(Math.min(1, p * 1.3)); o.aRx += 0.6 * bell(p); o.y += p > 0.4 && p < 0.6 ? 0.15 : 0; o.mouth = 'grin'; }, { fx: 'sparkle' });
  def('hide', 2.0, (p, o) => { const d = bell(p); o.aL += 2.4 * d; o.aR += 2.4 * d; o.aLx += 1.3 * d; o.aRx += 1.3 * d; o.sy -= 0.08 * d; o.eyes = d > 0.5 ? 'closed' : null; });
  def('stretchUp', 2.0, (p, o) => { const b = bell(p); o.sy += 0.18 * b; o.sx -= 0.06 * b; o.aL += 2.8 * b; o.aR += 2.8 * b; o.eyes = b > 0.4 ? 'happy' : null; });
  def('hiccup', 1.4, (p, o) => { const q = (p * 3) % 1; o.y += q < 0.2 ? 0.12 * bell(q / 0.2) : 0; o.sy += q < 0.2 ? 0.1 * bell(q / 0.2) : 0; o.eyes = q < 0.2 ? 'wide' : null; });
  def('blowKiss', 1.4, (p, o) => { o.aL += 1.8 * bell(p); o.aLx += 1.2 * bell(Math.min(1, p * 2)); o.eyes = 'happy'; o.mouth = 'o'; }, { fx: 'heart' });
  def('sparkleSpin', 1.2, (p, o) => { M.spin.f(p, o); o.eyes = 'star'; }, { fx: 'sparkle' });

  const IDLE_MOVES = ['lookAround', 'hop', 'jelly', 'giggle', 'blep', 'tiptoe', 'stretchUp', 'headTilt', 'wiggle', 'nod', 'twirl', 'bounce3', 'groove', 'sparkleSpin'];
  const REACT_MOVE = { jump: 'jump', bigjump: 'bigjump', squish: 'squish', stretch: 'stretch', shake: 'shake', spin: 'spin', wiggle: 'wiggle', nod: 'nod', wave: 'wave', poke: 'poke' };

  // ---------------------------------------------------------------- shared loading (one model per page)
  let modelP = null;
  function loadModel() {
    if (modelP) return modelP;
    modelP = new Promise((res, rej) => {
      if (!globalThis.PZ3) { rej(new Error('no 3D runtime')); return; }
      fetch(MODEL()).then((r) => r.arrayBuffer()).then((buf) => {
        new PZ3.GLTFLoader().parse(buf, '', (g) => res(g.scene), rej);
      }).catch(rej);
    });
    modelP.catch(() => {});
    return modelP;
  }
  let glOK = null, glSoft = false;
  function webglOK() {
    if (glOK != null) return glOK;
    try {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
      glOK = !!gl;
      if (gl) {
        // no real graphics chip (software drawing) = the 3D pet would slow the lecture down → classic 2D instead
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
        glSoft = /swiftshader|llvmpipe|software|basic render/i.test(name);
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch (e) { glOK = false; }
    return glOK;
  }
  // emoji / glyph textures for particles
  const TEX = {};
  function glyph(ch) {
    if (TEX[ch]) return TEX[ch];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (ch === 'Z') { g.font = '700 96px "Comic Sans MS", "PinisoHand", cursive'; g.fillStyle = '#4b5bdc'; g.lineWidth = 8; g.strokeStyle = '#fff'; g.strokeText('Z', 64, 70); g.fillText('Z', 64, 70); }
    else if (ch === 'dot') { g.fillStyle = '#1c1b18'; g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.fill(); }
    else if (ch === 'conf') { g.fillStyle = '#fff'; g.fillRect(34, 44, 60, 40); }
    else if (ch === 'glow') { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    else if (ch === 'shadow') { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    else { g.font = '96px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.fillText(ch, 64, 72); }
    const t = new PZ3.CanvasTexture(c); t.colorSpace = PZ3.SRGBColorSpace;
    return (TEX[ch] = t);
  }
  const FX = {
    sparkle: { ch: ['✨', '⭐'], n: 6, rise: 0.4, spread: 1.3, life: 1.4, size: 0.32 },
    heart: { ch: ['💖', '💕', '❤️'], n: 5, rise: 1.4, spread: 0.9, life: 1.8, size: 0.36 },
    zzz: { ch: ['Z'], n: 1, rise: 1.2, spread: 0.2, life: 2.6, size: 0.4, loop: 1.1, side: 0.8 },
    sweat: { ch: ['💧'], n: 1, rise: -0.6, spread: 0.1, life: 1.2, size: 0.28, at: [0.75, 1.75], loop: 1.4 },
    tear: { ch: ['💧'], n: 1, rise: -0.9, spread: 0.05, life: 1.1, size: 0.22, at: [-0.34, 1.0], loop: 1.6 },
    steam: { ch: ['💢', '💨'], n: 2, rise: 0.9, spread: 0.8, life: 1.2, size: 0.34, loop: 0.9 },
    question: { ch: ['❓'], n: 1, rise: 0.3, spread: 0.1, life: 1.8, size: 0.5, at: [0.9, 2.2], loop: 2.2 },
    exclaim: { ch: ['❗'], n: 1, rise: 0.4, spread: 0.1, life: 1.2, size: 0.55, at: [0.85, 2.25] },
    idea: { ch: ['💡'], n: 1, rise: 0.3, spread: 0.05, life: 1.8, size: 0.6, at: [0, 2.75] },
    note: { ch: ['🎵', '🎶'], n: 2, rise: 1.2, spread: 1.1, life: 1.8, size: 0.34, loop: 1.8 },
    dizzy: { ch: ['💫', '⭐'], n: 3, orbit: 1, life: 1.6, size: 0.3, loop: 1.6 },
    star: { ch: ['⭐', '🌟'], n: 3, rise: 0.7, spread: 1.0, life: 1.4, size: 0.4 },
    dots: { ch: ['dot'], n: 3, dots: 1, life: 1.5, size: 0.14, loop: 1.5 },
    confetti: { ch: ['conf'], n: 26, burst: 1, life: 1.8, size: 0.13 }
  };
  const CONF = ['#FF4D6D', '#FFD23F', '#3FA7FF', '#4DD48A', '#B07CFF', '#FF9F1C'];

  // ---------------------------------------------------------------- the 3D pet
  class Pet3D {
    constructor(p2, cfg) {
      this.p2 = p2; this.el = p2.el; this.cfg = Object.assign({}, cfg);
      this.mood = p2.mood || 'idle'; this.baseMood = 'idle'; this.moodUntil = 0;
      this.ready = false; this.dead = false;
      this.moves = []; this.parts = {}; this.fx = [];
      this.look = [0, 0]; this.lookT = [0, 0]; this.lookUntil = 0;
      this.blinkAt = performance.now() + 1500; this.blink = 0;
      this.talking = false; this.writing = false; this.waving = 0;
      this.st = { y: 0, vy: 0, sx: 1, sy: 1, vs: 0, sway: 0, leaf: 0, vleaf: 0, aL: 0, aR: 0 };
      this.idleAt = performance.now() + 9000 + Math.random() * 9000;
      this.t = 0;
      this.init().catch((e) => { this.fail(e); });
    }
    fail(e) { if (this.dead) return; this.failed = true; if (this.canvas) this.canvas.remove(); try { this.p2.pause(false); } catch (x) {} const svg = this.el.querySelector('svg'); if (svg) svg.style.visibility = ''; if (e && globalThis.PZ_DEBUG) console.warn('[Piniso 3D]', e); }
    async init() {
      if (!webglOK()) throw new Error('no webgl');
      const src = await loadModel();
      if (this.dead) return;
      const T = PZ3;
      const cv = this.canvas = document.createElement('canvas');
      cv.className = 'pz-3d';
      // the canvas is bigger than the pet box so jumps, hats and effects never get cut
      cv.style.cssText = 'position:absolute;left:-42%;top:-46%;width:184%;height:158%;pointer-events:none;display:block';
      const r = this.renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.NeutralToneMapping; r.toneMappingExposure = 1.05;
      r.setClearColor(0x000000, 0);
      const scene = this.scene = new T.Scene();
      const pm = new T.PMREMGenerator(r);
      scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.38;
      const key = new T.DirectionalLight(0xfff1dc, 2.8); key.position.set(-3.5, 6, 4.5); scene.add(key);
      const rim = new T.DirectionalLight(0xdce8ff, 1.5); rim.position.set(3, 3.5, -5); scene.add(rim);
      scene.add(new T.HemisphereLight(0xffffff, 0xb8a58c, 0.45));
      const cam = this.cam = new T.PerspectiveCamera(24, 1, 0.1, 50);
      cam.position.set(0, 2.55, 9.4); cam.lookAt(0, 1.5, 0);
      // contact shadow
      const sh = this.shadow = new T.Mesh(new T.PlaneGeometry(2.6, 1.5), new T.MeshBasicMaterial({ map: glyph('shadow'), transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = 0.002; scene.add(sh);
      // the model (geometry shared, materials per pet)
      const root = this.root = src.clone(true);
      scene.add(root);
      root.traverse((o) => { if (o.name) this.parts[o.name] = o; });
      // shoulders sit on the outside of the body so raised arms never sink into it
      ['ArmL', 'ArmR'].forEach((n, i) => { const a = this.parts[n]; if (a) { a.position.x += (i ? 1 : -1) * 0.1; a.position.z += 0.04; } });
      this.materials();
      this.applyConfig();
      this.el.style.position = 'relative';
      this.el.appendChild(cv);
      this.resize();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.el);
      this.ready = true;
      const svg = this.el.querySelector('svg'); if (svg) svg.style.visibility = 'hidden';
      try { this.p2.pause(true); } catch (e) {}
      this.setMood(this.mood);
      this._last = performance.now();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
      this.play('hop');
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.fail(); });
    }
    resize() {
      if (!this.renderer) return;
      const w = this.el.clientWidth * 1.84, h = this.el.clientHeight * 1.58;
      if (!w || !h) return;
      const dpr = this._low ? 1 : Math.min(2, devicePixelRatio || 1);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(Math.round(w), Math.round(h), false);
      this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    }
    // ---- clay materials, recoloured from the pet's settings
    materials() {
      const T = PZ3, c = this.cfg;
      const col = (x, d) => new T.Color(x || d);
      const clay = (color, o = {}) => new T.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.62, metalness: 0, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new T.Color(0xffffff), clearcoat: 0.18, clearcoatRoughness: 0.5 }, o));
      const mats = this.mats = {
        M_Body: clay(col(c.body, '#FFFDF7'), { roughness: 0.58, sheen: 0.8 }),
        M_Dark: clay(col(c.outline, '#1C1B18'), { roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.1, sheen: 0 }),
        M_White: clay(new T.Color('#ffffff'), { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0 }),
        M_Cheek: clay(col(c.cheeks, '#FF9BA8'), { roughness: 0.9, transparent: true, opacity: 0.82, sheen: 0 }),
        M_Pencil: clay(col(c.pencil, '#FFC93C'), { roughness: 0.4, clearcoat: 0.5 }),
        M_Eraser: clay(col(c.eraser, '#FF7F8E'), { roughness: 0.85 }),
        M_Accent: clay(col(c.accent, '#FFD23F'), { roughness: 0.5 })
      };
      this.root.traverse((o) => {
        if (!o.isMesh) return;
        const n = o.material && o.material.name;
        if (mats[n]) { o.material = mats[n]; return; }
        if (!mats[n]) {
          const s = o.material;
          mats[n] = clay(s.color ? s.color.clone() : new T.Color('#ccc'), { roughness: s.roughness != null ? s.roughness : 0.5, metalness: s.metalness || 0, emissive: s.emissive ? s.emissive.clone() : undefined, sheen: s.metalness > 0.5 ? 0 : 0.4 });
        }
        o.material = mats[n];
      });
    }
    applyConfig() {
      const c = this.cfg, P = this.parts;
      // only the option groups themselves (children of Hats / Faces / Necks / Hold) are switched
      const vis = (prefix, want) => Object.keys(P).forEach((k) => { const o = P[k]; if (k.startsWith(prefix) && o.parent && /^(Hats|Faces|Necks|Hold)$/.test(o.parent.name)) o.visible = k === prefix + want; });
      vis('Hat_', c.hat || 'sprout');
      vis('Face_', c.face || 'none');
      vis('Neck_', c.neck || 'none');
      vis('Item_', c.hold == null ? 'pencil' : c.hold);
      if (P.Thumb) P.Thumb.visible = (c.hold || 'pencil') !== 'none';
      this.eyeStyle = c.eyes || 'round';
      const scl = (side) => P['Sclera' + side], pup = (side) => P['Pupil' + side];
      ['L', 'R'].forEach((s) => {
        if (!scl(s)) return;
        scl(s).visible = this.eyeStyle !== 'dot';
        scl(s).scale.set(1, this.eyeStyle === 'anime' ? 1.18 : 1, 1);
        pup(s).scale.setScalar(this.eyeStyle === 'sparkle' ? 1.18 : this.eyeStyle === 'dot' ? 0.8 : this.eyeStyle === 'anime' ? 1.12 : 1);
        if (P['Shine2' + s]) P['Shine2' + s].visible = this.eyeStyle === 'sparkle' || this.eyeStyle === 'anime';
      });
      this.aura = c.aura || 'none';
      this.motion = c.motion || 'normal';
      if (this.auraObj) { this.scene.remove(this.auraObj); this.auraObj = null; }
      if (this.aura !== 'none') this.buildAura();
    }
    buildAura() {
      const T = PZ3, g = new T.Group();
      if (this.aura === 'glow') {
        const s = new T.Sprite(new T.SpriteMaterial({ map: glyph('glow'), color: new T.Color(this.cfg.accent || '#FFD23F'), transparent: true, opacity: 0.55, depthWrite: false }));
        s.scale.set(3.4, 3.4, 1); s.position.set(0, 1.05, -1.2); s.userData.glow = 1; g.add(s);
      } else {
        const n = this.aura === 'orbit' ? 3 : 5;
        for (let i = 0; i < n; i++) {
          const s = new T.Sprite(new T.SpriteMaterial({ map: glyph(this.aura === 'orbit' ? '⭐' : '✨'), transparent: true, depthWrite: false }));
          s.scale.setScalar(0.3); s.userData.i = i / n; g.add(s);
        }
      }
      this.auraObj = g; this.scene.add(g);
    }

    // ---- public API (same as the 2D pet)
    setMood(mood, ms = 0) {
      try { this.p2.setMood(mood, ms); } catch (e) {}
      if (!FACE[mood]) mood = 'idle';
      const was = this.mood;
      if (ms > 0) { this.mood = mood; this.moodUntil = performance.now() + ms; }
      else { this.baseMood = mood; if (performance.now() > this.moodUntil) this.mood = mood; }
      if (this.ready && was !== this.mood) this.enterMood(this.mood);
    }
    enterMood(m) {
      const f = FACE[m] || FACE.idle;
      if (f.fx) this.spawn(f.fx);
      if (MOOD_MOVE[m] && this.motion !== 'calm') this.play(MOOD_MOVE[m]);
    }
    react(kind) { try { this.p2.react(kind); } catch (e) {} if (!this.ready) return; if (kind === 'wave') this.waving = 1400; this.play(REACT_MOVE[kind] || kind); }
    play(name) {
      const mv = M[name];
      if (!mv || !this.ready) return false;
      if (this.motion === 'calm' && !/^(nod|wave|hop|squish|poke)$/.test(name)) return false;
      this.moves = this.moves.filter((x) => x.name !== name).slice(-2);
      this.moves.push({ name, mv, t0: performance.now(), d: mv.d * 1000 / (this.motion === 'hyper' ? 1.25 : 1) });
      if (mv.fx) this.spawn(mv.fx);
      this.idleAt = performance.now() + 12000 + Math.random() * 14000;
      return true;
    }
    talk(on) { try { this.p2.talk(on); } catch (e) {} this.talking = !!on; }
    write(on) { try { this.p2.write(on); } catch (e) {} this.writing = !!on; }
    lookAt(x, y, ms = 1200) { try { this.p2.lookAt(x, y, ms); } catch (e) {} this.lookT = [clamp(x, -1, 1), clamp(y, -1, 1)]; this.lookUntil = performance.now() + ms; }
    lookAtClient(cx, cy, ms) {
      const r = this.el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height * 0.42;
      const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 180);
      this.lookAt((dx / d) * k, (dy / d) * k, ms);
    }
    setConfig(cfg) {
      try { this.p2.setConfig(cfg); } catch (e) {}
      this.cfg = Object.assign({}, this.cfg, cfg);
      if (this.ready) {
        const svg = this.el.querySelector('svg'); if (svg) svg.style.visibility = 'hidden';
        if (this.canvas.parentNode !== this.el) this.el.appendChild(this.canvas);
        try { this.p2.pause(true); } catch (e) {}
        const c = this.cfg, m = this.mats;
        m.M_Body.color.set(c.body || '#FFFDF7'); m.M_Dark.color.set(c.outline || '#1C1B18'); m.M_Cheek.color.set(c.cheeks || '#FF9BA8');
        m.M_Pencil.color.set(c.pencil || '#FFC93C'); m.M_Eraser.color.set(c.eraser || '#FF7F8E'); m.M_Accent.color.set(c.accent || '#FFD23F');
        this.applyConfig(); this.resize();
      }
    }
    pause(p) { this.paused = p; }
    destroy() { this.dead = true; try { this.p2.destroy(); } catch (e) {} cancelAnimationFrame(this._raf); if (this.ro) this.ro.disconnect(); if (this.renderer) { this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {} } }

    // ---- particles
    spawn(kind) {
      const F = FX[kind]; if (!F || !this.ready) return;
      const T = PZ3, now = performance.now();
      if (F.loop) { this.loopFx = { kind, every: F.loop * 1000, next: now }; }
      const n = F.n;
      for (let i = 0; i < n; i++) {
        const ch = F.ch[i % F.ch.length];
        const mat = new T.SpriteMaterial({ map: glyph(ch), transparent: true, depthWrite: false });
        if (ch === 'conf') mat.color = new T.Color(CONF[i % CONF.length]);
        if (ch === 'dot') mat.color = new T.Color(this.cfg.outline || '#1C1B18');
        const s = new T.Sprite(mat);
        s.scale.setScalar(F.size);
        const p = { s, F, t0: now + (F.dots ? i * 220 : i * 70), i, n, kind };
        const a = Math.random() * TAU;
        if (F.burst) { p.v = [Math.cos(a) * (1 + Math.random() * 1.6), 2.5 + Math.random() * 2.2, Math.sin(a) * 0.8]; p.p = [0, 1.6, 0.3]; p.rot = Math.random() * 6; }
        else if (F.at) p.p = [F.at[0], F.at[1], 0.6];
        else if (F.side) p.p = [F.side + i * 0.15, 2.0, 0.2];
        else if (F.dots) p.p = [0.75 + i * 0.22, 2.25 + i * 0.12, 0.3];
        else p.p = [(Math.random() - 0.5) * 2 * F.spread, 1.2 + Math.random() * 0.8, 0.6];
        s.position.set(...p.p); s.visible = false;
        this.scene.add(s); this.fx.push(p);
      }
    }
    stepFx(now, dt) {
      if (this.loopFx) {
        const f = FACE[this.mood] || {};
        if (f.fx !== this.loopFx.kind) this.loopFx = null;
        else if (now >= this.loopFx.next && this.fx.length < 8) { this.loopFx.next = now + this.loopFx.every; const k = this.loopFx; this.loopFx = null; this.spawn(k.kind); if (!this.loopFx) this.loopFx = k; }
      }
      const y0 = (this.parts.Rig || this.root).position.y;
      this.fx = this.fx.filter((p) => {
        const age = (now - p.t0) / 1000, F = p.F;
        if (age < 0) return true;
        const q = age / F.life;
        if (q >= 1) { this.scene.remove(p.s); p.s.material.dispose(); return false; }
        const s = p.s; s.visible = true;
        if (F.burst) { p.v[1] -= 6.5 * dt; p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt; s.position.set(...p.p); s.material.rotation += p.rot * dt; s.material.opacity = 1 - Math.pow(q, 3); }
        else if (F.orbit) { const a = age * 4 + p.i / p.n * TAU; s.position.set(Math.cos(a) * 0.75, 2.2 + y0 + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.5 + 0.3); s.material.opacity = Math.min(1, (1 - q) * 3); }
        else if (F.dots) { s.position.y = p.p[1] + y0 + Math.sin(age * 6 + p.i) * 0.05; s.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(age * 4 - p.i)); }
        else { s.position.set(p.p[0] + Math.sin(age * 3 + p.i) * 0.12 * F.spread, p.p[1] + y0 + F.rise * ease.out(q), p.p[2]); s.material.opacity = q < 0.15 ? q / 0.15 : 1 - Math.pow((q - 0.15) / 0.85, 2); s.scale.setScalar(F.size * (0.6 + 0.4 * ease.back(Math.min(1, q * 4)))); }
        return true;
      });
    }

    // ---- the frame loop
    _loop(now) {
      if (this.dead) return;
      this._raf = requestAnimationFrame(this._loop);
      if (!this.el.isConnected) { if (this._gone++ > 120) this.destroy(); return; }
      this._gone = 0;
      if (this.paused || document.hidden) return;
      const dtMs = now - this._last;
      // 60 FPS while something moves, 30 when resting (saves battery); calm mode always 30
      const busy = this.moves.length || this.fx.length || this.talking || this.writing || Math.abs(this.st.vy) > 0.01;
      const minFrame = this.motion === 'calm' || !busy ? 31 : 15;
      if (dtMs < minFrame) return;
      this._last = now;
      const dt = Math.min(0.05, dtMs / 1000);
      this.t += dt;
      if (this.moodUntil && now > this.moodUntil) { this.moodUntil = 0; const was = this.mood; this.mood = this.baseMood; if (was !== this.mood) this.enterMood(this.mood); }
      const t0 = performance.now();
      this.step(now, dt);
      this.renderer.render(this.scene, this.cam);
      const cost = performance.now() - t0;
      this._cost = (this._cost || cost) * 0.95 + cost * 0.05;
      if (this._cost > 9 && !this._low) { this._low = true; this.resize(); }
    }
    step(now, dt) {
      const P = this.parts, st = this.st, f = FACE[this.mood] || FACE.idle, t = this.t;
      const k = this.motion === 'hyper' ? 1.5 : this.motion === 'calm' ? 0.4 : 1;
      // additive channels from running moves
      const o = { x: 0, y: 0, sx: 0, sy: 0, rx: 0, ry: 0, rz: 0, aL: 0, aR: 0, aLx: 0, aRx: 0, aLw: 0, aRw: 0, px: 0, py: 0, leaf: 0, eyes: null, mouth: null, brows: null };
      this.moves = this.moves.filter((m) => { const p = (now - m.t0) / m.d; if (p >= 1) return false; m.mv.f(Math.max(0, p), o); return true; });
      // idle life: a random little move now and then
      if (!this.moves.length && now > this.idleAt && this.mood !== 'sleep' && !this.talking && !this.writing && this.motion !== 'calm') {
        this.play(IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)]);
      }
      // breathing + mood bounce
      const breathe = Math.sin(t * (f.breathe ? 1.4 : 2.2)) * (f.breathe ? 0.03 : 0.014) * k;
      const bounce = f.bounce ? Math.abs(Math.sin(t * (f.bounce > 1 ? 9 : 6))) * 0.07 * k : 0;
      const talk = this.talking ? Math.abs(Math.sin(t * 15)) * 0.025 : 0;
      // root transform
      const R = P.Rig || this.root;
      R.position.set(o.x, o.y + bounce, 0);
      R.scale.set(1 + o.sx - breathe * 0.5 + talk * 0.4, 1 + o.sy + breathe - talk * 0.6, 1 + o.sx - breathe * 0.5);
      // gaze → body turns a little toward what it looks at
      let tgt = this.lookT;
      if (now > this.lookUntil) tgt = f.look || [Math.sin(t * 0.37) * 0.35, Math.sin(t * 0.23) * 0.2];
      this.look[0] += (tgt[0] - this.look[0]) * Math.min(1, dt * 7);
      this.look[1] += (tgt[1] - this.look[1]) * Math.min(1, dt * 7);
      const lx = clamp(this.look[0] + o.px, -1.2, 1.2), ly = clamp(this.look[1] + o.py, -1.2, 1.2);
      R.rotation.set(o.rx + ly * 0.08 + Math.sin(t * 1.1) * 0.012, o.ry + lx * 0.32, o.rz + Math.sin(t * 0.9) * 0.025 * k - lx * 0.04, 'YXZ');
      // shadow follows the jump
      const sh = Math.max(0.45, 1 - (o.y + bounce) / 2);
      this.shadow.scale.set(sh * (1 + o.sx), sh, 1); this.shadow.position.x = o.x; this.shadow.material.opacity = sh;
      // eyes
      if (now > this.blinkAt && !this.blink) { this.blink = now; this.blinkAt = now + 2200 + Math.random() * 3800; if (Math.random() < 0.18) this.blinkAt = now + 260; }
      let bl = 1;
      if (this.blink) { const q = (now - this.blink) / 150; if (q >= 1) this.blink = 0; else bl = 1 - Math.sin(Math.PI * q) * 0.92; }
      const eyes = o.eyes || f.eyes;
      const open = eyes === 'open' || eyes === 'wide' || eyes === 'sleepy';
      ['L', 'R'].forEach((s) => {
        const E = P['Eye' + s]; if (!E) return;
        E.visible = open;
        const w = eyes === 'wide' ? 1.22 : 1;
        E.scale.set(w, (open ? bl : 1) * w, w);
        const pu = P['Pup' + s]; if (pu) { if (!pu.userData.p0) pu.userData.p0 = pu.position.clone(); pu.position.set(pu.userData.p0.x + lx * 0.055, pu.userData.p0.y - ly * 0.035, pu.userData.p0.z + 0.012 + Math.hypot(lx, ly) * 0.015); }
        const lid = P['Lid' + s]; if (lid) { lid.visible = eyes === 'sleepy' || this.eyeStyle === 'sleepy'; }
        const map = { happy: 'Happy', closed: 'Closed', star: 'Star', heart: 'Heart', spiral: 'Spiral', cross: 'Cross' };
        Object.entries(map).forEach(([e, nm]) => { const m = P[nm + s]; if (m) { m.visible = eyes === e; if (m.visible) { const pop = 1 + Math.sin(t * 8) * (e === 'star' || e === 'heart' ? 0.08 : 0); m.scale.setScalar(pop); if (e === 'star' || e === 'spiral') m.rotation.z = (e === 'spiral' ? -t * 6 : Math.sin(t * 3) * 0.2); } } });
        if (P['Cross2' + s]) P['Cross2' + s].visible = eyes === 'cross';
      });
      // mouth (talking flaps between open and the mood mouth)
      let mouth = o.mouth || f.mouth;
      if (this.talking && Math.sin(t * 15) > 0.1) mouth = mouth === 'grin' ? 'smile' : 'open';
      Object.keys(P).forEach((n) => { if (n.startsWith('Mouth_') && P[n].parent && P[n].parent.name === 'Mouths') P[n].visible = n === 'Mouth_' + mouth; });
      // brows
      const brows = o.brows != null ? o.brows : f.brows;
      ['L', 'R'].forEach((s, i) => {
        const B = P['Brow' + s]; if (!B) return;
        const side = i === 0 ? -1 : 1;
        B.visible = !!brows || eyes === 'open' || eyes === 'wide';
        const target = brows === 'raised' ? [0.06, 0] : brows === 'angry' ? [-0.02, 0.38 * side] : brows === 'worried' ? [0.03, -0.32 * side] : brows === 'focus' ? [-0.03, 0] : [0, 0];
        B.userData.y = (B.userData.y || 0) + (target[0] - (B.userData.y || 0)) * Math.min(1, dt * 10);
        B.userData.r = (B.userData.r || 0) + (target[1] - (B.userData.r || 0)) * Math.min(1, dt * 10);
        if (B.userData.y0 == null) B.userData.y0 = B.position.y;
        B.position.y = B.userData.y0 + B.userData.y;
        B.rotation.z = B.userData.r;
      });
      if (P.CheekL) { const ch = f.eyes === 'happy' || f.eyes === 'heart' || this.mood === 'love' || this.mood === 'happy' ? 1.25 : 1; P.CheekL.scale.setScalar(ch); P.CheekR.scale.setScalar(ch); }
      // arms: holding the pencil, writing, waving, celebrating
      const writing = this.writing || this.mood === 'writing';
      let aR = Math.sin(t * 1.8) * 0.06 + o.aR, aL = Math.sin(t * 1.6 + 1) * 0.06 + o.aL;
      if (writing) { aR += 0.9 + Math.sin(t * 24) * 0.12; o.aRx += 0.7 + Math.cos(t * 19) * 0.12; }
      if (f.bounce > 1) { aL += 2.2 + Math.sin(t * 10) * 0.3; aR += 2.0 - Math.sin(t * 10) * 0.3; }
      if (this.waving > 0) { this.waving -= dt * 1000; if (!this.moves.some((m) => m.name === 'wave')) this.play('wave'); }
      st.aL += (aL - st.aL) * Math.min(1, dt * 14); st.aR += (aR - st.aR) * Math.min(1, dt * 14);
      if (P.ArmL) P.ArmL.rotation.set(-o.aLx + o.aLw * 0.3, -0.25 * Math.min(1, st.aL), -st.aL * 0.82 - o.aLw, 'XYZ');
      if (P.ArmR) P.ArmR.rotation.set(-o.aRx + o.aRw * 0.3, 0.25 * Math.min(1, st.aR), st.aR * 0.82 + o.aRw, 'XYZ');
      // sprout leaves: springy, lag behind the body
      const accel = (o.y - (st.py || 0)) / Math.max(dt, 0.001); st.py = o.y;
      st.vleaf += (-st.leaf * 60 - st.vleaf * 6 - accel * 0.9) * dt; st.leaf += st.vleaf * dt;
      const wind = Math.sin(t * 2.3) * 0.08 + Math.sin(t * 5.1) * 0.03;
      if (P.LeafL) P.LeafL.rotation.z = 0.1 + st.leaf * 0.5 + wind + o.leaf;
      if (P.LeafR) P.LeafR.rotation.z = -0.1 - st.leaf * 0.5 - wind - o.leaf;
      if (P.Hat_sprout) P.Hat_sprout.rotation.z = st.leaf * 0.25 + wind * 0.3;
      if (P.HaloRing) P.HaloRing.position.y = (P.HaloRing.userData.y0 != null ? P.HaloRing.userData.y0 : (P.HaloRing.userData.y0 = P.HaloRing.position.y)) + Math.sin(t * 2) * 0.04;
      // aura
      if (this.auraObj) this.auraObj.children.forEach((s) => {
        if (s.userData.glow) { s.material.opacity = 0.4 + Math.sin(t * 2) * 0.12; return; }
        const a = t * (this.aura === 'orbit' ? 1.6 : 0.6) + s.userData.i * TAU;
        if (this.aura === 'orbit') s.position.set(Math.cos(a) * 1.35, 1.2 + Math.sin(a * 2) * 0.15 + o.y, Math.sin(a) * 1.0);
        else { s.position.set(Math.cos(a) * 1.3, 0.6 + ((t * 0.4 + s.userData.i) % 1) * 1.9 + o.y, Math.sin(a) * 0.8 + 0.3); s.material.opacity = Math.sin(((t * 0.4 + s.userData.i) % 1) * Math.PI); }
      });
      this.stepFx(now, dt);
    }
  }

  const LIVE = [];
  function want3d(cfg) {
    if (cfg && cfg.render === '2d') return false;
    if (!globalThis.PZ3) return false;
    if (!webglOK()) return false;
    return !glSoft || (cfg && cfg.render === '3d-always');
  }
  globalThis.PinisoPet = Object.assign({}, P2, {
    is3D: true,
    create(host, cfg) {
      const p2 = create2d(host, cfg);
      if (!want3d(cfg || {})) return p2;
      // browsers allow only ~16 live 3D canvases per page: keep a safe number, extra pets stay 2D
      LIVE.splice(0, LIVE.length, ...LIVE.filter((x) => !x.dead && !x.failed && x.el.isConnected !== false));
      if (LIVE.length >= 6) return p2;
      const p = new Pet3D(p2, cfg || {});
      LIVE.push(p);
      return p;
    },
    MOVES: Object.keys(M),
    IDLE_MOVES,
    preload: () => (globalThis.PZ3 ? loadModel() : Promise.reject(new Error('no 3D runtime')))
  });
  // 2D pets also understand play(): the closest classic reaction
  const proto2 = Object.getPrototypeOf(create2d(document.createElement('div'), { size: 10 }));
  if (proto2 && !proto2.play) proto2.play = function (n) { this.react(/flip|spin|twirl|zoom|roll/.test(n) ? 'spin' : /jump|tada|cheer|celebrate|level/.test(n) ? 'bigjump' : /wave|kiss|five|salute/.test(n) ? 'wave' : /nod|bow/.test(n) ? 'nod' : /shake|shiver|stomp/.test(n) ? 'shake' : 'jump'); return true; };
})();
