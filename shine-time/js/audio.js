/* Synthesised sound effects (WebAudio, no audio files). */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.loops = {};
    this.volume = 0.8;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._makeLoops();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  _noiseLoop(filterType, freq, q, extra) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    let last = f;
    if (extra) last = extra(f);
    last.connect(g);
    g.connect(this.master);
    src.start();
    return { src, filter: f, gain: g, level: 0 };
  }

  _makeLoops() {
    const c = this.ctx;
    this.loops.spray = this._noiseLoop('bandpass', 2600, 0.6, (f) => {
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      f.connect(hp);
      return hp;
    });
    this.loops.foam = this._noiseLoop('lowpass', 900, 0.8);
    this.loops.scrub = this._noiseLoop('bandpass', 1300, 2.5);
    this.loops.towel = this._noiseLoop('bandpass', 700, 1.6);
    this.loops.blow = this._noiseLoop('lowpass', 520, 0.5);
    this.loops.mist = this._noiseLoop('highpass', 5200, 0.7);
    // polisher motor: buzzing oscillator
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 95;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(lp); lp.connect(g); g.connect(this.master);
    osc.start();
    this.loops.motor = { src: osc, filter: lp, gain: g, level: 0 };
  }

  /** Set each loop's target level (0..1) for this frame. */
  setLoops(levels) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const max = { spray: 0.22, foam: 0.2, scrub: 0.3, towel: 0.22, blow: 0.3, mist: 0.12, motor: 0.08 };
    for (const [k, loop] of Object.entries(this.loops)) {
      const target = (levels[k] || 0) * max[k];
      if (Math.abs(target - loop.level) > 0.002) {
        loop.gain.gain.setTargetAtTime(target, t, 0.05);
        loop.level = target;
      }
    }
    if (levels.motor) this.loops.motor.src.frequency.setTargetAtTime(90 + levels.motor * 40, t, 0.1);
  }

  tone(freq, dur = 0.15, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  click() { this.tone(900, 0.05, 'triangle', 0.08); }
  step() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.16, null, i * 0.07)); }
  done() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, null, i * 0.08)); }
  cash() {
    this.tone(1568, 0.09, 'square', 0.06);
    this.tone(2093, 0.25, 'square', 0.06, null, 0.08);
    this.tone(2637, 0.3, 'sine', 0.08, null, 0.16);
  }
  buy() { this.tone(660, 0.1, 'triangle', 0.15); this.tone(990, 0.2, 'triangle', 0.15, null, 0.08); }
  error() { this.tone(220, 0.18, 'sawtooth', 0.08, 160); }
  sad() { this.tone(440, 0.3, 'triangle', 0.12, 260); this.tone(330, 0.4, 'triangle', 0.1, 200, 0.2); }
  arrive() { this.tone(740, 0.12, 'sine', 0.12); this.tone(988, 0.16, 'sine', 0.1, null, 0.1); }
  engine(dur = 1.6) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.linearRampToValueAtTime(85, t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(60, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

export const Sound = new SoundEngine();
