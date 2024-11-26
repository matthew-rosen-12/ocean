interface Point {
  x: number;
  y: number;
  color: string;
}

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export default function interpolateAnimal(
  animal: Point[],
  scale: number,
  resolution: number = 1
): Point[] {
  // Helper function to get point at index, handling wrap-around
  const getPoint = (points: Point[], i: number): Point => {
    const len = points.length;
    return points[(i + len) % len];
  };

  // Convert hex to RGB for smoother interpolation
  function hexToRgb(hex: string): RGBColor {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // Convert RGB to hex
  function rgbToHex({ r, g, b }: RGBColor): string {
    r = Math.round(Math.max(0, Math.min(255, r)));
    g = Math.round(Math.max(0, Math.min(255, g)));
    b = Math.round(Math.max(0, Math.min(255, b)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // Cubic interpolation for a single value
  function cubicInterpolate(
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    t: number
  ): number {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom coefficients
    const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
    const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
    const c = -0.5 * p0 + 0.5 * p2;
    const d = p1;

    return a * t3 + b * t2 + c * t + d;
  }

  const result: Point[] = [];
  const isClosedShape =
    Math.abs(animal[0].x - animal[animal.length - 1].x) < 0.0001 &&
    Math.abs(animal[0].y - animal[animal.length - 1].y) < 0.0001;

  // For each segment
  for (
    let i = 0;
    i < (isClosedShape ? animal.length : animal.length - 1);
    i++
  ) {
    const p0 = getPoint(animal, i - 1);
    const p1 = getPoint(animal, i);
    const p2 = getPoint(animal, i + 1);
    const p3 = getPoint(animal, i + 2);

    // Convert colors to RGB for interpolation
    const c0 = hexToRgb(p0.color);
    const c1 = hexToRgb(p1.color);
    const c2 = hexToRgb(p2.color);
    const c3 = hexToRgb(p3.color);

    // Calculate base number of steps based on scaled distance
    const dx = (p2.x - p1.x) * scale;
    const dy = (p2.y - p1.y) * scale;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance * resolution);

    // Generate points along the curve
    for (let step = 0; step < steps; step++) {
      const t = step / steps;

      // Interpolate position
      const x = cubicInterpolate(p0.x, p1.x, p2.x, p3.x, t) * scale;
      const y = cubicInterpolate(p0.y, p1.y, p2.y, p3.y, t) * scale;

      // Interpolate color
      const r = cubicInterpolate(c0.r, c1.r, c2.r, c3.r, t);
      const g = cubicInterpolate(c0.g, c1.g, c2.g, c3.g, t);
      const b = cubicInterpolate(c0.b, c1.b, c2.b, c3.b, t);

      result.push({
        x,
        y,
        color: rgbToHex({ r, g, b }),
      });
    }
  }

  // For closed shapes, connect back to start
  if (isClosedShape) {
    const first = result[0];
    result.push({ ...first });
  }

  return result;
}
