import { Stack } from 'expo-router';

import { AdminAuthProvider } from '@/providers/admin-auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AdminAuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AdminAuthProvider>
    </ThemeProvider>
  );
}
