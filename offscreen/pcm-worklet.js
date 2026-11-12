/* Piniso — mic capture worklet: downsample to a target rate and post 16-bit PCM chunks (~100 ms). */
class PinisoPCM extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.target = (opts && opts.processorOptions && opts.processorOptions.rate) || 16000;
    this.ratio = sampleRate / this.target;
    this.buf = [];
    this.pos = 0;
    this.chunk = Math.round(this.target / 10);
    this.level = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let peak = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
    this.level = Math.max(peak, this.level * 0.9);
    // simple decimation with averaging
    while (this.pos < ch.length) {
      const a = Math.floor(this.pos), b = Math.min(ch.length - 1, Math.floor(this.pos + this.ratio));
      let s = 0, n = 0;
      for (let i = a; i <= b; i++) { s += ch[i]; n++; }
      this.buf.push(n ? s / n : 0);
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    if (this.buf.length >= this.chunk) {
      const out = new Int16Array(this.buf.length);
      for (let i = 0; i < this.buf.length; i++) { const v = Math.max(-1, Math.min(1, this.buf[i])); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
      this.port.postMessage({ pcm: out.buffer, level: this.level }, [out.buffer]);
      this.buf = [];
    }
    return true;
  }
}
registerProcessor('piniso-pcm', PinisoPCM);
