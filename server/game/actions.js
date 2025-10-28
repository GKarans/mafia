// server/game/actions.js
/**
 * Resolves all night phase actions in a Mafia game.
 * Supports roles: Mafia, Doctor, Detective.
 * Returns an object containing results for broadcast and game updates.
 */

export const resolveNightActions = (players, actions = {}) => {
  const result = {
  deaths: [],
  investigations: {},
  protected: null, // legacy: name
  detectiveMissed: false,
  protectedFromMafiaKill: false,
  protectedFromDetectiveShot: false,
  protectedName: null,
};

  if (!players || players.size === 0) return result;

  const mafiaTarget = actions.mafiaTarget;
  const doctorTarget = actions.doctorTarget;
  const detectiveTarget = actions.detectiveTarget;

  // --- Validate player references ---
  const isAlive = (id) => {
    const p = players.get(id);
    return p && p.alive;
  };

  // --- Mafia Kill ---
if (mafiaTarget && isAlive(mafiaTarget)) {
  if (mafiaTarget !== doctorTarget) {
    const victim = players.get(mafiaTarget);
    if (victim) {
      victim.alive = false;
      result.deaths.push(victim.name);
    }
  } else {
    // Doctor saved the Mafia kill
    const savedName = players.get(doctorTarget)?.name || null;
    result.protected = savedName; // legacy
    result.protectedFromMafiaKill = true;
    result.protectedName = savedName;
  }
}

  // --- Detective Night Shot ---
if (detectiveTarget && isAlive(detectiveTarget)) {
  const target = players.get(detectiveTarget);
  if (target.role === "mafia") {
    if (detectiveTarget !== doctorTarget) {
      // Detective kills mafia
      target.alive = false;
      result.deaths.push(target.name);
    } else {
      // Doctor saved the detective's shot (do NOT show doctor banner for this)
      const savedName = players.get(doctorTarget)?.name || null;
      result.protected = result.protected || savedName; // keep legacy if others rely on it
      result.protectedFromDetectiveShot = true;
      if (!result.protectedName) result.protectedName = savedName;
    }
  } else {
    // Detective missed (shot non-mafia)
    result.detectiveMissed = true;
  }
}

  // --- Broadcast structure ---
  const summary = {
  deaths: result.deaths.length ? result.deaths : ["No one died"],
  protected: result.protected, // legacy
  protectedFromMafiaKill: result.protectedFromMafiaKill,
  protectedFromDetectiveShot: result.protectedFromDetectiveShot,
  protectedName: result.protectedName,
  investigations: result.investigations,
  detectiveMissed: result.detectiveMissed,
};

  return summary;
};

/**
 * Utility to register a player's night action.
 * Ensures only one action per role per phase.
 */
export const registerNightAction = (actions, role, targetId) => {
  if (!actions || !role) return;
  switch (role.toLowerCase()) {
    case "mafia":
      actions.mafiaTarget = targetId;
      break;
    case "doctor":
      actions.doctorTarget = targetId;
      break;
    case "detective":
      actions.detectiveTarget = targetId;
      break;
    default:
      console.warn(`⚠️ Unknown role action: ${role}`);
  }
};
