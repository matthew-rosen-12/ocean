import { getPusherInstance } from "./pusher-instance";
import getChannel from "./create-room";
import { UserInfo } from "../../../utils/types/user";
import { NextResponse } from "next/server";

const pusher = getPusherInstance();
const channel = getChannel();

export async function joinRoom(
  socketId: string,
  guestUser: UserInfo
): Promise<NextResponse> {
  const authResponse = pusher.authorizeChannel(socketId, await channel, {
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
}
