import { createContext, use } from 'react';

import type { ShelfStep } from '@/components/auth-shelf';

// Which part of the shelf's loop is playing, so the welcome screen's Add it / Lend it / Get it
// back can follow it. The shelf drives it from the layout; the screen only reads it — the two
// would otherwise each keep their own timer and drift apart within a cycle.
export const ShelfStepContext = createContext<ShelfStep>(-1);

export const useShelfStep = () => use(ShelfStepContext);
