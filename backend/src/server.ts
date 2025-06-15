import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { NPCPhase, userId, UserInfo, socketId, NPCGroup } from "shared/types";
import authRouter from "./routes/auth";
import { getGameTicker } from "./game-ticker";
import { decrementRoomUsersInMemory, getRoomNumUsersInMemory } from "./state/rooms";
import { addUserToRoom, removeUserFromRoom, updateUserInRoom, getAllUsersInRoom } from "./state/users";
import { generateRoomTerrain } from "./utils/terrain";
import { getpathsfromMemory } from "./state/paths";
import { getNPCGroupsfromMemory, removeTopNPCFromGroupInRoomInMemory, removeNPCGroupInRoomInMemory, setNPCGroupsInMemory } from "./state/npcGroups";
import { setPathsInMemory } from "./state/paths";
import { updateNPCGroupInRoom } from "./services/npcService";
import { emitToRoom, TypedSocket } from "./utils/typed-socket";

// Initialize game ticker
getGameTicker();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// Add auth route
app.use("/api/auth", authRouter);

const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const startServer = async () => {
  try {
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();


io.on("connection", async (socket) => {
  const typedSocket = new TypedSocket(socket);

  try {
    // Authenticate socket using token
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log("No token provided, disconnecting");
      typedSocket.disconnect();
      return;
    }

    // Decode user info from token
    const user = JSON.parse(Buffer.from(token, "base64").toString());
    typedSocket.data.lastPosition = user.position;

    // Map this socket to the user
    typedSocket.data.user = user;


    // Join room and broadcast user joined
    typedSocket.on("join-room", async ({ name }) => {
      console.log("joining room");

      typedSocket.join(name);
      typedSocket.data.room = name;

      // Add user to server memory for this room
      addUserToRoom(name, user);

      // Send all existing users in the room to the joining user
      const existingUsers = getAllUsersInRoom(name);
      if (existingUsers.size > 0) {
        typedSocket.emit("all-users", { users: existingUsers });
      }

      // Send other room state to the joining socket
      try {
        // Send terrain configuration for this room
        const terrainConfig = generateRoomTerrain(name);
        typedSocket.emit("terrain-config", { terrainConfig });

        // Get existing paths
        const pathsData =  getpathsfromMemory(name);
        if (pathsData) {
          typedSocket.emit("all-paths", { paths: pathsData });
        }

        // Get existing NPC groups
        const groupsData =  getNPCGroupsfromMemory(name);
        if (groupsData) {
          typedSocket.emit("all-npc-groups", { npcGroups: groupsData });
        }
      } catch (error) {
        console.error("Error sending room state to new user:", error);
      }

      // Broadcast to room that user joined
      typedSocket.broadcast(name, "user-joined", { user });
    });

    // Handle capture-npc request
    typedSocket.on("capture-npc", async ({ npcId, room, captorId }) => {
      try {
        const npcGroups =  getNPCGroupsfromMemory(room);
        const npcGroup = npcGroups.getByNpcGroupId(npcId)!;

        const updatedNPCGroup: NPCGroup = {
          ...npcGroup,
          phase: NPCPhase.CAPTURED,
        };

        // Only call setPathCompleteInRoom if the NPC is actually in PATH phase
        if (npcGroup.phase === NPCPhase.PATH) {
          const paths =  getpathsfromMemory(room);
          paths.delete(npcGroup.id);
           setPathsInMemory(room, paths);
        }


        updateNPCGroupInRoom(room, updatedNPCGroup);

        typedSocket.broadcast(room, "npc-group-captured", {
          id: captorId,
          npcGroup: updatedNPCGroup,
        });
      } catch (error) {
        console.error("Error capturing NPC:", error);
      }
    });

    // Handle path-npc request
    typedSocket.on("path-npc", async ({ pathData }) => {
      try {
        const updatedNPCGroup: NPCGroup = {
          ...pathData.npcGroup,
          phase: NPCPhase.PATH,
        };

        updateNPCGroupInRoom(pathData.room, updatedNPCGroup);
        const activepaths =  getpathsfromMemory(pathData.room);
        // if pathData already exists, update it
        const existingPath = activepaths.get(pathData.npcGroup.id);
        if (existingPath) {
          activepaths.delete(pathData.npcGroup.id);
        }
        activepaths.set(pathData.npcGroup.id, pathData);
         setPathsInMemory(pathData.room, activepaths);

        // Only remove from group if there's a captorId (fleeing NPCs don't have groups)
        if (pathData.npcGroup.captorId) {
           removeTopNPCFromGroupInRoomInMemory(
            pathData.room,
            pathData.npcGroup.captorId
          );
        }

        typedSocket.broadcast(pathData.room, "path-update", {
          pathData,
        });
      } catch (error) {
        console.error("Error pathing NPC:", error);
      }
    });

    // Handle user position updates
    typedSocket.on("update-user", async ({ user }) => {
      try {
        typedSocket.data.lastPosition = user.position;
        const room = typedSocket.data.room;
        if (room) {
          // Update user in server memory
          updateUserInRoom(room, user);
          // Broadcast update to other users
          typedSocket.broadcast(room, "user-updated", { user });
        }
      } catch (error) {
        console.error("Error handling user update:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        const lastPosition = socket.data.lastPosition;

        const room = socket.data.room;
        if (room) {
          console.log("disconnecting");

          const userId = socket.data.user.id;
          // set npcs of this user's npc groups to IDLE
          const npcGroups = getNPCGroupsfromMemory(room);
          const npcGroup = npcGroups.getByUserId(user.id);
          if (npcGroup) {
            const updatedNPCGroup: NPCGroup = {
              ...npcGroup,
                position: lastPosition,
                phase: NPCPhase.IDLE,
              };
            npcGroups.setByNpcGroupId(npcGroup.id, updatedNPCGroup);
            setNPCGroupsInMemory(room, npcGroups);
          }
          // remove the user's npc groups from redis
          removeNPCGroupInRoomInMemory(room, user.id);

          // Remove user from room memory
          removeUserFromRoom(room, user.id);

          // Handle room users decrement
          decrementRoomUsersInMemory(room, socket.id);

          if (userId) {
            typedSocket.broadcast(room, "user-left", { lastPosition, userId });
          }
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });
  } catch (error) {
    console.error("Socket connection error:", error);
    socket.disconnect();
  }
});
