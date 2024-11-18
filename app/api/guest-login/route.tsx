import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
} from "../utils/user-info";
import { UserInfo } from "../../utils/types/user";
import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "../utils/pusher/join-room";

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json(
      { message: "Method not allowed" },
      { status: 405 }
    );
  }

  const guestUser: UserInfo = {
    id: generateGuestId(),
    animal: getRandomAnimal(),
    position: getPosition(),
    createdAt: new Date(),
  };

  // Generate auth token for Pusher
  const body = await req.formData();
  const socketId = body.get("socket_id")?.toString();

  if (!socketId) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    return joinRoom(socketId, guestUser);
  } catch (error) {
    console.error("Guest login error:", error);
    return NextResponse.json({ message: "Internal server error", status: 500 });
  }
}
