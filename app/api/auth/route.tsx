import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
} from "../utils/user-info";
import { UserInfo } from "../../utils/types/user";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const pusher = getPusherInstance();

  const formData = await request.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (
    !socketId ||
    !channelName ||
    typeof socketId !== "string" ||
    typeof channelName !== "string"
  ) {
    return NextResponse.json({
      message: "Missing or invalid socket_id or channel_name",
    });
  }

  const guestUser: UserInfo = {
    id: generateGuestId(),
    animal: getRandomAnimal(),
    channel_name: channelName,
    position: getPosition(),
    createdAt: new Date(),
  };

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: guestUser.id,
    user_info: {
      animal: guestUser.animal,
      channel_name: guestUser.channel_name,
      position: guestUser.position,
      createdAt: guestUser.createdAt,
    },
  });

  return NextResponse.json({
    ...authResponse,
    user: guestUser,
  });
}
