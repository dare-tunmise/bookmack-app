import type { ReactElement } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';

// Line icons on a 24×24 grid, round caps and joins.
//
// Most of these are the conventional shapes for system actions (close, search, check, chevron):
// people need to recognize those instantly, so they are deliberately unremarkable. The icons for
// the things only BookMack has — the shelf, lending, requests, scanning — are drawn from the brand
// mark's geometry instead: half-round terminals, the same ~17° lean as the cut through the logo,
// and the corner radii from the design system.
const ICONS = {
  menu: (
    <>
      <Line x1="3" y1="6" x2="21" y2="6" />
      <Line x1="3" y1="12" x2="21" y2="12" />
      <Line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  arrowLeft: (
    <>
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 19 5 12 12 5" />
    </>
  ),
  shuffle: (
    <>
      <Polyline points="16 3 21 3 21 8" />
      <Line x1="4" y1="20" x2="21" y2="3" />
      <Polyline points="21 16 21 21 16 21" />
      <Line x1="15" y1="15" x2="21" y2="21" />
      <Line x1="4" y1="4" x2="9" y2="9" />
    </>
  ),
  close: (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  // Three spines standing on a ledge, the last leaning at the same angle as the cut in the logo.
  library: (
    <>
      <Rect x="4" y="7.5" width="4.25" height="12.5" rx="1.25" />
      <Rect x="9.25" y="5" width="4.25" height="15" rx="1.25" />
      <Rect x="14.75" y="7" width="4.25" height="13" rx="1.25" transform="rotate(17 16.875 20)" />
      <Line x1="2.5" y1="21.25" x2="21.5" y2="21.25" />
    </>
  ),
  // A basket: books you mean to get, rather than books you have.
  //
  // It replaced a dashed version of `library` — a shelf with one slot outlined empty. That was a
  // clever drawing and a poor icon: at 13px, where the drawer and the wanted screen use it, the
  // dash blurred into a solid edge and it read as an ordinary shelf. A basket is a different
  // object at any size, which is the whole job.
  //
  // It also reads as a silhouette, so unlike the dashed shelf it can have a SOLID twin.
  wanted: (
    <>
      <Path d="M8.5 8.5V6.75a3.5 3.5 0 0 1 7 0V8.5" />
      <Path d="M3.25 8.5h17.5l-1.6 10.1a2.5 2.5 0 0 1-2.47 2.15H7.32a2.5 2.5 0 0 1-2.47-2.15z" />
      <Line x1="9.75" y1="12.5" x2="10.25" y2="17" />
      <Line x1="14.25" y1="12.5" x2="13.75" y2="17" />
    </>
  ),
  // A book going out: the spine on the left, the arrow leaving to the right. `requests` used to be
  // this mirrored, until the bar needed the two to be tellable apart at a glance.
  loans: (
    <>
      <Rect x="3" y="4" width="9.5" height="16" rx="2" />
      <Line x1="6.25" y1="4" x2="6.25" y2="20" />
      <Line x1="15.5" y1="12" x2="21" y2="12" />
      <Polyline points="18.75 9.25 21.5 12 18.75 14.75" />
    </>
  ),
  // A tray with something dropping into it: books people have asked you for, arriving.
  //
  // It used to be `loans` mirrored — the same book, the arrow pointing in instead of out. That was
  // a tidy idea and a bad icon in the bar: `library`, `requests` and `ask` were all a rounded
  // rectangle with a line down it, and at 24px, eight pixels apart, you could not tell which was
  // which. A tray is wide and low where a book is tall, so the silhouette alone separates them.
  requests: (
    <>
      <Path d="M3.5 13.5h4l1.25 2.25h6.5L16.5 13.5h4v4a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <Line x1="12" y1="3.5" x2="12" y2="10.5" />
      <Polyline points="9.25 7.75 12 10.5 14.75 7.75" />
    </>
  ),
  // A viewfinder around a barcode: what you point at the back of a book.
  scan: (
    <>
      <Path d="M3 8.5V6a2 2 0 0 1 2-2h2.5" />
      <Path d="M16.5 4H19a2 2 0 0 1 2 2v2.5" />
      <Path d="M21 15.5V18a2 2 0 0 1-2 2h-2.5" />
      <Path d="M7.5 20H5a2 2 0 0 1-2-2v-2.5" />
      <Line x1="8.5" y1="9" x2="8.5" y2="15" />
      <Line x1="12" y1="9" x2="12" y2="15" />
      <Line x1="15.5" y1="9" x2="15.5" y2="15" />
    </>
  ),
  // The same viewfinder, around a whole shelf rather than one barcode.
  scanShelf: (
    <>
      <Path d="M3 8.5V6a2 2 0 0 1 2-2h2.5" />
      <Path d="M16.5 4H19a2 2 0 0 1 2 2v2.5" />
      <Path d="M21 15.5V18a2 2 0 0 1-2 2h-2.5" />
      <Path d="M7.5 20H5a2 2 0 0 1-2-2v-2.5" />
      <Line x1="8.5" y1="15" x2="8.5" y2="10" />
      <Line x1="12" y1="15" x2="12" y2="8.5" />
      <Line x1="15.5" y1="15" x2="15.5" y2="11" />
      <Line x1="7" y1="15.75" x2="17" y2="15.75" />
    </>
  ),
  // The spark on its own: something worth reading next, picked out of what you already own.
  //
  // It was a book with the spark tucked in the corner, which made it the third rounded rectangle
  // in a five-slot bar. The spark was always the part carrying the meaning — the book was just
  // saying "book" in a row where everything is about books — so the book went and the spark grew
  // into the space. The smaller second one keeps it from reading as a plain star.
  ask: (
    <>
      <Path d="M11 2.6a1 1 0 0 1 1.9 0l1.55 3.95 3.95 1.55a1 1 0 0 1 0 1.9l-3.95 1.55-1.55 3.95a1 1 0 0 1-1.9 0L9.5 11.55 5.55 10a1 1 0 0 1 0-1.9L9.5 6.55z" />
      <Path d="M18.05 15.4l.62 1.58 1.58.62-1.58.62-.62 1.58-.62-1.58-1.58-.62 1.58-.62z" />
    </>
  ),
  // The same book with a ribbon left partway down it: something you are in the middle of.
  reading: (
    <>
      <Rect x="4" y="3.5" width="12" height="17" rx="2" />
      <Line x1="7.25" y1="3.5" x2="7.25" y2="20.5" />
      <Polyline points="11 3.5 11 11.5 12.75 10 14.5 11.5 14.5 3.5" />
    </>
  ),
  edit: (
    <>
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  plus: (
    <>
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  // Exactly `plus` without its upright, so the two are the same width when stacked as a pair —
  // which is the only place either is used together, on the reading crown.
  minus: <Line x1="5" y1="12" x2="19" y2="12" />,
  eye: (
    <>
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  offline: <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  error: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="8" x2="12" y2="13" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  // A label hanging by its hole: the owner's tags, and the themes the catalog gives a book.
  //
  // Deliberately the conventional shape rather than one built from the brand mark's geometry. A tag
  // is a system shape people recognise without reading it, which the note at the top of this file
  // reserves for exactly this treatment. Its square corners need no arcs of their own either: every
  // icon here is drawn with strokeLinejoin="round", so they come out rounded like the rest.
  tag: (
    <>
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Circle cx="7.25" cy="7.25" r="1.25" />
    </>
  ),
  check: <Polyline points="20 6 9 17 4 12" />,
  star: <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  // Rounded shoulders, like the terminals on the logo, rather than the usual square ones.
  users: (
    <>
      <Circle cx="9.25" cy="7.75" r="3.25" />
      <Path d="M3.25 20a6 6 0 0 1 12 0" />
      <Path d="M16.5 5.4a3.25 3.25 0 0 1 0 6.2" />
      <Path d="M17.75 14.4A6 6 0 0 1 21 20" />
    </>
  ),
  bell: (
    <>
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  chevronRight: <Polyline points="9 18 15 12 9 6" />,
  stats: (
    <>
      <Line x1="18" y1="20" x2="18" y2="10" />
      <Line x1="12" y1="20" x2="12" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  clock: (
    <>
      <Path d="M12 8v4l3 3" />
      <Circle cx="12" cy="12" r="9" />
    </>
  ),
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  mail: (
    <>
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22,6 12,13 2,6" />
    </>
  ),
  phone: (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  lock: (
    <>
      <Rect x="3" y="11" width="18" height="11" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  smartphone: (
    <>
      <Rect x="5" y="2" width="14" height="20" rx="2" />
      <Line x1="12" y1="18" x2="12.01" y2="18" />
    </>
  ),
  monitor: (
    <>
      <Rect x="2" y="3" width="20" height="14" rx="2" />
      <Line x1="8" y1="21" x2="16" y2="21" />
      <Line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  card: (
    <>
      <Rect x="1" y="4" width="22" height="16" rx="2" />
      <Line x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  fileText: (
    <>
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  image: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polyline points="21 15 16 10 5 21" />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  logOut: (
    <>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </>
  )
} satisfies Record<string, ReactElement>;

// Solid versions, for selected states. Only the icons whose shapes read well as a silhouette have
// one; `filled` falls back to the outline for the rest, so nothing has to be drawn twice to be
// usable. Drawn with no stroke, so they keep the same visual weight as the outlines beside them.
const SOLID = {
  library: (
    <>
      <Rect x="4" y="7.5" width="4.25" height="12.5" rx="1.25" />
      <Rect x="9.25" y="5" width="4.25" height="15" rx="1.25" />
      <Rect x="14.75" y="7" width="4.25" height="13" rx="1.25" transform="rotate(17 16.875 20)" />
      <Rect x="2.5" y="20.5" width="19" height="1.5" rx="0.75" />
    </>
  ),
  loans: (
    <>
      <Path d="M5 3.25h5.5a2.75 2.75 0 0 1 2.75 2.75v12a2.75 2.75 0 0 1-2.75 2.75H5A2.75 2.75 0 0 1 2.25 18V6A2.75 2.75 0 0 1 5 3.25zm1.25 1.5v14.5h1.5V4.75z" />
      <Path d="M18.22 8.72a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1 0 1.06l-2.5 2.5a.75.75 0 1 1-1.06-1.06l1.22-1.22H15.5a.75.75 0 0 1 0-1.5h3.94L18.22 9.78a.75.75 0 0 1 0-1.06z" />
    </>
  ),
  // The tray filled, with the notch in its lip left open so the shape still reads as a tray and
  // not as a slab. Redrawn with the outline: a filled book here would no longer be the same icon.
  requests: (
    <>
      <Path d="M3.5 12.75h4a.75.75 0 0 1 .62.33l1.03 1.55h5.7l1.03-1.55a.75.75 0 0 1 .62-.33h4a.75.75 0 0 1 .75.75v4.25A3.25 3.25 0 0 1 18 21H6a3.25 3.25 0 0 1-3.25-3.25V13.5a.75.75 0 0 1 .75-.75z" />
      <Path d="M11.25 3.5a.75.75 0 0 1 1.5 0v5.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72z" />
    </>
  ),
  users: (
    <>
      <Circle cx="9.25" cy="7.75" r="3.25" />
      <Path d="M3.25 20a6 6 0 0 1 12 0z" />
      <Path d="M16.5 5.4a3.25 3.25 0 0 1 0 6.2z" />
      <Path d="M17.75 14.4A6 6 0 0 1 21 20h-3.25z" />
    </>
  ),
  star: <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  card: (
    <>
      <Path d="M3 4.5h18a2 2 0 0 1 2 2V9H1V6.5a2 2 0 0 1 2-2z" />
      <Path d="M1 10.5h22V18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" />
    </>
  ),
  stats: (
    <>
      <Rect x="16.75" y="9.5" width="2.5" height="11" rx="1.25" />
      <Rect x="10.75" y="3.5" width="2.5" height="17" rx="1.25" />
      <Rect x="4.75" y="13.5" width="2.5" height="7" rx="1.25" />
    </>
  ),
  // The basket filled, with the handle left as an open stroke-width gap so it still reads as a
  // handle rather than a lump. The old dashed-shelf `wanted` could not have one of these.
  wanted: (
    <>
      <Path d="M12 2.5a4.25 4.25 0 0 1 4.25 4.25V8.5h-1.5V6.75a2.75 2.75 0 0 0-5.5 0V8.5h-1.5V6.75A4.25 4.25 0 0 1 12 2.5z" />
      <Path d="M3.25 7.75h17.5a.75.75 0 0 1 .74.87l-1.6 10.1a3.25 3.25 0 0 1-3.21 2.78H7.32a3.25 3.25 0 0 1-3.21-2.78L2.51 8.62a.75.75 0 0 1 .74-.87zm6.13 4.63a.75.75 0 0 0-1.5.17l.5 4.5a.75.75 0 0 0 1.5-.16zm5.24 0-.5 4.51a.75.75 0 0 0 1.5.16l.5-4.5a.75.75 0 0 0-1.5-.17z" />
    </>
  )
} satisfies Partial<Record<IconName, ReactElement>>;

export type IconName = keyof typeof ICONS;

// A 2px stroke at 12px is twice the weight, relative to the icon, that it is at 24px. Scaling it
// keeps small icons from looking like blobs and large ones from looking like hairlines.
const opticalStroke = (size: number) => {
  if (size <= 16) return 1.5;
  if (size <= 24) return 1.75;
  return 2;
};

type IconProps = {
  name: IconName;
  color: ColorValue;
  size?: number;
  // Defaults to a weight chosen for the size; pass one only to override that deliberately.
  strokeWidth?: number;
  // Solid version, for selected states. Falls back to the outline where there isn't one.
  filled?: boolean;
  // Fills closed shapes of the outline drawing (e.g. a half-selected star).
  fill?: ColorValue;
};

export function Icon({ name, color, size = 24, strokeWidth, filled = false, fill = 'none' }: IconProps) {
  const solid = filled ? SOLID[name as keyof typeof SOLID] : undefined;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {solid ? (
        <G fill={color} stroke="none">
          {solid}
        </G>
      ) : (
        <G
          fill={fill}
          stroke={color}
          strokeWidth={strokeWidth ?? opticalStroke(size)}
          strokeLinecap="round"
          strokeLinejoin="round">
          {ICONS[name]}
        </G>
      )}
    </Svg>
  );
}
