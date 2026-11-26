import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library only cleans up on its own when Vitest globals are on; they're off here.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom lacks a few browser APIs that Radix menus and sheets call.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
