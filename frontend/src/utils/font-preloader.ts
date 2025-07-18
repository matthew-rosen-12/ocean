import { preloadFont } from 'troika-three-text';

// Font URLs used in the application
const ROBOTO_FONT_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxM.woff';

// Global font preload status
let fontsPreloaded = false;

// Preload fonts using troika-three-text preloadFont functionality
export const preloadFonts = async (): Promise<void> => {
  if (fontsPreloaded) return;
  
  
  
  try {
    // Use troika-three-text's preloadFont method
    await new Promise<void>((resolve, reject) => {
      preloadFont(
        {
          font: ROBOTO_FONT_URL,
          characters: '0123456789', // Preload common characters used in NPC count and throw charge indicators
        },
        (payload: any) => {
          if (payload) {
            resolve();
          } else {
            reject(new Error('Font preload failed'));
          }
        }
      );
    });
    
    fontsPreloaded = true;
    
  } catch (error) {
    console.warn('[FONT PRELOADER] Failed to preload fonts:', error);
    // Even if preloading fails, mark as attempted to avoid repeated attempts
    fontsPreloaded = true;
  }
};

// Check if fonts have been preloaded
export const areFontsPreloaded = (): boolean => {
  return fontsPreloaded;
};

export { ROBOTO_FONT_URL };