/**
 * Web Worker for SVG processing and texture generation
 * Offloads expensive SVG parsing and canvas operations from main thread
 */

// Import Three.js core modules (if available in worker context)
// Note: We'll need to pass serializable data between worker and main thread

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'PROCESS_SVG':
      processSVG(data);
      break;
    case 'BATCH_PROCESS_SVGS':
      batchProcessSVGs(data);
      break;
    default:
      console.error('Unknown worker message type:', type);
  }
};

/**
 * Process a single SVG and return processed data
 */
function processSVG({ svgContent, animal, scale, color, requestId }) {
  try {
    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    if (!svgElement) {
      throw new Error('Invalid SVG content');
    }
    
    // Extract dimensions
    const viewBox = svgElement.getAttribute('viewBox');
    let width, height;
    
    if (viewBox) {
      const [, , w, h] = viewBox.split(' ').map(Number);
      width = w;
      height = h;
    } else {
      width = parseFloat(svgElement.getAttribute('width')) || 100;
      height = parseFloat(svgElement.getAttribute('height')) || 100;
    }
    
    // Apply color modifications if specified
    if (color) {
      applyColorToSVG(svgElement, color);
    }
    
    // Convert SVG to data URL for texture creation
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    
    // Create canvas for rasterization (optional - can be done on main thread)
    const canvas = new OffscreenCanvas(width * scale, height * scale);
    const ctx = canvas.getContext('2d');
    
    // Create image and draw to canvas
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convert to transferable bitmap
      canvas.convertToBlob().then(blob => {
        blob.arrayBuffer().then(buffer => {
          self.postMessage({
            type: 'SVG_PROCESSED',
            data: {
              requestId,
              animal,
              svgDataUrl,
              width,
              height,
              scale,
              imageBuffer: buffer,
              success: true
            }
          }, [buffer]); // Transfer ownership of buffer
        });
      });
    };
    
    img.onerror = () => {
      throw new Error('Failed to load SVG image');
    };
    
    img.src = svgDataUrl;
    
  } catch (error) {
    self.postMessage({
      type: 'SVG_PROCESSED',
      data: {
        requestId,
        animal,
        error: error.message,
        success: false
      }
    });
  }
}

/**
 * Process multiple SVGs in batch for better efficiency
 */
function batchProcessSVGs({ svgBatch, requestId }) {
  const results = [];
  let completed = 0;
  
  const processNext = (index) => {
    if (index >= svgBatch.length) {
      // All processed, send batch result
      self.postMessage({
        type: 'BATCH_SVG_PROCESSED',
        data: {
          requestId,
          results,
          success: true
        }
      });
      return;
    }
    
    const svgData = svgBatch[index];
    
    // Process individual SVG
    processSVGSync(svgData).then(result => {
      results.push(result);
      processNext(index + 1);
    }).catch(error => {
      results.push({
        animal: svgData.animal,
        error: error.message,
        success: false
      });
      processNext(index + 1);
    });
  };
  
  processNext(0);
}

/**
 * Synchronous SVG processing for batch operations
 */
function processSVGSync({ svgContent, animal, scale, color }) {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      
      if (!svgElement) {
        throw new Error('Invalid SVG content');
      }
      
      // Extract dimensions
      const viewBox = svgElement.getAttribute('viewBox');
      let width, height;
      
      if (viewBox) {
        const [, , w, h] = viewBox.split(' ').map(Number);
        width = w;
        height = h;
      } else {
        width = parseFloat(svgElement.getAttribute('width')) || 100;
        height = parseFloat(svgElement.getAttribute('height')) || 100;
      }
      
      // Apply color modifications
      if (color) {
        applyColorToSVG(svgElement, color);
      }
      
      // Serialize to data URL
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      
      resolve({
        animal,
        svgDataUrl,
        width,
        height,
        scale,
        success: true
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Apply color modifications to SVG elements
 */
function applyColorToSVG(svgElement, color) {
  // Find all path elements and apply color
  const paths = svgElement.querySelectorAll('path, circle, rect, polygon, ellipse');
  
  paths.forEach(element => {
    // Only modify elements that don't already have explicit fill colors
    const currentFill = element.getAttribute('fill');
    if (!currentFill || currentFill === 'currentColor' || currentFill === 'inherit') {
      element.setAttribute('fill', color);
    }
    
    // Also handle stroke if needed
    const currentStroke = element.getAttribute('stroke');
    if (currentStroke === 'currentColor') {
      element.setAttribute('stroke', color);
    }
  });
}

// Handle worker errors
self.onerror = function(error) {
  console.error('SVG Worker Error:', error);
  self.postMessage({
    type: 'WORKER_ERROR',
    data: {
      error: error.message,
      filename: error.filename,
      lineno: error.lineno
    }
  });
};