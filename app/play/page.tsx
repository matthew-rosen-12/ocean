"use client";
import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { getPusherInstance } from "../utils/pusher-client";

interface PusherMessage {
  message: string;
  timestamp: string;
}

// Push data
async function pushData(message: string) {
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error("Missing Pusher environment variables");
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const res = await fetch(`${baseUrl}/api/channels-events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    console.error("failed to push data");
  }
}

export default function Game() {
  const [message, setMessage] = useState<string>("loading");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const pusher = getPusherInstance();
    pusher.connection.bind("connected", () => {
      setIsConnected(true);
    });

    const genericChannel = pusher.subscribe("generic-channel");

    genericChannel.bind("my-event", (data: PusherMessage) => {
      setMessage(data.timestamp);
    });

    return () => {
      genericChannel.unbind_all();
      genericChannel.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      pushData("testing");
    }
  }, [isConnected]);

  return <div className={styles.page}>{message}</div>;
}
