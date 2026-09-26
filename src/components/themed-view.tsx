import { View, type ViewProps } from 'react-native';

import { Colors, type ThemeColor } from '@/constants/theme';

export type ThemedViewProps = ViewProps & {
  // Background color token; defaults to the app background.
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  return <View style={[{ backgroundColor: Colors[type ?? 'background'] }, style]} {...otherProps} />;
}
