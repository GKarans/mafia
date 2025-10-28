// client/src/components/ResultScreen.jsx
import React from "react";
import { useGame } from "../context/GameContext.jsx";
import { motion } from "framer-motion";

export default function ResultScreen() {
  const { state, actions } = useGame();
  const { result, players = [], playerName } = state;

  const isMafiaWin = result?.toLowerCase().includes("mafia");

  return (
    <div className="flex flex-col items-center min-h-[80vh] w-full max-w-xl mx-auto text-white p-4">
      <motion.h1
        className={`text-3xl sm:text-4xl font-extrabold mb-2 ${
          isMafiaWin ? "text-red-400" : "text-green-400"
        }`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {result || "Game Over"}
      </motion.h1>

      <p className="text-sm text-gray-300 mb-4">All roles are revealed below.</p>

      <div className="w-full bg-gray-800/70 rounded-2xl p-3 sm:p-4 space-y-2 max-h-[50vh] overflow-y-auto">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl px-3 py-2 bg-gray-700/70"
          >
            <div className="flex flex-col">
              <span className="text-base font-semibold">{p.name}</span>
              <span className={`text-xs ${p.role === "mafia" ? "text-red-300" : "text-green-300"}`}>
                {p.role || "—"}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-300">
              Score: <span className="font-semibold">{p.score ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4 w-full">
        <button
          onClick={() => actions.returnToLobby()}
          className="flex-1 bg-indigo-600 active:bg-indigo-700 hover:bg-indigo-700 px-4 py-3 rounded-2xl text-base"
        >
          Back to Lobby
        </button>
      </div>

      <motion.p
        className="text-xs text-gray-400 mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Thanks for playing Mafia! 🎭
      </motion.p>
    </div>
  );
}
