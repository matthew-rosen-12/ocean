const ANIMALS = ["dolphin", "wolf"];

export function getRandomAnimal(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getPosition(): { x: number; y: number } {
  const x = Math.floor(Math.random() * 60) - 30;
  const y = Math.floor(Math.random() * 100) - 50;
  return { x, y };
}
