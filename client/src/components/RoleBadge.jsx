// client/src/components/RoleBadge.jsx
import React from "react";
import { useGame } from "../context/GameContext.jsx";

export default function RoleBadge() {
  const { state } = useGame();
  const { role } = state;

  if (!role) return null;

  const color =
    role === "mafia" ? "bg-red-700" :
    role === "detective" ? "bg-blue-700" :
    role === "doctor" ? "bg-emerald-700" :
    "bg-slate-700";

  const label = role[0].toUpperCase() + role.slice(1);

  return (
    <div className={`fixed top-3 right-3 ${color} text-white px-3 py-1 rounded-full shadow-lg text-sm opacity-90`}>
      Your role: <span className="font-semibold ml-1">{label}</span>
    </div>
  );
}
