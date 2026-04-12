/**
 * WAV Sound Generator for Lullaby Screen
 * Generates 12 high-quality 16-bit PCM WAV files
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION = 12; // seconds
const NUM_SAMPLES = SAMPLE_RATE * DURATION;
const outDir = path.join(__dirname, '..', 'assets', 'sounds');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ */
/* WAV Writer                                                          */
/* ------------------------------------------------------------------ */

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const byteRate = SAMPLE_RATE * 2; // 16-bit mono
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(val * 32000), 44 + i * 2);
  }

  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, buffer);
  console.log(`  Created: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
}

/* ------------------------------------------------------------------ */
/* Noise Generators                                                    */
/* ------------------------------------------------------------------ */

function brownNoise(n) {
  const out = new Float64Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    prev += (Math.random() * 2 - 1) * 0.05;
    if (prev > 1) prev = 1;
    if (prev < -1) prev = -1;
    out[i] = prev;
  }
  return out;
}

function pinkNoise(n) {
  const out = new Float64Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08;
    b6 = w * 0.115926;
  }
  return out;
}

function whiteNoise(n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (Math.random() * 2 - 1) * 0.3;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Envelope                                                            */
/* ------------------------------------------------------------------ */

function applyFades(samples, fadeIn = 0.5, fadeOut = 0.5) {
  const fiSamples = Math.floor(fadeIn * SAMPLE_RATE);
  const foSamples = Math.floor(fadeOut * SAMPLE_RATE);
  for (let i = 0; i < fiSamples && i < samples.length; i++) {
    samples[i] *= i / fiSamples;
  }
  for (let i = 0; i < foSamples && i < samples.length; i++) {
    samples[samples.length - 1 - i] *= i / foSamples;
  }
  return samples;
}

/* ------------------------------------------------------------------ */
/* White Noise Category                                                */
/* ------------------------------------------------------------------ */

function generateWomb() {
  const n = NUM_SAMPLES;
  const out = new Float64Array(n);
  const noise = brownNoise(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Deep rumble (brown noise)
    let val = noise[i] * 0.5;
    // Heartbeat pulse: ~72 BPM = 1.2 Hz
    const heartPhase = (t * 1.2) % 1;
    const beat1 = heartPhase < 0.08 ? Math.sin(heartPhase / 0.08 * Math.PI) * 0.35 : 0;
    const beat2 = (heartPhase > 0.12 && heartPhase < 0.18) ? Math.sin((heartPhase - 0.12) / 0.06 * Math.PI) * 0.2 : 0;
    val += (beat1 + beat2) * Math.sin(2 * Math.PI * 50 * t); // low thump
    out[i] = val;
  }
  return applyFades(out);
}

function generateVacuum() {
  const n = NUM_SAMPLES;
  const noise = pinkNoise(n);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Pink noise + slight oscillation to simulate motor
    const mod = 1 + 0.05 * Math.sin(2 * Math.PI * 25 * t);
    out[i] = noise[i] * 0.6 * mod;
  }
  return applyFades(out);
}

function generateHairdryer() {
  const n = NUM_SAMPLES;
  const white = whiteNoise(n);
  const pink = pinkNoise(n);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Mix white + pink for warmer high-freq sound
    out[i] = (white[i] * 0.3 + pink[i] * 0.4);
  }
  return applyFades(out);
}

function generateFan() {
  const n = NUM_SAMPLES;
  const noise = brownNoise(n);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Slow wobble like a fan rotating
    const wobble = 1 + 0.15 * Math.sin(2 * Math.PI * 0.8 * t);
    out[i] = noise[i] * 0.45 * wobble;
  }
  return applyFades(out);
}

/* ------------------------------------------------------------------ */
/* Nature Category                                                     */
/* ------------------------------------------------------------------ */

function generateRain() {
  const n = NUM_SAMPLES;
  const pink = pinkNoise(n);
  const out = new Float64Array(n);

  // Pre-generate random "drop" events
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Base rain: pink noise
    let val = pink[i] * 0.35;
    // Random amplitude variation (rain intensity)
    const mod = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.15 * t + Math.sin(2 * Math.PI * 0.07 * t));
    // Occasional louder drops
    if (Math.random() < 0.001) {
      for (let j = 0; j < 200 && i + j < n; j++) {
        out[i + j] = (out[i + j] || 0) + (Math.random() * 2 - 1) * 0.15 * (1 - j / 200);
      }
    }
    out[i] += val * mod;
  }
  return applyFades(out);
}

function generateWave() {
  const n = NUM_SAMPLES;
  const brown = brownNoise(n);
  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Wave cycle: ~8 second period — surge then recede
    const waveCycle = Math.sin(2 * Math.PI * t / 8);
    const envelope = 0.3 + 0.5 * Math.max(0, waveCycle);
    // Combine brown noise with envelope
    out[i] = brown[i] * envelope;
    // Add subtle high-freq splash at peak
    if (waveCycle > 0.7) {
      out[i] += (Math.random() * 2 - 1) * 0.08 * (waveCycle - 0.7) / 0.3;
    }
  }
  return applyFades(out);
}

function generateForest() {
  const n = NUM_SAMPLES;
  const out = new Float64Array(n);

  // Gentle wind (very soft brown noise)
  const wind = brownNoise(n);
  for (let i = 0; i < n; i++) {
    out[i] = wind[i] * 0.1;
  }

  // Bird chirps: short sine bursts at high frequencies
  const chirpCount = 15;
  for (let c = 0; c < chirpCount; c++) {
    const startSample = Math.floor(Math.random() * (n - SAMPLE_RATE * 0.5));
    const freq = 1500 + Math.random() * 2500; // 1500-4000 Hz
    const chirpLen = Math.floor((0.05 + Math.random() * 0.12) * SAMPLE_RATE);
    const notesInChirp = 2 + Math.floor(Math.random() * 3);

    for (let note = 0; note < notesInChirp; note++) {
      const noteStart = startSample + note * Math.floor(chirpLen * 1.3);
      const noteFreq = freq * (1 + (Math.random() - 0.5) * 0.3);
      for (let j = 0; j < chirpLen && noteStart + j < n; j++) {
        const t = j / SAMPLE_RATE;
        const env = Math.sin(Math.PI * j / chirpLen); // bell envelope
        out[noteStart + j] += Math.sin(2 * Math.PI * noteFreq * t) * env * 0.08;
      }
    }
  }

  return applyFades(out);
}

function generateStream() {
  const n = NUM_SAMPLES;
  const pink = pinkNoise(n);
  const white = whiteNoise(n);
  const out = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Gentle flowing: mix of pink + white with slow modulation
    const flow = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.3 * t + Math.sin(2 * Math.PI * 0.1 * t) * 2);
    out[i] = (pink[i] * 0.25 + white[i] * 0.1) * flow;
  }
  return applyFades(out);
}

/* ------------------------------------------------------------------ */
/* Lullaby Category — Real Melodies                                    */
/* ------------------------------------------------------------------ */

const NOTE_FREQ = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

function synthNote(freq, duration, sampleRate, style = 'soft') {
  const n = Math.floor(duration * sampleRate);
  const out = new Float64Array(n);
  const attack = 0.05;
  const release = Math.min(0.3, duration * 0.3);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Fundamental + harmonics
    let val = Math.sin(2 * Math.PI * freq * t);

    if (style === 'orgel') {
      // Music box: sharp attack, quick decay, high harmonics
      val += Math.sin(2 * Math.PI * freq * 2 * t) * 0.6;
      val += Math.sin(2 * Math.PI * freq * 3 * t) * 0.3;
      val += Math.sin(2 * Math.PI * freq * 5 * t) * 0.1;
    } else {
      // Soft: gentle harmonics
      val += Math.sin(2 * Math.PI * freq * 2 * t) * 0.2;
      val += Math.sin(2 * Math.PI * freq * 3 * t) * 0.05;
    }

    // Slight vibrato
    val *= 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t);

    // ADSR envelope
    let env;
    if (t < attack) {
      env = t / attack;
    } else if (t > duration - release) {
      env = (duration - t) / release;
    } else {
      env = style === 'orgel' ? Math.exp(-(t - attack) * 3) * 0.7 + 0.3 : 1;
    }

    out[i] = val * env;
  }
  return out;
}

function renderMelody(notes, bpm, style = 'soft') {
  const beatDur = 60 / bpm;
  const out = new Float64Array(NUM_SAMPLES);

  let pos = 0; // in samples
  for (const [noteName, beats] of notes) {
    const dur = beats * beatDur;
    const startSample = Math.floor(pos);

    if (noteName !== 'R') { // R = rest
      const freq = NOTE_FREQ[noteName];
      if (!freq) { pos += dur * SAMPLE_RATE; continue; }
      const noteSamples = synthNote(freq, dur * 0.9, SAMPLE_RATE, style);
      for (let i = 0; i < noteSamples.length && startSample + i < NUM_SAMPLES; i++) {
        out[startSample + i] += noteSamples[i] * 0.25;
      }
    }
    pos += dur * SAMPLE_RATE;
    if (pos >= NUM_SAMPLES) break;
  }

  // If melody is shorter than clip, repeat
  const melodyLen = Math.floor(pos);
  if (melodyLen > 0 && melodyLen < NUM_SAMPLES) {
    for (let i = melodyLen; i < NUM_SAMPLES; i++) {
      out[i] = out[i % melodyLen];
    }
  }

  return applyFades(out);
}

function generateTwinkle() {
  // Twinkle Twinkle Little Star in C major, 90 BPM
  const melody = [
    ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
    ['G4', 1], ['G4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
    ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ['R', 2],
  ];
  return renderMelody(melody, 80, 'soft');
}

function generateBrahms() {
  // Brahms' Lullaby (simplified), 72 BPM, 3/4 time feel
  const melody = [
    ['E4', 1], ['E4', 0.5], ['E4', 1.5], ['G4', 1], ['R', 0.5],
    ['E4', 1], ['E4', 0.5], ['E4', 1.5], ['G4', 1], ['R', 0.5],
    ['E4', 1], ['G4', 1], ['C5', 1], ['B4', 0.5], ['A4', 1.5],
    ['A4', 1], ['B4', 0.5], ['C5', 1.5], ['R', 0.5],
    ['A4', 1], ['F4', 0.5], ['A4', 1.5], ['G4', 1], ['F4', 0.5],
    ['E4', 1], ['D4', 0.5], ['E4', 1.5], ['R', 0.5],
    ['E4', 1], ['F4', 0.5], ['D4', 1.5], ['C4', 1], ['R', 1],
    ['R', 2],
  ];
  return renderMelody(melody, 72, 'soft');
}

function generateMozart() {
  // Ah! vous dirai-je, Maman (Mozart K.265 theme), 85 BPM
  const melody = [
    ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    // Variation: slightly different
    ['G4', 1], ['G4', 0.5], ['A4', 0.5], ['G4', 1], ['F4', 1], ['E4', 1], ['E4', 0.5], ['F4', 0.5], ['E4', 1], ['D4', 1],
    ['G4', 1], ['G4', 0.5], ['A4', 0.5], ['G4', 1], ['F4', 1], ['E4', 1], ['E4', 0.5], ['D4', 0.5], ['C4', 2],
    ['R', 2],
  ];
  return renderMelody(melody, 78, 'soft');
}

function generateOrgel() {
  // Music box version of Canon in D (simplified), higher octave
  const melody = [
    ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1],
    ['G4', 1], ['F4', 1], ['G4', 1], ['A4', 1],
    ['D5', 0.5], ['C5', 0.5], ['B4', 0.5], ['A4', 0.5], ['G4', 0.5], ['A4', 0.5], ['B4', 0.5], ['C5', 0.5],
    ['D5', 1], ['G4', 1], ['A4', 1], ['B4', 1],
    ['C5', 1], ['E4', 1], ['E4', 0.5], ['F4', 0.5], ['G4', 1],
    ['A4', 0.5], ['G4', 0.5], ['F4', 0.5], ['E4', 0.5], ['D4', 1], ['G4', 1],
    ['D4', 1], ['E4', 0.5], ['F4', 0.5], ['G4', 1], ['A4', 1],
    ['B4', 0.5], ['A4', 0.5], ['G4', 0.5], ['F4', 0.5], ['E4', 0.5], ['D4', 0.5], ['C4', 1],
    ['R', 2],
  ];
  return renderMelody(melody, 100, 'orgel');
}

/* ------------------------------------------------------------------ */
/* Generate All Sounds                                                 */
/* ------------------------------------------------------------------ */

console.log('Generating 12 WAV files...\n');

const generators = {
  'womb.wav': generateWomb,
  'vacuum.wav': generateVacuum,
  'hairdryer.wav': generateHairdryer,
  'fan.wav': generateFan,
  'rain.wav': generateRain,
  'wave.wav': generateWave,
  'forest.wav': generateForest,
  'stream.wav': generateStream,
  'twinkle.wav': generateTwinkle,
  'brahms.wav': generateBrahms,
  'mozart.wav': generateMozart,
  'orgel.wav': generateOrgel,
};

for (const [filename, gen] of Object.entries(generators)) {
  const samples = gen();
  writeWav(filename, samples);
}

console.log('\nDone! All sound files generated.');
