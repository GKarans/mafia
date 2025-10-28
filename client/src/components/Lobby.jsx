// client/src/components/Lobby.jsx
import React, { useState } from "react";
import { useGame } from "../context/GameContext.jsx";

export default function Lobby() {
  const { state, dispatch, actions } = useGame();
  const [playerName, setPlayerName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = () => {
    if (!playerName.trim()) return setError("Enter your name first.");
    setLoading(true);
    dispatch({ type: "SET_PLAYER", payload: playerName });
    actions.createRoom({ hostName: playerName });
    setTimeout(() => setLoading(false), 300);
  };

  const handleJoin = () => {
    if (!roomInput.trim() || !playerName.trim())
      return setError("Enter both name and room ID.");
    setLoading(true);
    dispatch({ type: "SET_PLAYER", payload: playerName });
    actions.joinRoom(roomInput, playerName);
    setTimeout(() => setLoading(false), 300);
  };

  const isHost = state.playerName && state.players[0]?.name === state.playerName;

  return (
    <div className="flex flex-col items-center text-center w-full max-w-md bg-gray-800 rounded-2xl p-6 shadow-lg">
      <h1 className="text-3xl font-bold text-white mb-4">🎭 Mafia Game Lobby</h1>

      {!state.roomId ? (
        <>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-2 mb-3 rounded bg-gray-700 text-white"
          />
          <div className="flex gap-2 w-full">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition"
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
            >
              {loading ? "Joining..." : "Join Room"}
            </button>
          </div>
          <input
            type="text"
            placeholder="Enter room ID"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            className="w-full p-2 mt-3 rounded bg-gray-700 text-white"
          />
          {error && <p className="text-red-400 mt-3">{error}</p>}
        </>
      ) : (
        <>
          <h2 className="text-xl text-green-400 mb-2">
            Room: <span className="font-mono">{state.roomId}</span>
          </h2>
          <p className="text-gray-400 mb-4">
            Welcome, {state.playerName}!
          </p>

          <h3 className="text-lg text-white mb-2">Players:</h3>
          <ul className="bg-gray-700 rounded p-2 w-full max-h-48 overflow-y-auto">
            {state.players.map((p) => (
              <li key={p.id} className="text-gray-200">
                {p.name} {p.dead ? "💀" : ""}
              </li>
            ))}
          </ul>

          {isHost && (
            <button
              onClick={actions.assignRoles}
              disabled={state.rolesLocked || state.players.length < 4}
              className={`mt-4 w-full py-2 rounded ${
                state.rolesLocked || state.players.length < 4
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              } text-white transition`}
            >
              {state.rolesLocked ? "Roles Assigned" : "Assign Roles (Lobby)"}
            </button>
          )}

          {isHost && (
            <button
              onClick={actions.startGame}
              disabled={!state.rolesLocked}
              className={`mt-3 w-full py-2 rounded ${
                !state.rolesLocked
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              } text-white transition`}
            >
              Start Game
            </button>
          )}
        </>
      )}
    </div>
  );
}
