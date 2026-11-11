import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { ADMIN_UID } from '@/lib/admin';
import { auth } from '@/lib/firebase-auth';

type AdminAuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && nextUser.uid !== ADMIN_UID) {
        await signOut(auth);
        setUser(null);
      } else {
        setUser(nextUser);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (credential.user.uid !== ADMIN_UID) {
          await signOut(auth);
          throw new Error('Tài khoản này chưa được cấp quyền quản trị.');
        }
      },
      signOutAdmin: () => signOut(auth),
    }),
    [loading, user],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider.');
  }
  return context;
}
