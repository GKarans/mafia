// client/src/utils/soundManager.js
const ambientKey = "__ambient__";
const active = new Map();
let globalMuted = false;

// simple FX queue (serializes non-ambient sounds)
const fxQueue = [];
let fxPlaying = false;

const AMBIENT_FILES = new Set(["nakts_skana.mp3"]);
const DEFAULT_AMBIENT_VOL = 0.35;
const DUCKED_AMBIENT_VOL = 0.10;

function isAmbient(file) {
  return AMBIENT_FILES.has(file);
}

function setVolume(audio, v) {
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, v));
}

function duckAmbient(on) {
  const amb = active.get(ambientKey);
  if (!amb) return;
  setVolume(amb, on ? DUCKED_AMBIENT_VOL : DEFAULT_AMBIENT_VOL);
}

export const stopSound = (file) => {
  if (isAmbient(file)) {
    const amb = active.get(ambientKey);
    if (amb) {
      amb.pause();
      amb.currentTime = 0;
      active.delete(ambientKey);
    }
    return;
  }
  const snd = active.get(file);
  if (snd) {
    snd.pause();
    snd.currentTime = 0;
    active.delete(file);
  }
};

export const stopAllSounds = () => {
  active.forEach((_, key) => stopSound(key === ambientKey ? "nakts_skana.mp3" : key));
  active.clear();
};

function playAmbient(file, { loop = true, volume = DEFAULT_AMBIENT_VOL } = {}) {
  // stop existing ambient
  stopSound(file);
  const audio = new Audio(`/sounds/${file}`);
  audio.loop = loop;
  setVolume(audio, globalMuted ? 0 : volume);
  audio.play().catch(() => {});
  active.set(ambientKey, audio);
}

function playFxNow(file, volume = 0.8) {
  return new Promise((resolve) => {
    const audio = new Audio(`/sounds/${file}`);
    audio.loop = false;
    setVolume(audio, globalMuted ? 0 : volume);
    duckAmbient(true);
    active.set(file, audio);

    const cleanup = () => {
      duckAmbient(false);
      active.delete(file);
      resolve();
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;

    audio.play().catch(cleanup);
  });
}

async function pumpFxQueue() {
  if (fxPlaying) return;
  fxPlaying = true;
  while (fxQueue.length) {
    const { file, volume } = fxQueue.shift();
    await playFxNow(file, volume);
  }
  fxPlaying = false;
}

function enqueueFx(file, volume) {
  fxQueue.push({ file, volume });
  pumpFxQueue();
}

/**
 * Main entry point used by socket: decides ambient vs fx.
 */
export const playSound = (file, { loop = false, volume = 0.8 } = {}) => {
  if (!file || globalMuted) return;
  if (isAmbient(file)) {
    playAmbient(file, { loop: true, volume: volume ?? DEFAULT_AMBIENT_VOL });
    return;
  }
  enqueueFx(file, volume ?? 0.8);
};

export const fadeOutSound = (file, duration = 600) => {
  const snd = isAmbient(file) ? active.get(ambientKey) : active.get(file);
  if (!snd) return;
  const steps = Math.max(1, Math.floor(duration / 50));
  const delta = snd.volume / steps;
  let count = 0;
  const id = setInterval(() => {
    setVolume(snd, snd.volume - delta);
    count++;
    if (count >= steps) {
      clearInterval(id);
      stopSound(file);
    }
  }, 50);
};

export const toggleMute = (mute) => {
  globalMuted = mute;
  active.forEach((audio) => {
    audio.muted = mute;
  });
};

export const bindSocketSounds = (socket) => {
  if (!socket) return;
  socket.on("playSound", ({ file, loop, volume }) => {
    playSound(file, { loop, volume });
  });
  socket.on("stopSound", ({ file }) => {
    stopSound(file);
  });
};
