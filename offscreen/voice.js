/* Piniso — real-time voice talk (speech-to-speech). Runs in the offscreen document so the
   conversation survives tab switches. Gemini Live (free) or OpenAI Realtime (paid).
   Live captions come from the model's own input/output transcriptions. */
(() => {
  let SEQ = 0;
  const emit = (tabId, evt) => { evt.seq = ++SEQ; chrome.runtime.sendMessage({ type: 'voice:evt', tabId, evt }).catch(() => {}); };

  const b64FromBuf = (buf) => {
    const u = new Uint8Array(buf); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const bufFromB64 = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

  // ---------------- audio playback with barge-in ----------------
  class Player {
    constructor() {
      this.ctx = new AudioContext();
      this.out = this.ctx.createGain();
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 512;
      this.out.connect(this.an); this.an.connect(this.ctx.destination);
      this.next = 0; this.srcs = new Set();
    }
    play(pcmBuf, rate) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const i16 = new Int16Array(pcmBuf);
      if (!i16.length) return;
      const ab = this.ctx.createBuffer(1, i16.length, rate || 24000);
      const ch = ab.getChannelData(0);
      for (let i = 0; i < i16.length; i++) ch[i] = i16[i] / 32768;
      const src = this.ctx.createBufferSource();
      src.buffer = ab; src.connect(this.out);
      const now = this.ctx.currentTime;
      if (this.next < now + 0.02) this.next = now + 0.06;
      src.start(this.next);
      this.next += ab.duration;
      this.srcs.add(src);
      src.onended = () => this.srcs.delete(src);
    }
    flush() { this.srcs.forEach((s) => { try { s.stop(); } catch (e) {} }); this.srcs.clear(); this.next = 0; }
    speaking() { return this.srcs.size > 0; }
    level() {
      const d = new Uint8Array(this.an.fftSize); this.an.getByteTimeDomainData(d);
      let p = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i] - 128) / 128; if (v > p) p = v; }
      return p;
    }
    close() { this.flush(); try { this.ctx.close(); } catch (e) {} }
  }

  // ---------------- microphone ----------------
  class Mic {
    async start(rate, onChunk) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      this.ctx = new AudioContext();
      await this.ctx.audioWorklet.addModule(chrome.runtime.getURL('offscreen/pcm-worklet.js'));
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.node = new AudioWorkletNode(this.ctx, 'piniso-pcm', { processorOptions: { rate } });
      this.node.port.onmessage = (e) => { this.level = e.data.level; onChunk(e.data.pcm); };
      src.connect(this.node);
      this.level = 0;
    }
    stop() { try { this.stream.getTracks().forEach((t) => t.stop()); } catch (e) {} try { this.ctx.close(); } catch (e) {} }
  }

  // ---------------- Gemini Live ----------------
  class GeminiLive {
    constructor(cfg, h) { this.cfg = cfg; this.h = h; this.handle = null; this.retries = 0; this.closedByUser = false; this.inRate = 16000; }
    url() { return 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(this.cfg.key); }
    connect() {
      return new Promise((resolve, reject) => {
        const ws = this.ws = new WebSocket(this.url());
        ws.binaryType = 'arraybuffer';
        let ready = false;
        ws.onopen = () => {
          const setup = {
            model: this.cfg.model.startsWith('models/') ? this.cfg.model : 'models/' + this.cfg.model,
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.cfg.voice || 'Puck' } } } },
            systemInstruction: { parts: [{ text: this.cfg.system }] },
            tools: [{ functionDeclarations: this.cfg.tools }],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: this.handle ? { handle: this.handle } : {},
            contextWindowCompression: { slidingWindow: {} }
          };
          ws.send(JSON.stringify({ setup }));
        };
        ws.onmessage = (ev) => {
          let m;
          try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data)); } catch (e) { return; }
          if (m.setupComplete) {
            if (!ready) { ready = true; resolve(); }
            if (!this.greeted) { this.greeted = true; this.sendText(this.cfg.opener || 'Start now.', true); }
            return;
          }
          if (m.sessionResumptionUpdate && m.sessionResumptionUpdate.newHandle) this.handle = m.sessionResumptionUpdate.newHandle;
          if (m.goAway) { this.reconnectSoon = true; }
          const sc = m.serverContent;
          if (sc) {
            if (sc.interrupted) this.h.onInterrupt();
            if (sc.modelTurn && sc.modelTurn.parts) for (const p of sc.modelTurn.parts) {
              if (p.inlineData && /audio/.test(p.inlineData.mimeType || '')) {
                const rate = Number(((p.inlineData.mimeType || '').match(/rate=(\d+)/) || [])[1]) || 24000;
                this.h.onAudio(bufFromB64(p.inlineData.data), rate);
              }
            }
            if (sc.inputTranscription && sc.inputTranscription.text) this.h.onCaption('you', sc.inputTranscription.text, false);
            if (sc.outputTranscription && sc.outputTranscription.text) this.h.onCaption('pz', sc.outputTranscription.text, false);
            if (sc.turnComplete || sc.generationComplete) this.h.onTurnEnd();
          }
          if (m.toolCall && m.toolCall.functionCalls) for (const fc of m.toolCall.functionCalls) this.h.onTool(fc.id, fc.name, fc.args || {});
          if (m.usageMetadata && m.usageMetadata.totalTokenCount) this.h.onUsage && this.h.onUsage(m.usageMetadata.totalTokenCount);
        };
        ws.onerror = () => {};
        ws.onclose = (ev) => {
          if (!ready) { reject(new Error(ev.reason || 'Could not connect to Gemini Live (code ' + ev.code + '). Check your Gemini key.')); return; }
          if (this.closedByUser) return;
          if (this.handle && this.retries < 4) {
            this.retries++;
            this.h.onState('reconnecting');
            setTimeout(() => this.connect().then(() => { this.retries = 0; this.h.onState('live'); }).catch((e) => this.h.onEnd(e.message)), 400);
          } else this.h.onEnd(ev.reason || 'The voice session ended.');
        };
      });
    }
    open() { return this.ws && this.ws.readyState === 1; }
    sendAudio(buf) { if (this.open()) this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64FromBuf(buf), mimeType: 'audio/pcm;rate=16000' } } })); }
    endAudio() { if (this.open()) this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); }
    sendText(text, respond = true) {
      if (!this.open()) return;
      if (respond) this.ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } }));
      else this.ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: '[context, do not reply] ' + text }] }], turnComplete: false } }));
    }
    sendImage(dataUrl) {
      if (!this.open() || !dataUrl) return;
      const [head, data] = dataUrl.split(',');
      const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      this.ws.send(JSON.stringify({ realtimeInput: { video: { data, mimeType: mime } } }));
    }
    toolResult(id, name, result) {
      if (this.open()) this.ws.send(JSON.stringify({ toolResponse: { functionResponses: [{ id, name, response: { result } }] } }));
    }
    close() { this.closedByUser = true; try { this.ws.close(); } catch (e) {} }
  }

  // ---------------- OpenAI Realtime ----------------
  class OpenAIRealtime {
    constructor(cfg, h) { this.cfg = cfg; this.h = h; this.inRate = 24000; this.closedByUser = false; }
    connect() {
      return new Promise((resolve, reject) => {
        const ws = this.ws = new WebSocket('wss://api.openai.com/v1/realtime?model=' + encodeURIComponent(this.cfg.model || 'gpt-realtime-2'), ['realtime', 'openai-insecure-api-key.' + this.cfg.key]);
        let ready = false;
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime', instructions: this.cfg.system, output_modalities: ['audio'],
              audio: {
                input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: 'whisper-1' }, turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true } },
                output: { format: { type: 'audio/pcm', rate: 24000 }, voice: this.cfg.voice || 'marin' }
              },
              tools: this.cfg.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters || { type: 'object', properties: {} } })),
              tool_choice: 'auto'
            }
          }));
        };
        ws.onmessage = (ev) => {
          let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
          switch (m.type) {
            case 'session.created': case 'session.updated':
              if (!ready) { ready = true; resolve(); this.sendText(this.cfg.opener || 'Start now.', true); }
              break;
            case 'response.output_audio.delta': case 'response.audio.delta': this.h.onAudio(bufFromB64(m.delta), 24000); break;
            case 'response.output_audio_transcript.delta': case 'response.audio_transcript.delta': this.h.onCaption('pz', m.delta, false); break;
            case 'conversation.item.input_audio_transcription.delta': this.h.onCaption('you', m.delta, false); break;
            case 'conversation.item.input_audio_transcription.completed': if (!this.gotDelta) this.h.onCaption('you', m.transcript || '', false); this.h.onTurnEnd('you'); break;
            case 'input_audio_buffer.speech_started': this.h.onInterrupt(); break;
            case 'response.done': this.h.onTurnEnd(); break;
            case 'response.function_call_arguments.done': { let a = {}; try { a = JSON.parse(m.arguments || '{}'); } catch (e) {} this.h.onTool(m.call_id, m.name, a); break; }
            case 'error': if (!ready) reject(new Error((m.error && m.error.message) || 'OpenAI Realtime error')); else this.h.onError((m.error && m.error.message) || 'OpenAI error'); break;
            default: break;
          }
        };
        ws.onclose = (ev) => { if (!ready) reject(new Error(ev.reason || 'Could not connect to OpenAI Realtime. Check your OpenAI key.')); else if (!this.closedByUser) this.h.onEnd(ev.reason || 'The voice session ended.'); };
      });
    }
    open() { return this.ws && this.ws.readyState === 1; }
    sendAudio(buf) { if (this.open()) this.ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64FromBuf(buf) })); }
    endAudio() {}
    sendText(text, respond = true) {
      if (!this.open()) return;
      this.ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: respond ? text : '[context, do not reply] ' + text }] } }));
      if (respond) this.ws.send(JSON.stringify({ type: 'response.create' }));
    }
    sendImage(dataUrl) { if (this.open() && dataUrl) this.ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: dataUrl }] } })); }
    toolResult(id, name, result) {
      if (!this.open()) return;
      this.ws.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output: JSON.stringify({ result }) } }));
      this.ws.send(JSON.stringify({ type: 'response.create' }));
    }
    close() { this.closedByUser = true; try { this.ws.close(); } catch (e) {} }
  }

  // ---------------- session manager ----------------
  let S = null;
  async function start(cfg) {
    await stop(true);
    const tabId = cfg.tabId;
    const player = new Player();
    const mic = new Mic();
    let muted = false, ptt = !!cfg.ptt, talking = !ptt;
    let levelTimer = null;
    const startedAt = Date.now();
    const h = {
      onAudio: (buf, rate) => player.play(buf, rate),
      onInterrupt: () => { player.flush(); emit(tabId, { kind: 'interrupt' }); },
      onCaption: (who, text, final) => emit(tabId, { kind: 'caption', who, text, final }),
      onTurnEnd: (who) => emit(tabId, { kind: 'turn', who: who || 'pz' }),
      onTool: (id, name, args) => emit(tabId, { kind: 'tool', id, name, args }),
      onState: (st) => emit(tabId, { kind: 'state', state: st }),
      onError: (msg) => emit(tabId, { kind: 'error', error: msg }),
      onEnd: (why) => { emit(tabId, { kind: 'state', state: 'ended', error: why, seconds: (Date.now() - startedAt) / 1000 }); stop(true); },
      onUsage: () => {}
    };
    const Cls = cfg.provider === 'openai' ? OpenAIRealtime : GeminiLive;
    const conn = new Cls(cfg, h);
    S = { tabId, player, mic, conn, cfg, startedAt, set muted(v) { muted = v; }, get muted() { return muted; }, setPtt(v) { ptt = v; talking = !v; }, setTalking(v) { talking = v; if (!v) conn.endAudio(); } };
    emit(tabId, { kind: 'state', state: 'connecting' });
    try {
      await mic.start(conn.inRate, (buf) => { if (!muted && talking && S && S.conn === conn) conn.sendAudio(buf); });
    } catch (e) {
      emit(tabId, { kind: 'state', state: 'ended', error: 'NEEDS_MIC', detail: e.name || String(e) });
      await stop(true);
      return { ok: false, code: 'NEEDS_MIC' };
    }
    try { await conn.connect(); }
    catch (e) { emit(tabId, { kind: 'state', state: 'ended', error: e.message }); await stop(true); return { ok: false, error: e.message }; }
    emit(tabId, { kind: 'state', state: 'live', provider: cfg.provider, model: cfg.model });
    levelTimer = setInterval(() => { if (!S) return; emit(tabId, { kind: 'level', pz: player.level(), you: muted ? 0 : (mic.level || 0), speaking: player.speaking() }); }, 120);
    S.levelTimer = levelTimer;
    return { ok: true };
  }
  async function stop(silent) {
    if (!S) return;
    const s = S; S = null;
    clearInterval(s.levelTimer);
    try { s.conn.close(); } catch (e) {}
    s.mic.stop(); s.player.close();
    if (!silent) emit(s.tabId, { kind: 'state', state: 'ended', seconds: (Date.now() - s.startedAt) / 1000 });
  }

  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!msg || msg.type !== 'off:voice') return false;
    switch (msg.op) {
      case 'start': start(msg.cfg).then(reply, (e) => reply({ ok: false, error: String(e) })); return true;
      case 'stop': stop(false).then(() => reply({ ok: true })); return true;
      case 'mute': if (S) S.muted = !!msg.on; reply({ ok: true }); return false;
      case 'ptt': if (S) S.setPtt(!!msg.on); reply({ ok: true }); return false;
      case 'talking': if (S) S.setTalking(!!msg.on); reply({ ok: true }); return false;
      case 'text': if (S) S.conn.sendText(msg.text, msg.respond !== false); reply({ ok: true }); return false;
      case 'image': if (S) S.conn.sendImage(msg.dataUrl); reply({ ok: true }); return false;
      case 'tool': if (S) S.conn.toolResult(msg.id, msg.name, msg.result); reply({ ok: true }); return false;
      case 'status': reply({ ok: true, on: !!S, tabId: S && S.tabId }); return false;
      default: reply({ ok: false }); return false;
    }
  });
})();
