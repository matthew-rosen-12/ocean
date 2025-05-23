import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useMount } from "../hooks/useNPCBase";

// Global singleton outline effect composer
let globalComposer: EffectComposer | null = null;
let globalOutlinePass: OutlinePass | null = null;
let composerUsers = 0;
const objectsToOutline = new Set<THREE.Object3D>();

export default function useOutlineEffect() {
  const { gl, scene, camera, size } = useThree();

  // Initialize effect composer (singleton)
  useMount(() => {
    composerUsers++;
    console.log(
      `[OutlineEffect] User ${composerUsers} requesting outline effect`
    );

    // Create effect composer only once (singleton)
    if (!globalComposer) {
      console.log(
        `[OutlineEffect] Creating SINGLETON EffectComposer and passes`
      );
      globalComposer = new EffectComposer(gl);

      // Standard render pass
      const renderPass = new RenderPass(scene, camera);
      globalComposer.addPass(renderPass);

      // Outline pass
      globalOutlinePass = new OutlinePass(
        new THREE.Vector2(size.width, size.height),
        scene,
        camera
      );
      console.log(
        `[OutlineEffect] Created SINGLETON OutlinePass with render targets`
      );

      // Configure outline
      globalOutlinePass.edgeStrength = 3.0;
      globalOutlinePass.edgeGlow = 0;
      globalOutlinePass.edgeThickness = 4.0;
      globalOutlinePass.pulsePeriod = 0;
      globalOutlinePass.visibleEdgeColor.set("#190a05");
      globalOutlinePass.hiddenEdgeColor.set("#190a05");

      globalComposer.addPass(globalOutlinePass);

      // Output pass
      const outputPass = new OutputPass();
      globalComposer.addPass(outputPass);

      // FXAA pass for antialiasing
      const effectFXAA = new ShaderPass(FXAAShader);
      effectFXAA.uniforms["resolution"].value.set(
        1 / size.width,
        1 / size.height
      );
      globalComposer.addPass(effectFXAA);
      console.log(
        `[OutlineEffect] Created SINGLETON FXAA pass with render targets`
      );
    } else {
      console.log(`[OutlineEffect] Reusing existing SINGLETON EffectComposer`);
    }

    // Update size on resize
    globalComposer.setSize(size.width, size.height);

    return () => {
      composerUsers--;
      console.log(
        `[OutlineEffect] User disposed, remaining users: ${composerUsers}`
      );

      // Only dispose when NO users remain
      if (composerUsers <= 0) {
        console.log(
          `[OutlineEffect] Disposing SINGLETON effect composer (no users left)`
        );
        globalComposer?.dispose();
        globalComposer = null;
        globalOutlinePass = null;
        objectsToOutline.clear();
      }
    };
  });

  // Render using composer on each frame
  useFrame(() => {
    if (globalComposer && globalOutlinePass) {
      // Update selected objects
      globalOutlinePass.selectedObjects = Array.from(objectsToOutline);

      // Render the frame with the composer
      globalComposer.render();
    }
  }, 1); // Higher priority (1) to ensure it runs after all other useFrame callbacks

  // Return functions to add/remove objects from outline
  return {
    addToOutline: (
      object: THREE.Object3D,
      color: THREE.ColorRepresentation
    ) => {
      console.log(
        `[OutlineEffect] Adding object to outline:`,
        object.type,
        `UUID: ${object.uuid}`,
        `total objects: ${objectsToOutline.size + 1}`
      );
      objectsToOutline.add(object);
      if (globalOutlinePass) {
        globalOutlinePass.visibleEdgeColor.set(color);
      }
    },
    removeFromOutline: (object: THREE.Object3D) => {
      const wasInSet = objectsToOutline.has(object);
      console.log(
        `[OutlineEffect] Removing object from outline:`,
        object.type,
        `UUID: ${object.uuid}`,
        `was in set: ${wasInSet}`,
        `total objects: ${objectsToOutline.size - (wasInSet ? 1 : 0)}`
      );
      objectsToOutline.delete(object);
    },
  };
}
