import express from "express";
import { UserInfo, NPCGroup, NPCPhase } from "shared/types";
import {
  generateGuestId,
  getRandomAnimal,
  getInitialPosition,
  getInitialDirection,
} from "../initialization/user-info";

import { findRoomInMemory } from "../state/rooms";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const guestId = generateGuestId();
    const room = await findRoomInMemory();

    // Create guest user
    const guestUser: UserInfo = {
      id: guestId,
      animal: getRandomAnimal(),
      room: room,
      position: getInitialPosition(),
      direction: getInitialDirection(),
      npcGroup: new NPCGroup({ 
        id: guestId,
        fileNames: [],
        position: getInitialPosition(),
        direction: getInitialDirection(),
        phase: NPCPhase.IDLE,
        captorId: guestId 
      }),
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
