export default function Dolphin() {
  const dolphinCoords = [
    // Body outline - start from nose
    { x: 8, y: 5, color: "#0077be" }, // Nose tip
    { x: 7.5, y: 4.8, color: "#0077be" },
    { x: 7, y: 4.6, color: "#0077be" },
    { x: 6.5, y: 4.5, color: "#0077be" },
    { x: 6, y: 4.4, color: "#0077be" },
    { x: 5.5, y: 4.3, color: "#0077be" },
    { x: 5, y: 4.3, color: "#0077be" }, // Upper head
    { x: 4.5, y: 4.4, color: "#0077be" },
    { x: 4, y: 4.5, color: "#0077be" },

    // Dorsal fin
    { x: 3.5, y: 3.5, color: "#005c91" }, // Start of dorsal
    { x: 3.2, y: 3.0, color: "#005c91" },
    { x: 3.0, y: 2.5, color: "#005c91" }, // Tip of dorsal
    { x: 3.3, y: 3.2, color: "#005c91" },
    { x: 3.6, y: 3.8, color: "#005c91" }, // Back to body

    // Continue body
    { x: 3, y: 4.6, color: "#0077be" },
    { x: 2.5, y: 4.7, color: "#0077be" },
    { x: 2, y: 4.8, color: "#0077be" },

    // Tail
    { x: 1.5, y: 4.6, color: "#005c91" },
    { x: 1.0, y: 4.2, color: "#005c91" },
    { x: 0.8, y: 3.8, color: "#005c91" }, // Tail tip upper
    { x: 1.2, y: 4.4, color: "#005c91" },
    { x: 1.0, y: 4.8, color: "#005c91" },
    { x: 0.7, y: 5.2, color: "#005c91" }, // Tail tip lower

    // Lower body outline
    { x: 2, y: 5.2, color: "#0077be" },
    { x: 2.5, y: 5.3, color: "#0077be" },
    { x: 3, y: 5.4, color: "#0077be" },
    { x: 3.5, y: 5.5, color: "#0077be" },

    // Flipper
    { x: 4, y: 5.8, color: "#005c91" },
    { x: 4.2, y: 6.2, color: "#005c91" },
    { x: 4.5, y: 6.4, color: "#005c91" }, // Flipper tip
    { x: 4.3, y: 6.0, color: "#005c91" },
    { x: 4.1, y: 5.6, color: "#005c91" },

    // Complete body outline
    { x: 4.5, y: 5.4, color: "#0077be" },
    { x: 5, y: 5.3, color: "#0077be" },
    { x: 5.5, y: 5.2, color: "#0077be" },
    { x: 6, y: 5.1, color: "#0077be" },
    { x: 6.5, y: 5.0, color: "#0077be" },
    { x: 7, y: 4.9, color: "#0077be" },
    { x: 7.5, y: 4.8, color: "#0077be" },
    { x: 8, y: 4.7, color: "#0077be" }, // Back to nose

    // Eye (optional detail)
    { x: 7.2, y: 4.7, color: "#000000" },
  ];

  // Optional fill coordinates for solid appearance
  const dolphinFillCoords = [
    { x: 7, y: 4.7, color: "#0077be" },
    { x: 6, y: 4.8, color: "#0077be" },
    { x: 5, y: 4.9, color: "#0077be" },
    { x: 4, y: 5.0, color: "#0077be" },
    { x: 3, y: 5.1, color: "#0077be" },
    { x: 2, y: 5.0, color: "#0077be" },
    { x: 3, y: 4.9, color: "#0077be" },
    { x: 4, y: 4.8, color: "#0077be" },
    { x: 5, y: 4.7, color: "#0077be" },
    { x: 6, y: 4.6, color: "#0077be" },
  ];
  return [...dolphinCoords, ...dolphinFillCoords];
}
