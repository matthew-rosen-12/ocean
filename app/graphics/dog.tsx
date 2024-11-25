export default function Dog() {
  const dogCoords = [
    // Head outline
    { x: 7, y: 4, color: "#8B4513" }, // Nose
    { x: 6.8, y: 3.8, color: "#8B4513" },
    { x: 6.5, y: 3.7, color: "#8B4513" },
    { x: 6.2, y: 3.6, color: "#8B4513" },

    // Ear 1 (pointed up)
    { x: 6.0, y: 3.2, color: "#8B4513" },
    { x: 5.8, y: 2.8, color: "#8B4513" },
    { x: 5.7, y: 2.5, color: "#8B4513" }, // Ear tip
    { x: 5.6, y: 2.8, color: "#8B4513" },
    { x: 5.5, y: 3.2, color: "#8B4513" },

    // Top of head
    { x: 5.3, y: 3.5, color: "#8B4513" },
    { x: 5.0, y: 3.6, color: "#8B4513" },

    // Ear 2 (pointed up)
    { x: 4.8, y: 3.2, color: "#8B4513" },
    { x: 4.6, y: 2.8, color: "#8B4513" },
    { x: 4.5, y: 2.5, color: "#8B4513" }, // Ear tip
    { x: 4.4, y: 2.8, color: "#8B4513" },
    { x: 4.3, y: 3.2, color: "#8B4513" },

    // Back of head and body
    { x: 4.0, y: 3.6, color: "#8B4513" },
    { x: 3.7, y: 3.7, color: "#8B4513" },
    { x: 3.4, y: 3.8, color: "#8B4513" },

    // Body top line
    { x: 3.0, y: 3.8, color: "#8B4513" },
    { x: 2.6, y: 3.8, color: "#8B4513" },
    { x: 2.2, y: 3.8, color: "#8B4513" },
    { x: 1.8, y: 3.8, color: "#8B4513" },

    // Tail (wagging up)
    { x: 1.5, y: 3.6, color: "#8B4513" },
    { x: 1.3, y: 3.3, color: "#8B4513" },
    { x: 1.2, y: 3.0, color: "#8B4513" },
    { x: 1.0, y: 2.8, color: "#8B4513" }, // Tail tip
    { x: 1.1, y: 3.1, color: "#8B4513" },
    { x: 1.3, y: 3.4, color: "#8B4513" },

    // Back legs
    { x: 1.8, y: 4.0, color: "#8B4513" },
    { x: 1.8, y: 4.3, color: "#8B4513" },
    { x: 1.8, y: 4.6, color: "#8B4513" }, // Back paw
    { x: 2.2, y: 4.6, color: "#8B4513" }, // Back paw
    { x: 2.2, y: 4.3, color: "#8B4513" },
    { x: 2.2, y: 4.0, color: "#8B4513" },

    // Belly line
    { x: 2.6, y: 4.0, color: "#8B4513" },
    { x: 3.0, y: 4.0, color: "#8B4513" },
    { x: 3.4, y: 4.0, color: "#8B4513" },
    { x: 3.8, y: 4.0, color: "#8B4513" },

    // Front legs
    { x: 4.2, y: 4.0, color: "#8B4513" },
    { x: 4.2, y: 4.3, color: "#8B4513" },
    { x: 4.2, y: 4.6, color: "#8B4513" }, // Front paw
    { x: 4.6, y: 4.6, color: "#8B4513" }, // Front paw
    { x: 4.6, y: 4.3, color: "#8B4513" },
    { x: 4.6, y: 4.0, color: "#8B4513" },

    // Chest and neck
    { x: 5.0, y: 3.9, color: "#8B4513" },
    { x: 5.4, y: 3.8, color: "#8B4513" },
    { x: 5.8, y: 3.7, color: "#8B4513" },
    { x: 6.2, y: 3.7, color: "#8B4513" },
    { x: 6.6, y: 3.8, color: "#8B4513" },
    { x: 7.0, y: 3.9, color: "#8B4513" }, // Back to nose area

    // Eyes (optional detail)
    { x: 6.3, y: 3.4, color: "#000000" }, // Right eye
    { x: 5.8, y: 3.4, color: "#000000" }, // Left eye

    // Fill coordinates for more solid appearance
    { x: 5.0, y: 3.7, color: "#8B4513" },
    { x: 4.5, y: 3.7, color: "#8B4513" },
    { x: 4.0, y: 3.8, color: "#8B4513" },
    { x: 3.5, y: 3.9, color: "#8B4513" },
    { x: 3.0, y: 3.9, color: "#8B4513" },
    { x: 2.5, y: 3.9, color: "#8B4513" },
    { x: 2.0, y: 3.9, color: "#8B4513" },
    { x: 3.0, y: 3.7, color: "#8B4513" },
    { x: 4.0, y: 3.5, color: "#8B4513" },
    { x: 5.0, y: 3.5, color: "#8B4513" },
  ];

  // Optional shading coordinates for depth
  const dogShadingCoords = [
    // Darker shading for depth
    { x: 1.9, y: 4.5, color: "#663300" }, // Back leg shadow
    { x: 4.3, y: 4.5, color: "#663300" }, // Front leg shadow
    { x: 5.7, y: 2.6, color: "#663300" }, // Ear shadow
    { x: 4.5, y: 2.6, color: "#663300" }, // Ear shadow
    { x: 1.1, y: 2.9, color: "#663300" }, // Tail shadow
  ];

  return [...dogCoords, ...dogShadingCoords];
}
