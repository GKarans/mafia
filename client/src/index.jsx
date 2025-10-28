import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // Tailwind styles
import { GameProvider } from "./context/GameContext.jsx";
import { io } from "socket.io-client";

// ✅ Dynamically use production server URL when deployed
const SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

export const socket = io(SERVER_URL, {
  transports: ["websocket"], // ✅ Required for Heroku websockets
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>
);
