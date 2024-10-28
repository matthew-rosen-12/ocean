import Pusher from "pusher";
import { NextRequest, NextResponse } from 'next/server';
import { config } from '../lib/config';

const pusher = new Pusher(config.pusher);

interface MessageRequest {
  message: string;
  // add other fields you expect from the request
}

let count = 0

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body as MessageRequest;
    const response_message = count
    count = message == 'testing' ? count + 1 : -1

    await pusher.trigger('my-channel', 'my-event', {
      response_message,
      timestamp: 'irrelevant'
    });

    return NextResponse.json({ message: 'Message sent' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { message: 'Error sending message' },
      { status: 500 }
    );
  }
}