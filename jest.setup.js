// Global mocks

// Skip React Native setup for jsdom environment (used for hook tests)
if (process.env.JEST_ENVIRONMENT !== 'jsdom') {
  // React Native's jest setup runs here for node environment
  // This prevents conflicts with jsdom's window object
}
