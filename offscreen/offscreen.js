/* Piniso — offscreen audio listener. Records the lecture tab's audio in short segments
   (timed by the video clock sent from the page) and hands them to the background for transcription.
   The audio keeps playing normally for the student. */
let stream = null, ctx = null, analyser = null, tabId = null;
let rec = null, seg = null, peakTimer = null, guardTimer = null;

const MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => {
  try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; }
}) || '';

function blobToB64(blob) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => res('');
    r.readAsDataURL(blob);
  });
}

function measure() {
  if (!analyser || !seg) return;
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  if (rms > seg.peak) seg.peak = rms;
}

function begin(t, prompt) {
  if (!stream) return;
  const chunks = [];
  const s = { t0: t, startedAt: Date.now(), peak: 0, prompt: prompt || '', chunks };
  let r;
  try { r = new MediaRecorder(stream, MIME ? { mimeType: MIME, audioBitsPerSecond: 32000 } : undefined); }
  catch (e) { return; }
  r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  r.start();
  rec = r; seg = s;
  clearTimeout(guardTimer);
  guardTimer = setTimeout(() => finish(s.t0 + (Date.now() - s.startedAt) / 1000, true), 70000);
}

function finish(t1, restart, prompt) {
  const r = rec, s = seg;
  rec = null; seg = null;
  clearTimeout(guardTimer);
  if (!r || !s) { if (restart) begin(t1, prompt); return; }
  const dur = (Date.now() - s.startedAt) / 1000;
  r.onstop = async () => {
    if (dur < 1.5 || !s.chunks.length) return;
    const blob = new Blob(s.chunks, { type: r.mimeType || MIME || 'audio/webm' });
    const b64 = await blobToB64(blob);
    chrome.runtime.sendMessage({ type: 'off:chunk', tabId, t0: s.t0, t1: Math.max(t1, s.t0 + 0.5), b64, mime: blob.type, peak: s.peak, prompt: s.prompt }).catch(() => {});
  };
  try { r.stop(); } catch (e) {}
  if (restart) begin(t1, prompt);
}

async function start(streamId, tab) {
  await stop();
  tabId = tab;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false
  });
  ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  src.connect(ctx.destination); // keep the lecture audible
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  peakTimer = setInterval(measure, 200);
  stream.getAudioTracks().forEach((tr) => tr.addEventListener('ended', () => {
    chrome.runtime.sendMessage({ type: 'off:ended' }).catch(() => {});
    stop();
  }));
}

async function stop() {
  clearInterval(peakTimer); clearTimeout(guardTimer);
  try { if (rec) rec.stop(); } catch (e) {}
  rec = null; seg = null;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  if (ctx) { try { await ctx.close(); } catch (e) {} }
  ctx = null; analyser = null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('off:')) return false;
  // built-in (on-device) AI lives in window contexts, so the worker asks us
  if (msg.type === 'off:lm') {
    if (!globalThis.PDevice) { sendResponse({ ok: true, status: 'unavailable' }); return false; }
    const job = msg.op === 'status' ? PDevice.status() : PDevice.chat(msg.messages || [], { json: !!msg.json }).then((r) => ({ ok: true, text: r.text }));
    job.then((r) => sendResponse(r), (e) => sendResponse({ ok: false, error: (e && e.message) || String(e), code: e && e.code }));
    return true;
  }
  if (msg.type === 'off:start') {
    start(msg.streamId, msg.tabId).then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: 'Could not capture tab audio: ' + e.message }));
    return true;
  }
  if (msg.type === 'off:stop') { stop().then(() => sendResponse({ ok: true })); return true; }
  if (msg.type === 'off:seg') {
    if (msg.op === 'start') { if (!seg) begin(msg.t, msg.prompt); }
    else if (msg.op === 'cut') finish(msg.t, true, msg.prompt);
    else if (msg.op === 'pause') finish(msg.t, false);
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
