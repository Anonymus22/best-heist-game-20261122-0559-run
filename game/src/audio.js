// Midnight Ledger - synthesized sound: every effect is an oscillator or a
// burst of filtered noise, made on the spot. No audio files, no network.
// The context wakes on the first key or click, as browsers require.

let ctx = null;

export function wakeAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

// One short tone with an exponential falloff.
function tone(freq, seconds, type, gain, slideTo) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + seconds);
  } catch {
    /* sound is garnish; never let it break the game */
  }
}

// A click of metal: a few milliseconds of high-passed noise.
function tick(gain) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2400;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start(t);
  } catch {
    /* as above */
  }
}

export const sfx = {
  coin() { tone(1560, 0.09, 'square', 0.05); setTimeout(() => tone(2090, 0.12, 'square', 0.04), 55); },
  step() { tick(0.015); },
  pickup() { tone(880, 0.08, 'triangle', 0.07); setTimeout(() => tone(1320, 0.1, 'triangle', 0.06), 60); },
  lock() { tick(0.2); tone(520, 0.12, 'triangle', 0.08); },
  slip() { tone(190, 0.16, 'sawtooth', 0.05, 120); },
  alarm() { tone(740, 0.14, 'square', 0.05); setTimeout(() => tone(740, 0.14, 'square', 0.05), 180); },
  caught() { tone(320, 0.4, 'sawtooth', 0.08, 70); },
  win() { tone(660, 0.12, 'triangle', 0.07); setTimeout(() => tone(990, 0.2, 'triangle', 0.07), 110); },
};
