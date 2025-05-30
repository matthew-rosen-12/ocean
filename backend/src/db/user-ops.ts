// Simple in-memory user storage
const userStore: Map<string, any> = new Map();

// User management functions
export const addUserInMemory = async (
  userId: string,
  userInfo: any
): Promise<void> => {
  try {
    userStore.set(userId, userInfo);
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
};

export const removeUserInMemory = async (userId: string): Promise<void> => {
  try {
    userStore.delete(userId);
  } catch (error) {
    console.error("Error removing user:", error);
    throw error;
  }
};

export const getUserInMemory = async (userId: string): Promise<any | null> => {
  try {
    return userStore.get(userId) || null;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
};
