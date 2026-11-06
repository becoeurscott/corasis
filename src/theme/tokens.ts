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

const status = {
  light: {
    success: '#1E7F5C',
    successSoft: '#DDF3EA',
    warning: '#A35F00',
    warningSoft: '#FFF1D6',
    danger: '#C62828',
    dangerSoft: '#FDE2E2',
    info: '#1F5FA8',
    infoSoft: '#E0ECFB',
  },
  dark: {
    success: '#6FD3A6',
    successSoft: '#163A2C',
    warning: '#F6C25B',
    warningSoft: '#3D2E0E',
    danger: '#FF8A80',
    dangerSoft: '#4A1E1E',
    info: '#8CBBFF',
    infoSoft: '#1A2C47',
  },
};

function light(p: {
  primary: string; primaryStrong: string; primarySoft: string; gradientStart: string; gradientEnd: string;
  background: string; backgroundAlt: string; surfaceTint: string; selected: string;
}): ColorTokens {
  return {
    ...p,
    onPrimary: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    text: '#1B1420',
    textSecondary: '#5B5361',
    textMuted: '#8A8290',
    border: '#EDE6EF',
    borderStrong: '#D8CFDC',
    selectedBorder: p.primary,
    focus: p.primaryStrong,
    overlay: 'rgba(20, 10, 25, 0.45)',
    shadow: 'rgba(40, 20, 50, 0.12)',
    ...status.light,
  };
}

function dark(p: {
  primary: string; primaryStrong: string; primarySoft: string; gradientStart: string; gradientEnd: string;
  background: string; backgroundAlt: string; surface: string; surfaceRaised: string; surfaceTint: string; selected: string;
}): ColorTokens {
  return {
    ...p,
    onPrimary: '#140A14',
    text: '#F6F1F7',
    textSecondary: '#C3B9C7',
    textMuted: '#8E8494',
    border: '#2E2633',
    borderStrong: '#443B4A',
    selectedBorder: p.primary,
    focus: p.primary,
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: 'rgba(0, 0, 0, 0.5)',
    ...status.dark,
  };
}

export const palettes: Record<ThemeName, Palette> = {
  pink: {
    label: 'Pink',
    tagline: 'Soft, sweet and playful',
    light: light({
      primary: '#E0507F', primaryStrong: '#C33A68', primarySoft: '#FBE3EC',
      gradientStart: '#FF8FB1', gradientEnd: '#E0507F',
      background: '#FFF7FA', backgroundAlt: '#FDEFF4', surfaceTint: '#FFF0F5', selected: '#FBE3EC',
    }),
    dark: dark({
      primary: '#FF8FB1', primaryStrong: '#FFB0C8', primarySoft: '#3C1F2B',
      gradientStart: '#E0507F', gradientEnd: '#7A2B4A',
      background: '#17101A', backgroundAlt: '#1F1522', surface: '#231824', surfaceRaised: '#2C1F2E', surfaceTint: '#2E1C27', selected: '#3C1F2B',
    }),
  },
  purple: {
    label: 'Purple',
    tagline: 'Dreamy, calm and cozy',
    light: light({
      primary: '#7C4DD6', primaryStrong: '#5F36B3', primarySoft: '#ECE3FB',
      gradientStart: '#A78BFA', gradientEnd: '#7C4DD6',
      background: '#FAF7FF', backgroundAlt: '#F2ECFC', surfaceTint: '#F5F0FE', selected: '#ECE3FB',
    }),
    dark: dark({
      primary: '#B49AFF', primaryStrong: '#CBB8FF', primarySoft: '#2C2142',
      gradientStart: '#7C4DD6', gradientEnd: '#3E2A74',
      background: '#120F1C', backgroundAlt: '#191425', surface: '#1E1829', surfaceRaised: '#272033', surfaceTint: '#241C34', selected: '#2C2142',
    }),
  },
  red: {
    label: 'Red',
    tagline: 'Warm, bold and passionate',
    light: light({
      primary: '#E53935', primaryStrong: '#B71C1C', primarySoft: '#FDE3E1',
      gradientStart: '#FF7A6E', gradientEnd: '#E53935',
      background: '#FFF8F7', backgroundAlt: '#FDEFED', surfaceTint: '#FFF1EF', selected: '#FDE3E1',
    }),
    dark: dark({
      primary: '#FF7A6E', primaryStrong: '#FF9C92', primarySoft: '#3E1E1C',
      gradientStart: '#E53935', gradientEnd: '#6E1A17',
      background: '#1A0F0F', backgroundAlt: '#221515', surface: '#261818', surfaceRaised: '#302020', surfaceTint: '#2F1B1A', selected: '#3E1E1C',
    }),
  },
  blue: {
    label: 'Blue',
    tagline: 'Fresh, steady and serene',
    light: light({
      primary: '#2F6FED', primaryStrong: '#1F4FB5', primarySoft: '#E1EAFD',
      gradientStart: '#6FA3FF', gradientEnd: '#2F6FED',
      background: '#F6F9FF', backgroundAlt: '#ECF2FE', surfaceTint: '#EFF4FF', selected: '#E1EAFD',
    }),
    dark: dark({
      primary: '#7FA8FF', primaryStrong: '#A3C0FF', primarySoft: '#1C2A48',
      gradientStart: '#2F6FED', gradientEnd: '#16306B',
      background: '#0E1220', backgroundAlt: '#141A2B', surface: '#181F31', surfaceRaised: '#20283C', surfaceTint: '#1B2540', selected: '#1C2A48',
    }),
  },
};

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
