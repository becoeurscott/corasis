import { useWindowDimensions } from 'react-native';

/** Window-aware layout facts so screens adapt to phones, landscape and tablets. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  return {
    width,
    height,
    landscape,
    /** Narrow phones (iPhone SE class). */
    compact: width < 360,
    /** Tablets and landscape phones: enough room for two columns. */
    wide: width >= 700,
    /** Height available for hero elements (maps, previews) without pushing content off-screen. */
    heroHeight: Math.round(Math.min(Math.max(height * 0.38, 200), 420)),
  };
}
