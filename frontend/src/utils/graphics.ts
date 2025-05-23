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
const objectsToOutline = new Set<THREE.Object3D>();

export default function useOutlineEffect() {
  const { gl, scene, camera, size } = useThree();

  // Create refs for resources that need to persist
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

  // Initialize effect composer
  useMount(() => {
    // Create effect composer if not already created
    if (!composerRef.current) {
      composerRef.current = new EffectComposer(gl);

      // Standard render pass
      const renderPass = new RenderPass(scene, camera);
      composerRef.current.addPass(renderPass);

      // Outline pass
      outlinePassRef.current = new OutlinePass(
        new THREE.Vector2(size.width, size.height),
        scene,
        camera
      );

      // Configure outline
      outlinePassRef.current.edgeStrength = 3.0;
      outlinePassRef.current.edgeGlow = 0;
      outlinePassRef.current.edgeThickness = 4.0;
      outlinePassRef.current.pulsePeriod = 0;
      outlinePassRef.current.visibleEdgeColor.set("#190a05");
      outlinePassRef.current.hiddenEdgeColor.set("#190a05");

      composerRef.current.addPass(outlinePassRef.current);

      // Output pass
      const outputPass = new OutputPass();
      composerRef.current.addPass(outputPass);

      // FXAA pass for antialiasing
      const effectFXAA = new ShaderPass(FXAAShader);
      effectFXAA.uniforms["resolution"].value.set(
        1 / size.width,
        1 / size.height
      );
      composerRef.current.addPass(effectFXAA);
    }

    // Update size on resize
    composerRef.current.setSize(size.width, size.height);

    return () => {
      // Clean up resources when unmounted
      composerRef.current?.dispose();
      composerRef.current = null;
      outlinePassRef.current = null;
    };
  });

  // Render using composer on each frame
  useFrame(() => {
    if (composerRef.current && outlinePassRef.current) {
      // Update selected objects
      outlinePassRef.current.selectedObjects = Array.from(objectsToOutline);

      // Render the frame with the composer
      composerRef.current.render();
    }
  }, 1); // Higher priority (1) to ensure it runs after all other useFrame callbacks

  // Return functions to add/remove objects from outline
  return {
    addToOutline: (
      object: THREE.Object3D,
      color: THREE.ColorRepresentation
    ) => {
      objectsToOutline.add(object);
      if (outlinePassRef.current) {
        outlinePassRef.current.visibleEdgeColor.set(color);
      }
    },
    removeFromOutline: (object: THREE.Object3D) => {
      objectsToOutline.delete(object);
    },
  };
}
