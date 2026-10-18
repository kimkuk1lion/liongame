import { loadSoundSettings } from "./settings";

export type SoundEffect =
  | "launch"
  | "bounce"
  | "marbleHit"
  | "hole"
  | "capture"
  | "turn"
  | "gameOver"
  | "ui";

let audioContext: AudioContext | null = null;
let lastBounceTime = 0;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let nextMusicTime = 0;

const MUSIC_BPM = 122;
const MUSIC_STEP_SECONDS = 60 / MUSIC_BPM / 2;
const MUSIC_STEPS_PER_LOOP = 32;
const MUSIC_CHORDS = [
  [60, 64, 67], // C major
  [55, 59, 62], // G major
  [57, 60, 64], // A minor
  [53, 57, 60], // F major
];
const MUSIC_MELODY: Array<number | null> = [
  76, 79, 84, 79, 76, 74, 72, 74,
  79, 83, 86, 83, 79, 76, 74, 76,
  81, 84, 88, 84, 81, 79, 76, 79,
  77, 81, 84, 81, 77, 76, 74, 72,
];

export function startBackgroundMusic() {
  const settings = loadSoundSettings();
  if (!settings.bgmEnabled || settings.bgmVolume <= 0) {
    stopBackgroundMusic();
    return;
  }

  const context = getAudioContext();
  if (!context) return;
  resumeAudioContext(context);
  if (!musicGain) {
    musicGain = context.createGain();
    musicGain.connect(context.destination);
  }
  setMusicVolume(settings.bgmVolume);
  if (musicTimer !== null) return;

  musicStep = 0;
  nextMusicTime = context.currentTime + 0.06;
  musicTimer = window.setInterval(() => scheduleMusic(context), 25);
}

export function updateBackgroundMusic() {
  const settings = loadSoundSettings();
  if (!settings.bgmEnabled || settings.bgmVolume <= 0) {
    stopBackgroundMusic();
    return;
  }
  if (musicTimer === null) {
    startBackgroundMusic();
    return;
  }
  setMusicVolume(settings.bgmVolume);
}

export function stopBackgroundMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
  musicStep = 0;
  if (audioContext && musicGain) {
    musicGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.025);
  }
}

export function playSoundEffect(effect: SoundEffect) {
  const context = getAudioContext();
  if (!context) return;
  resumeAudioContext(context);

  const settings = loadSoundSettings();
  if (!settings.sfxEnabled || settings.sfxVolume <= 0) {
    return;
  }

  const now = context.currentTime;
  if (effect === "bounce") {
    if (now - lastBounceTime < 0.075) return;
    lastBounceTime = now;
  }
  const volume = settings.sfxVolume / 100;

  switch (effect) {
    case "launch":
      tone(context, 250, 520, 0.12, "triangle", volume * 0.28);
      noise(context, 0.09, volume * 0.08, 900);
      break;
    case "bounce":
      tone(context, 230, 125, 0.055, "sine", volume * 0.24);
      break;
    case "marbleHit":
      tone(context, 420, 185, 0.11, "triangle", volume * 0.33);
      tone(context, 760, 340, 0.075, "sine", volume * 0.12, 0.008);
      break;
    case "hole":
      tone(context, 500, 95, 0.32, "sine", volume * 0.3);
      tone(context, 260, 70, 0.24, "triangle", volume * 0.14, 0.035);
      break;
    case "capture":
      tone(context, 392, 392, 0.2, "triangle", volume * 0.24);
      tone(context, 523, 523, 0.24, "triangle", volume * 0.22, 0.09);
      tone(context, 659, 659, 0.32, "sine", volume * 0.2, 0.18);
      break;
    case "turn":
      tone(context, 560, 740, 0.09, "sine", volume * 0.16);
      break;
    case "gameOver":
      tone(context, 440, 330, 0.22, "triangle", volume * 0.25);
      tone(context, 330, 220, 0.28, "triangle", volume * 0.22, 0.2);
      tone(context, 220, 165, 0.38, "sine", volume * 0.2, 0.4);
      break;
    case "ui":
      tone(context, 680, 520, 0.055, "sine", volume * 0.13);
      break;
  }
}

function getAudioContext() {
  const Context = window.AudioContext;
  if (!Context) return null;
  audioContext ??= new Context();
  return audioContext;
}

function resumeAudioContext(context: AudioContext) {
  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
}

function setMusicVolume(volume: number) {
  if (!audioContext || !musicGain) return;
  musicGain.gain.setTargetAtTime((volume / 100) * 0.42, audioContext.currentTime, 0.08);
}

function scheduleMusic(context: AudioContext) {
  if (!musicGain) return;
  const scheduleUntil = context.currentTime + 0.12;
  while (nextMusicTime < scheduleUntil) {
    scheduleMusicStep(context, musicStep, nextMusicTime);
    musicStep = (musicStep + 1) % MUSIC_STEPS_PER_LOOP;
    nextMusicTime += MUSIC_STEP_SECONDS;
  }
}

function scheduleMusicStep(context: AudioContext, step: number, startTime: number) {
  if (!musicGain) return;
  const output = musicGain;
  const delay = Math.max(0, startTime - context.currentTime);
  const beatInBar = step % 8;
  const chord = MUSIC_CHORDS[Math.floor(step / 8)];

  if (step % 2 === 0) {
    const bassRoot = chord[0] - 24;
    const bassFrequency = midiToFrequency(bassRoot);
    tone(context, bassFrequency, bassFrequency * 0.92, 0.21, "triangle", 0.24, delay, output);
    if (beatInBar === 0 || beatInBar === 4) {
      tone(context, 112, 42, 0.13, "sine", 0.2, delay, output);
    } else {
      noise(context, 0.065, 0.09, 2400, delay, output);
    }
  }

  if (beatInBar === 0 || beatInBar === 4) {
    chord.forEach((note, index) => {
      const frequency = midiToFrequency(note + 12);
      tone(context, frequency, frequency * 0.995, 0.24, "triangle", 0.055, delay + index * 0.006, output);
    });
  }

  const melodyNote = MUSIC_MELODY[step];
  if (melodyNote !== null) {
    const frequency = midiToFrequency(melodyNote);
    tone(context, frequency, frequency * 0.97, 0.16, "sine", 0.13, delay, output);
  }
}

function midiToFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function tone(
  context: AudioContext,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0,
  output: AudioNode = context.destination,
) {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.012, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function noise(
  context: AudioContext,
  duration: number,
  volume: number,
  cutoff: number,
  delay = 0,
  output: AudioNode = context.destination,
) {
  const sampleCount = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const start = context.currentTime + delay;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start);
}
