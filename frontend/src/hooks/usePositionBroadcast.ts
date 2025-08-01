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
      lastBroadcastDirection.current.x !== direction.x ||
      lastBroadcastDirection.current.y !== direction.y;

    if (positionChanged || directionChanged) {
      // Emit socket event
      const currentTypedSocket = typedSocket();
      currentTypedSocket.emit("update-user", {
        user: {
          ...myUser,
          position: position.clone(),
          direction: { ...direction },
        },
      });
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
      trailing: true,
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