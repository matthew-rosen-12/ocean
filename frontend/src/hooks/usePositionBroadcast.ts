import { useRef, useCallback, useMemo, useEffect } from "react";
import { Direction, UserInfo, userId } from "shared/types";
import * as THREE from "three";
import { throttle } from "lodash";
import { typedSocket } from "../socket";

// Min distance before broadcasting position change
const POSITION_THRESHOLD = 0.01;
// Base throttle duration in milliseconds
const BASE_THROTTLE_MS = 100;
// Max throttle duration (prevent getting too slow)
const MAX_THROTTLE_MS = 300;

interface UsePositionBroadcastProps {
  position: THREE.Vector3;
  direction: Direction;
  myUser: UserInfo;
  users: Map<userId, UserInfo>;
}

export function usePositionBroadcast({
  position,
  direction,
  myUser,
  users,
}: UsePositionBroadcastProps) {
  // --- REFACTOR: Use refs for last broadcasted position/direction ---
  const lastBroadcastPosition = useRef(position.clone());
  const lastBroadcastDirection = useRef({ ...direction });

  // Only broadcast if position or direction actually changed
  const broadcastPosition = useCallback(() => {
    const positionDelta = new THREE.Vector3()
      .copy(position)
      .sub(lastBroadcastPosition.current);
    const positionChanged = positionDelta.length() >= POSITION_THRESHOLD;

    const directionChanged =
      Math.abs(lastBroadcastDirection.current.x - direction.x) > 0.01 ||
      Math.abs(lastBroadcastDirection.current.y - direction.y) > 0.01;

    if (positionChanged || directionChanged) {
      // Use delta compression for network efficiency
      const deltaData = {
        userId: myUser.id,
        positionDelta: positionChanged ? {
          dx: Number((position.x - lastBroadcastPosition.current.x).toFixed(2)),
          dy: Number((position.y - lastBroadcastPosition.current.y).toFixed(2))
        } : null,
        direction: directionChanged ? { 
          x: Number(direction.x.toFixed(3)), 
          y: Number(direction.y.toFixed(3)) 
        } : null,
        timestamp: Date.now()
      };

      // Emit delta update if we have significant changes
      const currentTypedSocket = typedSocket();
      if (deltaData.positionDelta || deltaData.direction) {
        // For now, still emit full user data (delta compression would require server changes)
        // But we optimize the data precision to reduce payload size
        currentTypedSocket.emit("update-user", {
          user: {
            ...myUser,
            position: {
              x: Number(position.x.toFixed(2)),
              y: Number(position.y.toFixed(2)),
              z: position.z ?? 0
            },
            direction: { 
              x: Number(direction.x.toFixed(3)), 
              y: Number(direction.y.toFixed(3)) 
            },
          },
        });
      }
      
      lastBroadcastPosition.current.copy(position);
      lastBroadcastDirection.current = { ...direction };
    }
  }, [position, direction, myUser]);

  // Dynamic throttle based on player count to reduce network congestion
  const throttledBroadcast = useMemo(() => {
    const playerCount = users.size;
    // Increase throttle time as more players join (O(n²) network traffic reduction)
    const dynamicThrottleMs = Math.min(BASE_THROTTLE_MS + (playerCount * 15), MAX_THROTTLE_MS);
    
    return throttle(broadcastPosition, dynamicThrottleMs, {
      leading: true,
      trailing: false,
    });
  }, [broadcastPosition, users.size]);

  // Effect to broadcast position/direction changes
  useEffect(() => {
    myUser.position = position.clone();
    myUser.direction = { ...direction };
    users.set(myUser.id, myUser);
    throttledBroadcast();
  }, [position, direction, myUser, throttledBroadcast, users]);

  return {
    throttledBroadcast,
  };
}