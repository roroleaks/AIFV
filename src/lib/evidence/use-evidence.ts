import { useCallback, useEffect, useMemo, useState } from "react";

import { evidenceLibrary, type EvidenceEntry } from "./library";
import { logHistory, readEvidenceState, writeEvidenceState, type EvidenceUserState } from "./store";

const defaultState: EvidenceUserState = {
  favorites: [],
  archived: [],
  notes: {},
  imported: [],
  history: [],
};

/** Shared client-side Evidence Manager state (favorites, notes, imports). */
export function useEvidenceManager() {
  const [state, setState] = useState<EvidenceUserState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readEvidenceState());
    setHydrated(true);
  }, []);

  const update = useCallback((next: EvidenceUserState) => {
    setState(next);
    writeEvidenceState(next);
  }, []);

  const library = useMemo<EvidenceEntry[]>(
    () => [...evidenceLibrary, ...(state.imported ?? [])],
    [state.imported],
  );

  const toggleFavorite = useCallback(
    (entry: EvidenceEntry) => {
      const favs = state.favorites ?? [];
      const on = favs.includes(entry.id);
      const favorites = on ? favs.filter((id) => id !== entry.id) : [...favs, entry.id];
      update(logHistory({ ...state, favorites }, on ? "unfavorited" : "favorited", entry));
    },
    [state, update],
  );

  const toggleArchived = useCallback(
    (entry: EvidenceEntry) => {
      const arch = state.archived ?? [];
      const on = arch.includes(entry.id);
      const archived = on ? arch.filter((id) => id !== entry.id) : [...arch, entry.id];
      update(logHistory({ ...state, archived }, on ? "restored" : "archived", entry));
    },
    [state, update],
  );

  const setNote = useCallback(
    (entry: EvidenceEntry, note: string) => {
      const notes = { ...(state.notes ?? {}), [entry.id]: note };
      update({ ...state, notes });
    },
    [state, update],
  );

  const commitNote = useCallback(
    (entry: EvidenceEntry) => {
      update(logHistory(state, "note-updated", entry));
    },
    [state, update],
  );

  const importEntry = useCallback(
    (entry: EvidenceEntry) => {
      const imp = state.imported ?? [];
      update(logHistory({ ...state, imported: [entry, ...imp] }, "imported", entry));
    },
    [state, update],
  );

  return {
    state,
    hydrated,
    library,
    toggleFavorite,
    toggleArchived,
    setNote,
    commitNote,
    importEntry,
    isFavorite: (id: string) => (state.favorites ?? []).includes(id),
    isArchived: (id: string) => (state.archived ?? []).includes(id),
  };
}
