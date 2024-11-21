import { NextRequest, NextResponse } from "next/server";
import { getPusherInstance } from "../utils/pusher/pusher-instance";

const pusher = getPusherInstance();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message + "s";
    await pusher.trigger("generic-channel", "generic-event", {
      message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ message: "Message sent" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { message: "Error sending message" },
      { status: 500 }
    );
  }
}
