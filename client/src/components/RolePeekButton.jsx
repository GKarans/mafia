// client/src/context/GameContext.jsx
import React, { createContext, useReducer, useEffect, useContext, useRef } from "react";
import { socket } from "../index.jsx";
import { bindSocketSounds } from "../utils/soundManager.js";

const initialState = {
  night: { mafiaSelections: {}, mafiaFinalTarget: null, detectivePeek: null },
  nightTurn: null,
  doctorSelfUsed: false,

  lastNightDeaths: [],
  lastLynch: null,
  dayResolved: false,
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
    case "SET_PHASE": return { ...state, phase: action.payload };
    case "SET_ROOM": return { ...state, roomId: action.payload };
    case "SET_RESULT": return { ...state, result: action.payload };
    case "CONNECTED": return { ...state, connected: true };
    case "ERROR": return { ...state, error: action.payload };
    case "RESET": return { ...initialState };
    case "SOCKET_STATE": return { ...state, ...action.payload };
    case "MAFIA_SELECTIONS":
      return { ...state, night: { ...state.night, mafiaSelections: action.payload } };
    case "MAFIA_FINAL":
      return { ...state, night: { ...state.night, mafiaFinalTarget: action.payload } };
    case "DETECTIVE_PEEK":
      return { ...state, night: { ...state.night, detectivePeek: action.payload } };
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

    socket.on("connect", () => {
      dispatch({ type: "CONNECTED" });
    });
    socket.on("disconnect", () => {
      dispatch({ type: "ERROR", payload: "Disconnected from server" });
    });
    socket.on("connect_error", (err) => {
      dispatch({ type: "ERROR", payload: err.message });
    });

    socket.on("joinedRoom", ({ roomId, player }) => {
      dispatch({ type: "SET_ROOM", payload: roomId });
      dispatch({ type: "SET_PLAYER", payload: player.name });
    });

    socket.on("playerList", (players) => dispatch({ type: "SET_PLAYERS", payload: players }));
    socket.on("roleAssigned", ({ role }) => dispatch({ type: "SET_ROLE", payload: role }));
    socket.on("phaseChange", ({ phase }) => dispatch({ type: "SET_PHASE", payload: phase }));
    socket.on("gameOver", ({ result }) => dispatch({ type: "SET_RESULT", payload: result }));

    socket.on("state:update", (payload) => dispatch({ type: "SOCKET_STATE", payload }));
    socket.on("mafia:selections", (map) => dispatch({ type: "MAFIA_SELECTIONS", payload: map }));
    socket.on("mafia:final", ({ targetId }) => dispatch({ type: "MAFIA_FINAL", payload: targetId }));
    socket.on("detective:result", ({ targetId, isMafia }) =>
      dispatch({ type: "DETECTIVE_PEEK", payload: { targetId, isMafia } })
    );
    socket.on("doctor:selfUsed", () => dispatch({ type: "DOCTOR_SELF_USED" }));

    socket.on("voting:update", (payload) => dispatch({ type: "SOCKET_STATE", payload }));
    socket.on("day:resolved", (payload) => dispatch({ type: "SOCKET_STATE", payload }));

    return () => {
      socket.off("playerList");
      socket.off("roleAssigned");
      socket.off("phaseChange");
      socket.off("gameOver");
      socket.off("state:update");
      socket.off("mafia:selections");
      socket.off("mafia:final");
      socket.off("detective:result");
      socket.off("doctor:selfUsed");
      socket.off("voting:update");
      socket.off("day:resolved");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  const actions = {
    createRoom: (config) => socket.emit("createRoom", config),
    joinRoom: (roomId, name) => socket.emit("joinRoom", { roomId, name }),

    // Lobby role control
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
  };

  return (
    <GameContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </GameContext.Provider>
  );
};
