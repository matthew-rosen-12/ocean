import Pusher from "pusher";
import { NextRequest, NextResponse } from 'next/server';
import { config } from './lib/config';

const pusher = new Pusher(config.pusher);

export default async function handler(
  req: NextRequest,
  res: NextResponse
) {
  await pusher.trigger('hello-channel', 'hello-event', { 
    message: 'hello world' 
  });
}