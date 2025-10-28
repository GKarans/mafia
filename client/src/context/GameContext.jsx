// client/src/context/GameContext.jsx
import React, { createContext, useReducer, useEffect, useContext, useRef } from "react";
import { socket } from "../index.jsx";
import { bindSocketSounds } from "../utils/soundManager.js";

const initialState = {
  night: {
    mafiaSelections: {},
    mafiaFinalTarget: null,
    detectivePeek: null,
    detectiveRevealWindow: null, // { targetId, isMafia, ms, ts }
  },
  nightTurn: null,
  nightRole: null,      // "mafia" | "detective" | "doctor" | null (private per-socket)
  nightTargets: [],     // [{ id, name }] (private per-socket)
  doctorSelfUsed: false,

  lastNightDeaths: [],   // [{ id, name, role }]
  lastNightSaved: false, // boolean — doctor saved the mafia target
  lastLynch: null,       // { id, name, role } when lynched by day
  dayResolved: false,
  detectiveMissed: false,  // banner: detective shot wrong target during day
  detectiveShot: null,     // { id, name, role } when detective kills mafia during day
  rolesLocked: false,

  roomId: null,
  playerName: "",
  players: [],
  role: null,
  phase: "LOBBY",
  result: null,
  connected: false,
  error: null,
};

function gameReducer(state, action) {
  switch (action.type) {
    case "SET_PLAYER": return { ...state, playerName: action.payload };
    case "SET_PLAYERS": return { ...state, players: action.payload };
    case "SET_ROLE": return { ...state, role: action.payload };
    case "SET_PHASE": {
  const next = { ...state, phase: action.payload };
  if (action.payload === "LOBBY" || action.payload === "NIGHT") {
    next.doctorSelfUsed = false; // ✅ reset per new game
    // also clear per-night detective UI
    next.night = { mafiaSelections: {}, mafiaFinalTarget: null, detectivePeek: null, detectiveRevealWindow: null };
    next.nightTurn = null;
    next.lastNightDeaths = [];
    next.lastNightSaved = false;
    next.lastLynch = null;
    next.dayResolved = false;
  }
  return next;
}
    case "SET_ROOM": return { ...state, roomId: action.payload };
    case "SET_RESULT": return { ...state, result: action.payload };
    case "CONNECTED": return { ...state, connected: true };
    case "ERROR": return { ...state, error: action.payload };
    case "RESET": return { ...initialState };

    // Generic merge from server (players, nightTurn, dayResolved, lastNightDeaths, lastNightSaved, etc.)
    case "SOCKET_STATE":
      return { ...state, ...action.payload };

    // Night-specific
    case "MAFIA_SELECTIONS":
      return { ...state, night: { ...state.night, mafiaSelections: action.payload } };
    case "MAFIA_FINAL":
      return { ...state, night: { ...state.night, mafiaFinalTarget: action.payload } };
    case "DETECTIVE_PEEK":
      return { ...state, night: { ...state.night, detectivePeek: action.payload } };
    case "DETECTIVE_REVEAL":
      return { ...state, night: { ...state.night, detectiveRevealWindow: action.payload } };
    case "DOCTOR_SELF_USED":
      return { ...state, doctorSelfUsed: true };

    default: return state;
  }
}

export const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const soundsBoundRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    // Bind sounds ONCE (avoid StrictMode double-effect)
    if (!soundsBoundRef.current) {
      bindSocketSounds(socket);
      soundsBoundRef.current = true;
    }

    // Connectivity
    socket.on("connect", () => dispatch({ type: "CONNECTED" }));
    socket.on("disconnect", () => dispatch({ type: "ERROR", payload: "Disconnected from server" }));
    socket.on("connect_error", (err) => dispatch({ type: "ERROR", payload: err.message }));

    // Lobby / base
    socket.on("joinedRoom", ({ roomId, player }) => {
      dispatch({ type: "SET_ROOM", payload: roomId });
      dispatch({ type: "SET_PLAYER", payload: player.name });
    });
    socket.on("playerList", (players) => dispatch({ type: "SET_PLAYERS", payload: players }));
    socket.on("roleAssigned", ({ role }) => dispatch({ type: "SET_ROLE", payload: role }));

    // Phase changes: clear any private night UI so everyone starts "asleep"
    socket.on("phaseChange", ({ phase }) => {
      dispatch({ type: "SET_PHASE", payload: phase });
      if (phase === "NIGHT" || phase === "DAY" || phase === "END") {
        dispatch({
          type: "SOCKET_STATE",
          payload: { nightRole: null, nightTargets: [] }
        });
      }
    });

    // Game end
    socket.on("gameOver", ({ result, reveal }) => {
      dispatch({ type: "SET_RESULT", payload: result });
      // also lock in final revealed players (with roles) for ResultScreen
      dispatch({ type: "SOCKET_STATE", payload: { players: reveal } });
    });

    // Night + Day updates (server state)
    socket.on("state:update", (payload) => dispatch({ type: "SOCKET_STATE", payload }));

    // Mafia-only live tally and final
    socket.on("mafia:selections", (map) => dispatch({ type: "MAFIA_SELECTIONS", payload: map }));
    socket.on("mafia:final", ({ targetId }) => dispatch({ type: "MAFIA_FINAL", payload: targetId }));

    // Detective private peek & timed reveal modal
    socket.on("detective:result", ({ targetId, isMafia }) =>
      dispatch({ type: "DETECTIVE_PEEK", payload: { targetId, isMafia } })
    );
    socket.on("detective:revealWindow", (payload) =>
      dispatch({ type: "DETECTIVE_REVEAL", payload })
    );

    // Doctor self-save one-time notification
    socket.on("doctor:selfUsed", () => dispatch({ type: "DOCTOR_SELF_USED" }));

    // Private role prompts (per-socket)
    socket.on("night:mafia", ({ targets }) =>
      dispatch({ type: "SOCKET_STATE", payload: { nightRole: "mafia", nightTargets: targets } })
    );
    socket.on("night:detective", ({ targets }) =>
      dispatch({ type: "SOCKET_STATE", payload: { nightRole: "detective", nightTargets: targets } })
    );
    socket.on("night:doctor", ({ targets }) =>
      dispatch({ type: "SOCKET_STATE", payload: { nightRole: "doctor", nightTargets: targets } })
    );

    // NEW: clear role panel immediately after that role's turn ends
    socket.on("night:clear", () =>
      dispatch({ type: "SOCKET_STATE", payload: { nightRole: null, nightTargets: [] } })
    );

    // Voting helpers
    socket.on("voting:update", (payload) => dispatch({ type: "SOCKET_STATE", payload }));
    socket.on("day:resolved", (payload) => dispatch({ type: "SOCKET_STATE", payload }));


    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");

      socket.off("joinedRoom");
      socket.off("playerList");
      socket.off("roleAssigned");
      socket.off("phaseChange");
      socket.off("gameOver");

      socket.off("state:update");
      socket.off("mafia:selections");
      socket.off("mafia:final");
      socket.off("detective:result");
      socket.off("detective:revealWindow");
      socket.off("doctor:selfUsed");

      socket.off("night:mafia");
      socket.off("night:detective");
      socket.off("night:doctor");
      socket.off("night:clear");

      socket.off("voting:update");
      socket.off("day:resolved");
    };
  }, []);

  const actions = {
    // Rooms
    createRoom: (config) => socket.emit("createRoom", config),
    joinRoom: (roomId, name) => socket.emit("joinRoom", { roomId, name }),

    // Lobby
    assignRoles: () => socket.emit("roles:assign"),
    startGame: () => socket.emit("startGame"),

    // Voting
    vote: (targetId) => socket.emit("vote", targetId),

    // Night actions
    mafiaPropose: (targetId) => socket.emit("mafia:propose", { targetId }),
    mafiaFinalize: (targetId) => socket.emit("mafia:finalize", { targetId }),
    detectiveCheck: (targetId) => socket.emit("detective:check", { targetId }),
    detectiveConfirm: () => socket.emit("detective:confirm"),
    doctorSave: (targetId) => socket.emit("doctor:save", { targetId }),
    doctorConfirm: () => socket.emit("doctor:confirm"),

    // Manual phase control
    startNight: () => socket.emit("phase:startNight"),

    // Lobby restart
    returnToLobby: () => socket.emit("returnToLobby"),
  };

  return (
    <GameContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </GameContext.Provider>
  );
};
