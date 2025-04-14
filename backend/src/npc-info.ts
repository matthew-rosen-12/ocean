export function getPosition(): { x: number; y: number } {
  const x = Math.random() * 20 - 0.5;
  const y = Math.random() * 20 - 1.5;
  return { x, y };
}

export function getDirection(): { x: number; y: number } {
  return { x: 0, y: 0 };
}
