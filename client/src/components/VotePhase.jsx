// client/src/components/VotePhase.jsx
import React, { useMemo, useState } from "react";
import { useGame } from "../context/GameContext.jsx";
import { motion } from "framer-motion";

export default function VotePhase({ noTimer = false }) {
  const { state, actions } = useGame();
  const { players = [], playerName, lastNightDeaths = [] } = state;
  const [selected, setSelected] = useState(undefined);
  const [voted, setVoted] = useState(false);

  // Targets: only alive players may be voted out
  const alive = useMemo(() => players.filter((p) => !p.dead), [players]);

  // Who am I?
  const me = useMemo(
    () => players.find((p) => p.name === playerName),
    [players, playerName]
  );

  // Was I killed last night?
  const iWasKilledLastNight = useMemo(
    () => Array.isArray(lastNightDeaths) && lastNightDeaths.some((d) => d?.name === playerName),
    [lastNightDeaths, playerName]
  );

  // Client-side voting rule to mirror the server's:
  // - You can vote if you are alive
  // - OR you were killed last night (one last vote)
  const canVoteNow = !!me && (!me.dead || iWasKilledLastNight);

  const handleVote = (targetId) => {
    if (!canVoteNow || voted) return;
    setSelected(targetId);
    actions.vote(targetId ?? null); // null = abstain
    setVoted(true);
  };

  return (
    <div className="w-full">
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xl font-bold mb-3"
      >
        Day Vote
      </motion.h3>

      {!canVoteNow && (
        <p className="mb-3 text-sm text-gray-300">
          You cannot vote this day. (Only players who are alive or were killed last night may vote.)
        </p>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${!canVoteNow ? "opacity-60" : ""}`}>
        {alive.map((p) => (
          <button
            key={p.id}
            onClick={() => handleVote(p.id)}
            className={`px-3.5 py-2.5 rounded-2xl text-left transition text-base ${
              selected === p.id ? "bg-red-700" : "bg-slate-700 hover:bg-slate-600 active:bg-slate-600"
            }`}
            disabled={voted || !canVoteNow}
          >
            {p.name}
          </button>
        ))}

        <button
          onClick={() => handleVote(null)}
          className={`px-3.5 py-2.5 rounded-2xl text-left transition text-base ${
            selected === null ? "bg-blue-700" : "bg-slate-700 hover:bg-slate-600 active:bg-slate-600"
          }`}
          disabled={voted || !canVoteNow}
        >
          Do not vote
        </button>
      </div>

      {voted && (
        <p className="text-green-400 mt-2">
          Vote submitted. Waiting for others…
        </p>
      )}
    </div>
  );
}
