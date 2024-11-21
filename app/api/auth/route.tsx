import {
  generateGuestId,
  getRandomAnimal,
  getPosition,
} from "../utils/user-info";
import { UserInfo } from "../../utils/types/user";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pusher = getPusherInstance();

  const guestUser: UserInfo = {
    id: generateGuestId(),
    animal: getRandomAnimal(),
    position: getPosition(),
    createdAt: new Date(),
  };

  const rawBody = await getRawBody(req);
  const data = new URLSearchParams(rawBody.toString());

  const socketId = data.get("socket_id");
  const channelName = data.get("channel_name");

  if (
    !socketId ||
    !channelName ||
    typeof socketId !== "string" ||
    typeof channelName !== "string"
  ) {
    return res.status(400).json({
      message: "Missing or invalid socket_id or channel_name",
    });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: guestUser.id,
    user_info: {
      animal: guestUser.animal,
      position: guestUser.position,
      createdAt: guestUser.createdAt,
    },
  });

  return res.json(authResponse);
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}
