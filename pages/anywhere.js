/* Piniso — Study Anything: share any window/app; Piniso hears it (shared audio → speech-to-text)
   and sees it (frames → board reading). The shared stream plays in a muted <video>, which the normal
   Piniso app treats like a lecture video — so notes, quizzes, talk, report cards all just work. */
(async () => {
  const $ = (id) => document.getElementById(id);
  const S = await PStore.settings();
  PU.applyTheme(S);
  document.getElementById('tp').innerHTML = PinisoPet.svgString(PU.petCfg(S), 'excited');
  const v = $('v');
  let stream = null;

  async function start() {
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: { suppressLocalAudioPlayback: false }, systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include' });
    } catch (e) { console.warn('[Piniso] share failed', e.name, e.message); PU.toast(e.name === 'NotAllowedError' ? 'Sharing was cancelled' : 'Could not share: ' + e.message); return; }
    const hasAudio = stream.getAudioTracks().length > 0;
    $('aud').textContent = hasAudio ? '🎧 hearing audio' : '🙉 no audio shared — I’ll read the screen';
    $('aud').className = 'pill ' + (hasAudio ? 'ok' : 'acc');
    v.srcObject = stream;
    v.hidden = false;
    $('intro').hidden = true;
    $('bar').hidden = false;
    await v.play().catch(() => {});
    stream.getVideoTracks()[0].addEventListener('ended', stop);
    if (!hasAudio && PZ.app) PZ.app.forceVision = true;
    PStore.updateStats((st, award) => award('anywhere'));
    setTimeout(() => { if (PZ.app) PZ.app.checkKey(true); }, 600);
  }
  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (PZ.app && PZ.app.session) PZ.app.finish();
    $('bar').hidden = true;
    v.hidden = true; $('intro').hidden = false;
  }
  $('start').onclick = start;
  $('stop').onclick = stop;
  $('pause').onclick = () => { if (v.paused) { v.play(); $('pause').textContent = 'Pause'; } else { v.pause(); $('pause').textContent = 'Resume'; } };
  $('float').onclick = () => PZ.Extras.float(PZ.app);
  $('talk').onclick = () => PZ.app.toggleTalk();
  $('snap').onclick = () => PZ.app.snap();
})();
