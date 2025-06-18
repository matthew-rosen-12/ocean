"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInitialPosition = getInitialPosition;
exports.getInitialDirection = getInitialDirection;
function getInitialPosition() {
    const x = Math.random() * 20 - 0.5;
    const y = Math.random() * 20 - 1.5;
    return { x, y };
}
function getInitialDirection() {
    return { x: 0, y: 0 };
}
