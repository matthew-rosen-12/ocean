/**
 * SVG Processing Manager - Main thread only
 * Simplified version without workers for better compatibility and performance
 */

interface SVGProcessResult {
  requestId: string;
  animal: string;
  svgDataUrl: string;
  width: number;
  height: number;
  scale: number;
  imageBuffer?: ArrayBuffer;
  success: boolean;
  error?: string;
}

class SVGWorkerManager {
  private requestIdCounter = 0;

  private getNextRequestId(): string {
    return `svg-request-${++this.requestIdCounter}-${Date.now()}`;
  }

  /**
   * Process a single SVG file on main thread
   */
  public processSVG(
    svgContent: string,
    animal: string,
    scale: number = 1,
    color?: string
  ): Promise<SVGProcessResult> {
    return this.processSVGMainThread(svgContent, animal, scale, color);
  }

  /**
   * Process multiple SVGs in batch on main thread
   */
  public processSVGBatch(
    svgBatch: Array<{
      svgContent: string;
      animal: string;
      scale?: number;
      color?: string;
    }>
  ): Promise<SVGProcessResult[]> {
    return Promise.all(
      svgBatch.map(({ svgContent, animal, scale = 1, color }) =>
        this.processSVGMainThread(svgContent, animal, scale, color)
      )
    );
  }

  /**
   * Main thread SVG processing
   */
  private async processSVGMainThread(
    svgContent: string,
    animal: string,
    scale: number,
    color?: string
  ): Promise<SVGProcessResult> {
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
        width = parseFloat(svgElement.getAttribute('width') || '100');
        height = parseFloat(svgElement.getAttribute('height') || '100');
      }
      
      // Apply color modifications
      if (color) {
        const paths = svgElement.querySelectorAll('path, circle, rect, polygon, ellipse');
        paths.forEach(element => {
          const currentFill = element.getAttribute('fill');
          if (!currentFill || currentFill === 'currentColor' || currentFill === 'inherit') {
            element.setAttribute('fill', color);
          }
        });
      }
      
      // Serialize to data URL
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      
      return {
        requestId: this.getNextRequestId(),
        animal,
        svgDataUrl,
        width,
        height,
        scale,
        success: true
      };
      
    } catch (error) {
      throw new Error(`SVG processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if workers are available (always false since workers are disabled)
   */
  public isWorkersAvailable(): boolean {
    return false;
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    pendingRequests: number;
    pendingBatchRequests: number;
  } {
    return {
      totalWorkers: 0,
      availableWorkers: 0,
      pendingRequests: 0,
      pendingBatchRequests: 0
    };
  }

  /**
   * Cleanup (no-op since no workers to terminate)
   */
  public terminate(): void {
    // Nothing to cleanup
  }
}

// Export singleton instance
export const svgWorkerManager = new SVGWorkerManager();

// Export class for custom instances
export { SVGWorkerManager };