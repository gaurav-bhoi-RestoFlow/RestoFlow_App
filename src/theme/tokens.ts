import { Platform, StyleSheet, type TextStyle } from 'react-native';
import design from '../../design/design_tokens.json';

export const colors = {
  ...design.colors,
  sageStrong: '#d5e3d4',
  forestLight: '#365e4d',
  peach: '#faeee6',
  line: '#e1e5dc',
  food: '#f4f1e7',
  dangerSoft: '#f8eeee',
};
export const premiumColors = {
  background: '#102f2a',
  highlight: '#2b5141',
  gold: '#ead29a',
  goldDark: '#826326',
  border: '#766d4b',
  copy: '#d7e4db',
  surface: '#f5efdf',
  surfaceBorder: '#e8dcc0',
};
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  page: 22,
  xl: 24,
  xxl: 32,
};
export const radius = design.radius;
export const motion = design.motion_ms;
export const fonts = {
  body: Platform.select({
    ios: 'System',
    android: 'SF Pro Display',
    default: 'sans-serif',
  }),
  heading: Platform.select({
    ios: 'System',
    android: 'SF Pro Display',
    default: 'sans-serif',
  }),
  script: 'NotoSansDevanagari-Regular',
};
// Read from the text layers in Figma, rather than the older prototype's weights.
// SF Pro is the iOS system font; Android registers bundled SF Pro Display weights.
export const typography = {
  body: { fontSize: 14, lineHeight: 21 },
  heading: { fontSize: 25, lineHeight: 35 },
  section: { fontSize: 21, lineHeight: 29.4 },
  small: { fontSize: 12, lineHeight: 18 },
  helper: { fontSize: 11, lineHeight: 16.5 },
  label: { fontSize: 12, lineHeight: 18 },
  button: { fontSize: 14, lineHeight: 21 },
  brand: { fontSize: 27, lineHeight: 40.5 },
  welcomeFirst: { fontSize: 29.1, lineHeight: 40.74 },
  display: { fontSize: 32, lineHeight: 44.8 },
  caption: { fontSize: 10, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

export const breakpoints = { phoneSmall: 350, tablet: 600, tabletLarge: 900 };
export const contentWidths = { screen: 600, form: 520 };
export const navigationLayout = { height: 66, inset: 18, bottomGap: 4 };
export const controlSizes = { button: 50, input: 54, touch: 44 };
export const layout = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stack: { gap: 14 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    padding: 18,
  },
  divider: { height: 1, backgroundColor: colors.line },
});
