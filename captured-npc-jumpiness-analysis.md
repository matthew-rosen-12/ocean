# Captured NPC Group Jumpiness Analysis

## Problem
The `CapturedNPCGroupGraphic` component experiences jumpy positioning when browser resources are limited, despite having interpolation in place.

## Root Causes Identified

### 1. **Frame Timing Inconsistency**
- **Location**: `useAnimationManager.ts:48-51`
- **Issue**: When browser throttles due to low resources, frame gaps can exceed 2 seconds
- **Impact**: Large time gaps cause interpolation to "catch up" with big jumps instead of smooth movement

### 2. **Delta-Independent Interpolation**
- **Location**: `CapturedNPCGroupGraphic.tsx:143-155`
- **Issue**: `smoothMove` function doesn't use the `delta` parameter from animation frame
- **Impact**: Movement speed becomes frame-rate dependent, causing inconsistent motion during resource constraints

### 3. **Multiple Position Update Layers**
- **Location**: `CapturedNPCGroupGraphic.tsx:177-181`
- **Issue**: Position updates happen through:
  1. `updatePositionWithTracking(newPosition)`
  2. `threeGroup.position.copy(newPosition)`
  3. `threeGroup.updateMatrixWorld(true)`
- **Impact**: Potential race conditions or overwrites between tracking and direct updates

### 4. **Cache Invalidation Timing**
- **Location**: `CapturedNPCGroupGraphic.tsx:105-110`
- **Issue**: Target position cache only updates when user position/direction changes
- **Impact**: During resource constraints, stale cached positions may persist while smooth interpolation continues toward outdated targets

### 5. **Distance Clamping After Interpolation**
- **Location**: `CapturedNPCGroupGraphic.tsx:164-175`
- **Issue**: Distance clamping happens after smooth movement calculation
- **Impact**: Creates sudden "snapping" when NPC exceeds max distance, especially noticeable during frame drops

## Performance Context Analysis

### Frame Rate Monitoring
The `useAnimationManager` detects browser throttling when:
- Frame gaps exceed 2000ms
- No frames received for 3000ms

During these periods, the interpolation system struggles because:
1. Large `delta` values aren't properly handled
2. Position corrections become more dramatic
3. User position may have changed significantly between frames

## Proposed Solutions

### 1. **Delta-Based Interpolation** (High Priority)
```typescript
// Modify smoothMove to accept and use delta
const deltaAdjustedLerpFactor = Math.min(lerpFactor * (delta * 60), 1.0);
```

### 2. **Frame Rate Adaptive Movement** (High Priority)
```typescript
// Adjust interpolation parameters based on frame timing
const adaptiveParams = {
  ...interpolationParams,
  lerpFactor: Math.min(interpolationParams.lerpFactor * Math.max(1, delta * 60), 0.5)
};
```

### 3. **Pre-Interpolation Distance Clamping** (Medium Priority)
- Clamp target position before passing to `smoothMove`
- Prevents post-interpolation snapping

### 4. **Simplified Position Update Chain** (Medium Priority)
- Remove redundant position updates
- Use either tracking OR direct updates, not both

### 5. **Smart Cache Invalidation** (Low Priority)
- Invalidate cache based on time elapsed, not just position changes
- Helps during frame drops where user hasn't moved but time has passed

## Implementation Priority

1. **Immediate**: Delta-based interpolation fixes
2. **Short-term**: Distance clamping improvements
3. **Long-term**: Position update system refactoring

## Testing Strategy

- Test on throttled browser tabs
- Test with artificially reduced frame rates
- Monitor during resource-intensive operations
- Verify smooth movement during network lag scenarios