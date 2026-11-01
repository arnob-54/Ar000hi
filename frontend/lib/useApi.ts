"use client";

// Small data-fetching hook that cancels in-flight requests on unmount/param
// change. This is the AbortController half of the old "fetch in useEffect"
// pattern: a stale response can no longer overwrite newer state after a quick
// navigation or under React strict-mode double mounting.

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/client";

export interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(
  path: string | null,
  deps: readonly unknown[] = [],
  options: { enabled?: boolean; initialData?: T | null } = {}
): UseApiResult<T> {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(Boolean(path && enabled));
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path || !enabled) {
      return;
    }
    const controller = new AbortController();

    apiFetch<T>(path, { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted || !mounted.current) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || !mounted.current) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (controller.signal.aborted || !mounted.current) return;
        setLoading(false);
      });

    return () => controller.abort();
    // `deps` is intentionally spread: callers pass URL parameters so a change
    // refetches. The path itself is also a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, version, ...deps]);

  const reload = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);

  return { data, error, loading, reload };
}
