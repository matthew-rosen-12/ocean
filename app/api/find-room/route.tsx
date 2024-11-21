import { NextResponse } from "next/server";
import getChannel from "../utils/pusher/find-room";

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
