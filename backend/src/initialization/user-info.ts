import { Animal, Direction, Position, BACKEND_DIRECTION_OFFSET } from "shared/types";

export function getRandomAnimal(): Animal {
  const animals = Object.values(Animal);
  const randomIndex = Math.floor(Math.random() * animals.length);
  const selectedAnimal = animals[randomIndex];
  
  return selectedAnimal;
}

export function getUniqueAnimalForRoom(usedAnimals: Animal[]): Animal {
  const allAnimals = Object.values(Animal);
  const availableAnimals = allAnimals.filter(animal => !usedAnimals.includes(animal));
  
  // If all animals are taken, allow duplicates (fallback)
  if (availableAnimals.length === 0) {
    return getRandomAnimal();
  }
  
  // Pick randomly from available animals
  const randomIndex = Math.floor(Math.random() * availableAnimals.length);
  return availableAnimals[randomIndex];
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getInitialPosition(): Position {
  const x = Math.random() * 2 - 0.5;
  const y = Math.random() * 2 - 1.5;
  return {x, y};
}

export function getInitialDirection(): Direction {
  return { x: 1 + BACKEND_DIRECTION_OFFSET, y: 0 };
}
