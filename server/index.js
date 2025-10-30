// server/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import GameManager from "./game/gameManager.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const games = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getGameBySocket(socket) {
  for (const game of games.values()) {
    if (game.players.has(socket.id)) return game;
  }
  return null;
}
function getPlayerBySocket(game, socketId) {
  return game?.players.get(socketId) || null;
}
function emitNightTurn(game, roleOrNull) {
  io.to(game.room).emit("state:update", { nightTurn: roleOrNull });
}

io.on("connection", (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  socket.on("createRoom", (config) => {
    try {
      const game = new GameManager(io, config);
      games.set(game.id, game);

      game.nightState = {
        mafiaVotes: {},              // mafiaId -> targetId
        mafiaSelections: {},         // targetId -> count
        mafiaFinalTarget: null,

        detectiveVotes: {},          // detectiveId -> targetId
        detectiveSelections: {},     // targetId -> count
        detectiveFinalTarget: null,

        doctorTarget: null,
        doctorConfirmed: false,
        doctorSelfUsed: new Set(),   // doctor ids who already self-saved
      };

      if (config.hostName) game.addPlayer(socket, config.hostName);
      socket.emit("roomCreated", { roomId: game.id });
    } catch {
      socket.emit("error", "Failed to create room");
    }
  });

  socket.on("joinRoom", ({ roomId, name }) => {
    const game = games.get(roomId);
    if (!game) return socket.emit("error", "Room not found");
    game.addPlayer(socket, name);
  });

  // Host returns to lobby after a game
  socket.on("returnToLobby", () => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const hostId = Array.from(game.players.keys())[0];
    if (socket.id !== hostId) return socket.emit("error", "Only host can return to lobby");
    game.returnToLobby();
  });

  // Host assigns roles (in the lobby)
  socket.on("roles:assign", () => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const hostId = Array.from(game.players.keys())[0];
    if (socket.id !== hostId) return socket.emit("error", "Only host can assign roles");
    const ok = game.assignRolesNow();
    if (!ok) {
      socket.emit("error", "Cannot assign roles yet (need at least 4 players, or already locked).");
      return;
    }
    for (const p of game.players.values()) {
      io.to(p.id).emit("roleAssigned", { role: p.role });
    }
    io.to(game.room).emit("state:update", { rolesLocked: true });
  });

  socket.on("startGame", async () => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const hostId = Array.from(game.players.keys())[0];
    if (socket.id !== hostId) return socket.emit("error", "Only the host can start the game");

    game.startGame();
    await runNightSequence(game, io);
  });

  // --- Manual: Start Night (host-only, no timers) ---
  socket.on("phase:startNight", async () => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const hostId = Array.from(game.players.keys())[0];
    if (socket.id !== hostId) return socket.emit("error", "Only the host can start the night");
    console.log(`🌙 Manual: Starting night phase for ${game.id}`);
    await runNightSequence(game, io);
  });

  socket.on("phase:endDay", () => {});

  // ===== DAY VOTING =====
  socket.on("vote", (targetId) => {
    const game = getGameBySocket(socket);
    if (!game) return;

    const voter = game.players.get(socket.id);
    if (!voter) return;

    // Voting eligibility
    if (!game.canPlayerVoteNow(voter)) return;

    // Record (null => abstain)
    game.votes[socket.id] = targetId ?? null;
    io.to(game.room).emit("voting:update", { votes: game.votes });

    // --- 2/3 live threshold ---
    const aliveIds = [...game.players.values()].filter(p => p.alive).map(p => p.id);

    const tally = {};
    for (const id of aliveIds) {
      const choice = game.votes[id];
      if (choice) tally[choice] = (tally[choice] || 0) + 1;
    }

    let topTarget = null, topCount = 0;
    for (const [tid, count] of Object.entries(tally)) {
      if (count > topCount) { topCount = count; topTarget = tid; }
    }

    const needed = Math.ceil((2 * aliveIds.length) / 3);
    let lastLynch = null;

    if (topTarget && topCount >= needed) {
      const target = game.players.get(topTarget);
      if (target && target.alive) {
        target.alive = false;
        target.voteGhostUntilDay = null;
        lastLynch = { id: target.id, name: target.name, role: target.role };
        io.to(game.room).emit("playerDied", { name: target.name });

        Object.keys(game.votes).forEach((vid) => {
          if (game.votes[vid] === target.id) delete game.votes[vid];
        });

        io.to(game.room).emit("day:resolved", { dayResolved: true, lastLynch });

        if (game.checkWinCondition()) return;
        return;
      }
    }

    const everyoneVoted = game.allEligibleVotersHaveVoted();
    if (!everyoneVoted) return;

    io.to(game.room).emit("day:resolved", { dayResolved: true, lastLynch: null });

    if (game.checkWinCondition()) return;
  });

  // ===== NIGHT ACTION SOCKETS =====

  // ---- MAFIA consensus (propose/finalize) ----
  socket.on("mafia:propose", ({ targetId }) => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "mafia" || !me.alive) return;

    const ns = game.nightState;
    ns.mafiaVotes[me.id] = targetId;

    const mafiaAlive = [...game.players.values()].filter((p) => p.role === "mafia" && p.alive);
    const aliveIdSet = new Set(mafiaAlive.map((p) => p.id));
    const tally = {};
    for (const [mid, tid] of Object.entries(ns.mafiaVotes)) {
      if (!aliveIdSet.has(mid) || !tid) continue;
      tally[tid] = (tally[tid] || 0) + 1;
    }
    ns.mafiaSelections = tally;

    // Unanimity: all alive mafias have voted AND chose the same target
    const votes = mafiaAlive.map(m => ns.mafiaVotes[m.id]).filter(Boolean);
    let unanimousTargetId = null;
    if (votes.length === mafiaAlive.length && votes.length > 0) {
      const first = votes[0];
      if (votes.every(v => v === first)) unanimousTargetId = first;
    }

    const payload = { selections: ns.mafiaSelections, unanimousTargetId };
    for (const p of mafiaAlive) {
      io.to(p.id).emit("mafia:status", payload);
      io.to(p.id).emit("mafia:selections", ns.mafiaSelections); // legacy (safe to keep)
    }
  });

  socket.on("mafia:finalize", ({ targetId }) => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "mafia" || !me.alive) return;

    const ns = game.nightState;
    const mafiaAlive = [...game.players.values()].filter((p) => p.role === "mafia" && p.alive);
    if (mafiaAlive.length === 0) return;

    if (mafiaAlive.length === 1) {
      ns.mafiaFinalTarget = targetId;
      console.log(`🔫 Mafia (single) finalized target: ${targetId}`);
    } else {
      const allAgree = mafiaAlive.every((m) => ns.mafiaVotes[m.id] === targetId);
      if (!allAgree) return;
      ns.mafiaFinalTarget = targetId;
      console.log(`🔫 Mafia (group) finalized target: ${targetId}`);
    }

    for (const p of mafiaAlive) io.to(p.id).emit("mafia:final", { targetId });
  });

  // ---- DETECTIVE consensus (propose/finalize) ----
  socket.on("detective:propose", ({ targetId }) => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "detective" || !me.alive) return;

    const ns = game.nightState;
    ns.detectiveVotes[me.id] = targetId;

    const detAlive = [...game.players.values()].filter((p) => p.role === "detective" && p.alive);
    const aliveIdSet = new Set(detAlive.map((p) => p.id));
    const tally = {};
    for (const [did, tid] of Object.entries(ns.detectiveVotes)) {
      if (!aliveIdSet.has(did) || !tid) continue;
      tally[tid] = (tally[tid] || 0) + 1;
    }
    ns.detectiveSelections = tally;

    // Unanimity: all alive detectives have voted AND chose the same target
    const votes = detAlive.map(d => ns.detectiveVotes[d.id]).filter(Boolean);
    let unanimousTargetId = null;
    if (votes.length === detAlive.length && votes.length > 0) {
      const first = votes[0];
      if (votes.every(v => v === first)) unanimousTargetId = first;
    }

    const payload = { selections: ns.detectiveSelections, unanimousTargetId };
    for (const d of detAlive) {
      io.to(d.id).emit("detective:status", payload);
      io.to(d.id).emit("detective:selections", ns.detectiveSelections); // legacy (safe to keep)
    }
  });

  socket.on("detective:finalize", ({ targetId }) => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "detective" || !me.alive) return;

    const ns = game.nightState;
    const detAlive = [...game.players.values()].filter((p) => p.role === "detective" && p.alive);
    if (detAlive.length === 0) return;

    if (detAlive.length === 1) {
      ns.detectiveFinalTarget = targetId;
      console.log(`🕵️ Detective (single) finalized target: ${targetId}`);
    } else {
      const allAgree = detAlive.every((d) => ns.detectiveVotes[d.id] === targetId);
      if (!allAgree) return;
      ns.detectiveFinalTarget = targetId;
      console.log(`🕵️ Detectives (group) finalized target: ${targetId}`);
    }

    for (const d of detAlive) io.to(d.id).emit("detective:final", { targetId });
  });

  // ---- DOCTOR: self-save limited to once per doctor ----
  socket.on("doctor:save", ({ targetId }) => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "doctor" || !me.alive) return;

    const ns = game.nightState;

    // SECOND SELF-SAVE → deny & auto-advance
    if (targetId === me.id && ns.doctorSelfUsed.has(me.id)) {
      io.to(me.id).emit("doctor:selfDenied");
      ns.doctorTarget = null;     // explicit no-target
      ns.doctorConfirmed = true;  // mark done
      io.to(me.id).emit("night:clear");
      return;
    }

    // First self-save → mark used
    if (targetId === me.id) {
      ns.doctorSelfUsed.add(me.id);
      io.to(me.id).emit("doctor:selfUsed");
    }

    ns.doctorTarget = targetId ?? null;
  });

  socket.on("doctor:confirm", () => {
    const game = getGameBySocket(socket);
    if (!game) return;
    const me = getPlayerBySocket(game, socket.id);
    if (!me || me.role !== "doctor" || !me.alive) return;
    if (!game.nightState) return;
    game.nightState.doctorConfirmed = true;
  });

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    for (const [id, game] of games.entries()) {
      if (!game.players.has(socket.id)) continue;
      game.removePlayer(socket.id);
      if (game.players.size === 0) {
        console.log(`🧹 Removing empty game room: ${id}`);
        games.delete(id);
      } else {
        io.to(game.room).emit("playerList", game.getPublicPlayers());
      }
    }
  });
});

app.get("/", (req, res) => res.send("✅ Mafia Game Server is running"));
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

/** NIGHT ORCHESTRATOR
 * Resolve before wake; parity checks at start and after resolve.
 */
async function runNightSequence(game, io) {
  // reset per-night (keep doctorSelfUsed persistent across nights)
  Object.assign(game.nightState, {
    mafiaVotes: {},
    mafiaSelections: {},
    mafiaFinalTarget: null,

    detectiveVotes: {},
    detectiveSelections: {},
    detectiveFinalTarget: null,

    doctorTarget: null,
    doctorConfirmed: false,
  });

  game.startNight();

  // parity at night start
  if (game.checkWinCondition()) return;

  // "asleep" baseline
  io.to(game.room).emit("state:update", {
    night: {
      mafiaSelections: {},
      mafiaFinalTarget: null,
      detectivePeek: null,
      detectiveRevealWindow: null,
    },
    nightTurn: null,
  });

  // ambient
  io.to(game.room).emit("playSound", { file: "nakts_skana.mp3", loop: true, volume: 0.35 });
  await sleep(3000);

  io.to(game.room).emit("playSound", { file: "sakas_nakts.mp3", loop: false, volume: 0.8 });
  await sleep(3000);

  // --- MAFIA ---
  if (!game.checkWinCondition()) {
    const mafiaAlive = [...game.players.values()].filter(p => p.role === "mafia" && p.alive);
    if (mafiaAlive.length) {
      emitNightTurn(game, "mafia");
      const targets = [...game.players.values()]
        .filter(p => p.alive && p.role !== "mafia")
        .map(p => ({ id: p.id, name: p.name }));
      for (const m of mafiaAlive) io.to(m.id).emit("night:mafia", { targets });
      io.to(game.room).emit("playSound", { file: "mafia_atver.mp3", loop: false, volume: 1.0 });

      await waitFor(() => !!game.nightState.mafiaFinalTarget);

      for (const m of mafiaAlive) io.to(m.id).emit("night:clear");
      io.to(game.room).emit("playSound", { file: "mafia_aizver.mp3", loop: false, volume: 1.0 });
      emitNightTurn(game, null);
      await sleep(3000);
    } else {
      emitNightTurn(game, null);
    }
  }

  // --- DETECTIVE ---
  const detectiveAlive = [...game.players.values()].filter(p => p.role === "detective" && p.alive);
  if (detectiveAlive.length && !game.checkWinCondition()) {
    emitNightTurn(game, "detective");
    for (const d of detectiveAlive) {
      const targets = [...game.players.values()]
        .filter(t => t.alive && t.id !== d.id)
        .map(t => ({ id: t.id, name: t.name }));
      io.to(d.id).emit("night:detective", { targets });
    }
    io.to(game.room).emit("playSound", { file: "policija_atver.mp3", loop: false, volume: 1.0 });

    await waitFor(() => !!game.nightState.detectiveFinalTarget);

    for (const d of detectiveAlive) io.to(d.id).emit("night:clear");
    io.to(game.room).emit("playSound", { file: "policija_aizver.mp3", loop: false, volume: 1.0 });
    emitNightTurn(game, null);
    await sleep(3000);
  }

  // --- DOCTOR ---
  const doctorAlive = [...game.players.values()].filter(p => p.role === "doctor" && p.alive);
  if (doctorAlive.length && !game.checkWinCondition()) {
    emitNightTurn(game, "doctor");
    const targets = [...game.players.values()].filter(t => t.alive).map(t => ({ id: t.id, name: t.name }));
    for (const d of doctorAlive) io.to(d.id).emit("night:doctor", { targets });
    io.to(game.room).emit("playSound", { file: "arsts_atver.mp3", loop: false, volume: 1.0 });

    // only wait for confirmed (target can be null if self-denied)
    await waitFor(() => !!game.nightState.doctorConfirmed);

    for (const d of doctorAlive) io.to(d.id).emit("night:clear");
    io.to(game.room).emit("playSound", { file: "arsts_aizver.mp3", loop: false, volume: 1.0 });
    emitNightTurn(game, null);
    await sleep(3000);
  }

  // stop ambient before resolve
  io.to(game.room).emit("stopSound", { file: "nakts_skana.mp3" });

  // RESOLVE
  const actions = {
    mafiaTarget: game.nightState.mafiaFinalTarget,
    detectiveTarget: game.nightState.detectiveFinalTarget,
    doctorTarget: game.nightState.doctorTarget,
  };
  const summary = game.resolveNight(actions);

  const publicList = game.getPublicPlayers();
  const lastNightDeaths = summary.lastNightDeathsResolved || [];
  const lastNightSaved = !!summary.protected; // protected = saved player name or null
  const lastNightSavedName = summary.protected || null;
  const detectiveMissed = false;

  io.to(game.room).emit("state:update", {
    players: publicList,
    lastNightDeaths,
    lastNightSaved,
    lastNightSavedName,
    detectiveMissed,
    dayResolved: false,
    night: { mafiaSelections: {}, mafiaFinalTarget: null, detectivePeek: null, detectiveRevealWindow: null },
    nightTurn: null,
  });

  // win check after resolve (may end immediately)
  if (game.checkWinCondition()) return;

  // wake all only if nobody won
  io.to(game.room).emit("playSound", { file: "visi_atver.mp3", loop: false, volume: 0.9 });

  // day starts
  game.startDay();
}

async function waitFor(conditionFn, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  while (!conditionFn()) {
    await sleep(150);
    if (timeoutMs && Date.now() - start > timeoutMs) break;
  }
}
