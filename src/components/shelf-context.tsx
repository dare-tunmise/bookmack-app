import { createContext, use } from 'react';

import type { ShelfStep } from '@/components/auth-shelf';

// Which part of the shelf's loop is playing, so the welcome screen's Add it / Lend it / Get it
// back can follow it. The shelf drives it from the layout; screens only read it — the two would
// otherwise each keep their own timer and drift apart within a cycle.
export const ShelfStepContext = createContext<ShelfStep>(-1);
export const useShelfStep = () => use(ShelfStepContext);

// A screen asking the shelf to come back to full size and give a hop. Only one moment uses it —
// the account being ready — and it is a request rather than a second shelf, because there is only
// ever one shelf.
export const ShelfCelebrateContext = createContext<(on: boolean) => void>(() => {});
export const useShelfCelebrate = () => use(ShelfCelebrateContext);
