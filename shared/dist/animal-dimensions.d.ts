/**
 * Animal dimensions for collision detection
 * These values are calculated from SVG bounds and multiplied by animal scale
 * Generated automatically from animal cache files
 */
export interface AnimalDimensions {
    width: number;
    height: number;
}
/**
 * Get animal dimensions for collision detection
 * Multiplies base dimensions by animal scale
 */
export declare function getAnimalDimensions(animal: string, scale?: number): AnimalDimensions;
/**
 * Get collision threshold for an animal (typically width * 0.5 to match frontend)
 */
export declare function getCollisionThreshold(animal: string, scale?: number): number;
export declare const ORIGINAL_SVG_BOUNDS: {
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
