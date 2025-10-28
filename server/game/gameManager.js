// server/game/gameManager.js
import { v4 as uuidv4 } from "uuid";
import { assignRoles } from "./roles.js";
import { PHASES } from "./phases.js";
import { resolveNightActions } from "./actions.js";

export default class GameManager {
  constructor(io, config = {}) {
    this.io = io;
    this.id = uuidv4();
    this.room = `room-${this.id}`;
    this.config = config;

    this.players = new Map(); // socket.id -> { id, name, role, alive, voteGhostUntilDay, score }
    this.phase = PHASES.LOBBY;
    this.result = null;

    // Per-game / per-day
    this.dayCount = 0;          // increments when Day starts
    this.votes = {};
    this.dayDetectiveUsed = false;            // voterId -> targetId|null
    this.nightState = {         // transient, recreated each night
      mafiaVotes: {},
      mafiaSelections: {},
      mafiaFinalTarget: null,
      detectiveTarget: null,
      doctorTarget: null,
      doctorConfirmed: false,
      doctorSelfUsed: new Set(), // track self-saves per doctor
    };

    // Persist across many games in this lobby
    this.scores = new Map();    // socket.id -> points
  }

  getPublicPlayers() {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      dead: p.alive === false,
      role: this.phase === PHASES.END ? p.role : undefined, // reveal roles only at end
      score: this.scores.get(p.id) || 0,
    }));
  }

  addPlayer(socket, name) {
    const p = {
      id: socket.id,
      name,
      role: null,
      alive: true,
      voteGhostUntilDay: null, // if killed at night, can vote only in next day (== dayCount+1)
    };
    this.players.set(socket.id, p);
    if (!this.scores.has(socket.id)) this.scores.set(socket.id, 0);
    socket.join(this.room);
    this.io.to(socket.id).emit("joinedRoom", { roomId: this.room, player: { id: p.id, name: p.name } });
    this.broadcastPlayers();
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    delete this.votes[socketId];
    this.broadcastPlayers();
  }

  broadcastPlayers() {
    this.io.to(this.room).emit("playerList", this.getPublicPlayers());
  }

  assignRolesNow() {
    if (this.phase !== PHASES.LOBBY) return false;

    const arr = Array.from(this.players.values());
    const min = this.config.minPlayers ?? 1; // allow 1 for testing; change to 4 for production
    if (arr.length < min) return false;

    try {
      assignRoles(arr);
    } catch (e) {
      console.error("assignRoles error:", e);
      return false;
    }

    for (const p of arr) {
      p.alive = true;
      p.voteGhostUntilDay = null;
    }

    for (const p of arr) {
      this.io.to(p.id).emit("roleAssigned", { role: p.role });
    }

    this.io.to(this.room).emit("state:update", { rolesLocked: true });
    this.broadcastPlayers();
    return true;
  }

  startGame() {
    this.phase = PHASES.NIGHT;
    this.dayCount = 0;
    this.votes = {};
    this.dayDetectiveUsed = false;
    for (const p of this.players.values()) {
      p.alive = true;
      p.voteGhostUntilDay = null;
    }
    this.dayDetectiveUsed = false;
    this.io.to(this.room).emit("phaseChange", { phase: this.phase });
  }

  startNight() {
    this.phase = PHASES.NIGHT;
    this.dayDetectiveUsed = false;
    this.io.to(this.room).emit("phaseChange", { phase: this.phase });
    const keepSelfUsed = this.nightState.doctorSelfUsed;
    this.nightState = {
      mafiaVotes: {},
      mafiaSelections: {},
      mafiaFinalTarget: null,
      detectiveTarget: null,
      doctorTarget: null,
      doctorConfirmed: false,
      doctorSelfUsed: keepSelfUsed || new Set(),
    };
  }

  startDay() {
    this.phase = PHASES.DAY;
    this.dayCount += 1;

    // Expire ghost voting older than the just-started day
    for (const p of this.players.values()) {
      if (typeof p.voteGhostUntilDay === "number" && p.voteGhostUntilDay < this.dayCount) {
        p.voteGhostUntilDay = null;
      }
    }

    this.votes = {};
    this.dayDetectiveUsed = false;
    this.dayDetectiveUsed = false;
    this.io.to(this.room).emit("phaseChange", { phase: this.phase });
  }

  // Killed at night: allow only next-day voting
  markNightDeath(p) {
    p.alive = false;
    p.voteGhostUntilDay = this.dayCount + 1; // the upcoming day only
  }

  // Day-voted: no more voting allowed
  markDayLynch(p) {
    p.alive = false;
    p.voteGhostUntilDay = null;
  }

  // Post-night resolution utility that also returns a shape the server emitter can send
  resolveNight(actions) {
    const summary = resolveNightActions(this.players, actions);

    // Collect deaths (by name) -> convert to {id,name,role}; also ensure ghost-vote window
    const deathsByName = (summary.deaths || []).filter(Boolean).filter((x) => x !== "No one died");
    const lastNightDeathsResolved = [];

    for (const name of deathsByName) {
      const killed = [...this.players.values()].find((pp) => pp.name === name);
      if (killed) {
        this.markNightDeath(killed); // idempotent; ensures voteGhostUntilDay window
        lastNightDeathsResolved.push({ id: killed.id, name: killed.name, role: killed.role });
      }
    }

    return {
      lastNightDeathsResolved,
      investigations: summary.investigations || {},
      protected: summary.protected || null, // saved player NAME or null
    };
  }

  // --- Voting eligibility helpers ---
  canPlayerVoteNow(p) {
    if (!p) return false;
    if (p.alive) return true;
    // Night-killed may vote only in the very next day
    return typeof p.voteGhostUntilDay === "number" && p.voteGhostUntilDay === this.dayCount;
  }

  allEligibleVotersHaveVoted() {
    const eligible = [...this.players.values()].filter((p) => this.canPlayerVoteNow(p)).map((p) => p.id);
    return eligible.every((id) => Object.prototype.hasOwnProperty.call(this.votes, id));
  }

  // --- Win conditions ---
  checkWinCondition() {
    const mafiaAlive = [...this.players.values()].filter((p) => p.role === "mafia" && p.alive).length;
    const townAlive  = [...this.players.values()].filter((p) => p.role !== "mafia" && p.alive).length;

    if (mafiaAlive === 0) {
      this.endGame("Town wins!");
      return true;
    }
    if (mafiaAlive >= townAlive) {
      this.endGame("Mafia wins!");
      return true;
    }
    return false;
  }

  endGame(result) {
    this.phase = PHASES.END;
    this.result = result;

    // Scoring: Mafia +2 each if mafia wins, Town +1 each otherwise
    if (/mafia/i.test(result)) {
      for (const p of this.players.values()) {
        if (p.role === "mafia") this.scores.set(p.id, (this.scores.get(p.id) || 0) + 2);
      }
    } else {
      for (const p of this.players.values()) {
        if (p.role !== "mafia") this.scores.set(p.id, (this.scores.get(p.id) || 0) + 1);
      }
    }

    const reveal = this.getPublicPlayers(); // includes roles in END phase

    // Send scoreboard + final reveal
    this.io.to(this.room).emit("state:update", {
      players: reveal,
      scores: Object.fromEntries(this.scores),
    });

    // IMPORTANT: also tell clients the phase is END so the UI routes to results
    this.dayDetectiveUsed = false;
    this.io.to(this.room).emit("phaseChange", { phase: this.phase });

    // Winner modal payload (client already listens to this)
    this.io.to(this.room).emit("gameOver", { result, reveal });

    // (Optional) log
    console.log(`🏁 Game over in ${this.room}: ${result}`);
  }

  returnToLobby() {
    this.phase = PHASES.LOBBY;
    // Keep scores, reset roles and life status; host can re-assign roles
    for (const p of this.players.values()) {
      p.alive = true;
      p.role = null;
      p.voteGhostUntilDay = null;
    }
    this.votes = {};
    this.dayDetectiveUsed = false;
    this.nightState = {
      mafiaVotes: {},
      mafiaSelections: {},
      mafiaFinalTarget: null,
      detectiveTarget: null,
      doctorTarget: null,
      doctorConfirmed: false,
      doctorSelfUsed: new Set(),
    };
    this.dayCount = 0;

    // Push lobby state + phase
    this.io.to(this.room).emit("state:update", {
      players: this.getPublicPlayers(),
      rolesLocked: false,
      dayResolved: false,
      lastNightDeaths: [],
      lastNightSaved: false,
      lastLynch: null,
    });
    this.dayDetectiveUsed = false;
    this.io.to(this.room).emit("phaseChange", { phase: this.phase });
  }
}
