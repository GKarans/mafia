// server/game/roles.js

/**
 * 🎭 Mafia Game Role Definitions
 * Each role includes alignment, description, and ability metadata.
 */
export const ROLE_INFO = Object.freeze({
  mafia: {
    alignment: "evil",
    description: "Works with other mafia to eliminate the town.",
    action: "kill",
  },
  doctor: {
    alignment: "good",
    description: "Can save one player per night from being killed.",
    action: "heal",
  },
  detective: {
    alignment: "good",
    description: "Can investigate one player per night to learn their alignment.",
    action: "investigate",
  },
  villager: {
    alignment: "good",
    description: "Has no special abilities. Wins if the mafia are eliminated.",
    action: null,
  },
});

/**
 * 🔄 Dynamically assigns roles to all players currently in the room.
 * - Automatically called whenever a player joins.
 * - Ensures fair distribution with at least one Mafia.
 * - Rebalances if new players join.
 */
// server/game/roles.js
// Simple, predictable role assignment for Mafia
// - Always 1 Mafia if >= 1 players
// - Add Detective if >= 3
// - Add Doctor if >= 4
// - Remaining are Villagers

export function assignRoles(players) {
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error("assignRoles: players array required");
  }

  // Reset roles before assigning
  for (const p of players) p.role = null;

  const count = players.length;

  // Shuffle a shallow copy to avoid predictable roles by join order
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  // Decide counts
  let mafiaCount = 1; // minimum 1 Mafia for any size
  if (count >= 7) mafiaCount = 2; // example scaling; tweak to your taste
  if (count >= 10) mafiaCount = 3;

  let detectiveCount = count >= 3 ? 1 : 0;
  let doctorCount = count >= 4 ? 1 : 0;

  // Assign Mafia
  for (let i = 0; i < mafiaCount && shuffled.length; i++) {
    const p = shuffled.shift();
    p.role = "mafia";
  }

  // Assign Detective
  for (let i = 0; i < detectiveCount && shuffled.length; i++) {
    const p = shuffled.shift();
    p.role = "detective";
  }

  // Assign Doctor
  for (let i = 0; i < doctorCount && shuffled.length; i++) {
    const p = shuffled.shift();
    p.role = "doctor";
  }

  // Rest are Villagers
  for (const p of shuffled) {
    p.role = "villager";
  }
}


/**
 * 🧠 Utility: Get info for a given role.
 */
export const getRoleInfo = (role) => {
  return ROLE_INFO[role] || {
    alignment: "unknown",
    description: "Unrecognized role.",
    action: null,
  };
};
