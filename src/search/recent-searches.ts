import * as SecureStore from 'expo-secure-store';

// The last few questions someone asked their shelf, kept on the device and nowhere else.
//
// ON THE DEVICE ON PURPOSE. The value of a recents list is "do not make me type that again",
// which is entirely local; the only thing a server copy would add is sync across devices. Against
// that: what someone asks their own library is unusually personal — "books about grief", "queer
// sexuality" — and a server-side record of it is something that then has to be protected, deleted
// with the account, and included in a data export. Not worth it for a convenience.
//
// STORED IN SecureStore, which is the Keychain / Android Keystore, for a practical reason as much
// as a privacy one: it is the only persistent store already in this build. Adding AsyncStorage
// would add a native module, which changes the runtime version, which means a store release — a
// lot to pay for a list of strings. The privacy fit is a bonus rather than the argument.
const KEY = 'bookmack.recentSearches';

// Ten is what fits on screen without the list becoming its own scrolling problem.
const MAX_ENTRIES = 10;

// SecureStore's Android backing has a size limit in the low kilobytes, and a question is a
// sentence, not an essay. Long ones are kept but clipped, so one pasted paragraph cannot push the
// whole list over the edge and lose everyone's history.
const MAX_LENGTH = 120;

// Short enough to be a slip rather than a question.
const MIN_LENGTH = 2;

const read = async (): Promise<string[]> => {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX_ENTRIES);
};

/**
 * The saved questions, most recent first. Never throws: a recents list is a convenience, and a
 * corrupt or unreadable store should cost the reader nothing more than an empty list.
 */
export const loadRecentSearches = async (): Promise<string[]> => {
  try {
    return await read();
  } catch {
    return [];
  }
};

/**
 * Records a question and returns the new list.
 *
 * Matching is case-insensitive, so asking the same thing with a capital letter moves the existing
 * entry to the top rather than adding a near-duplicate beside it. The wording kept is the newest
 * one, because that is what the reader last chose to type.
 */
export const rememberSearch = async (question: string): Promise<string[]> => {
  const entry = question.trim().slice(0, MAX_LENGTH);
  if (entry.length < MIN_LENGTH) return loadRecentSearches();

  try {
    const existing = await read();
    const next = [entry, ...existing.filter((old) => old.toLowerCase() !== entry.toLowerCase())]
      .slice(0, MAX_ENTRIES);
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    return next;
  } catch {
    // Failing to save must not fail the search that just worked.
    return loadRecentSearches();
  }
};

/** Forgets everything. The reader must always be able to do this. */
export const clearRecentSearches = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing useful to do, and nothing depends on it having worked.
  }
};
