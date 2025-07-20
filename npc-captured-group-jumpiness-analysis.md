# NPC Captured Group Jumpiness Analysis

## Problem Statement
Local captured NPC groups appear jumpy when the local user position updates, even though the captured group movement is lerped. Remote captured NPC groups appear smooth and stable.

## Root Cause Analysis

### Data Flow Differences

**LOCAL USER (isLocalUser = true):**
- Position updates: Every frame (60fps) as user moves
- Broadcasting: Position broadcasted to server every 100ms (throttled)
- Target calculation: Recalculated every frame from live user position/direction
- Interpolation: Uses faster lerp factor (0.2) to follow rapidly changing target

**REMOTE USER (isLocalUser = false):**
- Position updates: Only when receiving socket events (~10Hz)
- Target calculation: Only recalculates when socket data arrives
- Interpolation: Uses slower lerp factor (0.07) but follows stable target

### Core Problem Location
`frontend/src/components/npc-graphics/CapturedNPCGroupGraphic.tsx:93-111`

The `calculateTargetPosition` callback is invalidated frequently for local users because:
1. The `user` object reference changes every frame as position updates
2. Cache invalidation happens too often despite the caching logic
3. Target position gets recalculated for tiny position changes

For remote users, the `user` object only changes when socket updates arrive (~10Hz), making the cache effective.

### Contributing Factors
1. **Interpolation Speed Mismatch**: Local (0.2) vs Remote (0.07) lerp factors
2. **Position Broadcast Throttling**: User position throttled to 100ms for network, but local captured group calculation isn't throttled to match
3. **Collision Detection**: Additional position adjustments for local groups only

## Solution Strategies

### Strategy 1: Throttled Target Calculation (Recommended)
**Goal**: Match local target calculation frequency to broadcast throttling (100ms)

**Implementation**:
- Add throttling mechanism to `calculateTargetPosition` for local users
- Use `useRef` to track last calculation time
- Only recalculate target position every 100ms for local users
- Keep immediate calculation for remote users

**Pros**: 
- Directly addresses the core issue
- Maintains smooth movement without sacrificing responsiveness
- Aligns with existing network throttling

**Cons**: 
- Adds slight delay to captured group following for local users

### Strategy 2: Distance-Based Cache Invalidation
**Goal**: Improve caching logic to avoid recalculation on tiny movements

**Implementation**:
- Replace exact position equality checks with distance thresholds
- Only recalculate when user moves > 0.1 units or rotates > 5 degrees
- Use more stable comparison logic

**Pros**: 
- Natural movement threshold
- Reduces unnecessary calculations
- Simple to implement

**Cons**: 
- May still have some jitter with consistent small movements

### Strategy 3: Adaptive Interpolation
**Goal**: Use similar lerp factors but adaptive based on target stability

**Implementation**:
- Monitor target position change frequency
- Adjust lerp factor dynamically (slower for frequently changing targets)
- Use target velocity to determine appropriate interpolation speed

**Pros**: 
- Self-adjusting system
- Could improve both local and remote smoothness

**Cons**: 
- More complex implementation
- May introduce other edge cases

### Strategy 4: Position Smoothing Buffer
**Goal**: Add intermediate smoothing layer for local user positions

**Implementation**:
- Create smoothed position buffer for local users
- Use exponential moving average or similar smoothing
- Calculate captured group target from smoothed position instead of raw position

**Pros**: 
- Creates more stable target positions
- Doesn't affect network layer

**Cons**: 
- Adds latency to captured group following
- Requires careful tuning to avoid lag feeling

## Recommended Implementation Plan

1. **Start with Strategy 1 (Throttled Target Calculation)**
   - Implement 100ms throttling for local user target calculation
   - Test with various movement patterns
   - Measure perceived smoothness improvement

2. **Combine with Strategy 2 if needed**
   - Add distance-based thresholds for cache invalidation
   - Fine-tune threshold values based on testing

3. **Fallback to Strategy 4 if Strategies 1+2 insufficient**
   - Implement position smoothing buffer
   - Experiment with different smoothing algorithms

## Success Metrics
- Visual smoothness: Local captured groups should appear as smooth as remote ones
- Responsiveness: Captured groups should still follow user movement promptly
- Performance: No significant FPS impact from changes
- Consistency: Behavior should be predictable across different movement speeds

## Implementation Notes
- Test with both fast/jerky movements and slow/smooth movements
- Consider impact on collision detection timing
- Ensure changes don't affect remote captured group behavior
- Monitor for any new edge cases or visual artifacts