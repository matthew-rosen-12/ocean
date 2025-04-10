import { createClient } from "redis";

// Global Redis client to reuse connections across requests
let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on("error", (err) => {
      console.error("Redis client error:", err);
    });

    await redisClient.connect();
  }

  return redisClient;
}
