// route for pusher to find a room for a guest user

import { NextResponse } from "next/server";
import getChannel from "../utils/pusher/find-room";

export const dynamic = "force-dynamic";

export async function GET() {
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
