// client/src/components/DayPhase.jsx
import React from "react";
import { useGame } from "../context/GameContext.jsx";
import { motion } from "framer-motion";
import VotePhase from "./VotePhase.jsx";

export default function DayPhase() {
  const { state, actions } = useGame();
  const { dayResolved, lastNightDeaths = [], lastNightSaved = false, lastLynch = null } = state;

  return (
    <div className="p-4 space-y-4 w-full max-w-xl mx-auto">
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-bold"
      >
        ☀️ Day Phase
      </motion.h2>

      {/* Night results: either deaths (with roles) or a doctor save banner */}
      {lastNightSaved && (
  <div className="bg-green-900/50 border border-green-700 rounded-2xl p-3">
    <p className="text-sm">🩺 <span className="font-semibold">Doctor saved someone's life.</span></p>
  </div>
)}
{/* 
{state.detectiveMissed && (
  <div className="bg-yellow-900/50 border border-yellow-700 rounded-2xl p-3">
    <p className="text-sm">🔫 <span className="font-semibold">Detectiv didnt shoot mafia3333.</span></p>
  </div>
)} */}


      {(
        <div className="bg-green-900/50 border border-green-700 rounded-2xl p-3">
          <p className="text-sm">
            🔫 <span className="font-semibold">Detectiv didnt shoot mafia.</span>
          </p>
        </div>
      )}

      {!!lastNightDeaths?.length && (
        <div className="bg-gray-800/70 rounded-2xl p-3">
          <h4 className="font-semibold mb-2">Last night:</h4>
          <ul className="list-disc list-inside text-sm">
            {lastNightDeaths.map((d) => (
              <li key={d.id || d.name}>
                {d.name}
                <span className="text-gray-300"> — </span>
                <span className={d.role === "mafia" ? "text-red-300" : "text-green-300"}>
                  {d.role || "unknown"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day lynch (if any) */}
      {lastLynch && (
        <div className="bg-gray-800/70 rounded-2xl p-3">
          <h4 className="font-semibold mb-1">Lynched:</h4>
          <p className="text-sm">
            {lastLynch.name}
            {lastLynch.role && (
              <>
                <span className="text-gray-300"> — </span>
                <span className={lastLynch.role === "mafia" ? "text-red-300" : "text-green-300"}>
                  {lastLynch.role}
                </span>
              </>
            )}
          </p>
        </div>
      )}

            <VotePhase noTimer />

      <div className="pt-1">
        <button
          onClick={() => actions.startNight()}
          disabled={!dayResolved}
          className={`w-full mt-2 px-4 py-3 rounded-2xl text-base ${
            dayResolved
              ? "bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-700"
              : "bg-slate-700 opacity-50 cursor-not-allowed"
          }`}
          title={dayResolved ? "Start night" : "Wait until the day is resolved"}
        >
          Start Night
        </button>
      </div>
    </div>
  );
}
