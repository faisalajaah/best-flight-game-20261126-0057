// Merapi Run — sound, all synthesized with WebAudio: an engine hum that
// follows the throttle, wind that rises with speed, a chime for each ring
// and a thud for touchdown. No audio files, no network, mute with M.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      // Engine: two detuned saws through a low-pass, quiet at idle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.5;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass that opens with speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  // Call from a user gesture (start button / first key): browsers only let
  // audio start after one.
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function setFlight(throttle, speed, flying) {
    if (!ctx || muted || !started) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(flying ? 0.03 + throttle * 0.05 : 0.015, t, 0.1);
    engineOsc.frequency.setTargetAtTime(45 + throttle * 70, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.12, (speed / 95) * 0.12), t, 0.2);
    windFilter.frequency.setTargetAtTime(300 + speed * 12, t, 0.2);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function ringChime() {
    blip(880, 0.35, 'sine', 0.16);
    blip(1318, 0.4, 'sine', 0.12, 0.07);
  }

  function touchdownThud() {
    blip(70, 0.25, 'sine', 0.3);
    blip(140, 0.18, 'triangle', 0.15, 0.02);
  }

  function crashBang() {
    blip(55, 0.6, 'sawtooth', 0.25);
    blip(38, 0.8, 'sine', 0.3, 0.05);
  }

  function toggleMute() {
    muted = !muted;
    if (ctx) {
      const t = ctx.currentTime;
      if (engineGain) engineGain.gain.setTargetAtTime(muted ? 0 : 0.05, t, 0.05);
      if (windGain) windGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return muted;
  }

  return { unlock, setFlight, ringChime, touchdownThud, crashBang, toggleMute, isMuted: () => muted };
}
