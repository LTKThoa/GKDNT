import { useSyncExternalStore } from 'react';

/**
 * Use light mode for server rendering, then subscribe to the browser preference after hydration.
 */
export function useColorScheme() {
  return useSyncExternalStore(
    subscribeToColorScheme,
    getColorScheme,
    () => 'light',
  );
}

function subscribeToColorScheme(onChange: () => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getColorScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
