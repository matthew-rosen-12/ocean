import superjson from "superjson";

// For Redis storage
export function serialize(data: any): string {
  return superjson.stringify(data);
}

export function deserialize(serialized: string): any {
  if (!serialized) return null;
  return superjson.parse(serialized);
}
