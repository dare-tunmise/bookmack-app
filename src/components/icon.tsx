import type { ColorValue } from 'react-native';

// Imported one file at a time, not from the package root. Metro does not tree-shake the root
// barrel — importing from it pulls all ~1,500 icons, in six weights each, into the bundle, which
// was measured rather than assumed: `acorn` and `guitar` were both in the exported bundle. The
// package documents this exact form for bundlers that cannot shake the barrel. The two type
// imports below stay on the root because `import type` is erased and reaches no runtime module.
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BasketIcon } from 'phosphor-react-native/src/icons/Basket';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BooksIcon } from 'phosphor-react-native/src/icons/Books';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChartPieSliceIcon } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { EnvelopeIcon } from 'phosphor-react-native/src/icons/Envelope';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlashIcon } from 'phosphor-react-native/src/icons/EyeSlash';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { HandArrowUpIcon } from 'phosphor-react-native/src/icons/HandArrowUp';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { ListIcon } from 'phosphor-react-native/src/icons/List';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { MonitorIcon } from 'phosphor-react-native/src/icons/Monitor';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ScanIcon } from 'phosphor-react-native/src/icons/Scan';
import { ShuffleIcon } from 'phosphor-react-native/src/icons/Shuffle';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrayArrowDownIcon } from 'phosphor-react-native/src/icons/TrayArrowDown';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WifiSlashIcon } from 'phosphor-react-native/src/icons/WifiSlash';
import { XIcon } from 'phosphor-react-native/src/icons/X';

// Icons come from Phosphor. They were hand-drawn on a 24×24 grid until this file was replaced;
// the drawings were consistent but angular, and every selected state needed a second glyph drawn
// by hand. Phosphor ships six weights of each icon, so `regular` and `fill` give us the
// outline/solid pair for free across the whole set.
//
// This stays an adapter rather than letting the app import Phosphor directly: every call site
// keeps naming icons in BookMack's own vocabulary (`library`, `loans`, `wanted`), so what an icon
// *means* here is decided in one place, and swapping sets again later touches only this file.
const ICONS = {
  menu: ListIcon,
  search: MagnifyingGlassIcon,
  arrowLeft: ArrowLeftIcon,
  shuffle: ShuffleIcon,
  close: XIcon,
  // A shelf of books, one leaning — the closest thing in the set to the drawing it replaces.
  library: BooksIcon,
  // A basket, not a bookmark: books you mean to get, rather than books you have. The drawing this
  // replaced was deliberately a basket for the same reason — it reads as a different object from
  // the shelf at 13px, where the drawer and the wanted screen use it.
  wanted: BasketIcon,
  // A hand passing something away: a loan is a book that has left the shelf.
  loans: HandArrowUpIcon,
  // A tray with an arrow dropping into it. The arrow is the point — a request is incoming.
  requests: TrayArrowDownIcon,
  scan: ScanIcon,
  scanShelf: CameraIcon,
  ask: SparkleIcon,
  reading: BookOpenIcon,
  edit: PencilSimpleIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  eye: EyeIcon,
  eyeOff: EyeSlashIcon,
  offline: WifiSlashIcon,
  error: WarningCircleIcon,
  tag: TagIcon,
  check: CheckIcon,
  star: StarIcon,
  users: UsersIcon,
  bell: BellIcon,
  settings: GearIcon,
  chevronRight: CaretRightIcon,
  // A pie with one slice lifted clear — which is what the Stats screen leads with.
  stats: ChartPieSliceIcon,
  clock: ClockIcon,
  user: UserIcon,
  mail: EnvelopeIcon,
  phone: PhoneIcon,
  lock: LockIcon,
  smartphone: DeviceMobileIcon,
  monitor: MonitorIcon,
  card: CreditCardIcon,
  info: InfoIcon,
  fileText: FileTextIcon,
  image: ImageIcon,
  trash: TrashIcon,
  logOut: SignOutIcon
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

// Phosphor has no stroke width: the weight *is* the stroke. The old call sites asked for one of
// three things — heavier for emphasis at small sizes (a check inside a 14px chip), lighter for a
// quieter mark (an unrated star), or the 2px default — so each maps to the nearest weight rather
// than being dropped.
const weightFor = (filled: boolean, strokeWidth?: number): IconWeight => {
  if (filled) return 'fill';
  if (strokeWidth === undefined) return 'regular';
  if (strokeWidth >= 2.5) return 'bold';
  if (strokeWidth <= 1.5) return 'light';
  return 'regular';
};

type IconProps = {
  name: IconName;
  color: ColorValue;
  size?: number;
  // Kept so existing call sites read the same. It no longer sets a stroke width — it only chooses
  // between `regular` and `bold`. Pass it for emphasis, not for a precise weight.
  strokeWidth?: number;
  // Solid version, for selected states. Every icon in the set has one.
  filled?: boolean;
};

export function Icon({ name, color, size = 24, strokeWidth, filled = false }: IconProps) {
  const Glyph = ICONS[name];

  // Phosphor types `color` as a plain string. Every colour in the design system is a hex literal,
  // so this is safe; it is a cast rather than a conversion because `ColorValue` also admits the
  // opaque platform colours we never use.
  return <Glyph size={size} color={color as string} weight={weightFor(filled, strokeWidth)} />;
}
