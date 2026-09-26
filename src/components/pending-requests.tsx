import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { api } from '@/api/client';

// How many borrow requests are still waiting on you, shared between the drawer badge and the
// requests screen.
//
// Why a context rather than each screen fetching: the drawer mounts once and only re-renders when
// navigation state changes, so the common flow (open drawer, tap Requests, approve, reopen drawer)
// would leave the badge stale at exactly the moment you look at it. Deciding a request tells the
// count directly instead, so it is right before the drawer reopens.
//
// useDrawerStatus would be the other way to trigger a refresh, but @react-navigation/drawer is
// only a transitive dependency here and importing it directly would be relying on something this
// package never declared.

// Counting past this is not worth a second request: the badge says "20+" and means "a lot".
const COUNT_LIMIT = 20;

type PendingRequests = {
  count: number;
  // True when there are more than COUNT_LIMIT, so the badge can say so honestly.
  more: boolean;
  refresh: () => void;
  // Called when a request is answered, so the badge drops without waiting for a round trip.
  decrement: () => void;
};

const Context = createContext<PendingRequests>({
  count: 0,
  more: false,
  refresh: () => {},
  decrement: () => {}
});

export const usePendingRequests = () => useContext(Context);

export function PendingRequestsProvider({ children }: PropsWithChildren) {
  const [count, setCount] = useState(0);
  const [more, setMore] = useState(false);

  const refresh = useCallback(() => {
    let cancelled = false;
    api
      .GET('/requests', { params: { query: { status: 'pending', limit: COUNT_LIMIT } } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCount(data.data.length);
        setMore(Boolean(data.meta.nextCursor));
      })
      // A badge is not worth surfacing an error for; the requests screen reports its own.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refresh(), [refresh]);

  const decrement = useCallback(() => {
    setCount((current) => Math.max(0, current - 1));
  }, []);

  const value = useMemo(() => ({ count, more, refresh, decrement }), [count, more, refresh, decrement]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
