import express from "express";
import { UserInfo } from "shared/types";
import {
  generateGuestId,
  getUniqueAnimalForRoom,
  getInitialPosition,
  getInitialDirection,
} from "../initialization/user-info";

import { findRoomInMemory } from "../state/rooms";
import { getAllUsersInRoom } from "../state/users";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const guestId = generateGuestId();
    const room = await findRoomInMemory();

    // Get animals already used in this room
    const existingUsers = getAllUsersInRoom(room);
    const usedAnimals = Array.from(existingUsers.values()).map(user => user.animal);

    // Create guest user with unique animal
    const guestUser: UserInfo = {
      id: guestId,
      animal: getUniqueAnimalForRoom(usedAnimals),
      room: room,
      position: getInitialPosition(),
      direction: getInitialDirection(),
      nickname: "", // Placeholder, will be set by frontend
    };

    // Generate token (base64 encoded user info)
    const token = Buffer.from(JSON.stringify(guestUser)).toString("base64");

    res.json({ user: guestUser, token });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Failed to authenticate" });
  }
});

export default router;
