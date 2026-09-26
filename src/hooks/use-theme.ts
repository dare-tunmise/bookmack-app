import { Colors } from '@/constants/theme';

// The app has a light theme only. Components read colors through this hook, so a dark theme can
// be added later in one place.
export function useTheme() {
  return Colors;
}
