import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';

// Firebase exposes this helper through its React Native package condition.
// The base TypeScript declarations resolve to the web entry point instead.
// @ts-expect-error React Native-only export selected by Metro on device builds.
import { getReactNativePersistence } from 'firebase/auth';

import { app } from './firebase';

let authInstance: Auth;

try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  if ((error as { code?: string }).code !== 'auth/already-initialized') {
    throw error;
  }

  authInstance = getAuth(app);
}

export const auth = authInstance;
