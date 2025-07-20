import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import {
  TerrainBoundaries,
  TERRAIN_PLANE_CONFIG,
  multiRandom,
} from "../../utils/terrain";
import { RENDER_ORDERS } from "shared/z-depths";
import { canvasCache } from "../../utils/canvas-cache";

/**
 * MosaicPattern – city‑block texture with rivers, bridges & traffic
 * ------------------------------------------------------------------
 * Fixes in **this** patch:
 *   1. Streets that would run *along* a river (same orientation) are now
 *      completely skipped, removing the “asphalt ribbon with cars floating the
 *      river’s length” artefact.
 *   2. `rectOverlapsRiver()` corrected: strict AABB test (no more `x < w+rgt`),
 *      preventing false negatives and positives.
 *   3. Vehicle spawn loops honour the new street‑skipping logic so there is no
 *      hidden traffic draw when the street itself was not painted.
 */

type RiverOrientation = "vertical" | "horizontal";
interface River { orientation: RiverOrientation; coord: number; width: number; }
interface MosaicPatternProps { boundaries: TerrainBoundaries; seed: number; usePngFile?: string; }

/* Geometry */
const BLOCK_W = 280, BLOCK_H = 180, STREET = 30;
const UNIT_X = BLOCK_W + STREET, UNIT_Y = BLOCK_H + STREET;

export default function MosaicPattern({ boundaries, seed, usePngFile }: MosaicPatternProps) {
  const pngTexture = usePngFile ? useLoader(THREE.TextureLoader, usePngFile) : null;
  if (pngTexture) { pngTexture.wrapS = THREE.RepeatWrapping; pngTexture.wrapT = THREE.RepeatWrapping; }

  const mosaicTexture = useMemo(() => {
    // Create cache key with content hash for proper invalidation
    const cacheKey = {
      width: Math.max(1024, boundaries.width * 10),
      height: Math.max(1024, boundaries.height * 10),
      type: 'city',
      hash: `${seed}_${boundaries.width}_${boundaries.height}_${usePngFile || 'none'}`
    };

    // Use canvas cache to get or create texture
    const texture = canvasCache.getOrCreate(cacheKey, (canvas, ctx) => {

    ctx.fillStyle = "#E8F4F8"; ctx.fillRect(0,0,canvas.width,canvas.height);

    const BUILD = ["rgba(100,100,100,.66)","rgba(80,80,90,.72)","rgba(60,80,100,.66)","rgba(90,70,70,.58)","rgba(70,85,110,.64)","rgba(110,90,70,.62)","rgba(85,95,120,.69)","rgba(120,100,80,.6)"];
    const VEH   = ["rgba(200,50,50,.85)","rgba(50,100,200,.8)","rgba(255,200,50,.75)","rgba(100,200,100,.7)"];

    const blocksX = Math.floor(canvas.width / UNIT_X) + 1;
    const blocksY = Math.floor(canvas.height / UNIT_Y) + 1;

    /* ------------------------------------------------------------------- */
    /* 1. Rivers ---------------------------------------------------------- */
    const rivers: River[] = [];
    const taken = { v:new Set<number>(), h:new Set<number>() };
    const addRiver = (ori:RiverOrientation, s:number) => {
      const rn = multiRandom(s);
      const max = ori==='vertical'?blocksX:blocksY;
      const idx = Math.floor(rn.x * max);
      const pool = ori==='vertical'?taken.v:taken.h;
      if (pool.has(idx)) return false;
      pool.add(idx);
      const coord = ori==='vertical'
        ? idx*UNIT_X + BLOCK_W + STREET/2
        : idx*UNIT_Y + BLOCK_H + STREET/2;
      const width = ori==='vertical' ? BLOCK_W + STREET : BLOCK_H + STREET;
      rivers.push({ orientation:ori, coord, width });
      return true;
    };
    const wantV = +(multiRandom(seed+10).extra>.2) + +(multiRandom(seed+11).extra>.8);
    const wantH = +(multiRandom(seed+20).extra>.5) + +(multiRandom(seed+21).extra>.85);
    let tries=0; while(rivers.filter(r=>r.orientation==='vertical').length<wantV && tries<50) addRiver('vertical',seed+30+tries++);
    tries=0; while(rivers.filter(r=>r.orientation==='horizontal').length<wantH && tries<50) addRiver('horizontal',seed+130+tries++);
    if(rivers.length===0) addRiver('vertical', seed+999);

    /* ------------------------------------------------------------------- */
    /* 2. Bridges --------------------------------------------------------- */
    const bridgeKeys = new Set<string>();
    rivers.forEach((r,i)=>{
      const rnd = multiRandom(seed + 2000 + i*97);
      const max = r.orientation==='vertical' ? blocksY : blocksX;
      const n   = 1 + Math.floor(rnd.extra * 3);
      for(let k=0;k<n;k++){
        const pick = Math.floor(((rnd.x + k*0.37) % 1) * max);
        bridgeKeys.add(`${r.orientation==='vertical'?'h':'v'},${pick},${i}`);
      }
    });

    /* ------------------------------------------------------------------- */
    /* 3. Helper predicates ----------------------------------------------- */
    const xInVerticalRiver = (x:number) => rivers.some(r=> r.orientation==='vertical' && x >= r.coord-r.width/2 && x <= r.coord+r.width/2);
    const yInHorizontalRiver = (y:number) => rivers.some(r=> r.orientation==='horizontal' && y >= r.coord-r.width/2 && y <= r.coord+r.width/2);

    const rectOverlapsRiver = (x:number,y:number,w:number,h:number) => rivers.some(r=>{
      if(r.orientation==='vertical') {
        const l = r.coord - r.width/2, rt = r.coord + r.width/2;
        return x < rt && x + w > l;
      }
      const t = r.coord - r.width/2, b = r.coord + r.width/2;
      return y < b && y + h > t;
    });

    const onBridge = (x:number,y:number,w:number,h:number) => rivers.some((r,i)=>{
      if(r.orientation==='vertical') {
        const l=r.coord-r.width/2, rt=r.coord+r.width/2, by=Math.floor((y-BLOCK_H-8)/UNIT_Y+0.5);
        return x+w>l && x<rt && bridgeKeys.has(`h,${by},${i}`);
      }
      const t=r.coord-r.width/2, b=r.coord+r.width/2, bx=Math.floor((x-BLOCK_W-8)/UNIT_X+0.5);
      return y+h>t && y<b && bridgeKeys.has(`v,${bx},${i}`);
    });

    /* ------------------------------------------------------------------- */
    /* 4. Paint order: water → streets → decks → buildings → vehicles ----- */

    /* Water */
    ctx.fillStyle = "rgba(100,150,200,.9)";
    rivers.forEach(r=>{
      if(r.orientation==='vertical') ctx.fillRect(r.coord-r.width/2, 0, r.width, canvas.height);
      else                           ctx.fillRect(0, r.coord-r.width/2, canvas.width, r.width);
    });

    /* Streets & collect decks ------------------------------------------- */
    interface Deck {x:number;y:number;w:number;h:number;horizontal:boolean;}
    const decks:Deck[] = [];
    ctx.fillStyle = "rgba(80,80,80,.88)";

    // Horizontal streets --------------------------------------------------
    const vRiversSorted = rivers.filter(r=>r.orientation==='vertical').sort((a,b)=>a.coord-b.coord);
    for(let by=0; by<blocksY; by++){
      const y = by*UNIT_Y + BLOCK_H;
      if(y >= canvas.height) break;
      // Skip if the entire street lies in a horizontal river corridor
      if(yInHorizontalRiver(y + STREET/2)) continue;

      let cur = 0;
      vRiversSorted.forEach(vr=>{
        const left = vr.coord - vr.width/2;
        const right = vr.coord + vr.width/2;
        if(cur < left) ctx.fillRect(cur, y, left-cur, STREET);
        if(bridgeKeys.has(`h,${by},${rivers.indexOf(vr)}`)) decks.push({x:left,y,w:vr.width,h:STREET,horizontal:true});
        cur = right;
      });
      if(cur < canvas.width) ctx.fillRect(cur, y, canvas.width-cur, STREET);
    }

    // Vertical streets ----------------------------------------------------
    const hRiversSorted = rivers.filter(r=>r.orientation==='horizontal').sort((a,b)=>a.coord-b.coord);
    for(let bx=0; bx<blocksX; bx++){
      const x = bx*UNIT_X + BLOCK_W;
      if(x >= canvas.width) break;
      // Skip whole street if tile sits inside a vertical river corridor
      if(xInVerticalRiver(x + STREET/2)) continue;

      let cur = 0;
      hRiversSorted.forEach(hr=>{
        const top = hr.coord - hr.width/2;
        const bottom = hr.coord + hr.width/2;
        if(cur < top) ctx.fillRect(x, cur, STREET, top-cur);
        if(bridgeKeys.has(`v,${bx},${rivers.indexOf(hr)}`)) decks.push({x, y:top, w:STREET, h:hr.width, horizontal:false});
        cur = bottom;
      });
      if(cur < canvas.height) ctx.fillRect(x, cur, STREET, canvas.height-cur);
    }

    /* Bridge decks ------------------------------------------------------- */
    const DECK = "rgba(112,82,50,.95)", RAIL = "rgba(230,220,190,.9)";
    ctx.fillStyle = DECK;
    decks.forEach(d=>{
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = RAIL;
      if(d.horizontal){ ctx.fillRect(d.x, d.y, d.w, 2); ctx.fillRect(d.x, d.y+d.h-2, d.w, 2); }
      else             { ctx.fillRect(d.x, d.y, 2, d.h); ctx.fillRect(d.x+d.w-2, d.y, 2, d.h); }
      ctx.fillStyle = DECK;
    });

    /* Buildings ---------------------------------------------------------- */
    for(let by=0; by<blocksY; by++) for(let bx=0; bx<blocksX; bx++){
      const blockLeft = bx*UNIT_X, blockTop = by*UNIT_Y;
      if(rectOverlapsRiver(blockLeft, blockTop, BLOCK_W, BLOCK_H)) continue;

      const rng = multiRandom(seed + bx*733 + by*947);
      const n = 2 + Math.floor(rng.extra * 3);
      for(let i=0;i<n;i++){
        const r = multiRandom(seed + bx*811 + by*877 + i*37);
        const w = 50 + r.size*60, h = 80 + r.y*120;
        const x = blockLeft + i*BLOCK_W/n + (BLOCK_W/n - w)/2;
        const y = blockTop + BLOCK_H - h;
        ctx.fillStyle = BUILD[Math.floor(r.color*BUILD.length)];
        ctx.fillRect(x, y, w, h);
        const cols=Math.floor(w/12), rows=Math.floor(h/18);
        for(let c=0;c<cols;c++) for(let r2=0;r2<rows;r2++) if(multiRandom(seed+c*17+r2*19+i*23).extra>.65){
          ctx.fillStyle="rgba(255,255,200,.65)";
          ctx.fillRect(x+3+c*12, y+6+r2*18, 6, 10);
        }
      }
    }

    /* Vehicles ----------------------------------------------------------- */
    const horizVeh = Math.floor(canvas.width / 130);
    for(let by=0; by<blocksY; by++){
      const y = by*UNIT_Y + BLOCK_H + 8;
      if(y >= canvas.height || yInHorizontalRiver(y - 8)) continue; // skip streets removed above
      for(let v=0; v<horizVeh; v++){
        const vr = multiRandom(seed + by*379 + v*53);
        const w = 40 + vr.size*30;
        const x = v*120 + vr.x*40;
        if(x+w>=canvas.width) continue;
        if(rectOverlapsRiver(x,y,w,15) && !onBridge(x,y,w,15)) continue;
        ctx.fillStyle = VEH[Math.floor(vr.color*VEH.length)];
        ctx.fillRect(x, y, w, 15);
        ctx.fillStyle="rgba(50,50,50,.9)";
        ctx.fillRect(x+5, y+12, 5, 5);
        ctx.fillRect(x+w-10, y+12, 5, 5);
      }
    }

    const vertVeh = Math.floor(canvas.height / 130);
    for(let bx=0; bx<blocksX; bx++){
      const x = bx*UNIT_X + BLOCK_W + 8;
      if(x >= canvas.width || xInVerticalRiver(x - 8)) continue; // skip removed streets
      for(let v=0; v<vertVeh; v++){
        const vr = multiRandom(seed + bx*727 + v*61);
        const h = 40 + vr.size*30;
        const y = v*120 + vr.y*40;
        if(y+h>=canvas.height) continue;
        if(rectOverlapsRiver(x,y,15,h) && !onBridge(x,y,15,h)) continue;
        ctx.fillStyle = VEH[Math.floor(vr.color*VEH.length)];
        ctx.fillRect(x, y, 15, h);
        ctx.fillStyle="rgba(50,50,50,.9)";
        ctx.fillRect(x+12, y+5, 5, 5);
        ctx.fillRect(x+12, y+h-10, 5, 5);
      }
    }
    });

    return texture;
  }, [boundaries.width, boundaries.height, seed, usePngFile]);

  /* Debug helper ---------------------------------------------------------- */
  if(typeof window!=="undefined") (window as any).downloadCityPattern = () => {
    const a=document.createElement('a'); a.download=`city-${seed}.png`; a.href=(mosaicTexture.image as HTMLCanvasElement).toDataURL(); a.click(); };

  return (
    <mesh position={TERRAIN_PLANE_CONFIG.position} renderOrder={RENDER_ORDERS.TERRAIN}>
      <planeGeometry args={[boundaries.width, boundaries.height]} />
      <meshBasicMaterial 
        transparent 
        opacity={TERRAIN_PLANE_CONFIG.opacity} 
        depthWrite={false}
        depthTest={true}
        map={pngTexture || undefined}
      >
        {!usePngFile && <primitive attach="map" object={mosaicTexture} />}
      </meshBasicMaterial>
    </mesh>
  );
}
