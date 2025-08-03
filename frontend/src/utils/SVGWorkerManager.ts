/**
 * SVG Worker Manager for offloading SVG processing to web workers
 * Provides a pool of workers and intelligent task distribution
 */

interface SVGProcessRequest {
  svgContent: string;
  animal: string;
  scale: number;
  color?: string;
  requestId: string;
}

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

interface BatchSVGRequest {
  svgBatch: Omit<SVGProcessRequest, 'requestId'>[];
  requestId: string;
}

type WorkerCallback = (result: SVGProcessResult) => void;
type BatchCallback = (results: SVGProcessResult[]) => void;

class SVGWorkerManager {
  private workers: Worker[] = [];
  private workerQueue: Worker[] = [];
  private pendingRequests: Map<string, WorkerCallback> = new Map();
  private pendingBatchRequests: Map<string, BatchCallback> = new Map();
  private maxWorkers: number;
  private requestIdCounter = 0;

  constructor(maxWorkers: number = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker('/workers/svg-loader.js');
        
        worker.onmessage = (e) => {
          this.handleWorkerMessage(e, worker);
        };
        
        worker.onerror = (error) => {
          console.error(`SVG Worker ${i} error:`, error);
          this.handleWorkerError(worker);
        };
        
        this.workers.push(worker);
        this.workerQueue.push(worker);
      } catch (error) {
        console.warn('Failed to create SVG worker:', error);
        // Fall back to fewer workers
        break;
      }
    }
    
    if (this.workers.length === 0) {
      console.warn('No SVG workers available - falling back to main thread processing');
    }
  }

  private handleWorkerMessage(e: MessageEvent, worker: Worker): void {
    const { type, data } = e.data;
    
    switch (type) {
      case 'SVG_PROCESSED':
        this.handleSingleSVGResult(data, worker);
        break;
        
      case 'BATCH_SVG_PROCESSED':
        this.handleBatchSVGResult(data, worker);
        break;
        
      case 'WORKER_ERROR':
        console.error('Worker reported error:', data);
        this.returnWorkerToQueue(worker);
        break;
        
      default:
        console.warn('Unknown worker message type:', type);
    }
  }

  private handleSingleSVGResult(data: SVGProcessResult, worker: Worker): void {
    const callback = this.pendingRequests.get(data.requestId);
    if (callback) {
      callback(data);
      this.pendingRequests.delete(data.requestId);
    }
    this.returnWorkerToQueue(worker);
  }

  private handleBatchSVGResult(data: { requestId: string; results: SVGProcessResult[] }, worker: Worker): void {
    const callback = this.pendingBatchRequests.get(data.requestId);
    if (callback) {
      callback(data.results);
      this.pendingBatchRequests.delete(data.requestId);
    }
    this.returnWorkerToQueue(worker);
  }

  private handleWorkerError(worker: Worker): void {
    // Remove failed worker from queue and arrays
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
    }
    
    const queueIndex = this.workerQueue.indexOf(worker);
    if (queueIndex !== -1) {
      this.workerQueue.splice(queueIndex, 1);
    }
    
    // Try to create a replacement worker
    try {
      const newWorker = new Worker('/workers/svg-loader.js');
      newWorker.onmessage = (e) => this.handleWorkerMessage(e, newWorker);
      newWorker.onerror = (error) => {
        console.error('Replacement SVG worker error:', error);
        this.handleWorkerError(newWorker);
      };
      
      this.workers.push(newWorker);
      this.workerQueue.push(newWorker);
    } catch (error) {
      console.warn('Failed to create replacement SVG worker:', error);
    }
  }

  private returnWorkerToQueue(worker: Worker): void {
    if (this.workers.includes(worker) && !this.workerQueue.includes(worker)) {
      this.workerQueue.push(worker);
    }
  }

  private getNextRequestId(): string {
    return `svg-request-${++this.requestIdCounter}-${Date.now()}`;
  }

  /**
   * Process a single SVG file
   */
  public processSVG(
    svgContent: string,
    animal: string,
    scale: number = 1,
    color?: string
  ): Promise<SVGProcessResult> {
    return new Promise((resolve, reject) => {
      // If no workers available, fall back to main thread
      if (this.workers.length === 0) {
        this.processSVGMainThread(svgContent, animal, scale, color)
          .then(resolve)
          .catch(reject);
        return;
      }

      const requestId = this.getNextRequestId();
      const worker = this.workerQueue.shift();
      
      if (!worker) {
        // No workers available right now, queue the request
        setTimeout(() => {
          this.processSVG(svgContent, animal, scale, color)
            .then(resolve)
            .catch(reject);
        }, 10);
        return;
      }

      this.pendingRequests.set(requestId, (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error || 'SVG processing failed'));
        }
      });

      worker.postMessage({
        type: 'PROCESS_SVG',
        data: { svgContent, animal, scale, color, requestId }
      });
    });
  }

  /**
   * Process multiple SVGs in batch for better efficiency
   */
  public processSVGBatch(
    svgBatch: Array<{
      svgContent: string;
      animal: string;
      scale?: number;
      color?: string;
    }>
  ): Promise<SVGProcessResult[]> {
    return new Promise((resolve, reject) => {
      // If no workers available, fall back to main thread
      if (this.workers.length === 0) {
        Promise.all(
          svgBatch.map(({ svgContent, animal, scale = 1, color }) =>
            this.processSVGMainThread(svgContent, animal, scale, color)
          )
        ).then(resolve).catch(reject);
        return;
      }

      const requestId = this.getNextRequestId();
      const worker = this.workerQueue.shift();
      
      if (!worker) {
        // No workers available, queue the request
        setTimeout(() => {
          this.processSVGBatch(svgBatch)
            .then(resolve)
            .catch(reject);
        }, 10);
        return;
      }

      this.pendingBatchRequests.set(requestId, resolve);

      worker.postMessage({
        type: 'BATCH_PROCESS_SVGS',
        data: {
          svgBatch: svgBatch.map(({ svgContent, animal, scale = 1, color }) => ({
            svgContent,
            animal,
            scale,
            color
          })),
          requestId
        }
      });
    });
  }

  /**
   * Fallback to main thread processing when workers aren't available
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
      throw new Error(`Main thread SVG processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if workers are available and healthy
   */
  public isWorkersAvailable(): boolean {
    return this.workers.length > 0;
  }

  /**
   * Get worker pool statistics
   */
  public getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    pendingRequests: number;
    pendingBatchRequests: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.workerQueue.length,
      pendingRequests: this.pendingRequests.size,
      pendingBatchRequests: this.pendingBatchRequests.size
    };
  }

  /**
   * Cleanup all workers
   */
  public terminate(): void {
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers = [];
    this.workerQueue = [];
    this.pendingRequests.clear();
    this.pendingBatchRequests.clear();
  }
}

// Export singleton instance
export const svgWorkerManager = new SVGWorkerManager();

// Export class for custom instances
export { SVGWorkerManager };