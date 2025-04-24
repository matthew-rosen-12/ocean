import { io, Socket } from "socket.io-client";

export const BACKEND_URL = "http://localhost:3001";
let socketInstance: Socket | null = null;

export const getSocket = (token?: string) => {
  if (token) {
    // If we have a token, create a new socket instance with it
    if (socketInstance) {
      socketInstance.disconnect();
    }
    socketInstance = io(BACKEND_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
  } else if (!socketInstance) {
    // If no token and no instance, create one without auth
    socketInstance = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
    });
  }
  return socketInstance;
};

export const socket = () => getSocket();
