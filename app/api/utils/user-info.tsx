const ANIMALS = [
    'Lion', 'Elephant', 'Giraffe', 'Penguin', 'Kangaroo',
    'Dolphin', 'Panda', 'Tiger', 'Koala', 'Zebra'
  ];
  
export function getRandomAnimal(): string {
return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export function generateGuestId(): string {
return Math.random().toString(36).substring(2, 15);
}