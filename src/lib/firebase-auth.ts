import type { Auth } from 'firebase/auth';

// Expo Router uses this fallback while rendering routes on the server.
// Firebase Auth is initialized only by firebase-auth.web.ts or
// firebase-auth.native.ts on the actual client platform.
export const auth = null as unknown as Auth;
