/**
 * Wait for a Konva transformer or rotator to be in a specific state
 * @param {Object} I - CodeceptJS I object
 * @param {boolean} expectedState - Expected state (true = should exist, false = should not exist)
 * @param {string} checkType - Type to check: "transformer" or "rotator"
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds (default: 2000)
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 100)
 */
const waitForTransformerState = async (I, expectedState, checkType = "transformer", options = {}) => {
  const timeout = options.timeout || 2000;
  const pollInterval = options.pollInterval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const exists = await I.executeScript(
      (checkType) => {
        try {
          const stage = window.Konva?.stages?.[0];
          if (!stage) return false;
          
          const selector = checkType === "transformer" ? "._anchor" : ".rotater";
          const elements = stage.find(selector).filter((shape) => shape.getAttr("visible") !== false);
          return !!elements.length;
        } catch (error) {
          return false;
        }
      },
      checkType
    );

    if (exists === expectedState) {
      return; // Success!
    }

    await I.wait(pollInterval / 1000); // Convert ms to seconds for CodeceptJS
  }

  // If we get here, we timed out
  throw new Error(`Timeout waiting for ${checkType} state to be ${expectedState} (elapsed: ${Date.now() - startTime}ms)`);
};

/**
 * Wait for meta data to be saved in an annotation region
 * @param {Object} I - CodeceptJS I object
 * @param {number} regionIndex - Index of the region to check
 * @param {string} expectedText - Text that should be present in the meta
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in milliseconds (default: 2000)
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 100)
 */
const waitForMetaSaved = async (I, regionIndex, expectedText, options = {}) => {
  const timeout = options.timeout || 2000;
  const pollInterval = options.pollInterval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const saved = await I.executeScript(
      (regionIndex, expectedText) => {
        try {
          const annotations = window.Htx?.annotationStore?.annotations;
          if (!annotations || annotations.length === 0) return false;

          const annotation = annotations[0];
          const regions = annotation?.regions;
          if (!regions || regions.length <= regionIndex) return false;

          const region = regions[regionIndex];
          return region?.meta?.text && region.meta.text.some((t) => t.includes(expectedText));
        } catch (error) {
          return false;
        }
      },
      regionIndex,
      expectedText
    );

    if (saved) {
      return; // Success!
    }

    await I.wait(pollInterval / 1000); // Convert ms to seconds for CodeceptJS
  }

  // If we get here, we timed out
  throw new Error(`Timeout waiting for meta to be saved in region ${regionIndex} (elapsed: ${Date.now() - startTime}ms)`);
};

module.exports = {
  waitForTransformerState,
  waitForMetaSaved,
};
