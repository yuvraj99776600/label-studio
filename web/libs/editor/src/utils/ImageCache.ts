/**
 * Global image cache that persists across annotation switches
 * This prevents re-downloading the same images when switching between annotations on the same task
 */

type CachedImage = {
  blobUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  timestamp: number;
};

class ImageCacheManager {
  private cache: Map<string, CachedImage> = new Map();
  private pendingLoads: Map<string, Promise<CachedImage>> = new Map();

  // Cache for 30 minutes by default
  private readonly maxAge = 30 * 60 * 1000;
  // Maximum cache size (100 images)
  private readonly maxSize = 100;

  /**
   * Check if an image is already cached
   */
  has(url: string): boolean {
    const cached = this.cache.get(url);
    if (!cached) return false;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(url);
      return false;
    }

    return true;
  }

  /**
   * Get a cached image's blob URL
   */
  get(url: string): CachedImage | undefined {
    const cached = this.cache.get(url);
    if (!cached) return undefined;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(url);
      return undefined;
    }

    return cached;
  }

  /**
   * Check if an image is currently being loaded
   */
  isLoading(url: string): boolean {
    return this.pendingLoads.has(url);
  }

  /**
   * Get the pending load promise for an image
   */
  getPendingLoad(url: string): Promise<CachedImage> | undefined {
    return this.pendingLoads.get(url);
  }

  /**
   * Load an image and cache it
   * If the same image is already being loaded, return the existing promise (deduplication)
   */
  async load(url: string, crossOrigin?: string, onProgress?: (progress: number) => void): Promise<CachedImage> {
    // Check cache first
    const cached = this.get(url);
    if (cached) {
      onProgress?.(1);
      return cached;
    }

    // Check if already loading (deduplication)
    const pending = this.pendingLoads.get(url);
    if (pending) {
      return pending;
    }

    // Start new load
    const loadPromise = this.loadImage(url, crossOrigin, onProgress);
    this.pendingLoads.set(url, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(url);
    }
  }

  private async loadImage(
    url: string,
    crossOrigin?: string,
    onProgress?: (progress: number) => void,
  ): Promise<CachedImage> {
    return new Promise((resolve, reject) => {
      // Use fetch with XHR for progress tracking
      const xhr = new XMLHttpRequest();
      xhr.responseType = "blob";

      xhr.addEventListener("load", async () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const blob = xhr.response;
          const blobUrl = URL.createObjectURL(blob);

          // Get natural dimensions by loading into an Image
          const img = new Image();
          if (crossOrigin) img.crossOrigin = crossOrigin;

          img.onload = () => {
            const cachedImage: CachedImage = {
              blobUrl,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              timestamp: Date.now(),
            };

            // Ensure cache doesn't grow too large
            this.ensureCacheSize();
            this.cache.set(url, cachedImage);

            resolve(cachedImage);
          };

          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Failed to load image dimensions: ${url}`));
          };

          img.src = blobUrl;
        } else {
          reject(new Error(`Failed to download image: ${xhr.status}`));
        }
      });

      xhr.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress?.(e.loaded / e.total);
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error(`Network error loading image: ${url}`));
      });

      xhr.open("GET", url);
      xhr.send();
    });
  }

  private ensureCacheSize(): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entries (first in map)
      const entriesToRemove = this.cache.size - this.maxSize + 1;
      let removed = 0;
      for (const [key, value] of this.cache) {
        if (removed >= entriesToRemove) break;
        URL.revokeObjectURL(value.blobUrl);
        this.cache.delete(key);
        removed++;
      }
    }
  }

  /**
   * Clear the entire cache (useful for cleanup)
   */
  clear(): void {
    for (const value of this.cache.values()) {
      URL.revokeObjectURL(value.blobUrl);
    }
    this.cache.clear();
  }

  /**
   * Remove a specific image from cache
   */
  remove(url: string): void {
    const cached = this.cache.get(url);
    if (cached) {
      URL.revokeObjectURL(cached.blobUrl);
      this.cache.delete(url);
    }
  }
}

// Singleton instance - persists across annotation switches
export const imageCache = new ImageCacheManager();
