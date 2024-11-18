// pages/api/pusher/webhook.ts
import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { getPusherInstance } from "../utils/pusher-client";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify webhook is from Pusher
  const pusher = getPusherInstance();
  const webhook = pusher.webhook({
    headers: req.headers as any,
    rawBody: JSON.stringify(req.body),
  });

  if (!webhook.isValid()) {
    return res.status(401).json({ error: "Invalid webhook" });
  }

  try {
    // Handle member removed events
    for (const event of webhook.getEvents()) {
      if (event.name === "member_removed") {
        // Extract roomId from channel name
        const roomId = event.channel.split("presence-room-")[1];

        // Update room count in database
        await prisma.$transaction([
          prisma.room.update({
            where: { id: roomId },
            data: {
              numUsers: { decrement: 1 },
              lastActive: new Date(),
            },
          }),
          prisma.stats.update({
            where: { id: "global" },
            data: {
              totalUsers: { decrement: 1 },
            },
          }),
        ]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
