// Define the NPC type in a shared location
export type NPC = {
  id: string;
  type: string;
  filename: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  direction: {
    x: number;
    y: number;
  };
};
