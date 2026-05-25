// Tiny WebAudio sound manager (no files needed)
const Audio = (() => {
  let ctx, muted = false;
  const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); };
  const beep = (freq, dur = 0.12, type = 'sine', vol = 0.15) => {
    if (muted) return;
    try {
      ensure();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (e) {}
  };
  const chord = (notes, dur = 0.15, type = 'triangle') => notes.forEach((f, i) => setTimeout(() => beep(f, dur, type), i * 60));
  return {
    correct: () => chord([523, 659, 784], 0.16, 'triangle'),
    wrong: () => { beep(180, 0.18, 'sawtooth', 0.18); setTimeout(() => beep(140, 0.2, 'sawtooth', 0.18), 100); },
    xp: () => chord([700, 900, 1100], 0.1, 'sine'),
    levelUp: () => chord([523, 659, 784, 1046, 1318], 0.18, 'triangle'),
    chest: () => chord([392, 523, 659, 880], 0.22, 'triangle'),
    tap: () => beep(620, 0.05, 'square', 0.08),
    heart: () => beep(140, 0.3, 'sawtooth', 0.2),
    setMuted: v => { muted = v; },
    isMuted: () => muted,
  };
})();
