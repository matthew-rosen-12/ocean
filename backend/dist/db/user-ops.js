"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserInRedis = exports.removeUserInRedis = exports.addUserInRedis = void 0;
// Simple in-memory user storage
const userStore = new Map();
// User management functions
const addUserInRedis = (userId, userInfo) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        userStore.set(userId, userInfo);
    }
    catch (error) {
        console.error("Error adding user:", error);
        throw error;
    }
});
exports.addUserInRedis = addUserInRedis;
const removeUserInRedis = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        userStore.delete(userId);
    }
    catch (error) {
        console.error("Error removing user:", error);
        throw error;
    }
});
exports.removeUserInRedis = removeUserInRedis;
const getUserInRedis = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return userStore.get(userId) || null;
    }
    catch (error) {
        console.error("Error getting user:", error);
        throw error;
    }
});
exports.getUserInRedis = getUserInRedis;
