// ocean/app/components/Scene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { UserInfo } from "../utils/types/user";
import Animal from "./Animal";

interface Props {
  users: Map<string, UserInfo>;
  myUser: UserInfo;
}

export default function Scene({ users, myUser }: Props) {
  return (
    <Canvas
      camera={{
        position: [0, 0, 10],
        up: [0, 1, 0], // Ensure Y is up
        fov: 50,
        near: 0.1,
        far: 1000,
      }}
      style={{
        border: "1px solid white",
        width: "100%",
        height: "100%",
      }}
    >
      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

      {/* Debug helpers to verify orientation */}
      <gridHelper args={[20, 20]} />
      <axesHelper args={[5]} />

      {Array.from(users.values()).map((user) => (
        <Animal key={user.id} user={user} myUser={myUser} />
      ))}
    </Canvas>
  );
}

/* TODO: 
- set animal rendered position by user position
- send message to update position of one user to all users
- is database broken? (ngrok forwarding is not constant)
- relative scaling (broken, test if interpolation works)
- zooming
- create content
  - education
  - travel around the world
  - LLM for interactions
  - start with few number of organisms
 

sometime:
- enter channel vieweable on someone else's profile to join channel
- time stamped tokens for routes from client to server
*/
