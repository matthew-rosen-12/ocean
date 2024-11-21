import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../utils/pusher/pusher-instance";
import getChannel from "../utils/pusher/find-room";

const pusher = getPusherInstance();

export async function GET(req: NextRequest) {
  try {
    const channel_name = await getChannel();

    return NextResponse.json({ channel_name });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { message: "Error sending message" },
      { status: 500 }
    );
  }
}
