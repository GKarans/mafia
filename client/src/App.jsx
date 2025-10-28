// client/src/App.jsx
import React, { Suspense, useContext, useState } from "react";
import { GameContext } from "./context/GameContext.jsx";

// Lazy screens
const Lobby = React.lazy(() => import("./components/Lobby.jsx"));
const NightPhase = React.lazy(() => import("./components/NightPhase.jsx"));
const DayPhase = React.lazy(() => import("./components/DayPhase.jsx"));
const VotePhase = React.lazy(() => import("./components/VotePhase.jsx"));
const ResultScreen = React.lazy(() => import("./components/ResultScreen.jsx"));
const GameBoard = React.lazy(() => import("./components/GameBoard.jsx"));

/** Simple error boundary to avoid white screen */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error("App ErrorBoundary caught:", err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <pre className="bg-gray-800 rounded p-3 overflow-auto text-sm">
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <p className="mt-2 opacity-70">Check the browser console for a stack trace.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameRouter() {
  const { state } = useContext(GameContext) || {};
  const phase = state?.phase || "LOBBY";

  switch (phase) {
    case "LOBBY": return <Lobby />;
    case "NIGHT": return <NightPhase />;
    case "DAY":   return <DayPhase />;
    case "VOTE":  return <VotePhase />;
    case "END":   return <ResultScreen />;
    default:      return <GameBoard />;
  }
}

/** Persistent floating role-reveal button (bottom-right) */
function RoleBadge() {
  const { state } = useContext(GameContext);
  const { role, playerName, phase } = state || {};
  const [open, setOpen] = useState(false);

  const showText = (() => {
    if (!role) return "Roles are not assigned yet.";
    return `🎭 Your role: ${role.toUpperCase()}`;
  })();

  return (
    <>
      {/* Floating toggle button always visible */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 bottom-4 right-4 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 text-white font-semibold"
        title="Show my role"
      >
        👁 Show Role
      </button>

      {/* Minimal modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl p-5 border bg-gray-900/95 border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold">Player: <span className="opacity-80">{playerName || "Unknown"}</span></h3>
            <p className="mt-2">{showText}</p>
            <div className="mt-4 flex justify-end">
              <button
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {/* Optional helper text */}
            {phase === "LOBBY" && (
              <p className="mt-2 text-xs opacity-60">
                If you see “Roles are not assigned yet.” ask the host to assign roles in the lobby.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  // Provider lives in index.jsx — do not wrap here
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <ErrorBoundary>
        <Suspense fallback={<div className="text-lg animate-pulse">Loading game…</div>}>
          <GameRouter />
        </Suspense>

        {/* Persistent role reveal button */}
        <RoleBadge />
      </ErrorBoundary>
    </div>
  );
}
