"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomAnimal = getRandomAnimal;
exports.generateGuestId = generateGuestId;
exports.getInitialPosition = getInitialPosition;
exports.getInitialDirection = getInitialDirection;
const DIRECTION_OFFSET = 0.001;
const ANIMALS = ["WOLF", "DOLPHIN", "PENGUIN"];
function getRandomAnimal() {
    return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}
function generateGuestId() {
    return Math.random().toString(36).substring(2, 15);
}
function getInitialPosition() {
    const x = Math.random() * 2 - 0.5;
    const y = Math.random() * 2 - 1.5;
    return { x, y };
}
function getInitialDirection() {
    return { x: 1 + DIRECTION_OFFSET, y: 0 };
}
