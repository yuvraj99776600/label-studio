// Load feature flags in development mode OR when in CI/test mode
// LSF_TEST_MODE allows running production builds with feature flags for testing
const shouldLoadFlags = process.env.NODE_ENV !== "production" || process.env.LSF_TEST_MODE === "true";

if (shouldLoadFlags && !window.APP_SETTINGS) {
  const feature_flags = (() => {
    try {
      return require("./flags.json");
    } catch (err) {
      return {};
    }
  })();

  window.APP_SETTINGS = { feature_flags };
}
