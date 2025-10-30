// client/src/components/NightPhase.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useGame } from "../context/GameContext.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { socket } from "../index.jsx";

export default function NightPhase() {
  const { state, actions } = useGame();
  const {
    nightRole,             // "mafia" | "detective" | "doctor" | null
    nightTargets = [],     // [{ id, name }] — private to me this night
    nightTurn,             // which role's turn it is globally
    doctorSelfUsed = false,
    playerName = "",
    night = {},
  } = state;

  // ===== Local UI state =====
  const [picked, setPicked] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [selfDenied, setSelfDenied] = useState(false);
  const [selections, setSelections] = useState({});   // targetId -> count
  const [unanimousTargetId, setUnanimousTargetId] = useState(null);

  // Reset local state each new turn
  useEffect(() => {
    setPicked(null);
    setSubmitted(false);
    setSelfDenied(false);
    setSelections({});
    setUnanimousTargetId(null);
  }, [nightRole, nightTurn]);

  const itIsMyTurn = useMemo(() => {
    if (!nightRole || !nightTurn) return false;
    return nightRole === nightTurn;
  }, [nightRole, nightTurn]);

  // Which roles can act at night
  const canActRole =
    nightRole === "mafia" || nightRole === "detective" || nightRole === "doctor";
  const canActNow = canActRole && itIsMyTurn;

  // ===== Consensus listeners (Mafia & Detective) =====
  useEffect(() => {
    if (!canActNow) return;

    function onMafiaStatus({ selections, unanimousTargetId }) {
      if (nightRole !== "mafia") return;
      setSelections(selections || {});
      setUnanimousTargetId(unanimousTargetId || null);
    }
    function onMafiaFinal({ targetId }) {
      if (nightRole !== "mafia") return;
      setUnanimousTargetId(targetId || null);
      setSubmitted(true);
    }
    function onDetStatus({ selections, unanimousTargetId }) {
      if (nightRole !== "detective") return;
      setSelections(selections || {});
      setUnanimousTargetId(unanimousTargetId || null);
    }
    function onDetFinal({ targetId }) {
      if (nightRole !== "detective") return;
      setUnanimousTargetId(targetId || null);
      setSubmitted(true);
    }

    socket.on("mafia:status", onMafiaStatus);
    socket.on("mafia:final", onMafiaFinal);
    socket.on("detective:status", onDetStatus);
    socket.on("detective:final", onDetFinal);

    return () => {
      socket.off("mafia:status", onMafiaStatus);
      socket.off("mafia:final", onMafiaFinal);
      socket.off("detective:status", onDetStatus);
      socket.off("detective:final", onDetFinal);
    };
  }, [canActNow, nightRole]);

  // Emit propose on pick for mafia/detective
  const pickAndPropose = (id) => {
    setPicked(id);
    if (nightRole === "mafia") actions.mafiaPropose(id);
    if (nightRole === "detective") actions.detectivePropose(id);
  };

  // ===== Submit handler (Confirm) =====
  const submit = () => {
    if (!canActNow || submitted) return;

    if (nightRole === "mafia") {
      if (!unanimousTargetId) return;
      actions.mafiaFinalize(unanimousTargetId);
      setSubmitted(true);
      return;
    }

    if (nightRole === "detective") {
      if (!unanimousTargetId) return;
      actions.detectiveFinalize(unanimousTargetId);
      setSubmitted(true);
      return;
    }

    if (nightRole === "doctor") {
      // Doctor may choose anyone; enforce self-save once per game:
      const pickedObj = nightTargets.find((t) => t.id === picked);
      const pickedIsSelf = pickedObj && pickedObj.name === playerName;

      if (doctorSelfUsed && pickedIsSelf) {
        // Show banner and block
        setSelfDenied(true);
        return;
      }

      if (picked) actions.doctorSave(picked);
      actions.doctorConfirm(); // doctor confirms regardless (can be null if skipping)
      setSubmitted(true);
      return;
    }
  };

  const targetIsSelf = (t) => t?.name === playerName;

  const consensusColor = (id) => {
    // Doctor: single actor — highlight selected as green
    if (nightRole === "doctor") {
      return picked === id
        ? "bg-green-700"
        : "bg-slate-700 hover:bg-slate-600 active:bg-slate-600";
    }
    // Mafia/Detective:
    // - GREEN only when server says unanimous for this id
    if (unanimousTargetId && id === unanimousTargetId) return "bg-green-700";
    // - Otherwise, any currently selected targets (even if single) are RED
    if (selections && selections[id] > 0) return "bg-red-700";
    return "bg-slate-700 hover:bg-slate-600 active:bg-slate-600";
  };

  const btnClass = (id, disabled) =>
    `px-4 py-3 rounded-2xl text-left text-base transition ${
      disabled ? "bg-slate-700/50 cursor-not-allowed opacity-60" : consensusColor(id)
    }`;

  // Instruction line depends on role
  const instruction = (() => {
    if (nightRole === "mafia") return "Choose a target to eliminate. All Mafias must agree.";
    if (nightRole === "detective")
      return "Choose a player to shoot (only mafia will die). All Detectives must agree.";
    if (nightRole === "doctor") return "Choose a player to protect, then confirm.";
    return "";
  })();

  // ===== Optional reveal overlay (legacy-safe) =====
  const reveal = night?.detectiveRevealWindow || null;
  const [revealOpen, setRevealOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const timerRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => {
    if (!reveal) {
      setRevealOpen(false);
      setRemainingMs(0);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    const elapsed = Date.now() - (reveal.ts || Date.now());
    const left = Math.max(0, (reveal.ms || 5000) - elapsed);

    setRevealOpen(true);
    setRemainingMs(left);

    tickRef.current = setInterval(() => {
      setRemainingMs((m) => Math.max(0, m - 1000));
    }, 1000);

    timerRef.current = setTimeout(() => {
      setRevealOpen(false);
      if (tickRef.current) clearInterval(tickRef.current);
    }, left);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [reveal]);

  return (
    <div className="p-4 space-y-4 w-full max-w-xl mx-auto">
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-bold"
      >
        🌙 Night Phase
      </motion.h2>

      {canActNow ? (
        <div className="bg-gray-800/70 rounded-2xl p-3">
          <p className="text-sm text-gray-300 mb-2">{instruction}</p>

          {/* Target list */}
          <div className="space-y-2">
            {nightTargets.map((t) => {
              const disabled =
                submitted ||
                (nightRole === "doctor" &&
                  doctorSelfUsed &&
                  targetIsSelf(t));

              return (
                <button
                  key={t.id}
                  className={btnClass(t.id, disabled)}
                  disabled={disabled}
                  onClick={() =>
                    !disabled &&
                    (nightRole === "doctor" ? setPicked(t.id) : pickAndPropose(t.id))
                  }
                >
                  <span className="font-semibold">{t.name}</span>
                  {targetIsSelf(t) && (
                    <span className="ml-2 text-xs text-gray-300">(you)</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Self-save denied banner */}
          {nightRole === "doctor" && selfDenied && (
            <div className="bg-yellow-900/50 border border-yellow-700 rounded-2xl p-3 mt-2">
              <p className="text-sm">
                ⚠️ <span className="font-semibold">You cannot save yourself again.</span>
              </p>
            </div>
          )}

          {/* Confirm */}
          <button
            className={`w-full mt-3 px-4 py-3 rounded-2xl text-base ${
              submitted ||
              (nightRole === "mafia" && !unanimousTargetId) ||
              (nightRole === "detective" && !unanimousTargetId) ||
              (nightRole === "doctor" &&
                doctorSelfUsed &&
                (() => {
                  const sel = nightTargets.find((t) => t.id === picked);
                  return sel && sel.name === playerName;
                })())
                ? "bg-slate-700 opacity-50 cursor-not-allowed"
                : "bg-indigo-700 hover:bg-indigo-600 active:bg-indigo-700"
            }`}
            onClick={submit}
          >
            Confirm
          </button>

          {/* Skip (doctor only) */}
          {nightRole === "doctor" && !submitted && (
            <button
              onClick={() => {
                setPicked(null);
                actions.doctorConfirm();
                setSubmitted(true);
              }}
              className="w-full mt-2 px-4 py-3 rounded-2xl text-base bg-slate-700 hover:bg-slate-600 active:bg-slate-600"
            >
              Skip
            </button>
          )}

          {submitted && (
            <p className="text-gray-300 mt-2 text-sm">
              Action submitted. Waiting for others…
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-800/50 rounded-2xl p-3">
          <p className="text-sm text-gray-300">
            Waiting for other roles to act…
          </p>
        </div>
      )}

      {/* Optional reveal overlay (if server ever sends reveal windows) */}
      <AnimatePresence>
        {revealOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 p-4 rounded-2xl w-full max-w-sm"
            >
              <h3 className="text-lg font-semibold mb-2">Reveal</h3>
              <p className="text-sm text-gray-200 mb-3">
                Detective result window (legacy support).
              </p>
              <button
                onClick={() => {}}
                disabled
                className="w-full px-4 py-3 rounded-2xl text-base bg-slate-700 opacity-70 cursor-not-allowed"
                title="Auto closes"
              >
                Closing in {Math.ceil(remainingMs / 1000)}s…
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
