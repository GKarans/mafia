// server/game/roles.js

/**
 * Recommended role distribution by player count:
 * 4–8:  mafia=1, detective=1, doctor=1
 * 9–11: mafia=2, detective=2, doctor=1
 * 12–16: mafia=3, detective=2, doctor=1
 * 17+:  mafia=4, detective=3, doctor=1
 */
export function computeRoleCounts(playerCount) {
  if (playerCount <= 8)  return { mafia: 1, detective: 1, doctor: 1 };
  if (playerCount <= 11) return { mafia: 2, detective: 2, doctor: 1 };
  if (playerCount <= 16) return { mafia: 3, detective: 2, doctor: 1 };
  return { mafia: 4, detective: 3, doctor: 1 };
}

export const ROLE_INFO = Object.freeze({
  mafia:     { alignment: "evil", description: "Works with other mafia to eliminate the town.", action: "kill" },
  doctor:    { alignment: "good", description: "Can save one player per night from being killed.", action: "heal" },
  detective: { alignment: "good", description: "Can investigate or shoot a target at night.", action: "investigate" },
  villager:  { alignment: "good", description: "No special ability.", action: null },
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Assign roles to the given array of player objects (in-place).
 * Ensures the above distribution and fills the rest with villagers.
 */
export function assignRoles(players) {
  if (!Array.isArray(players) || players.length < 4) {
    throw new Error("assignRoles: need at least 4 players");
  }

  // Reset any previous role
  for (const p of players) p.role = null;

  // Work on a shuffled copy to avoid predictability
  const shuffled = [...players];
  shuffle(shuffled);

  const { mafia, detective, doctor } = computeRoleCounts(players.length);
  const roles = [
    ...Array(mafia).fill("mafia"),
    ...Array(detective).fill("detective"),
    ...Array(doctor).fill("doctor"),
  ];
  while (roles.length < players.length) roles.push("villager");
  shuffle(roles);

  // Apply roles back in the shuffled order
  shuffled.forEach((p, i) => { p.role = roles[i]; });
}

export const getRoleInfo = (role) => ROLE_INFO[role] || {
  alignment: "unknown",
  description: "Unrecognized role.",
  action: null,
};
