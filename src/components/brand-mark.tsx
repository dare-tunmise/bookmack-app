import Svg, { Path, Rect } from 'react-native-svg';

import { BRAND_MARK } from '@/constants/brand-mark';

type BrandMarkProps = {
  size?: number;
  // Draw the mark on its lime rounded square, like the app icon. Otherwise just the mark.
  tile?: boolean;
};

// The BookMack logo, from the same geometry as the app icon (scripts/generate-icons.mjs).
export function BrandMark({ size = 32, tile = true }: BrandMarkProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={tile ? BRAND_MARK.canvas : BRAND_MARK.cropped}
      preserveAspectRatio="xMidYMid meet"
      accessibilityLabel="BookMack logo">
      {tile ? (
        <Rect width={512} height={512} rx={BRAND_MARK.cornerRadius} fill={BRAND_MARK.colors.background} />
      ) : null}
      <Path d={BRAND_MARK.top} fill={BRAND_MARK.colors.top} />
      <Path d={BRAND_MARK.bottom} fill={BRAND_MARK.colors.bottom} />
    </Svg>
  );
}
