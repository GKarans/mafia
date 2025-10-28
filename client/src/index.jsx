import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css"; // ✅ Tailwind styles
import { io } from "socket.io-client";
import { GameProvider } from "./context/GameContext.jsx";

export const socket = io("http://localhost:4000", {
  transports: ["websocket"],
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>
);
