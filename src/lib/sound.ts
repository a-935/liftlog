// One soft two-note chime via Web Audio. iOS only allows audio after a user gesture,
// so unlockAudio() is called when the rest stopwatch is started.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio() {
  try {
    const c = context();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    // a silent buffer fully unlocks playback on iOS
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // ignore
  }
}

export function playChime() {
  try {
    const c = context();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime + 0.02;
    [
      [659.25, 0],
      [987.77, 0.18],
    ].forEach(([freq, delay]) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = t0 + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 1.2);
    });
  } catch {
    // ignore
  }
}
