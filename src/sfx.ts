// Tiny WebAudio sound effects (no audio files). Starts on the first user gesture; mute is remembered.
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem("atlantis-mute") === "1";
} catch {
  /* ignore */
}
const ac = (): AudioContext | null => {
  if (muted || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
};
function tone(f0: number, f1: number, dur: number, type: OscillatorType = "sine", vol = 0.12, delay = 0): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.1, hp = 800, delay = 0): void {
  const c = ac();
  if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay;
  s.buffer = buf;
  f.type = "highpass";
  f.frequency.value = hp;
  g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
}
export function sfx(name: string): void {
  switch (name) {
    case "move": tone(420, 300, 0.09, "triangle", 0.08); break;
    case "take": tone(300, 620, 0.12, "square", 0.05); tone(620, 920, 0.1, "square", 0.045, 0.08); break;
    case "roll": for (let i = 0; i < 6; i++) { noise(0.05, 0.1, 1500, i * 0.09); tone(300 + i * 40, 200, 0.05, "square", 0.03, i * 0.09); } break;
    case "saved": [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, "sine", 0.1, i * 0.09)); break;
    case "splash": noise(0.3, 0.1, 1200); break;
    case "crash": noise(0.5, 0.18, 200); tone(200, 50, 0.5, "sawtooth", 0.08); break;
    case "whirl": tone(700, 120, 1.1, "sine", 0.1); noise(0.9, 0.05, 400); break;
    case "erupt": noise(1.4, 0.22, 60); tone(90, 30, 1.4, "sawtooth", 0.14); break;
    case "shield": tone(500, 900, 0.25, "triangle", 0.1); break;
    case "turn": tone(660, 660, 0.12, "sine", 0.1); tone(880, 880, 0.16, "sine", 0.1, 0.12); break;
  }
}
export const toggleMute = (): boolean => {
  muted = !muted;
  try {
    localStorage.setItem("atlantis-mute", muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  return muted;
};
export const isMuted = (): boolean => muted;
