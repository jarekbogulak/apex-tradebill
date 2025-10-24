/**
 * Optional Testing Library matchers for API tests that rely on DOM assertions.
 * The require is wrapped to avoid crashing when the DOM APIs are not available.
 */
try {
  require('@testing-library/jest-dom/extend-expect');
} catch {
  // jest-dom expects a browser-like environment; ignore if unavailable.
}
