// client/src/components/GameBoard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useGame } from "../context/GameContext.jsx";
import { motion } from "framer-motion";

export default function GameBoard() {
  const { state, actions } = useGame();
  const { phase, role, players = [], playerName, roomId, rolesLocked } = state;
  const [instruction, setInstruction] = useState("");
  const [showRole, setShowRole] = useState(false);

  // Alive convenience using server's `dead` flag
  const alivePlayers = useMemo(() => players.filter(p => !p.dead), [players]);

  // Instruction banner by phase
  useEffect(() => {
    switch (phase) {
      case "NIGHT":
        setInstruction("🌙 Night has fallen... Mafia, make your move!");
        break;
      case "DAY":
        setInstruction("☀️ Daylight! Discuss and vote wisely…");
        break;
      case "END":
        setInstruction("🏁 Game over! Check the results.");
        break;
      default:
        setInstruction("🎮 Waiting for players…");
    }
  }, [phase]);

  // Host is the first joined player (server enforces on actions)
  const isHost = players[0]?.name === playerName;

  return (
    <div className="flex flex-col items-center w-full max-w-3xl bg-gray-800 rounded-2xl p-4 sm:p-6 text-white shadow-lg">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-3">
        <h1 className="text-2xl sm:text-3xl font-bold">🎭 Mafia Game</h1>
        <span className="text-xs sm:text-sm text-gray-400">Room: {roomId || "—"}</span>
      </div>

      {/* Phase Info */}
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full text-lg sm:text-xl font-semibold text-yellow-400 mb-3"
      >
        {instruction}
      </motion.div>

      {/* Players (bigger tap targets + comfy scroll) */}
      <div className="w-full bg-gray-700 rounded-2xl p-3 sm:p-4 mb-4">
        <h2 className="text-lg font-bold mb-2">Players</h2>

        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {players.map((p) => {
              const isAlive = !p.dead;
              return (
                <li
                  key={p.id}
                  className={`px-3.5 py-2.5 rounded-2xl text-center transition ${
                    isAlive
                      ? "bg-slate-700 hover:bg-slate-600 active:bg-slate-600"
                      : "bg-red-900/70 line-through"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-base">{p.name}</span>
                    {p.name === playerName && (
                      <span className="text-green-400 text-sm">(You)</span>
                    )}
                    {/* Score (if present in payload) */}
                    {typeof p.score === "number" && (
                      <span className="text-xs text-gray-300">• {p.score} pts</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Role reveal (mobile friendly) */}
      <div className="w-full flex flex-col items-center">
        <button
          onClick={() => setShowRole((prev) => !prev)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-700 px-4 py-3 rounded-2xl mb-3 text-base"
        >
          {showRole ? "Hide Role" : "Reveal Role"}
        </button>

        {showRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full sm:w-auto p-3 bg-gray-900 rounded-2xl text-center border border-blue-500"
          >
            <h3 className="text-xl font-bold text-blue-400 mb-1">Your Role</h3>
            <p className="text-lg capitalize">{role || "Unassigned"}</p>
          </motion.div>
        )}
      </div>

      {/* Host controls in Lobby (Assign Roles + Start Game) */}
      {isHost && phase === "LOBBY" && (
        <div className="w-full flex flex-col sm:flex-row gap-2 mt-4">
          <button
            onClick={actions.assignRoles}
            className={`flex-1 px-4 py-3 rounded-2xl text-base ${
              rolesLocked
                ? "bg-slate-700 opacity-50 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-700"
            }`}
            disabled={!!rolesLocked}
            title={rolesLocked ? "Roles already locked" : "Assign roles to all players"}
          >
            🃏 Assign Roles
          </button>

          <button
            onClick={actions.startGame}
            className="flex-1 px-4 py-3 rounded-2xl text-base bg-red-600 hover:bg-red-700 active:bg-red-700"
            title="Start the game (go to Night 1)"
          >
            🚀 Start Game
          </button>
        </div>
      )}

      {/* Hints based on phase (no game logic here; Night/Day actions handled in their own components) */}
      {phase === "NIGHT" && (
        <p className="text-sm text-gray-300 mt-3">
          If you are Mafia, Detective, or Doctor, your private night action panel will appear.
        </p>
      )}
      {phase === "DAY" && (
        <p className="text-sm text-gray-300 mt-3">
          Discuss and cast your vote in the Day screen.
        </p>
      )}
    </div>
  );
}
