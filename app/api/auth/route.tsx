import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
  getDirection,
} from "../utils/user-info";
import { UserInfo } from "../../utils/types";
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

  const guestId = generateGuestId();

  const guestUser: UserInfo = {
    id: guestId,
    animal: getRandomAnimal(),
    channel_name: channelName,
    position: getPosition(),
    direction: getDirection(),
    npcGroup: { npcIds: new Set(), captorId: guestId },
  };

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: guestUser.id,
    user_info: guestUser,
  });

  return NextResponse.json(authResponse);
}
