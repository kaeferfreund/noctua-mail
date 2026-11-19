"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList } from "react";
import type { AccountRole, SenderIdentity } from "@/lib/data";
import type { ContactList, EmailTemplateSummary } from "@/lib/addons/outreach/types";
import type { OutreachApi } from "./outreachApi";
import type { OutreachLocation } from "./location";

export { OUTREACH_SECTIONS, type OutreachLocation, type OutreachSection } from "./location";

export type OutreachManageContextValue = {
  api: OutreachApi;
  accountId: string;
  role: AccountRole;
  /** editor and manager: contacts, lists, templates, drafts, sending. */
  canEdit: boolean;
  /** manager: consent-independent suppression. */
  isManager: boolean;
  navigate: (location: OutreachLocation) => void;
  /** Registers unsaved changes of one editor; navigation inside the area asks before dropping them. */
  setDirty: (key: string, dirty: boolean) => void;
  lists: SharedResource<ContactList[]>;
  templates: SharedResource<EmailTemplateSummary[]>;
  identities: SharedResource<SenderIdentity[]>;
};

export const OutreachManageContext = createContext<OutreachManageContextValue | null>(null);

export function useOutreachManage() {
  const value = useContext(OutreachManageContext);
  if (!value) throw new Error("useOutreachManage outside OutreachManage");
  return value;
}

export type Resource<T> = { data: T | null; error: unknown; loading: boolean; reload: () => Promise<void> };

/** Loads once per change of `deps`; the newest request wins, older answers are dropped. */
export function useResource<T>(load: () => Promise<T>, deps: DependencyList): Resource<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const generation = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try {
      const data = await loadRef.current();
      if (current === generation.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (current === generation.current) setState(previous => ({ data: previous.data, error, loading: false }));
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's dependency list for `load`.
  useEffect(() => { void reload(); }, deps);
  useEffect(() => () => { generation.current++; }, []);
  return { ...state, reload };
}

/**
 * A first page plus "load more": later pages are appended in the click handler and belong to
 * the first page they continued; a reload of the first page drops them.
 */
export function usePagedResource<R, T, C>(
  load: (cursor: C | null) => Promise<R>,
  pageOf: (page: R) => { items: T[]; next: C | null },
  deps: DependencyList
) {
  const first = useResource(() => load(null), deps);
  const [more, setMore] = useState<{ base: R; items: T[]; next: C | null } | null>(null);
  const [moreState, setMoreState] = useState<{ loading: boolean; error: unknown }>({ loading: false, error: null });
  const extra = more && first.data !== null && more.base === first.data ? more : null;
  const items = first.data === null ? [] : [...pageOf(first.data).items, ...(extra?.items ?? [])];
  const next = extra ? extra.next : first.data === null ? null : pageOf(first.data).next;
  const loadMore = async () => {
    const base = first.data;
    if (base === null || next === null) return;
    setMoreState({ loading: true, error: null });
    try {
      const page = pageOf(await load(next));
      setMore(previous => ({ base, items: [...(previous && previous.base === base ? previous.items : []), ...page.items], next: page.next }));
      setMoreState({ loading: false, error: null });
    } catch (error) { setMoreState({ loading: false, error }); }
  };
  return { first, items, next, loadMore, loadingMore: moreState.loading, error: first.error ?? moreState.error };
}

/** A resource the whole area shares (lists, templates, sender identities): loaded on first use. */
export type SharedResource<T> = Resource<T> & { ensure: () => void };

export function useSharedResource<T>(load: () => Promise<T>, key: string): SharedResource<T> {
  const [wanted, setWanted] = useState(false);
  const resource = useResource<T | null>(() => wanted ? load() : Promise.resolve(null), [wanted, key]);
  const ensure = useCallback(() => setWanted(true), []);
  return { ...resource, data: resource.data as T | null, loading: !wanted || resource.loading, ensure };
}

/**
 * Marks an editor's unsaved state; also warns before the browser leaves the page. Returns
 * `markClean` for editors that navigate right after a save, before their next render.
 */
export function useUnsavedChanges(key: string, dirty: boolean) {
  const { setDirty } = useOutreachManage();
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [dirty, key, setDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return useCallback(() => setDirty(key, false), [key, setDirty]);
}
