import { types, getParent } from "mobx-state-tree";
import { FileLoader } from "../../../utils/FileLoader";
import { imageCache } from "../../../utils/ImageCache";
import { clamp } from "../../../utils/utilities";
import { FF_IMAGE_MEMORY_USAGE, isFF } from "../../../utils/feature-flags";

const fileLoader = new FileLoader();

export const ImageEntity = types
  .model("ImageEntity", {
    id: types.identifier,
    src: types.string,
    index: types.number,

    rotation: types.optional(types.number, 0),

    /**
     * Natural sizes of Image
     * Constants
     */
    naturalWidth: types.optional(types.integer, 1),
    naturalHeight: types.optional(types.integer, 1),

    stageWidth: types.optional(types.number, 1),
    stageHeight: types.optional(types.number, 1),

    /**
     * Zoom Scale
     */
    zoomScale: types.optional(types.number, 1),

    /**
     * Coordinates of left top corner
     * Default: { x: 0, y: 0 }
     */
    zoomingPositionX: types.optional(types.number, 0),
    zoomingPositionY: types.optional(types.number, 0),

    /**
     * Brightness of Canvas
     */
    brightnessGrade: types.optional(types.number, 100),

    contrastGrade: types.optional(types.number, 100),
  })
  .volatile(() => ({
    stageRatio: 1,
    // Container's sizes causing limits to calculate a scale factor
    containerWidth: 1,
    containerHeight: 1,

    stageZoom: 1,
    stageZoomX: 1,
    stageZoomY: 1,
    currentZoom: 1,

    /** Is image downloaded to local cache */
    downloaded: false,
    /** Is image being downloaded */
    downloading: false,
    /** If error happened during download */
    error: false,
    /** Download progress 0..1 */
    progress: 0,
    /** Local image src created with URL.createURLObject */
    currentSrc: undefined,
    /** Is image loaded using `<img/>` tag and cached by the browser */
    imageLoaded: false,
    /** Track if we've attempted a retry after error */
    _retryAttempted: false,
    /** Track the original URL for error recovery */
    _originalUrl: undefined,
  }))
  .views((self) => ({
    get parent() {
      // Get the ImageEntityMixin
      return getParent(self, 2);
    },
    get imageCrossOrigin() {
      return self.parent?.imageCrossOrigin ?? "anonymous";
    },
  }))
  .actions((self) => ({
    preload() {
      if (self.ensurePreloaded() || !self.src) return;

      // Store original URL for error recovery
      self._originalUrl = self.src;

      // FIT-720: Use global image cache to prevent re-downloading on annotation switch
      const crossOrigin = self.imageCrossOrigin;

      // Check if already cached in global cache
      const cached = imageCache.get(self.src);
      if (cached) {
        // Add reference to prevent cache eviction while we're using this image
        imageCache.addRef(self.src);
        self.setCurrentSrc(cached.blobUrl);
        self.setDownloaded(true);
        self.setProgress(1);
        self.setDownloading(false);
        // DO NOT set imageLoaded here - wait for the actual <img> onLoad event
        // This prevents false positives when blob URLs are invalid/revoked
        return;
      }

      // Check if currently loading (deduplication)
      if (imageCache.isLoading(self.src)) {
        self.setDownloading(true);
        imageCache
          .getPendingLoad(self.src)
          ?.then((result) => {
            imageCache.addRef(self.src);
            self.setCurrentSrc(result.blobUrl);
            self.setDownloaded(true);
            self.setProgress(1);
            self.setDownloading(false);
            // DO NOT set imageLoaded here - wait for <img> onLoad
          })
          .catch(() => {
            self.setError(true);
            self.setDownloading(false);
          });
        return;
      }

      self.setDownloading(true);

      // Use the global cache for loading
      imageCache
        .load(self.src, crossOrigin, (progress) => {
          self.setProgress(progress);
        })
        .then((result) => {
          imageCache.addRef(self.src);
          self.setCurrentSrc(result.blobUrl);
          self.setDownloaded(true);
          self.setProgress(1);
          self.setDownloading(false);
          // DO NOT set imageLoaded here - wait for <img> onLoad
        })
        .catch(() => {
          // Fallback to old behavior if global cache fails
          if (isFF(FF_IMAGE_MEMORY_USAGE)) {
            const img = new Image();
            if (crossOrigin) img.crossOrigin = crossOrigin;
            img.onload = () => {
              self.setCurrentSrc(self.src);
              self.setDownloaded(true);
              self.setProgress(1);
              self.setDownloading(false);
              // imageLoaded will be set by <img> onLoad in the component
            };
            img.onerror = () => {
              self.setError(true);
              self.setDownloading(false);
            };
            img.src = self.src;
          } else {
            fileLoader
              .download(self.src, (_t, _l, progress) => {
                self.setProgress(progress);
              })
              .then((url) => {
                self.setDownloaded(true);
                self.setDownloading(false);
                self.setCurrentSrc(url);
                // imageLoaded will be set by <img> onLoad in the component
              })
              .catch(() => {
                self.setDownloading(false);
                self.setError(true);
              });
          }
        });
    },

    ensurePreloaded() {
      // FIT-720: First check global image cache
      const cached = imageCache.get(self.src);
      if (cached) {
        imageCache.addRef(self.src);
        self.setDownloading(false);
        self.setDownloaded(true);
        self.setProgress(1);
        self.setCurrentSrc(cached.blobUrl);
        // DO NOT set imageLoaded here - wait for <img> onLoad
        return true;
      }

      if (isFF(FF_IMAGE_MEMORY_USAGE)) return self.currentSrc !== undefined;

      if (fileLoader.isError(self.src)) {
        self.setDownloading(false);
        self.setError(true);
        return true;
      }
      if (fileLoader.isPreloaded(self.src)) {
        self.setDownloading(false);
        self.setDownloaded(true);
        self.setProgress(1);
        self.setCurrentSrc(fileLoader.getPreloadedURL(self.src));
        return true;
      }
      return false;
    },

    /**
     * Release the reference to the cached image
     * Should be called when the component unmounts or switches images
     */
    releaseImage() {
      if (self.src) {
        imageCache.releaseRef(self.src);
      }
    },

    setImageLoaded(value) {
      self.imageLoaded = value;
    },

    setProgress(progress) {
      self.progress = clamp(progress, 0, 100);
    },

    setDownloading(downloading) {
      self.downloading = downloading;
    },

    setDownloaded(downloaded) {
      self.downloaded = downloaded;
    },

    setCurrentSrc(src) {
      self.currentSrc = src;
    },

    /**
     * Set error state and attempt recovery if not already retried
     * @param {boolean} value - Whether to set error state
     */
    setError(value = true) {
      if (value && !self._retryAttempted && self._originalUrl) {
        // Attempt recovery: force re-fetch from original URL
        self._retryAttempted = true;
        self.error = false;

        // Remove potentially corrupt cache entry
        imageCache.forceRemove(self.src);

        // Re-attempt load
        self.setDownloading(true);
        self.setDownloaded(false);
        self.setImageLoaded(false);
        self.setCurrentSrc(undefined);

        const crossOrigin = self.imageCrossOrigin;

        imageCache
          .load(self.src, crossOrigin, (progress) => {
            self.setProgress(progress);
          })
          .then((result) => {
            imageCache.addRef(self.src);
            self.setCurrentSrc(result.blobUrl);
            self.setDownloaded(true);
            self.setProgress(1);
            self.setDownloading(false);
          })
          .catch(() => {
            // Final failure - set error state
            self.error = true;
            self.setDownloading(false);
          });
      } else {
        self.error = value;
      }
    },
  }))
  .actions((self) => ({
    setRotation(angle) {
      self.rotation = angle;
    },

    setNaturalWidth(width) {
      self.naturalWidth = width;
    },

    setNaturalHeight(height) {
      self.naturalHeight = height;
    },

    setStageWidth(width) {
      self.stageWidth = width;
    },

    setStageHeight(height) {
      self.stageHeight = height;
    },

    setStageRatio(ratio) {
      self.stageRatio = ratio;
    },

    setContainerWidth(width) {
      self.containerWidth = width;
    },

    setContainerHeight(height) {
      self.containerHeight = height;
    },

    setStageZoom(zoom) {
      self.stageZoom = zoom;
    },

    setStageZoomX(zoom) {
      self.stageZoomX = zoom;
    },

    setStageZoomY(zoom) {
      self.stageZoomY = zoom;
    },

    setCurrentZoom(zoom) {
      self.currentZoom = zoom;
    },

    setZoomScale(zoomScale) {
      self.zoomScale = zoomScale;
    },

    setZoomingPositionX(x) {
      self.zoomingPositionX = x;
    },

    setZoomingPositionY(y) {
      self.zoomingPositionY = y;
    },

    setBrightnessGrade(grade) {
      self.brightnessGrade = grade;
    },

    setContrastGrade(grade) {
      self.contrastGrade = grade;
    },
  }));
