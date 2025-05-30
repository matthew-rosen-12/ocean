"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosition = getPosition;
exports.getDirection = getDirection;
function getPosition() {
    const x = Math.random() * 20 - 0.5;
    const y = Math.random() * 20 - 1.5;
    return { x, y };
}
function getDirection() {
    return { x: 0, y: 0 };
}
