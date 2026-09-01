import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, Settings } from './types';
import { clearStorage, loadState, saveNow, saveState } from './services/storage';
import {
  emptyProgress,
  emptyState,
  migrate,
  recordAnswer,
  type RecordInput,
} from './services/progress';
import { checkAchievements } from './services/achievements';

export interface SceneMark {
  completed?: boolean;
  replay?: boolean;
  score?: number;
  hiddenEnglish?: boolean;
  listening?: boolean;
}

interface StoreValue {
  state: AppState;
  ready: boolean;
  record: (input: RecordInput) => void;
  recordMany: (inputs: RecordInput[]) => void;
  update: (fn: (s: AppState) => AppState) => void;
  setSettings: (patch: Partial<Settings>) => void;
  toggleStar: (id: number) => void;
  setNote: (id: number, note: string) => void;
  setAudio: (patch: Partial<Settings['audio']>) => void;
  setCaptions: (patch: Partial<Settings['captions']>) => void;
  markScene: (kind: 'stories' | 'conversations', id: string, how: SceneMark) => void;
  toggleSaved: (kind: 'stories' | 'conversations' | 'lines', id: string) => void;
  setList: (name: string, ids: number[]) => void;
  addToList: (name: string, id: number) => void;
  removeFromList: (name: string, id: number) => void;
  deleteList: (name: string) => void;
  resetWord: (id: number) => void;
  resetPack: (ids: number[]) => void;
  resetStats: () => void;
  resetAll: () => Promise<void>;
  exportJson: () => string;
  importJson: (raw: string) => { ok: boolean; message: string };
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Only ever write state the learner actually changed. Without this guard a
  // slow or failed read on startup would immediately overwrite good data with
  // the empty default.
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadState().then(({ state: loaded }) => {
      if (cancelled) return;
      if (loaded) setState(migrate(loaded));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && dirtyRef.current) saveState(state);
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    dirtyRef.current = true;
    setState((prev) => checkAchievements(fn(prev)));
  }, []);

  const record = useCallback(
    (input: RecordInput) => {
      update((s) => recordAnswer(s, input));
    },
    [update],
  );

  const recordMany = useCallback(
    (inputs: RecordInput[]) => {
      update((s) => inputs.reduce((acc, i) => recordAnswer(acc, i), s));
    },
    [update],
  );

  const setSettings = useCallback(
    (patch: Partial<Settings>) => {
      update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    [update],
  );

  const toggleStar = useCallback(
    (id: number) => {
      update((s) => {
        const p = s.progress[id] ?? emptyProgress(id);
        return { ...s, progress: { ...s.progress, [id]: { ...p, starred: !p.starred } } };
      });
    },
    [update],
  );

  const setNote = useCallback(
    (id: number, note: string) => {
      update((s) => {
        const p = s.progress[id] ?? emptyProgress(id);
        return { ...s, progress: { ...s.progress, [id]: { ...p, note } } };
      });
    },
    [update],
  );

  const setAudio = useCallback(
    (patch: Partial<Settings['audio']>) => {
      update((s) => ({ ...s, settings: { ...s.settings, audio: { ...s.settings.audio, ...patch } } }));
    },
    [update],
  );

  const setCaptions = useCallback(
    (patch: Partial<Settings['captions']>) => {
      update((s) => ({
        ...s,
        settings: { ...s.settings, captions: { ...s.settings.captions, ...patch } },
      }));
    },
    [update],
  );

  const markScene = useCallback(
    (kind: 'stories' | 'conversations', id: string, how: SceneMark) => {
      update((s) => {
        const cur = s[kind];
        const add = (list: string[], on: boolean | undefined) =>
          on && !list.includes(id) ? [...list, id] : list;
        return {
          ...s,
          [kind]: {
            completed: add(cur.completed, how.completed),
            replays: how.replay ? { ...cur.replays, [id]: (cur.replays[id] ?? 0) + 1 } : cur.replays,
            scores: how.score !== undefined ? { ...cur.scores, [id]: how.score } : cur.scores,
            hiddenEnglish: add(cur.hiddenEnglish, how.hiddenEnglish),
            listening: add(cur.listening, how.listening),
          },
        };
      });
    },
    [update],
  );

  const toggleSaved = useCallback(
    (kind: 'stories' | 'conversations' | 'lines', id: string) => {
      update((s) => {
        const list = s.saved[kind];
        return {
          ...s,
          saved: {
            ...s.saved,
            [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
          },
        };
      });
    },
    [update],
  );

  const setList = useCallback(
    (name: string, ids: number[]) => {
      update((s) => ({ ...s, customLists: { ...s.customLists, [name]: ids } }));
    },
    [update],
  );

  const addToList = useCallback(
    (name: string, id: number) => {
      update((s) => {
        const cur = s.customLists[name] ?? [];
        if (cur.includes(id)) return s;
        return { ...s, customLists: { ...s.customLists, [name]: [...cur, id] } };
      });
    },
    [update],
  );

  const removeFromList = useCallback(
    (name: string, id: number) => {
      update((s) => {
        const cur = s.customLists[name] ?? [];
        return { ...s, customLists: { ...s.customLists, [name]: cur.filter((x) => x !== id) } };
      });
    },
    [update],
  );

  const deleteList = useCallback(
    (name: string) => {
      update((s) => {
        const next = { ...s.customLists };
        delete next[name];
        return { ...s, customLists: next };
      });
    },
    [update],
  );

  const resetWord = useCallback(
    (id: number) => {
      update((s) => {
        const next = { ...s.progress };
        delete next[id];
        return { ...s, progress: next, attempts: s.attempts.filter((a) => a.wordId !== id) };
      });
    },
    [update],
  );

  const resetPack = useCallback(
    (ids: number[]) => {
      update((s) => {
        const next = { ...s.progress };
        for (const id of ids) delete next[id];
        const set = new Set(ids);
        return { ...s, progress: next, attempts: s.attempts.filter((a) => !set.has(a.wordId)) };
      });
    },
    [update],
  );

  const resetStats = useCallback(() => {
    update((s) => ({ ...s, attempts: [], days: {}, bossScores: {}, confusionLosses: {} }));
  }, [update]);

  const resetAll = useCallback(async () => {
    const fresh = emptyState();
    dirtyRef.current = true;
    setState(fresh);
    await clearStorage();
    await saveNow(fresh);
  }, []);

  const exportJson = useCallback(
    () => JSON.stringify({ ...stateRef.current, exportedAt: new Date().toISOString() }, null, 2),
    [],
  );

  const importJson = useCallback((rawText: string) => {
    try {
      const parsed = JSON.parse(rawText) as AppState;
      if (!parsed || typeof parsed !== 'object' || !('progress' in parsed)) {
        return { ok: false, message: 'That file does not look like a Learn HSK 3 backup.' };
      }
      const migrated = migrate(parsed);
      dirtyRef.current = true;
      setState(migrated);
      void saveNow(migrated);
      const n = Object.keys(migrated.progress).length;
      return { ok: true, message: `Imported progress for ${n} words.` };
    } catch (err) {
      return { ok: false, message: `Could not read that file: ${(err as Error).message}` };
    }
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      ready,
      record,
      recordMany,
      update,
      setSettings,
      toggleStar,
      setNote,
      setAudio,
      setCaptions,
      markScene,
      toggleSaved,
      setList,
      addToList,
      removeFromList,
      deleteList,
      resetWord,
      resetPack,
      resetStats,
      resetAll,
      exportJson,
      importJson,
    }),
    [
      state,
      ready,
      record,
      recordMany,
      update,
      setSettings,
      toggleStar,
      setNote,
      setAudio,
      setCaptions,
      markScene,
      toggleSaved,
      setList,
      addToList,
      removeFromList,
      deleteList,
      resetWord,
      resetPack,
      resetStats,
      resetAll,
      exportJson,
      importJson,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
