"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomAnimal = getRandomAnimal;
exports.getUniqueAnimalForRoom = getUniqueAnimalForRoom;
exports.generateGuestId = generateGuestId;
exports.getInitialPosition = getInitialPosition;
exports.getInitialDirection = getInitialDirection;
const types_1 = require("shared/types");
function getRandomAnimal() {
    const animals = Object.values(types_1.Animal);
    const randomIndex = Math.floor(Math.random() * animals.length);
    const selectedAnimal = animals[randomIndex];
    return selectedAnimal;
}
function getUniqueAnimalForRoom(usedAnimals) {
    const allAnimals = Object.values(types_1.Animal);
    const availableAnimals = allAnimals.filter(animal => !usedAnimals.includes(animal));
    // If all animals are taken, allow duplicates (fallback)
    if (availableAnimals.length === 0) {
        return getRandomAnimal();
    }
    // Pick randomly from available animals
    const randomIndex = Math.floor(Math.random() * availableAnimals.length);
    return availableAnimals[randomIndex];
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
    return { x: 1 + types_1.BACKEND_DIRECTION_OFFSET, y: 0 };
}
