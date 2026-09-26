import { Text, type TextProps } from 'react-native';

import { Colors, Typography, type ThemeColor } from '@/constants/theme';

const TYPE_STYLES = {
  default: Typography.body,
  title: Typography.display,
  subtitle: Typography.h1,
  h2: Typography.h2,
  h3: Typography.h3,
  small: Typography.small,
  smallBold: Typography.label,
  caption: Typography.caption,
  button: Typography.button,
  link: Typography.label,
  linkPrimary: { ...Typography.label, color: Colors.brand }
};

export type ThemedTextProps = TextProps & {
  type?: keyof typeof TYPE_STYLES;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  return <Text style={[{ color: Colors[themeColor ?? 'text'] }, TYPE_STYLES[type], style]} {...rest} />;
}
