// Generates every BookMack icon from one geometric definition of the logo: the app icon, Android
// adaptive icon layers, splash mark, and favicons for the Expo web build and the website.
//
// Run from the repo root: npm run icons (needs rsvg-convert: `brew install librsvg`).
//
// The website's icons are written to dist/web-icons/ rather than into the site itself. They used
// to be written straight across to ../frontend/public when both lived in one repo; that path does
// not exist any more, and a build script that writes outside its own repository is a surprise
// waiting to happen. Copy them over by hand when the mark changes, which is rarely.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Staged for the website repo rather than written into it; see the note at the top.
const WEB_ICONS = join(MOBILE, 'dist/web-icons');
const BRAND = join(MOBILE, 'assets/brand');
const IMAGES = join(MOBILE, 'assets/images');

const COLORS = { background: '#9FE870', top: '#347821', bottom: '#163300' };

// ---------------------------------------------------------------- geometry (512 × 512 canvas)
//
// The mark is a "B" made of two D shapes (a rectangle with a half circle on its right) separated by a
// slanted gap, so it also reads as two stacked books.

const LEFT = 128;
const TOP_EDGE = 96;
const RADIUS = 92;
const TOP_CENTER = { x: 250, y: TOP_EDGE + RADIUS }; // 250, 188
const BOTTOM_CENTER = { x: 290, y: 323 };
const BOTTOM_EDGE = BOTTOM_CENTER.y + RADIUS; // 415

// The cut rises 5 units for every 16 across (about 17.4°).
const SLOPE = 5 / 16;
// Height of the gap at the left edge. The original drawing used 33; widened so the two halves stay
// apart at launcher sizes.
const GAP = 50;
// Where the middle of the gap meets the left edge (unchanged from the original drawing).
const GAP_MIDDLE = 299;
const TOP_CUT = GAP_MIDDLE - GAP / 2;
const BOTTOM_CUT = GAP_MIDDLE + GAP / 2;

const round = (value) => Math.round(value * 100) / 100;

// Where the cut line through (LEFT, y0) meets a D's half circle, on its right side.
function cutMeetsCircle(y0, center) {
  // Line: y = a - SLOPE·x. Circle: (x - cx)² + (y - cy)² = r².
  const a = y0 + SLOPE * LEFT;
  const k = a - center.y;
  const A = 1 + SLOPE * SLOPE;
  const B = -2 * center.x - 2 * SLOPE * k;
  const C = center.x * center.x + k * k - RADIUS * RADIUS;
  const x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  return { x, y: a - SLOPE * x };
}

const angle = (point, center) => (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;

function markPaths() {
  // Top half: across the top, clockwise around the curve to the cut, then back along the cut.
  const topEnd = cutMeetsCircle(TOP_CUT, TOP_CENTER);
  const topSweep = angle(topEnd, TOP_CENTER) - -90;
  const top = [
    `M${LEFT} ${TOP_EDGE}`,
    `H${TOP_CENTER.x}`,
    `A${RADIUS} ${RADIUS} 0 ${topSweep > 180 ? 1 : 0} 1 ${round(topEnd.x)} ${round(topEnd.y)}`,
    `L${LEFT} ${TOP_CUT}`,
    'Z'
  ].join(' ');

  // Bottom half: up along the cut, clockwise around the curve to the bottom, then back to the left.
  const bottomStart = cutMeetsCircle(BOTTOM_CUT, BOTTOM_CENTER);
  const bottomSweep = 90 - angle(bottomStart, BOTTOM_CENTER);
  const bottom = [
    `M${LEFT} ${BOTTOM_CUT}`,
    `L${round(bottomStart.x)} ${round(bottomStart.y)}`,
    `A${RADIUS} ${RADIUS} 0 ${bottomSweep > 180 ? 1 : 0} 1 ${BOTTOM_CENTER.x} ${BOTTOM_EDGE}`,
    `H${LEFT}`,
    'Z'
  ].join(' ');

  return { top, bottom };
}

// ---------------------------------------------------------------- SVG documents

const { top, bottom } = markPaths();
const MARK_CENTER = { x: (LEFT + BOTTOM_CENTER.x + RADIUS) / 2, y: (TOP_EDGE + BOTTOM_EDGE) / 2 };

// The mark, optionally scaled about its center and drawn in a single color.
function mark({ scale = 1, color } = {}) {
  const transform =
    scale === 1
      ? ''
      : ` transform="translate(${round(256 - MARK_CENTER.x * scale)} ${round(256 - MARK_CENTER.y * scale)}) scale(${scale})"`;
  return `<g${transform}><path fill="${color ?? COLORS.top}" d="${top}"/><path fill="${color ?? COLORS.bottom}" d="${bottom}"/></g>`;
}

const svg = (body, viewBox = '0 0 512 512') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;

// Android masks the foreground to a circle or other shape; content must stay inside the middle 66dp
// of the 108dp layer. The mark's square corners are the farthest points, so it's scaled until they
// fit inside that circle, with a little room to spare.
const SAFE_RADIUS = (512 * 66) / 108 / 2;
const MARK_HALF_DIAGONAL = Math.hypot(MARK_CENTER.x - LEFT, MARK_CENTER.y - TOP_EDGE);
const ADAPTIVE_SCALE = round((SAFE_RADIUS * 0.94) / MARK_HALF_DIAGONAL);

const documents = {
  // Full-bleed square: stores and launchers round the corners themselves.
  appIcon: svg(`<rect width="512" height="512" fill="${COLORS.background}"/>${mark()}`),
  // Rounded square for browsers, which show the icon as-is.
  roundedIcon: svg(`<rect width="512" height="512" rx="110" fill="${COLORS.background}"/>${mark()}`),
  adaptiveForeground: svg(mark({ scale: ADAPTIVE_SCALE })),
  // Themed icons use only the shape; the system picks the color.
  adaptiveMonochrome: svg(mark({ scale: ADAPTIVE_SCALE, color: '#000000' })),
  // Just the mark, cropped close, for the splash screen.
  splashMark: svg(mark(), `${LEFT - 20} ${TOP_EDGE - 20} ${BOTTOM_CENTER.x + RADIUS - LEFT + 40} ${BOTTOM_EDGE - TOP_EDGE + 40}`)
};

// ---------------------------------------------------------------- output

mkdirSync(BRAND, { recursive: true });
mkdirSync(WEB_ICONS, { recursive: true });
const sources = {};
for (const [name, content] of Object.entries(documents)) {
  sources[name] = join(BRAND, `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}.svg`);
  writeFileSync(sources[name], content);
}

const renders = [
  [sources.appIcon, join(IMAGES, 'icon.png'), 1024],
  [sources.adaptiveForeground, join(IMAGES, 'android-icon-foreground.png'), 1024],
  [sources.adaptiveMonochrome, join(IMAGES, 'android-icon-monochrome.png'), 1024],
  [sources.splashMark, join(IMAGES, 'splash-icon.png'), 1024],
  [sources.roundedIcon, join(IMAGES, 'favicon.png'), 48],
  [sources.roundedIcon, join(WEB_ICONS, 'favicon-48.png'), 48],
  [sources.appIcon, join(WEB_ICONS, 'apple-touch-icon.png'), 180]
];

for (const [source, output, width] of renders) {
  // The splash mark isn't square; rsvg-convert keeps its proportions from the width.
  execFileSync('rsvg-convert', ['--width', String(width), '--keep-aspect-ratio', source, '--output', output]);
  console.log(`wrote ${output.replace(`${MOBILE}/`, '')} (${width}px wide)`);
}

writeFileSync(join(WEB_ICONS, 'favicon.svg'), documents.roundedIcon);
console.log('wrote dist/web-icons/favicon.svg');
// The website's in-page logo: navbar, footer, sign-in form, and dashboard sidebar.
writeFileSync(join(WEB_ICONS, 'bookmack-icon.svg'), documents.roundedIcon);
console.log('wrote dist/web-icons/bookmack-icon.svg');
console.log('  -> copy dist/web-icons/* into the website repo when the mark changes');
// The app's in-screen logo (src/components/brand-mark.tsx) draws these paths.
writeFileSync(
  join(MOBILE, 'src/constants/brand-mark.ts'),
  `// Generated by scripts/generate-icons.mjs (npm run icons). Don't edit by hand.

export const BRAND_MARK = {
  // The whole 512 × 512 icon canvas, and a box cropped close around the mark.
  canvas: '0 0 512 512',
  cropped: '${LEFT} ${TOP_EDGE} ${BOTTOM_CENTER.x + RADIUS - LEFT} ${BOTTOM_EDGE - TOP_EDGE}',
  cornerRadius: 110,
  top: '${top}',
  bottom: '${bottom}',
  colors: { background: '${COLORS.background}', top: '${COLORS.top}', bottom: '${COLORS.bottom}' }
} as const;
`
);
console.log('wrote src/constants/brand-mark.ts');
console.log(`adaptive icon scale: ${ADAPTIVE_SCALE}`);
