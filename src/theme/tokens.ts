import product from '../../shared/product.json';

/**
 * Semantic design tokens for the four Together themes.
 * Each theme has a light and dark appearance. Status colors are shared and
 * tuned to stay distinguishable on every theme background.
 */
export type ThemeName = 'pink' | 'purple' | 'red' | 'blue';
export type Appearance = 'light' | 'dark';

export interface ColorTokens {
  primary: string;
  primaryStrong: string;
  primarySoft: string;
  onPrimary: string;
  gradientStart: string;
  gradientEnd: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceRaised: string;
  surfaceTint: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  selected: string;
  selectedBorder: string;
  focus: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  shadow: string;
}

interface Palette {
  label: string;
  tagline: string;
  light: ColorTokens;
  dark: ColorTokens;
}


export const palettes = product.palettes as Record<ThemeName, Palette>;

export const themeOrder: ThemeName[] = ['pink', 'purple', 'red', 'blue'];

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.6 },
};
export const touchTarget = 44;
