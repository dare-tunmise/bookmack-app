import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

// Subtle vector background for welcome and sign-in flows (see docs/ui-design-prompt.md §6): soft
// blobs near the top and faint line art around the edges, kept clear of the content column.

// 24×24 line motifs.
const MOTIFS = {
  book: ['M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  leaf: [
    'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
    'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'
  ],
  sparkle: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z']
};

type Motif = keyof typeof MOTIFS;

// Positions on a 412×915 canvas (a typical phone); the canvas is scaled to cover the screen.
const PLACEMENTS: { motif: Motif; x: number; y: number; scale: number; rotate: number }[] = [
  { motif: 'book', x: 14, y: 150, scale: 1.6, rotate: -12 },
  { motif: 'sparkle', x: 364, y: 200, scale: 1, rotate: 0 },
  { motif: 'leaf', x: 354, y: 330, scale: 1.4, rotate: 20 },
  { motif: 'bookmark', x: 12, y: 430, scale: 1.2, rotate: 8 },
  { motif: 'sparkle', x: 30, y: 610, scale: 0.8, rotate: 0 },
  { motif: 'book', x: 350, y: 560, scale: 1.4, rotate: 10 },
  { motif: 'leaf', x: 18, y: 770, scale: 1.3, rotate: -24 },
  { motif: 'bookmark', x: 362, y: 790, scale: 1.1, rotate: -10 },
  { motif: 'sparkle', x: 330, y: 880, scale: 0.9, rotate: 0 }
];

const LINE_OPACITY = 0.07;
const LINE_WIDTH = 1.5;

export function AuthBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 412 915" preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-60 40C20-40 170-30 200 60C230 150 120 210 30 190C-50 172-130 110-60 40Z"
          fill={Colors.brandTint}
          opacity={0.4}
        />
        <Path
          d="M290-40C370-60 470 20 440 110C415 185 330 175 295 115C262 58 225-25 290-40Z"
          fill={Colors.accent}
          opacity={0.3}
        />
        <Path
          d="M330 140C370 120 420 150 410 190C400 230 350 235 330 205C312 178 300 155 330 140Z"
          fill={Colors.brandTint}
          opacity={0.4}
        />

        {PLACEMENTS.map(({ motif, x, y, scale, rotate }, index) => (
          <G
            key={index}
            transform={`translate(${x} ${y}) rotate(${rotate} 12 12) scale(${scale})`}
            fill="none"
            stroke={Colors.brand}
            strokeOpacity={LINE_OPACITY}
            // Keep the drawn line 1.5px regardless of the motif's scale.
            strokeWidth={LINE_WIDTH / scale}
            strokeLinecap="round"
            strokeLinejoin="round">
            {MOTIFS[motif].map((d) => (
              <Path key={d} d={d} />
            ))}
          </G>
        ))}
      </Svg>
    </View>
  );
}
