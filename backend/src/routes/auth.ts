import express from "express";
import { v4 as uuidv4 } from "uuid";
import { set } from "../db/config";
import { UserInfo } from "../types";
import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
  getDirection,
} from "../user-info";

import { findRoom } from "../db/config";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const guestId = generateGuestId();
    const room = await findRoom();

    // Create guest user
    const guestUser: UserInfo = {
      id: guestId,
      animal: getRandomAnimal(),
      room: room,
      position: getPosition(),
      direction: getDirection(),
      npcGroup: { npcIds: new Set(), captorId: guestId },
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
