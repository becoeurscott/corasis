import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { usePrefs } from '@/store/prefs';
import { Appearance, ColorTokens, palettes, ThemeName } from './tokens';

export interface Theme {
  name: ThemeName;
  appearance: Appearance;
  colors: ColorTokens;
  isDark: boolean;
}

const ThemeContext = createContext<Theme | null>(null);

/** Resolves the user's theme + appearance preference into concrete tokens. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const themeName = usePrefs((s) => s.theme) ?? 'pink';
  const appearancePref = usePrefs((s) => s.appearance);
  const appearance: Appearance =
    appearancePref === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearancePref;

  const value = useMemo<Theme>(
    () => ({ name: themeName, appearance, colors: palettes[themeName][appearance], isDark: appearance === 'dark' }),
    [themeName, appearance],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Preview tokens for a theme that is not yet selected (theme picker). */
export function previewTheme(name: ThemeName, appearance: Appearance): Theme {
  return { name, appearance, colors: palettes[name][appearance], isDark: appearance === 'dark' };
}
