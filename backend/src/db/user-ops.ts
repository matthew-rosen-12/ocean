import { redisClient } from "./config";

// User management functions
export const addUserInRedis = async (
  userId: string,
  userInfo: any
): Promise<void> => {
  try {
    // Convert userInfo object to array of field-value pairs
    const entries = Object.entries(userInfo);
    if (entries.length === 0) return;

    // Use hSet with field-value pairs
    const tuples: [string, string][] = entries.map(([field, value]) => [
      field,
      String(value),
    ]);
    await redisClient.hSet(`user:${userId}`, tuples);
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

export const removeUserInRedis = async (userId: string): Promise<void> => {
  try {
    await redisClient.del(`user:${userId}`);
  } catch (error) {
    console.error("Error removing user:", error);
    throw error;
  }
};

export const getUserInRedis = async (userId: string): Promise<any | null> => {
  try {
    const userData = await redisClient.hGetAll(`user:${userId}`);
    return Object.keys(userData).length > 0 ? userData : null;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
};
