import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

const originalConsoleWarn = console.warn.bind(console);
const originalConsoleError = console.error.bind(console);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function isKnownSvgWarning(message: string) {
  return [
    '<defs /> is using incorrect casing',
    '<linearGradient /> is using incorrect casing',
    'The tag <defs> is unrecognized in this browser',
    'The tag <linearGradient> is unrecognized in this browser',
    'The tag <stop> is unrecognized in this browser',
  ].some((warning) => message.includes(warning));
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  class IntersectionObserverMock {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));

  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');
    const noisyWarnings = [
      'React does not recognize',
      'Received `false` for a non-boolean attribute',
      'The width(0) and height(0) of chart should be greater than 0',
      'The width(-1) and height(-1) of chart should be greater than 0',
    ];

    if (noisyWarnings.some((warning) => message.includes(warning)) || isKnownSvgWarning(message)) return;
    originalConsoleWarn(...args);
  });

  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (isKnownSvgWarning(message)) return;
    originalConsoleError(...args);
  });
});
