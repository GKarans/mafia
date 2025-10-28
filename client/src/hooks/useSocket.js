// client/src/hooks/useSocket.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

/**
 * React hook for managing a persistent Socket.IO connection.
 * @param {Object} options - Optional event handler map (eventName: callback)
 */
export const useSocket = (options = {}) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
      socketRef.current = io(SERVER_URL, {
        transports: ["websocket"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      console.log(`🔌 Connected to server: ${SERVER_URL}`);

      socketRef.current.on("connect_error", (err) => {
        console.error("⚠️ Socket connection error:", err.message);
      });
    }

    // Register custom event listeners
    const socket = socketRef.current;
    Object.entries(options).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup on unmount
    return () => {
      Object.entries(options).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []);

  return socketRef.current;
};
