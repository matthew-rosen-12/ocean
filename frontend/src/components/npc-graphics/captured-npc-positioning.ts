import * as THREE from "three";
import { UserInfo } from "shared/types";
import { smoothMove } from "../../utils/movement";
import { calculateNPCGroupPosition } from "../../utils/npc-group-utils";

// Configuration constants
export const POSITIONING_CONFIG = {
  MAX_DISTANCE: 15.0,
  DIRECTION_LERP_SPEED: 0.15,
  MAX_HISTORY_FRAMES: 20,
  FRAME_CHECK_INTERVAL: 4,
  POSITION_CHANGE_THRESHOLD: 0.001,
  DIRECTION_CHANGE_THRESHOLD: 0.01,
  CLOSE_TO_TARGET_THRESHOLD: 0.03,
  
  // Interpolation parameters
  LOCAL_PARAMS: { lerpFactor: 0.08, moveSpeed: 0.4, minDistance: 0.01, useConstantSpeed: false },
  REMOTE_PARAMS: { lerpFactor: 0.15, moveSpeed: 0.4, minDistance: 0.01, useConstantSpeed: false },
  
  // Remote user position lerping
  REMOTE_POSITION_PARAMS: { lerpFactor: 0.1, moveSpeed: 0.5, minDistance: 0.01, useConstantSpeed: false }
} as const;

// Helper functions
export const clampPositionToMaxDistance = (
  position: THREE.Vector3,
  userPosition: THREE.Vector3,
  maxDistance: number
): THREE.Vector3 => {
  const userPos2D = new THREE.Vector2(userPosition.x, userPosition.y);
  const pos2D = new THREE.Vector2(position.x, position.y);
  const distance = userPos2D.distanceTo(pos2D);
  
  if (distance <= maxDistance) {
    return position.clone();
  }
  
  const direction = pos2D.clone().sub(userPos2D).normalize();
  const clampedPos2D = userPos2D.clone().add(direction.multiplyScalar(maxDistance));
  return new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, position.z);
};

// Remote user positioning system
export class RemoteUserPositioning {
  private remoteAnimalPosition: THREE.Vector3;
  private lerpedDirection: THREE.Vector2;
  
  constructor(initialUser: UserInfo) {
    this.remoteAnimalPosition = new THREE.Vector3(
      initialUser.position.x, 
      initialUser.position.y, 
      initialUser.position.z || 0
    );
    this.lerpedDirection = new THREE.Vector2(
      initialUser.direction.x, 
      initialUser.direction.y
    );
  }

  updateInterpolatedPosition(user: UserInfo, delta: number): void {
    // Interpolate animal position
    const targetAnimalPosition = new THREE.Vector3(user.position.x, user.position.y, user.position.z || 0);
    this.remoteAnimalPosition.copy(
      smoothMove(this.remoteAnimalPosition.clone(), targetAnimalPosition, POSITIONING_CONFIG.REMOTE_POSITION_PARAMS)
    );

    // Lerp direction
    const targetDirection = new THREE.Vector2(user.direction.x, user.direction.y);
    this.lerpedDirection.lerp(targetDirection, POSITIONING_CONFIG.DIRECTION_LERP_SPEED);
  }

  calculateTargetPosition(user: UserInfo, animalWidth: number, scaleFactor: number): THREE.Vector3 {
    const userForCalculation = {
      ...user,
      position: { 
        x: this.remoteAnimalPosition.x, 
        y: this.remoteAnimalPosition.y, 
        z: this.remoteAnimalPosition.z 
      },
      direction: { x: this.lerpedDirection.x, y: this.lerpedDirection.y }
    };
    return calculateNPCGroupPosition(userForCalculation, animalWidth, scaleFactor);
  }

  calculateNewPosition(
    currentPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    delta: number
  ): THREE.Vector3 {
    if (currentPosition.equals(targetPosition)) {
      return currentPosition.clone();
    }

    const interpolationParams = { ...POSITIONING_CONFIG.REMOTE_PARAMS, delta };
    const interpolatedPosition = smoothMove(
      currentPosition.clone(),
      targetPosition,
      interpolationParams
    );
    
    // Apply distance clamping using interpolated animal position
    const animalPos2D = new THREE.Vector2(this.remoteAnimalPosition.x, this.remoteAnimalPosition.y);
    const interpolatedPos2D = new THREE.Vector2(interpolatedPosition.x, interpolatedPosition.y);
    const distanceFromAnimal = animalPos2D.distanceTo(interpolatedPos2D);

    if (distanceFromAnimal > POSITIONING_CONFIG.MAX_DISTANCE) {
      return clampPositionToMaxDistance(
        interpolatedPosition, 
        this.remoteAnimalPosition, 
        POSITIONING_CONFIG.MAX_DISTANCE
      );
    }
    
    return interpolatedPosition;
  }

  getInterpolatedPosition(): THREE.Vector3 {
    return this.remoteAnimalPosition.clone();
  }

  getInterpolatedDirection(): THREE.Vector2 {
    return this.lerpedDirection.clone();
  }
}

// Local user positioning system
export class LocalUserPositioning {
  private lerpedDirection: THREE.Vector2;
  private lastUserPosition: THREE.Vector2;
  private lastUserDirection: THREE.Vector2;
  private cachedTargetPosition: THREE.Vector3 | null = null;
  private positionHistory: THREE.Vector2[] = [];
  private directionHistory: THREE.Vector2[] = [];
  private isUsingDirectClampedPositioning = false;
  private frameCounter = 0;

  constructor(initialUser: UserInfo) {
    this.lerpedDirection = new THREE.Vector2(initialUser.direction.x, initialUser.direction.y);
    this.lastUserPosition = new THREE.Vector2(initialUser.position.x, initialUser.position.y);
    this.lastUserDirection = new THREE.Vector2(initialUser.direction.x, initialUser.direction.y);
  }

  updateHistory(currentUserPosition: THREE.Vector2, targetDirection: THREE.Vector2): void {
    this.positionHistory.push(currentUserPosition.clone());
    this.directionHistory.push(targetDirection.clone());
    
    // Keep only the last N frames
    if (this.positionHistory.length > POSITIONING_CONFIG.MAX_HISTORY_FRAMES) {
      this.positionHistory.shift();
      this.directionHistory.shift();
    }
  }

  updateLerpedDirection(targetDirection: THREE.Vector2): void {
    this.lerpedDirection.lerp(targetDirection, POSITIONING_CONFIG.DIRECTION_LERP_SPEED);
  }

  calculateTargetPosition(
    user: UserInfo, 
    userPositionRef: React.MutableRefObject<THREE.Vector3>,
    animalWidth: number, 
    scaleFactor: number
  ): THREE.Vector3 {
    const effectiveUserPosition = userPositionRef.current;
    const currentUserPosition = new THREE.Vector2(effectiveUserPosition.x, effectiveUserPosition.y);
    const currentUserDirection = this.lerpedDirection.clone();
    
    const positionChanged = !this.lastUserPosition.equals(currentUserPosition);
    const directionChanged = !this.lastUserDirection.equals(currentUserDirection);
    
    // Only recalculate when user position/direction changes or no target exists
    if (positionChanged || directionChanged || !this.cachedTargetPosition) {
      const userForCalculation = {
        ...user,
        position: { x: effectiveUserPosition.x, y: effectiveUserPosition.y, z: effectiveUserPosition.z },
        direction: { x: currentUserDirection.x, y: currentUserDirection.y }
      };
      this.cachedTargetPosition = calculateNPCGroupPosition(userForCalculation, animalWidth, scaleFactor);
      this.lastUserPosition.copy(currentUserPosition);
      this.lastUserDirection.copy(currentUserDirection);
    }
    
    return this.cachedTargetPosition || new THREE.Vector3(0, 0, -10);
  }

  private shouldUseDirectPositioning(
    currentUserPosition: THREE.Vector2,
    targetDirection: THREE.Vector2
  ): boolean {
    this.frameCounter++;
    
    if (this.frameCounter >= POSITIONING_CONFIG.FRAME_CHECK_INTERVAL && this.isUsingDirectClampedPositioning) {
      const positionStillChanging = this.positionHistory.length >= 2 && 
        currentUserPosition.distanceTo(this.positionHistory[this.positionHistory.length - 2]) > POSITIONING_CONFIG.POSITION_CHANGE_THRESHOLD;

      if (!positionStillChanging) {
        this.isUsingDirectClampedPositioning = false;
      }
      this.frameCounter = 0;
    }

    if (this.isUsingDirectClampedPositioning) {
      const directionNotChanging = this.directionHistory.length >= 2 &&
        targetDirection.distanceTo(this.directionHistory[this.directionHistory.length - 2]) < POSITIONING_CONFIG.DIRECTION_CHANGE_THRESHOLD;
      
      if (!directionNotChanging) {
        this.isUsingDirectClampedPositioning = false;
      }
    }

    return this.isUsingDirectClampedPositioning;
  }

  calculateNewPosition(
    currentPosition: THREE.Vector3,
    targetPosition: THREE.Vector3,
    userPositionRef: React.MutableRefObject<THREE.Vector3>,
    currentUserPosition: THREE.Vector2,
    targetDirection: THREE.Vector2,
    delta: number
  ): THREE.Vector3 {
    const useDirectPositioning = this.shouldUseDirectPositioning(currentUserPosition, targetDirection);

    if (useDirectPositioning) {
      const directionToNPC = targetPosition.clone().sub(userPositionRef.current).normalize();
      const clampedPos2D = userPositionRef.current.clone().add(
        directionToNPC.multiplyScalar(POSITIONING_CONFIG.MAX_DISTANCE)
      );
      return new THREE.Vector3(clampedPos2D.x, clampedPos2D.y, 0);
    }

    const interpolationParams = { ...POSITIONING_CONFIG.LOCAL_PARAMS, delta };
    const interpolatedPosition = smoothMove(
      currentPosition.clone(),
      targetPosition,
      interpolationParams
    );

    const userPos2D = new THREE.Vector2(userPositionRef.current.x, userPositionRef.current.y);
    const interpolatedPos2D = new THREE.Vector2(interpolatedPosition.x, interpolatedPosition.y);
    const distanceFromUser = userPos2D.distanceTo(interpolatedPos2D);

    if (distanceFromUser > POSITIONING_CONFIG.MAX_DISTANCE) {
      const userPos3D = new THREE.Vector3(userPositionRef.current.x, userPositionRef.current.y, userPositionRef.current.z);
      const clampedPosition = clampPositionToMaxDistance(interpolatedPosition, userPos3D, POSITIONING_CONFIG.MAX_DISTANCE);
      const clampedTargetPosition = clampPositionToMaxDistance(currentPosition.clone(), userPos3D, POSITIONING_CONFIG.MAX_DISTANCE);
      
      const distanceToTarget = clampedPosition.distanceTo(clampedTargetPosition);
      const isCloseToTarget = distanceToTarget < POSITIONING_CONFIG.CLOSE_TO_TARGET_THRESHOLD;
      
      if (isCloseToTarget) {
        this.isUsingDirectClampedPositioning = true;
      }
      
      return clampedPosition;
    }

    return interpolatedPosition;
  }

  getLerpedDirection(): THREE.Vector2 {
    return this.lerpedDirection.clone();
  }
}