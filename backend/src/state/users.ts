import { UserInfo, userId, roomId } from "shared/types";

// Room-based user storage
const roomUsers: Map<roomId, Map<userId, UserInfo>> = new Map();

export const addUserToRoom = (roomName: roomId, user: UserInfo): void => {
  let users = roomUsers.get(roomName);
  if (!users) {
    users = new Map();
    roomUsers.set(roomName, users);
  }
  users.set(user.id, user);
};

export const removeUserFromRoom = (roomName: roomId, userId: userId): void => {
  const users = roomUsers.get(roomName);
  if (users) {
    users.delete(userId);
    if (users.size === 0) {
      roomUsers.delete(roomName);
    }
  }
};

export const updateUserInRoom = (roomName: roomId, user: UserInfo): void => {
  const users = roomUsers.get(roomName);
  if (users) {
    users.set(user.id, user);
  }
};

export const getAllUsersInRoom = (roomName: roomId): Map<userId, UserInfo> => {
  return roomUsers.get(roomName) || new Map();
};

export const getUserInRoom = (roomName: roomId, userId: userId): UserInfo | undefined => {
  const users = roomUsers.get(roomName);
  return users?.get(userId);
};
