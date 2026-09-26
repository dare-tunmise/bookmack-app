import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { AddBookSheet } from '@/components/add-book-sheet';
import { PickReadSheet } from '@/components/pick-read-sheet';

// The two things the bottom bar opens that are not destinations: adding a book, and asking what
// to read next.
//
// They live here rather than on the library screen because the bar is on every section. Reaching
// for "+" from Loans has to work, and a sheet cannot be owned by a screen that is not mounted.
type AppActions = {
  openAdd: () => void;
  openPickRead: () => void;
  // Bumped when something opened from the bar changes what is on the shelf. The library screen
  // reloads on focus, but starting a book from the bar happens while that screen is already on
  // top, so there is no focus change to hang a reload on.
  libraryVersion: number;
};

const Context = createContext<AppActions>({
  openAdd: () => {},
  openPickRead: () => {},
  libraryVersion: 0
});

export const useAppActions = () => useContext(Context);

export function AppActionsProvider({ children }: PropsWithChildren) {
  const [addOpen, setAddOpen] = useState(false);
  const [pickReadOpen, setPickReadOpen] = useState(false);
  const [libraryVersion, setLibraryVersion] = useState(0);

  const openAdd = useCallback(() => setAddOpen(true), []);
  const openPickRead = useCallback(() => setPickReadOpen(true), []);

  const value = useMemo(
    () => ({ openAdd, openPickRead, libraryVersion }),
    [openAdd, openPickRead, libraryVersion]
  );

  return (
    <Context.Provider value={value}>
      {children}

      <AddBookSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <PickReadSheet
        visible={pickReadOpen}
        onClose={() => setPickReadOpen(false)}
        onStarted={() => setLibraryVersion((version) => version + 1)}
      />
    </Context.Provider>
  );
}
