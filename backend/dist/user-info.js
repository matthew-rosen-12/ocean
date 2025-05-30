"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANIMAL_SCALES = exports.DIRECTION_OFFSET = void 0;
exports.getRandomAnimal = getRandomAnimal;
exports.generateGuestId = generateGuestId;
exports.getPosition = getPosition;
exports.getDirection = getDirection;
exports.DIRECTION_OFFSET = 0.001;
const ANIMALS = ["DOLPHIN", "WOLF"];
exports.ANIMAL_SCALES = {
    DOLPHIN: 3.0,
    WOLF: 1.0,
};
function getRandomAnimal() {
    return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}
function generateGuestId() {
    return Math.random().toString(36).substring(2, 15);
}
function getPosition() {
    const x = Math.random() * 2 - 0.5;
    const y = Math.random() * 2 - 1.5;
    return { x, y };
}
function getDirection() {
    return { x: 1 + exports.DIRECTION_OFFSET, y: 0 };
}
