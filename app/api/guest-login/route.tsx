import { getPusherInstance } from "../utils/pusher-client";
import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
} from "../utils/user-info";
import { UserInfo } from "../../types/user";
import { NextRequest, NextResponse } from "next/server";

const pusher = getPusherInstance();

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const guestUser: UserInfo = {
      id: generateGuestId(),
      animal: getRandomAnimal(),
      position: getPosition(),
      createdAt: new Date(),
    };

    // Generate auth token for Pusher
    const body = await req.formData();
    const socketId = body.get("socket_id")?.toString();
    const channel = `presence-chat`;

    if (!socketId || !channel) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: guestUser.id,
      user_info: {
        animal: guestUser.animal,
        position: guestUser.position,
        createdAt: guestUser.createdAt,
      },
    });

    return NextResponse.json({
      ...authResponse,
      user: guestUser,
    });
  } catch (error) {
    console.error("Guest login error:", error);
    return NextResponse.json({ message: "Internal server error", status: 500 });
  }
}
