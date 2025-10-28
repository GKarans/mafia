// server/game/sounds.js

/**
 * Sound registry for Mafia Game events.
 * Order used in night:
 *  startNight → (ambient loop) → mafiaOpen → mafiaClose → 3s →
 *  policeOpen → policeClose → 3s → doctorOpen → doctorClose → 3s →
 *  allWake → 2s → stop ambient
 */

export const SOUND_PACKS = {
  classic: {
    startNight:   { file: "sakas_nakts.mp3",   volume: 0.8, phase: "NIGHT" },
    nightAmbient: { file: "nakts_skana.mp3",   volume: 0.5, phase: "NIGHT" },
    mafiaOpen:    { file: "mafia_atver.mp3",   volume: 1.0, phase: "NIGHT" },
    mafiaClose:   { file: "mafia_aizver.mp3",  volume: 1.0, phase: "NIGHT" },
    policeOpen:   { file: "policija_atver.mp3",volume: 1.0, phase: "NIGHT" },
    policeClose:  { file: "policija_aizver.mp3",volume: 1.0, phase: "NIGHT" },
    doctorOpen:   { file: "arsts_atver.mp3",   volume: 1.0, phase: "NIGHT" },
    doctorClose:  { file: "arsts_aizver.mp3",  volume: 1.0, phase: "NIGHT" },
    allWake:      { file: "visi_atver.mp3",    volume: 0.9, phase: "DAY" },
  },
};

export const getSoundEvent = (event, pack = "classic") => {
  const sounds = SOUND_PACKS[pack] || SOUND_PACKS.classic;
  return sounds[event] || null;
};

export const getPhaseSounds = (phase, pack = "classic") => {
  const sounds = SOUND_PACKS[pack] || SOUND_PACKS.classic;
  return Object.entries(sounds)
    .filter(([_, s]) => s.phase === phase)
    .map(([key, val]) => ({ key, ...val }));
};

export const emitSoundEvent = (io, room, eventKey, pack = "classic") => {
  const sound = getSoundEvent(eventKey, pack);
  if (!sound) return;
  io.to(room).emit("playSound", sound);
  console.log(`🔊 Emitted sound event '${eventKey}' -> ${sound.file}`);
};
