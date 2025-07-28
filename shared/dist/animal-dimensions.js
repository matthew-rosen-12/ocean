"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// animal-dimensions.ts
var animal_dimensions_exports = {};
__export(animal_dimensions_exports, {
  ORIGINAL_SVG_BOUNDS: () => ORIGINAL_SVG_BOUNDS,
  checkRotatedBoundingBoxCollision: () => checkRotatedBoundingBoxCollision,
  getAnimalDimensions: () => getAnimalDimensions,
  getCollisionThreshold: () => getCollisionThreshold
});
module.exports = __toCommonJS(animal_dimensions_exports);
var ANIMAL_BASE_DIMENSIONS = {
  BEAR: { width: 4, height: 4 },
  BEE: { width: 4, height: 4 },
  CUTTLEFISH: { width: 4, height: 2 },
  DOLPHIN: { width: 4, height: 3.06 },
  EAGLE: { width: 4, height: 2.24 },
  PENGUIN: { width: 4, height: 7.83 },
  SALAMANDER: { width: 4, height: 2.25 },
  SNAKE: { width: 4, height: 3.47 },
  TIGER: { width: 4, height: 2.67 },
  TUNA: { width: 4, height: 1.74 },
  TURTLE: { width: 4, height: 1.87 },
  WOLF: { width: 4, height: 4.41 }
};
function getAnimalDimensions(animal, scale = 1) {
  const baseDimensions = ANIMAL_BASE_DIMENSIONS[animal] || { width: 4, height: 4 };
  return {
    width: baseDimensions.width * scale,
    height: baseDimensions.height * scale
  };
}
function getCollisionThreshold(animal, scale = 1) {
  const dimensions = getAnimalDimensions(animal, scale);
  return dimensions.width * 0.1;
}
function checkRotatedBoundingBoxCollision(pos1, pos2, width1, height1, rotation1, width2, height2, rotation2) {
  const corners1 = getRotatedBoundingBoxCorners(pos1, width1, height1, rotation1);
  const corners2 = getRotatedBoundingBoxCorners(pos2, width2, height2, rotation2);
  const axes1 = getBoundingBoxAxes(corners1);
  const axes2 = getBoundingBoxAxes(corners2);
  const allAxes = [...axes1, ...axes2];
  for (const axis of allAxes) {
    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y);
    if (axisLength < 1e-4) continue;
    const projection1 = projectBoundingBox(corners1, axis);
    const projection2 = projectBoundingBox(corners2, axis);
    if (projection1.max < projection2.min || projection2.max < projection1.min) {
      return false;
    }
  }
  return true;
}
function getRotatedBoundingBoxCorners(position, width, height, rotation) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight }
  ];
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return corners.map((corner) => ({
    x: position.x + corner.x * cos - corner.y * sin,
    y: position.y + corner.x * sin + corner.y * cos
  }));
}
function getBoundingBoxAxes(corners) {
  const axes = [];
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const edgeLength = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
    if (edgeLength < 1e-4) continue;
    const normal = { x: -edge.y / edgeLength, y: edge.x / edgeLength };
    axes.push(normal);
  }
  return axes;
}
function projectBoundingBox(corners, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const corner of corners) {
    const projection = corner.x * axis.x + corner.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}
var ORIGINAL_SVG_BOUNDS = {
  BEAR: { width: 1024, height: 1024, aspectRatio: 1 },
  BEE: { width: 1024, height: 1024, aspectRatio: 1 },
  CUTTLEFISH: { width: 500, height: 250, aspectRatio: 2 },
  DOLPHIN: { width: 307.5, height: 235.2, aspectRatio: 1.308 },
  EAGLE: { width: 1367, height: 766, aspectRatio: 1.785 },
  PENGUIN: { width: 324.7, height: 635.9, aspectRatio: 0.511 },
  SALAMANDER: { width: 1365, height: 768, aspectRatio: 1.777 },
  SNAKE: { width: 2334.1, height: 2026.5, aspectRatio: 1.152 },
  TIGER: { width: 1254, height: 836, aspectRatio: 1.5 },
  TUNA: { width: 1552, height: 675, aspectRatio: 2.299 },
  TURTLE: { width: 5059.9, height: 2367, aspectRatio: 2.138 },
  WOLF: { width: 287.6, height: 317.1, aspectRatio: 0.907 }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ORIGINAL_SVG_BOUNDS,
  checkRotatedBoundingBoxCollision,
  getAnimalDimensions,
  getCollisionThreshold
});
