// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, chimes and thuds, each a short oscillator envelope.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // Sound is garnish; a failure never stops the game.
    }
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function engine(speedRatio) {
    if (!ensure() || muted) {
      stopEngine();
      return;
    }
    try {
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineGain = context.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = speedRatio > 0.03 ? 0.05 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(60 + speedRatio * 140, context.currentTime, 0.1);
    } catch {
      // Ignore.
    }
  }

  function stopEngine() {
    if (engineGain) engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
  }

  function siren(on) {
    if (!ensure() || muted || !on) return;
    tone(720, 0.28, 'sine', 0.06, 540);
    window.setTimeout(() => tone(540, 0.28, 'sine', 0.06, 720), 300);
  }

  return {
    unlock,
    setMuted,
    isMuted: () => muted,
    engine,
    stopEngine,
    siren,
    punch: () => tone(120, 0.12, 'square', 0.12, 60),
    pickup: () => {
      tone(660, 0.12, 'sine', 0.1);
      window.setTimeout(() => tone(880, 0.16, 'sine', 0.1), 120);
    },
    paid: () => {
      tone(523, 0.1, 'triangle', 0.12);
      window.setTimeout(() => tone(659, 0.1, 'triangle', 0.12), 100);
      window.setTimeout(() => tone(784, 0.2, 'triangle', 0.12), 200);
    },
    crash: () => tone(90, 0.25, 'sawtooth', 0.16, 40),
    busted: () => {
      tone(392, 0.3, 'sawtooth', 0.1, 311);
      window.setTimeout(() => tone(311, 0.5, 'sawtooth', 0.1, 233), 300);
    },
    win: () => {
      tone(523, 0.15, 'triangle', 0.12);
      window.setTimeout(() => tone(659, 0.15, 'triangle', 0.12), 150);
      window.setTimeout(() => tone(784, 0.15, 'triangle', 0.12), 300);
      window.setTimeout(() => tone(1047, 0.35, 'triangle', 0.12), 450);
    },
  };
}
