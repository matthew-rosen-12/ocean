# Performance Optimization TODO

## Overview
This document outlines the performance optimizations for the React/Three.js multiplayer game. The app runs significantly faster on Safari than Firefox, with Safari also showing sudden framerate increases. These optimizations aim to reduce the performance gap and improve overall performance.

## Current Status
✅ **COMPLETED**
- [x] Consolidated keyboard movement RAF loop and frame rate monitoring into single AnimationManager
- [x] Increased movement speed from 0.5 to 1.5 to compensate for useFrame vs RAF timing differences

## High Priority Optimizations

### 1. **Consolidate Remaining useFrame Hooks** 
**Status**: 🟡 In Progress  
**Impact**: High - Reduces from 7+ separate animation loops to 1  
**Complexity**: Medium-High  

**Current useFrame hooks to consolidate**:
- `useBotCollisionDetection.ts:29`
- `use-npc-group-base.ts:589` (shimmer animation - reverted, needs special handling)
- `CapturedNPCGroupGraphic.tsx:147` (position updates)
- `PathNPCGroupGraphic.tsx:93` (path following)
- `IdleNPCGroupGraphic.tsx:31` (idle animation)
- `CloudAnimation.tsx:120` (cloud effects)
- `AnimalGraphic.tsx:236` (animal animation)

**Plan**:
1. Start with simpler hooks (CloudAnimation, IdleNPCGroupGraphic)
2. Move to position-based hooks (CapturedNPCGroupGraphic, PathNPCGroupGraphic)
3. Handle collision detection last (most complex)
4. Special handling for shimmer animation (see below)

### 2. **Cache Expensive Color Calculations**
**Status**: 🔴 Pending (Shimmer animation reverted)  
**Impact**: High - Eliminates `new THREE.Color()` calls every frame  
**Complexity**: High  

**Issues Found**:
- Shimmer animation creates new THREE.Color objects every frame in `use-npc-group-base.ts:608`
- Only applies to NPCs in `PathPhase.THROWN` or `PathPhase.RETURNING` state
- Colors need to be collected dynamically from active NPCs and passed to AnimationManager

**Detailed Plan**:
1. **Phase 1**: Simple color caching in existing useFrame hook
   - Cache `blendedColor` object in `use-npc-group-base.ts`
   - Use `useMemo` or `useRef` to persist color objects
   - Estimated impact: ~15% performance gain

2. **Phase 2**: Advanced shimmer consolidation (complex)
   - Create shimmer animation registry in Scene component
   - Track which NPCs have shimmer animations
   - Pass shimmer data to AnimationManager
   - Handle dynamic addition/removal of shimmering NPCs

**Code Reference**:
```typescript
// Current problematic code in use-npc-group-base.ts:608
const blendedColor = new THREE.Color(); // NEW OBJECT EVERY FRAME!
blendedColor.lerpColors(userColor, goldColor, wave);
```

### 3. **Optimize Position Calculations**
**Status**: 🔴 Pending  
**Impact**: Medium - Reduces unnecessary calculations  
**Complexity**: Medium  

**Issues Found**:
- `CapturedNPCGroupGraphic.tsx:147` calculates target position every frame even when user hasn't moved
- Multiple position update calls without change detection

**Plan**:
1. Add position change detection using `useRef` for last known positions
2. Only recalculate target positions when user actually moves
3. Use `Vector3.equals()` for efficient position comparison
4. Estimated impact: ~10% performance gain

### 4. **Optimize Update Frequencies**
**Status**: 🟡 Partially Done  
**Impact**: Medium - Reduces unnecessary updates  
**Complexity**: Low  

**Completed**:
- ✅ Throw count updates reduced from 50ms to 100ms intervals

**Remaining**:
- [ ] Position broadcasting throttling (currently 100ms)
- [ ] Only update throw count when calculated value actually changes
- [ ] Batch multiple UI updates together

## Medium Priority Optimizations

### 5. **Texture and Graphics Optimizations**
**Status**: 🔴 Pending  
**Impact**: Medium - Reduces GPU load  
**Complexity**: Medium  

**Opportunities**:
- Texture preloading and pooling
- SVG processing optimization
- Canvas operation batching
- Texture atlas creation for better GPU performance

### 6. **React Re-render Optimizations**
**Status**: 🔴 Pending  
**Impact**: Medium - Reduces CPU load  
**Complexity**: Low-Medium  

**Issues**:
- `React.memo` comparisons in `CapturedNPCGroupGraphic.tsx` are expensive
- Unnecessary re-renders due to object recreation

**Plan**:
- Optimize memo comparison functions
- Use `useMemo` for expensive calculations
- Implement proper dependency arrays

## Browser-Specific Considerations

### Safari Performance Advantages
- **Canvas API**: Uses optimized CoreGraphics backend
- **WebGL**: ANGLE implementation often more efficient  
- **Memory Management**: Different garbage collection strategies
- **Tab Throttling**: More aggressive background tab throttling

### Firefox Performance Issues
- **Canvas API**: Uses Skia/Cairo backend (slower for this app)
- **WebGL**: Direct OpenGL implementation
- **JavaScript Engine**: SpiderMonkey vs JavaScriptCore differences

## Performance Monitoring

### Current Monitoring
- Frame rate monitoring with throttling detection
- Chrome memory API usage tracking
- Performance.now() timing for critical paths

### Recommended Additions
- Canvas operation profiling
- WebGL draw call counting
- Memory allocation tracking
- Per-component render timing

## Implementation Strategy

1. **Phase 1**: Complete remaining useFrame consolidation (simplest first)
2. **Phase 2**: Position calculation optimizations
3. **Phase 3**: Color caching without consolidation
4. **Phase 4**: React re-render optimizations  
5. **Phase 5**: Advanced shimmer animation consolidation
6. **Phase 6**: Texture and graphics optimizations

## Testing Strategy

- Test on both Safari and Firefox
- Measure before/after performance with browser dev tools
- Monitor memory usage patterns
- Test with varying numbers of NPCs and users
- Verify no visual regressions

## Notes

- Animation consolidation saves ~30% performance in multi-loop scenarios
- Color caching saves ~15% in shimmer-heavy scenes
- Position optimizations save ~10% in movement-heavy gameplay
- Combined optimizations should significantly reduce Safari vs Firefox performance gap