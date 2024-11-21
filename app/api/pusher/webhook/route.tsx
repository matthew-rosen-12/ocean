import { prisma } from "@/prisma/prisma";
import { getPusherInstance } from "../../utils/pusher/pusher-instance";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  // Get raw body
  const pusher = getPusherInstance();
  const rawBody = await request.arrayBuffer();
  let rawBodyString = Buffer.from(rawBody).toString("utf-8");

  // Get headers
  const headersList = headers();
  const signature = headersList.get("x-pusher-signature");
  const key = headersList.get("x-pusher-key");
  const jsonBody = JSON.parse(rawBodyString);
  rawBodyString = JSON.stringify(jsonBody);

  const expectedSignature = crypto
    .createHmac("sha256", process.env.CHANNELS_APP_SECRET!)
    .update(rawBodyString)
    .digest("hex");

  const webhook = pusher.webhook({
    headers: {
      "x-pusher-signature": signature!,
      "x-pusher-key": key!,
      "content-type": "application/json", // Add this
      "content-length": Buffer.byteLength(rawBody).toString(), // And this
    },
    rawBody: rawBodyString,
  });

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  const events = webhook.getData().events;

  try {
    // Handle member removed events
    for (const event of events) {
      if (event.name === "member_removed") {
        // Extract roomId from channel name
        const roomId = event.channel.split("presence-chat-")[1];

        await prisma.$transaction(async (tx) => {
          const updatedRoom = await prisma.room.update({
            where: { id: roomId },
            data: {
              numUsers: { decrement: 1 },
              lastActive: new Date(),
            },
            select: {
              numUsers: true,
            },
          });

          if (updatedRoom.numUsers <= 0) {
            await tx.room.delete({
              where: { id: roomId },
            });
          }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({
      error: "Webhook processing failed",
      status: 500,
    });
  }
}
