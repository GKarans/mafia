// server/game/phases.js

/**
 * Mafia Game Phase Definitions
 * Each phase includes metadata to control timers, transitions, and descriptions.
 */

export const PHASES = Object.freeze({
  LOBBY: "LOBBY",
  NIGHT: "NIGHT",
  DAY: "DAY",
  VOTE: "VOTE",
  END: "END",
});

export const PHASE_INFO = Object.freeze({
  [PHASES.LOBBY]: { next: PHASES.NIGHT, duration: 0, description: "Waiting for players..." },
  [PHASES.NIGHT]: { next: PHASES.DAY, duration: 15000, description: "Night actions are being taken." },
  [PHASES.DAY]: { next: PHASES.VOTE, duration: 20000, description: "Players discuss and decide who to vote." },
  [PHASES.VOTE]: { next: PHASES.NIGHT, duration: 10000, description: "Voting results are being tallied." },
  [PHASES.END]: { next: null, duration: 0, description: "The game has ended." },
});

/**
 * Get the next valid phase in sequence.
 * Returns null when the game has ended.
 */
export const nextPhase = (phase) => {
  if (!phase || !PHASE_INFO[phase]) return PHASES.LOBBY;
  return PHASE_INFO[phase].next;
};

/**
 * Get phase duration (used for timers)
 */
export const getPhaseDuration = (phase) => {
  return PHASE_INFO[phase]?.duration || 0;
};

/**
 * Get phase description for UI or logging
 */
export const describePhase = (phase) => {
  return PHASE_INFO[phase]?.description || "Unknown phase.";
};
