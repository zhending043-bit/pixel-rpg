// ========== 8-bit Sound Effects (Web Audio API) ==========
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.15) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) { /* audio not supported */ }
}

function playNoise(duration, volume = 0.08) {
  try {
    const ctx = getAudioCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime);
  } catch (e) { /* audio not supported */ }
}

// Sound effects
function soundPlayerAttack() {
  playTone(520, 0.08, 'square', 0.12);
  setTimeout(() => playTone(440, 0.06, 'square', 0.10), 40);
}

function soundMonsterAttack() {
  playTone(300, 0.1, 'square', 0.10);
  setTimeout(() => playTone(250, 0.08, 'square', 0.08), 50);
}

function soundCriticalHit() {
  playTone(780, 0.06, 'square', 0.15);
  setTimeout(() => playTone(1040, 0.06, 'square', 0.15), 40);
  setTimeout(() => playTone(780, 0.1, 'square', 0.12), 80);
}

function soundVictory() {
  const notes = [520, 660, 780, 1040];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.15, 'square', 0.12), i * 100);
  });
}

function soundDefeat() {
  const notes = [400, 350, 300, 200];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.2, 'square', 0.10), i * 120);
  });
}

function soundClick() {
  playTone(660, 0.04, 'square', 0.06);
}

function soundFlee() {
  playTone(400, 0.1, 'square', 0.10);
  setTimeout(() => playTone(500, 0.1, 'square', 0.10), 80);
  setTimeout(() => playTone(600, 0.12, 'square', 0.08), 160);
}

function soundGameOver() {
  playTone(200, 0.3, 'square', 0.12);
  setTimeout(() => playTone(150, 0.3, 'square', 0.10), 300);
  setTimeout(() => playTone(100, 0.5, 'square', 0.08), 600);
}

// ========== 8-bit Background Music ==========
let bgmPlaying = false;
let bgmTimeoutId = null;

const NOTE = {
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
};

function startBGM() {
  if (bgmPlaying) return;
  bgmPlaying = true;
  scheduleBGM();
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmTimeoutId) {
    clearTimeout(bgmTimeoutId);
    bgmTimeoutId = null;
  }
}

function scheduleBGM() {
  if (!bgmPlaying) return;
  const ctx = getAudioCtx();
  const bpm = 130;
  const beat = 60 / bpm;
  const startTime = ctx.currentTime + 0.05;

  // Melody: [freq|null, beats] - adventure feel using pentatonic scale
  const melody = [
    [NOTE.E4,1],[NOTE.E4,1],[null,0.5],[NOTE.E4,1.5],[null,1],[NOTE.C4,0.5],[NOTE.E4,0.5],[NOTE.G4,1],
    [null,1],[NOTE.G3,1],[null,2],[NOTE.G3,1],[null,1],
    [NOTE.C4,0.5],[NOTE.G3,0.5],[NOTE.E3,1],[NOTE.A3,1],[null,0.5],[NOTE.B3,0.5],[NOTE.C4,1],[NOTE.G3,1],
    [NOTE.E4,1],[NOTE.D4,0.5],[NOTE.C4,0.5],[null,1],[NOTE.G3,1],[null,1],
    // repeat
    [NOTE.E4,1],[NOTE.E4,1],[null,0.5],[NOTE.E4,1.5],[null,1],[NOTE.C4,0.5],[NOTE.E4,0.5],[NOTE.G4,1],
    [null,1],[NOTE.G3,1],[null,2],[NOTE.G3,1],[null,1],
    [NOTE.E4,0.5],[NOTE.C4,0.5],[NOTE.G3,1],[NOTE.A3,1],[null,0.5],[NOTE.B3,0.5],[NOTE.C4,1],[NOTE.G3,1],
    [null,1],[NOTE.G4,1],[NOTE.E4,1],[NOTE.C4,1],[null,1],
  ];

  // Bass line
  const bass = [
    [NOTE.C3,2],[NOTE.G3,2],[NOTE.A3,2],[NOTE.E3,1],[NOTE.F3,1],
    [NOTE.C3,2],[NOTE.G3,2],[NOTE.A3,2],[NOTE.E3,1],[NOTE.F3,1],
    [NOTE.C3,2],[NOTE.G3,2],[NOTE.A3,2],[NOTE.E3,1],[NOTE.F3,1],
    [NOTE.G3,1],[NOTE.F3,1],[NOTE.E3,1],[NOTE.D3,1],[NOTE.C3,2],
  ];

  const totalBeats = melody.reduce((s, [,b]) => s + b, 0);
  const totalDuration = totalBeats * beat;

  function playPart(notes, type, vol) {
    let t = startTime;
    for (const [freq, beats] of notes) {
      if (freq) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + beats * beat * 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + beats * beat);
      }
      t += beats * beat;
    }
  }

  playPart(melody, 'square', 0.07);
  playPart(bass, 'triangle', 0.10);

  // Light percussion (noise clicks on downbeats)
  for (let i = 0; i < totalBeats; i += 2) {
    const t = startTime + i * beat;
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.04, t);
    noise.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);
  }

  bgmTimeoutId = setTimeout(scheduleBGM, totalDuration * 1000);
}
