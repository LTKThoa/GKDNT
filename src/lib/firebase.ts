import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDu5luSflTXZw-Il-q4w4eiBn5ydUqjVF0',
  authDomain: 'gkdnt-9758d.firebaseapp.com',
  projectId: 'gkdnt-9758d',
  storageBucket: 'gkdnt-9758d.firebasestorage.app',
  messagingSenderId: '837373205795',
  appId: '1:837373205795:web:46c4fa5be9577020334096',
  measurementId: 'G-4EJ36KY520',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export { app };
export const db = getFirestore(app);
