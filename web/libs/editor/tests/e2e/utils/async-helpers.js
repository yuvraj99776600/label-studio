/**
 * Wait for a Konva transformer or rotator to be in a specific state
 * @param {Object} I - CodeceptJS I object
 * @param {boolean} expectedState - Expected state (true = should exist, false = should not exist)
 * @param {string} checkType - Type to check: "transformer" or "rotator"
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 50)
 */
const waitForTransformerState = (I, expectedState, checkType = "transformer", options = {}) => {
  const timeout = options.timeout || 5000;
  const pollInterval = options.pollInterval || 50;
  const timeoutMessage = `Timeout waiting for ${checkType} state to be ${expectedState}`;

  // Define everything inline so Playwright can serialize it properly
  return I.executeScript(
    (expectedState, checkType, timeout, pollInterval, timeoutMessage) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const poll = () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(timeoutMessage));
            return;
          }

          try {
            const stage = window.Konva?.stages?.[0];
            if (!stage) {
              setTimeout(poll, pollInterval);
              return;
            }

            const selector = checkType === "transformer" ? "._anchor" : ".rotater";
            const elements = stage.find(selector).filter((shape) => shape.getAttr("visible") !== false);
            const exists = !!elements.length;

            if (exists === expectedState) {
              resolve();
            } else {
              setTimeout(poll, pollInterval);
            }
          } catch (error) {
            setTimeout(poll, pollInterval);
          }
        };

        poll();
      });
    },
    expectedState,
    checkType,
    timeout,
    pollInterval,
    timeoutMessage,
  );
};

/**
 * Wait for meta data to be saved in an annotation region
 * @param {Object} I - CodeceptJS I object
 * @param {number} regionIndex - Index of the region to check
 * @param {string} expectedText - Text that should be present in the meta
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 50)
 */
const waitForMetaSaved = (I, regionIndex, expectedText, options = {}) => {
  const timeout = options.timeout || 5000;
  const pollInterval = options.pollInterval || 50;
  const timeoutMessage = `Timeout waiting for meta to be saved in region ${regionIndex}`;

  // Define everything inline so Playwright can serialize it properly
  return I.executeScript(
    (regionIndex, expectedText, timeout, pollInterval, timeoutMessage) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const poll = () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(timeoutMessage));
            return;
          }

          try {
            const annotations = window.Htx?.annotationStore?.annotations;
            if (!annotations || annotations.length === 0) {
              setTimeout(poll, pollInterval);
              return;
            }

            const annotation = annotations[0];
            const regions = annotation?.regions;
            if (!regions || regions.length <= regionIndex) {
              setTimeout(poll, pollInterval);
              return;
            }

            const region = regions[regionIndex];
            if (region?.meta?.text && region.meta.text.some((t) => t.includes(expectedText))) {
              resolve();
            } else {
              setTimeout(poll, pollInterval);
            }
          } catch (error) {
            setTimeout(poll, pollInterval);
          }
        };

        poll();
      });
    },
    regionIndex,
    expectedText,
    timeout,
    pollInterval,
    timeoutMessage,
  );
};

module.exports = {
  waitForTransformerState,
  waitForMetaSaved,
};
