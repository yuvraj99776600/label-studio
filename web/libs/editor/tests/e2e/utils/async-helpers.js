/**
 * General helper to wait for a condition to be met in the browser context.
 * This is the core utility that all other wait helpers should use.
 *
 * @example
 * // Wait for an element to have a specific class
 * await waitForCondition(
 *   I,
 *   (className) => document.querySelector('.target')?.classList.contains(className),
 *   ['active'],
 *   { timeout: 3000, timeoutMessage: 'Element did not become active' }
 * );
 *
 * @param {Object} I - CodeceptJS I object
 * @param {Function} conditionFn - Function that returns true when condition is met.
 *                                 Will be serialized and executed in browser context.
 *                                 Should be a pure function with no external dependencies.
 * @param {Array} args - Arguments to pass to the condition function
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds (default: 5000)
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 50)
 * @param {string} options.timeoutMessage - Custom timeout error message
 * @returns {Promise<void>}
 */
const waitForCondition = (I, conditionFn, args = [], options = {}) => {
  const { timeout = 5000, pollInterval = 50, timeoutMessage = "Timeout waiting for condition" } = options;

  return I.executeScript(
    (conditionFnStr, args, timeout, pollInterval, timeoutMessage) => {
      return new Promise((resolve, reject) => {
        // Reconstruct the condition function from string
        const conditionFn = eval(`(${conditionFnStr})`);
        const startTime = Date.now();

        const checkCondition = () => {
          if (Date.now() - startTime > timeout) {
            reject(new Error(timeoutMessage));
            return;
          }

          try {
            const result = conditionFn(...args);
            if (result) {
              resolve();
            } else {
              setTimeout(checkCondition, pollInterval);
            }
          } catch (error) {
            // If condition throws, keep polling (might be accessing not-yet-available objects)
            setTimeout(checkCondition, pollInterval);
          }
        };

        checkCondition();
      });
    },
    conditionFn.toString(),
    args,
    timeout,
    pollInterval,
    timeoutMessage,
  );
};

/**
 * Wait for a Konva transformer or rotator to be in a specific state
 * @param {Object} I - CodeceptJS I object
 * @param {boolean} expectedState - Expected state (true = should exist, false = should not exist)
 * @param {string} checkType - Type to check: "transformer" or "rotator"
 * @param {Object} options - Configuration options (passed to waitForCondition)
 */
const waitForTransformerState = (I, expectedState, checkType = "transformer", options = {}) => {
  const conditionFn = (expectedState, checkType) => {
    const stage = window.Konva?.stages?.[0];
    if (!stage) return false;

    const selector = checkType === "transformer" ? "._anchor" : ".rotater";
    const elements = stage.find(selector).filter((shape) => shape.getAttr("visible") !== false);
    const exists = !!elements.length;
    return exists === expectedState;
  };

  return waitForCondition(I, conditionFn, [expectedState, checkType], {
    timeoutMessage: `Timeout waiting for ${checkType} state to be ${expectedState}`,
    ...options,
  });
};

/**
 * Wait for meta data to be saved in an annotation region
 * @param {Object} I - CodeceptJS I object
 * @param {number} regionIndex - Index of the region to check
 * @param {string} expectedText - Text that should be present in the meta
 * @param {Object} options - Configuration options (passed to waitForCondition)
 */
const waitForMetaSaved = (I, regionIndex, expectedText, options = {}) => {
  const conditionFn = (regionIndex, expectedText) => {
    const annotations = window.Htx?.annotationStore?.annotations;
    if (!annotations || annotations.length === 0) return false;

    const annotation = annotations[0];
    const regions = annotation?.regions;
    if (!regions || regions.length <= regionIndex) return false;

    const region = regions[regionIndex];
    return region?.meta?.text && region.meta.text.some((t) => t.includes(expectedText));
  };

  return waitForCondition(I, conditionFn, [regionIndex, expectedText], {
    timeoutMessage: `Timeout waiting for meta to be saved in region ${regionIndex}`,
    ...options,
  });
};

module.exports = {
  waitForCondition,
  waitForTransformerState,
  waitForMetaSaved,
};
