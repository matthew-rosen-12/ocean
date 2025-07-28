/**
 * Animal dimensions for collision detection
 * These values are calculated from SVG bounds and multiplied by animal scale
 * Generated automatically from animal cache files
 */
interface AnimalDimensions {
    width: number;
    height: number;
}
/**
 * Get animal dimensions for collision detection
 * Multiplies base dimensions by animal scale
 */
declare function getAnimalDimensions(animal: string, scale?: number): AnimalDimensions;
/**
 * Get collision threshold for an animal (typically width * 0.5 to match frontend)
 */
declare function getCollisionThreshold(animal: string, scale?: number): number;
/**
 * Check if two rotated bounding boxes collide using Separating Axis Theorem (SAT)
 * @param pos1 Position of first object
 * @param pos2 Position of second object
 * @param width1 Width of first object
 * @param height1 Height of first object
 * @param rotation1 Rotation of first object in radians
 * @param width2 Width of second object
 * @param height2 Height of second object
 * @param rotation2 Rotation of second object in radians
 * @returns true if the bounding boxes collide
 */
declare function checkRotatedBoundingBoxCollision(pos1: {
    x: number;
    y: number;
}, pos2: {
    x: number;
    y: number;
}, width1: number, height1: number, rotation1: number, width2: number, height2: number, rotation2: number): boolean;
declare const ORIGINAL_SVG_BOUNDS: {
    BEAR: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    BEE: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    CUTTLEFISH: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    DOLPHIN: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    EAGLE: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    PENGUIN: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    SALAMANDER: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    SNAKE: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    TIGER: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    TUNA: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    TURTLE: {
        width: number;
        height: number;
        aspectRatio: number;
    };
    WOLF: {
        width: number;
        height: number;
        aspectRatio: number;
    };
};

export { type AnimalDimensions, ORIGINAL_SVG_BOUNDS, checkRotatedBoundingBoxCollision, getAnimalDimensions, getCollisionThreshold };
