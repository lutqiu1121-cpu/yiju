
let ctx = null;
let droneNodes = null;
let enabled = localStorage.getItem('qipai.sound') !== 'off';

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type, gain, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, gain, hp) {
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 900;
  const g = a.createGain(); g.gain.value = gain || 0.06;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}
export const Sound = {
  setEnabled(v) { enabled = !!v; localStorage.setItem('qipai.sound', v ? 'on' : 'off'); },
  isEnabled() { return enabled; },
  place() { noise(0.055, 0.075, 1200); tone(196, 0.09, 'sine', 0.05); },
  capture() { noise(0.1, 0.09, 700); tone(128, 0.14, 'triangle', 0.07); },
  card() { noise(0.045, 0.05, 1600); tone(330, 0.05, 'triangle', 0.03); },
  tap() { tone(520, 0.035, 'sine', 0.028); },
  dice() { noise(0.16, 0.06, 500); tone(240, 0.08, 'square', 0.025, 0.05); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.22, 'sine', 0.055, i * 0.1)); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.24, 'sine', 0.045, i * 0.12)); },
  alert() { tone(660, 0.09, 'triangle', 0.05); tone(880, 0.09, 'triangle', 0.04, 0.11); },

  cue(name) {
    switch (name) {
      case 'curtain': tone(196, .5, 'sine', .045); tone(294, .6, 'sine', .03, .12); break;
      case 'doorbell': tone(784, .22, 'sine', .05); tone(659, .28, 'sine', .045, .19); break;
      case 'clock': tone(440, .12, 'triangle', .035); tone(392, .16, 'triangle', .03, .85); break;
      case 'paper': noise(.09, .035, 2200); break;
      case 'chime': [523, 659, 784].forEach((f, i) => tone(f, .35, 'sine', .035, i * .13)); break;
      case 'gong': tone(110, 1.1, 'sine', .06); tone(165, .9, 'sine', .03, .06); noise(.5, .02, 300); break;
      case 'end': [392, 330, 262, 196].forEach((f, i) => tone(f, .4, 'sine', .04, i * .16)); break;
      default: tone(520, .04, 'sine', .02);
    }
  },

  ambience(kind, on) {
    const a = ac(); if (!a) return;
    if (!on || !kind || kind === 'none') { stopDrone(); return; }
    if (droneNodes && droneNodes.kind === kind) return;
    stopDrone();
    try {
      const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
      o.type = kind === 'rain' ? 'sawtooth' : 'sine';
      o.frequency.value = kind === 'rain' ? 58 : kind === 'hum' ? 82 : 110;
      f.type = 'lowpass'; f.frequency.value = kind === 'rain' ? 420 : 220;
      g.gain.value = kind === 'rain' ? .012 : .008;
      o.connect(f); f.connect(g); g.connect(a.destination); o.start();
      droneNodes = { kind, o, g };
    } catch (e) {}
  }
};
function stopDrone() {
  if (!droneNodes) return;
  try { droneNodes.g.gain.exponentialRampToValueAtTime(.0001, (ctx ? ctx.currentTime : 0) + .4);
        setTimeout(() => { try { droneNodes.o.stop(); } catch (e) {} }, 500); } catch (e) {}
  droneNodes = null;
}
