"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsersInRoom = exports.updateUserInRoom = exports.removeUserFromRoom = exports.addUserToRoom = void 0;
// Room-based user storage
const roomUsers = new Map();
const addUserToRoom = (roomName, user) => {
    let users = roomUsers.get(roomName);
    if (!users) {
        users = new Map();
        roomUsers.set(roomName, users);
    }
    users.set(user.id, user);
};
exports.addUserToRoom = addUserToRoom;
const removeUserFromRoom = (roomName, userId) => {
    const users = roomUsers.get(roomName);
    if (users) {
        users.delete(userId);
        if (users.size === 0) {
            roomUsers.delete(roomName);
        }
    }
};
exports.removeUserFromRoom = removeUserFromRoom;
const updateUserInRoom = (roomName, user) => {
    const users = roomUsers.get(roomName);
    if (users) {
        users.set(user.id, user);
    }
};
exports.updateUserInRoom = updateUserInRoom;
const getAllUsersInRoom = (roomName) => {
    return roomUsers.get(roomName) || new Map();
};
exports.getAllUsersInRoom = getAllUsersInRoom;
