import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

const palettes = {
  light: {
    mode: 'light' as const,
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    text: '#0F172A',
    muted: '#475569',
    border: '#E2E8F0',
    accent: '#4F46E5',
    accentSoft: '#EEF2FF',
    accentBorder: '#C7D2FE',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    success: '#16A34A',
    successSoft: '#F0FDF4',
    successText: '#166534',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    warningText: '#92400E',
    selected: '#F5F7FF',
    checkboxBorder: '#94A3B8',
    input: '#FFFFFF',
  },
  dark: {
    mode: 'dark' as const,
    background: '#020617',
    surface: '#0F172A',
    surfaceMuted: '#111C31',
    text: '#F1F5F9',
    muted: '#CBD5E1',
    border: '#263247',
    accent: '#4F46E5',
    accentSoft: '#1E2545',
    accentBorder: '#373F70',
    danger: '#F87171',
    dangerSoft: '#351C28',
    success: '#4ADE80',
    successSoft: '#102A24',
    successText: '#86EFAC',
    warning: '#FBBF24',
    warningSoft: '#332817',
    warningText: '#FCD34D',
    selected: '#171F3C',
    checkboxBorder: '#64748B',
    input: '#0F172A',
  },
};

type ThemeValue = (typeof palettes)[keyof typeof palettes] & { toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme();
  const [mode, setMode] = useState<'light' | 'dark'>(systemMode === 'dark' ? 'dark' : 'light');
  const value = useMemo<ThemeValue>(
    () => ({
      ...palettes[mode],
      toggle: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider.');
  }
  return context;
}
