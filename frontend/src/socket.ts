import { io, Socket } from "socket.io-client";
import { TypedSocket } from "./utils/typed-socket";
import { superjsonParser } from "./superjson-parser";

export const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? '' // Use relative URL in production (same origin)
  : "http://localhost:3001";
let socketInstance: Socket | null = null;
let typedSocketInstance: TypedSocket | null = null;

export const getSocket = (token?: string) => {
  if (token) {
    // If we have a token, create a new socket instance with it
    if (socketInstance) {
      socketInstance.disconnect();
    }
    socketInstance = io(BACKEND_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      // parser: superjsonParser,
    });
    // Create new typed socket instance
    typedSocketInstance = new TypedSocket(socketInstance);
  } else if (!socketInstance) {
    // If no token and no instance, create one without auth
    socketInstance = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      // parser: superjsonParser,
    });
    // Create new typed socket instance
    typedSocketInstance = new TypedSocket(socketInstance);
  }
  return socketInstance;
};

export const getTypedSocket = (): TypedSocket => {
  if (!typedSocketInstance) {
    // Ensure we have a socket instance first
    getSocket();
    if (socketInstance) {
      typedSocketInstance = new TypedSocket(socketInstance);
    } else {
      throw new Error("Failed to create socket instance");
    }
  }
  return typedSocketInstance;
};

export const socket = () => getSocket();
export const typedSocket = () => getTypedSocket();
