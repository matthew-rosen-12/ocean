const ANIMALS = [
  "Lion",
  "Elephant",
  "Giraffe",
  "Penguin",
  "Kangaroo",
  "Dolphin",
  "Panda",
  "Tiger",
  "Koala",
  "Zebra",
];

export function getRandomAnimal(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export function generateGuestId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function getPosition(): [number, number] {
  const x = Math.floor(Math.random() * 11) - 5;
  const y = Math.floor(Math.random() * 11) - 5;
  return [x, y];
}
